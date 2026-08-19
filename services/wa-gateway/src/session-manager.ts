import { promises as fs } from 'node:fs'
import path from 'node:path'
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessage,
  type WAMessageKey,
  type WASocket,
} from 'baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import { config } from './config.js'
import { emitWebhook } from './webhook-emitter.js'
import { jidToPhone, translateInbound } from './translate-inbound.js'
import {
  phoneToJid,
  translateOutbound,
  type SendPayload,
} from './translate-outbound.js'
import {
  clearOrgState,
  flushState,
  lookupMessageKey,
  rememberMessageKey,
  setPendingPrompt,
} from './store.js'
import { clearOrgMedia } from './media-store.js'

/**
 * One WhatsApp Web socket per org, kept alive for the life of the process.
 *
 * This is the whole reason the gateway exists as a separate service: the
 * connection is stateful, long-lived and single-instance. It cannot live
 * in a Next.js route handler, and it does not survive being replicated.
 * Scaling past a handful of pilot orgs would mean sharding by org — which
 * is a problem we intend never to have.
 */

const logger = pino({ level: config.logLevel })

export type SessionState =
  | 'pairing'
  | 'connected'
  | 'disconnected'
  | 'logged_out'

export interface SessionSnapshot {
  state: SessionState
  phoneNumber: string | null
  qr: string | null
  pairingCode: string | null
  lastError: string | null
}

/** Reconnect backoff, capped. Index is the consecutive-failure count. */
const BACKOFF_MS = [1_000, 3_000, 10_000, 30_000, 60_000]

class Session {
  readonly orgId: string
  sock: WASocket | null = null
  state: SessionState = 'disconnected'
  phoneNumber: string | null = null
  qr: string | null = null
  pairingCode: string | null = null
  lastError: string | null = null

  /** Set while a pairing-code request is pending for this number. */
  private pairingPhone: string | undefined
  private failures = 0
  private closing = false
  private reconnectTimer: NodeJS.Timeout | null = null
  /** Resolvers waiting for the socket to produce a QR / code / connection. */
  private waiters: Array<() => void> = []

  constructor(orgId: string) {
    this.orgId = orgId
  }

  private authDir(): string {
    return path.join(config.dataDir, 'auth', this.orgId)
  }

  snapshot(): SessionSnapshot {
    return {
      state: this.state,
      phoneNumber: this.phoneNumber,
      qr: this.qr,
      pairingCode: this.pairingCode,
      lastError: this.lastError,
    }
  }

  private notifyWaiters(): void {
    const waiters = this.waiters
    this.waiters = []
    for (const resolve of waiters) resolve()
  }

  /** Resolve as soon as the session reaches a state worth reporting. */
  private waitForProgress(timeoutMs: number): Promise<void> {
    if (this.state === 'connected' || this.qr || this.pairingCode) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== onProgress)
        resolve()
      }, timeoutMs)
      const onProgress = () => {
        clearTimeout(timer)
        resolve()
      }
      this.waiters.push(onProgress)
    })
  }

  async connect(phoneNumber?: string): Promise<SessionSnapshot> {
    // Already online: pairing again would tear down a working socket.
    if (this.state === 'connected' && this.sock) return this.snapshot()

    this.pairingPhone = phoneNumber
    this.closing = false

    if (!this.sock) {
      await this.openSocket()
    }

    await this.waitForProgress(40_000)
    return this.snapshot()
  }

  private async openSocket(): Promise<void> {
    await fs.mkdir(this.authDir(), { recursive: true })
    const { state: authState, saveCreds } = await useMultiFileAuthState(
      this.authDir(),
    )
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: authState,
      logger,
      // The gateway is a background service; announcing "online" would
      // mark the operator's real WhatsApp as active and suppress their
      // phone notifications.
      markOnlineOnConnect: false,
      browser: ['wacrm-pilot', 'Chrome', '1.0.0'],
    })

    this.sock = sock
    this.state = authState.creds.registered ? 'disconnected' : 'pairing'

    sock.ev.on('creds.update', saveCreds)

    // Pairing-code mode: ask for the 8-character code instead of a QR.
    // Only valid before the session has ever registered.
    if (this.pairingPhone && !sock.authState.creds.registered) {
      try {
        const code = await sock.requestPairingCode(this.pairingPhone)
        this.pairingCode = code
        this.state = 'pairing'
        this.notifyWaiters()
      } catch (err) {
        this.lastError = `Pairing code request failed: ${
          err instanceof Error ? err.message : String(err)
        }`
        logger.error({ orgId: this.orgId, err }, 'pairing code request failed')
      }
    }

    sock.ev.on('connection.update', (update) => {
      void this.onConnectionUpdate(update)
    })

    sock.ev.on('messages.upsert', (event) => {
      // 'notify' is live traffic. 'append' is history sync replay, which
      // would re-ingest months of old conversations into the inbox on
      // every fresh pairing.
      if (event.type !== 'notify') return
      for (const message of event.messages) {
        void this.onInboundMessage(message)
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async onConnectionUpdate(update: any): Promise<void> {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      // Data URL so the admin caller can render it directly.
      this.qr = await QRCode.toDataURL(qr as string)
      this.state = 'pairing'
      this.notifyWaiters()
    }

    if (connection === 'open') {
      this.state = 'connected'
      this.qr = null
      this.pairingCode = null
      this.lastError = null
      this.failures = 0
      const selfId = this.sock?.user?.id
      if (selfId) this.phoneNumber = jidToPhone(selfId)
      logger.info(
        { orgId: this.orgId, phoneNumber: this.phoneNumber },
        'session connected',
      )
      this.notifyWaiters()
      return
    }

    if (connection !== 'close') return

    const statusCode = lastDisconnect?.error?.output?.statusCode
    this.sock = null

    if (statusCode === DisconnectReason.loggedOut) {
      // WhatsApp invalidated the credentials — unpaired from the handset,
      // or the number was banned. Reconnecting in a loop with dead creds
      // is exactly the behaviour that escalates a ban, so stop.
      this.state = 'logged_out'
      this.lastError =
        'WhatsApp ended the session (logged out, unpaired, or the number was banned). Re-pair to continue.'
      logger.warn({ orgId: this.orgId }, 'session logged out')
      this.notifyWaiters()
      return
    }

    if (this.closing) {
      this.state = 'disconnected'
      return
    }

    this.state = 'disconnected'
    this.lastError = lastDisconnect?.error?.message ?? 'connection closed'

    const delay = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)]!
    this.failures++
    logger.warn(
      { orgId: this.orgId, statusCode, delay },
      'session closed, scheduling reconnect',
    )

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.openSocket().catch((err) => {
        this.lastError = err instanceof Error ? err.message : String(err)
        logger.error({ orgId: this.orgId, err }, 'reconnect failed')
      })
    }, delay)
  }

  private async onInboundMessage(message: WAMessage): Promise<void> {
    try {
      if (message.key.id && message.key.remoteJid) {
        await rememberMessageKey(this.orgId, {
          remoteJid: message.key.remoteJid,
          id: message.key.id,
          fromMe: Boolean(message.key.fromMe),
          ...(message.participant ? { participant: message.participant } : {}),
        })
      }

      if (!this.phoneNumber) {
        logger.warn(
          { orgId: this.orgId },
          'inbound message before the paired number is known; dropping',
        )
        return
      }

      const body = await translateInbound(
        this.orgId,
        this.phoneNumber,
        message,
        {
          downloadMedia: (m) =>
            downloadMediaMessage(
              m,
              'buffer',
              {},
              { logger, reuploadRequest: this.sock!.updateMediaMessage },
            ) as Promise<Buffer>,
        },
      )

      if (body) await emitWebhook(body)
    } catch (err) {
      logger.error(
        { orgId: this.orgId, err, messageId: message.key.id },
        'failed to process inbound message',
      )
    }
  }

  async send(payload: SendPayload): Promise<{ messageId: string }> {
    if (!this.sock || this.state !== 'connected') {
      throw new Error(
        `Session for org ${this.orgId} is "${this.state}"${
          this.lastError ? ` — ${this.lastError}` : ''
        }`,
      )
    }

    const jid = phoneToJid(payload.to)

    // Reactions address the target by full key; replies quote it. Both
    // need the id → key lookup the CRM cannot provide.
    const targetId =
      payload.kind === 'reaction'
        ? payload.targetMessageId
        : payload.contextMessageId
    let quotedKey: WAMessageKey | null = null
    if (targetId) {
      const stored = await lookupMessageKey(this.orgId, targetId)
      if (stored) {
        quotedKey = {
          remoteJid: stored.remoteJid,
          id: stored.id,
          fromMe: stored.fromMe,
          ...(stored.participant ? { participant: stored.participant } : {}),
        }
      } else if (payload.kind !== 'reaction') {
        // A missing quote target is cosmetic — send unquoted rather than
        // dropping the agent's message.
        logger.warn(
          { orgId: this.orgId, targetId },
          'no stored key for quoted message; sending without context',
        )
      }
    }

    const { content, options, promptOptions } = translateOutbound(
      payload,
      quotedKey,
    )

    const sent = await this.sock.sendMessage(jid, content, options)
    const messageId = sent?.key?.id
    if (!messageId) {
      throw new Error('WhatsApp accepted the message but returned no id')
    }

    await rememberMessageKey(this.orgId, {
      remoteJid: jid,
      id: messageId,
      fromMe: true,
    })

    // Arm the numbered-menu mapping only after the send succeeded — a
    // prompt armed for a message that never left would swallow the
    // customer's next unrelated reply.
    if (promptOptions?.length) {
      await setPendingPrompt(this.orgId, jid, {
        options: promptOptions,
        promptMessageId: messageId,
        at: Date.now(),
      })
    }

    return { messageId }
  }

  async logout(): Promise<void> {
    this.closing = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    try {
      await this.sock?.logout()
    } catch (err) {
      // Already gone on WhatsApp's side is the outcome we wanted.
      logger.warn({ orgId: this.orgId, err }, 'logout call failed; continuing')
    }
    this.sock = null
    this.state = 'logged_out'
    this.qr = null
    this.pairingCode = null
    await fs.rm(this.authDir(), { recursive: true, force: true })
    await clearOrgState(this.orgId)
    await clearOrgMedia(this.orgId)
  }

  async shutdown(): Promise<void> {
    this.closing = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    await flushState(this.orgId)
    try {
      this.sock?.end(undefined)
    } catch {
      // Best effort on the way out.
    }
  }
}

const sessions = new Map<string, Session>()

function sessionFor(orgId: string): Session {
  let session = sessions.get(orgId)
  if (!session) {
    session = new Session(orgId)
    sessions.set(orgId, session)
  }
  return session
}

export function connect(
  orgId: string,
  phoneNumber?: string,
): Promise<SessionSnapshot> {
  return sessionFor(orgId).connect(phoneNumber)
}

export function snapshot(orgId: string): SessionSnapshot {
  const session = sessions.get(orgId)
  return (
    session?.snapshot() ?? {
      state: 'disconnected',
      phoneNumber: null,
      qr: null,
      pairingCode: null,
      lastError: 'No session has been started for this organization.',
    }
  )
}

export function send(
  orgId: string,
  payload: SendPayload,
): Promise<{ messageId: string }> {
  const session = sessions.get(orgId)
  if (!session) {
    throw new Error(`No session for org ${orgId}. Pair the number first.`)
  }
  return session.send(payload)
}

export async function logout(orgId: string): Promise<void> {
  const session = sessions.get(orgId)
  if (!session) return
  await session.logout()
  sessions.delete(orgId)
}

/**
 * Re-open every session that has credentials on disk.
 *
 * Without this a container restart would silently take every paired
 * number offline until someone noticed and re-paired by hand — the kind
 * of failure that shows up mid-demo.
 */
export async function restoreSessions(): Promise<void> {
  const authRoot = path.join(config.dataDir, 'auth')
  let entries: string[]
  try {
    entries = await fs.readdir(authRoot)
  } catch {
    return
  }

  for (const orgId of entries) {
    try {
      const creds = path.join(authRoot, orgId, 'creds.json')
      await fs.access(creds)
      logger.info({ orgId }, 'restoring session')
      // Not awaited as a batch: one slow handshake must not hold up the
      // rest, and the HTTP server should come up immediately either way.
      void sessionFor(orgId)
        .connect()
        .catch((err) => logger.error({ orgId, err }, 'restore failed'))
    } catch {
      // Directory without creds.json — an abandoned pairing attempt.
    }
  }
}

export async function shutdownAll(): Promise<void> {
  await Promise.all([...sessions.values()].map((s) => s.shutdown()))
}
