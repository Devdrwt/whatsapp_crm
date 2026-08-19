/**
 * HTTP client for the `wa-gateway` side-car (pilot transport).
 *
 * INTERNAL PILOT ONLY. The gateway drives an unofficial WhatsApp Web
 * connection (Baileys). It exists so we can run demos and end-to-end
 * tests without provisioning a WABA — it is not a product, must not
 * appear in pricing or client onboarding, and can get the paired number
 * banned. See docs/pilote-baileys.md.
 *
 * Why a side-car at all: Baileys holds one long-lived WebSocket per
 * paired number, with in-memory Signal session state. A Next.js route
 * handler is the wrong shape for that — it has no lifetime between
 * requests and gets replicated per instance. So the socket lives in a
 * separate always-on Node process and the app talks to it over plain
 * HTTP, which keeps the app's provider interface identical in shape to
 * the Meta one.
 *
 * The gateway is trusted to the same degree as the Meta API: it is
 * reachable only on the internal Docker network and every call carries a
 * bearer token.
 */

const DEFAULT_TIMEOUT_MS = 30_000

export interface GatewaySessionState {
  /**
   * `pairing`      — socket up, waiting for the operator to scan the QR
   *                  (or enter the pairing code) on the handset.
   * `connected`    — paired and online; sends will work.
   * `disconnected` — credentials exist but the socket is down; the
   *                  gateway is retrying with backoff.
   * `logged_out`   — WhatsApp invalidated the session (unpaired from the
   *                  phone, or banned). Requires a fresh pairing.
   */
  state: 'pairing' | 'connected' | 'disconnected' | 'logged_out'
  /** E.164 without a leading plus, once known. Mirrors `whatsapp_config.phone_number_id`. */
  phoneNumber: string | null
  /** PNG data URL, present only while `state === 'pairing'`. */
  qr: string | null
  /** 8-character code to type on the handset, alternative to the QR. */
  pairingCode: string | null
  lastError: string | null
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

function gatewayBaseUrl(): string {
  const url = process.env.WA_GATEWAY_URL
  if (!url) {
    throw new GatewayError(
      'WA_GATEWAY_URL is not set — the Baileys pilot gateway is not configured for this deployment.',
      503,
    )
  }
  return url.replace(/\/+$/, '')
}

function gatewayToken(): string {
  const token = process.env.WA_GATEWAY_TOKEN
  if (!token) {
    throw new GatewayError(
      'WA_GATEWAY_TOKEN is not set — refusing to call the gateway unauthenticated.',
      503,
    )
  }
  return token
}

interface GatewayRequestOptions {
  method?: string
  body?: unknown
  timeoutMs?: number
}

async function gatewayFetch(
  path: string,
  options: GatewayRequestOptions = {},
): Promise<Response> {
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  // The gateway can be mid-reconnect and hold a request open; without an
  // explicit abort a stuck socket would pin a Next.js request until the
  // platform timeout, which reads to the operator as "the CRM is down".
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${gatewayBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${gatewayToken()}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GatewayError(
        `Gateway did not answer within ${timeoutMs}ms (${method} ${path}).`,
        504,
      )
    }
    throw new GatewayError(
      `Gateway unreachable (${method} ${path}): ${
        err instanceof Error ? err.message : String(err)
      }`,
      503,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    let message = `Gateway error ${response.status}`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // Non-JSON error body — keep the status-based fallback.
    }
    throw new GatewayError(message, response.status)
  }

  return response
}

async function gatewayJson<T>(
  path: string,
  options: GatewayRequestOptions = {},
): Promise<T> {
  const response = await gatewayFetch(path, options)
  return (await response.json()) as T
}

// ============================================================
// Session lifecycle
// ============================================================

/**
 * Start (or restart) pairing for an org. Idempotent: calling it while a
 * session is already `connected` returns the current state untouched
 * rather than tearing down a working socket.
 *
 * `phoneNumber` (E.164, no leading plus) opts into pairing-code mode
 * instead of the QR — easier when the operator cannot point a camera at
 * the screen.
 */
export function connectSession(
  orgId: string,
  phoneNumber?: string,
): Promise<GatewaySessionState> {
  return gatewayJson<GatewaySessionState>(`/sessions/${orgId}/connect`, {
    method: 'POST',
    body: phoneNumber ? { phoneNumber } : {},
    // Pairing waits for WhatsApp to mint a QR; slower than a send.
    timeoutMs: 45_000,
  })
}

export function getSessionState(orgId: string): Promise<GatewaySessionState> {
  return gatewayJson<GatewaySessionState>(`/sessions/${orgId}`)
}

/** Log the number out on WhatsApp's side and delete the stored credentials. */
export function logoutSession(orgId: string): Promise<{ ok: true }> {
  return gatewayJson<{ ok: true }>(`/sessions/${orgId}`, { method: 'DELETE' })
}

// ============================================================
// Sending
// ============================================================

export interface GatewaySendResult {
  messageId: string
}

/**
 * The payload shapes mirror the Meta helpers one-for-one so the provider
 * façade can forward its arguments straight through. Translating them
 * into Baileys' own message shapes is the gateway's job, not the app's —
 * that keeps every WhatsApp-Web-specific quirk on one side of the wire.
 */
export type GatewaySendPayload =
  | { kind: 'text'; to: string; text: string; contextMessageId?: string }
  | {
      kind: 'buttons'
      to: string
      bodyText: string
      headerText?: string
      footerText?: string
      buttons: { id: string; title: string }[]
      contextMessageId?: string
    }
  | {
      kind: 'list'
      to: string
      bodyText: string
      buttonLabel: string
      headerText?: string
      footerText?: string
      sections: {
        title?: string
        rows: { id: string; title: string; description?: string }[]
      }[]
      contextMessageId?: string
    }
  | { kind: 'reaction'; to: string; targetMessageId: string; emoji: string }

export function sendViaGateway(
  orgId: string,
  payload: GatewaySendPayload,
): Promise<GatewaySendResult> {
  return gatewayJson<GatewaySendResult>(`/sessions/${orgId}/messages`, {
    method: 'POST',
    body: payload,
  })
}

// ============================================================
// Media
// ============================================================

/**
 * Inbound media is decrypted and cached by the gateway at receive time —
 * WhatsApp Web media keys are single-use per message, so we cannot defer
 * the download the way the Meta proxy does. `mediaId` is the message key
 * id the gateway put in the webhook payload.
 */
/**
 * Existence check for a cached media item — the gateway answers a HEAD
 * with 200 or 404 and no body. Used by the webhook to decide whether to
 * write a proxy URL onto the message row, without pulling megabytes on
 * the inbound hot path.
 */
export async function headGatewayMedia(
  orgId: string,
  mediaId: string,
): Promise<void> {
  await gatewayFetch(`/sessions/${orgId}/media/${encodeURIComponent(mediaId)}`, {
    method: 'HEAD',
  })
}

export async function fetchGatewayMedia(
  orgId: string,
  mediaId: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await gatewayFetch(
    `/sessions/${orgId}/media/${encodeURIComponent(mediaId)}`,
    { timeoutMs: 60_000 },
  )
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream'
  return { buffer: Buffer.from(await response.arrayBuffer()), contentType }
}
