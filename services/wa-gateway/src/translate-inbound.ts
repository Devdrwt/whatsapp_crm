import type { WAMessage } from 'baileys'
import { config } from './config.js'
import { storeMedia } from './media-store.js'
import { takePendingPrompt } from './store.js'

/**
 * Baileys message → Meta Cloud API webhook payload.
 *
 * The CRM's webhook route is the single inbound pipeline for both
 * transports, so everything WhatsApp-Web-specific is normalised away
 * here. Anything this file cannot express in Meta's vocabulary is
 * dropped with a log line rather than half-translated — a message that
 * lands in the inbox with the wrong shape is worse than one that never
 * lands, because the operator has no way to tell it is wrong.
 */

export interface MetaWebhookBody {
  entry: Array<{
    id: string
    changes: Array<{
      field: 'messages'
      value: {
        messaging_product: 'whatsapp'
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: Array<{ profile: { name: string }; wa_id: string }>
        messages?: Array<Record<string, unknown>>
      }
    }>
  }>
}

/** '21612345678@s.whatsapp.net' → '21612345678' */
export function jidToPhone(jid: string): string {
  const user = jid.split('@')[0] ?? ''
  // Multi-device JIDs can carry a ':<device>' suffix on the user part.
  return user.split(':')[0] ?? ''
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us')
}

/**
 * Media kinds we forward, mapped to the Meta message `type` and the
 * matching payload key. Anything absent from this table (contacts, polls,
 * live location, view-once, …) has no Meta equivalent the CRM models.
 */
const MEDIA_KINDS = [
  { field: 'imageMessage', type: 'image' },
  { field: 'videoMessage', type: 'video' },
  { field: 'documentMessage', type: 'document' },
  { field: 'audioMessage', type: 'audio' },
  { field: 'stickerMessage', type: 'sticker' },
] as const

export interface TranslateDeps {
  /** Decrypts and returns the media bytes for a message. */
  downloadMedia: (message: WAMessage) => Promise<Buffer>
}

/**
 * Build the Meta-shaped body for one inbound message, or null when the
 * message should be ignored.
 *
 * `pairedNumber` is the gateway's own number (E.164, no plus). It becomes
 * `metadata.phone_number_id`, which is how the CRM's webhook resolves the
 * payload back to an org — the value is mirrored into
 * `whatsapp_config.phone_number_id` when the session pairs.
 */
export async function translateInbound(
  orgId: string,
  pairedNumber: string,
  msg: WAMessage,
  deps: TranslateDeps,
): Promise<MetaWebhookBody | null> {
  const remoteJid = msg.key.remoteJid
  if (!remoteJid || !msg.message) return null

  // Our own outbound messages come back through the same event stream.
  // The CRM already persisted them at send time; re-ingesting would
  // duplicate every agent reply in the thread.
  if (msg.key.fromMe) return null

  if (config.ignoreGroups && isGroupJid(remoteJid)) return null

  // Status/broadcast pseudo-JIDs are not conversations.
  if (remoteJid === 'status@broadcast') return null

  const messageId = msg.key.id
  if (!messageId) return null

  const from = jidToPhone(remoteJid)
  const pushName = msg.pushName || from

  const translated = await translateContent(orgId, remoteJid, messageId, msg, deps)
  if (!translated) return null

  return {
    entry: [
      {
        id: pairedNumber,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: pairedNumber,
                phone_number_id: pairedNumber,
              },
              contacts: [{ profile: { name: pushName }, wa_id: from }],
              messages: [
                {
                  id: messageId,
                  from,
                  timestamp: String(
                    typeof msg.messageTimestamp === 'number'
                      ? msg.messageTimestamp
                      : Number(msg.messageTimestamp ?? 0),
                  ),
                  ...translated,
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

/** The `type` + payload half of a Meta message object. */
async function translateContent(
  orgId: string,
  remoteJid: string,
  messageId: string,
  msg: WAMessage,
  deps: TranslateDeps,
): Promise<Record<string, unknown> | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = msg.message as any
  if (!content) return null

  // --- Reactions ------------------------------------------------------
  if (content.reactionMessage) {
    const target = content.reactionMessage.key?.id
    if (!target) return null
    return {
      type: 'reaction',
      reaction: {
        message_id: target,
        emoji: content.reactionMessage.text ?? '',
      },
    }
  }

  // --- Native interactive replies -------------------------------------
  // Present only when the handset actually rendered a real button/list
  // (WA_INTERACTIVE_MODE=native, and a client version that still
  // supports it). The text fallback below covers everything else.
  if (content.buttonsResponseMessage) {
    return interactiveReply(
      'button_reply',
      content.buttonsResponseMessage.selectedButtonId,
      content.buttonsResponseMessage.selectedDisplayText,
    )
  }
  if (content.templateButtonReplyMessage) {
    return interactiveReply(
      'button_reply',
      content.templateButtonReplyMessage.selectedId,
      content.templateButtonReplyMessage.selectedDisplayText,
    )
  }
  if (content.listResponseMessage) {
    return interactiveReply(
      'list_reply',
      content.listResponseMessage.singleSelectReply?.selectedRowId,
      content.listResponseMessage.title,
    )
  }

  // --- Text -----------------------------------------------------------
  const text: string | undefined =
    content.conversation ?? content.extendedTextMessage?.text
  if (typeof text === 'string') {
    const contextId: string | undefined =
      content.extendedTextMessage?.contextInfo?.stanzaId

    // A plain text reply may in fact be the answer to a numbered menu we
    // rendered as text. Resolving it back to the option id here is what
    // keeps the Flows runner working on this transport — the runner only
    // ever advances on an interactive reply id.
    const asMenuChoice = await matchPendingPrompt(orgId, remoteJid, text)
    if (asMenuChoice) {
      return { ...asMenuChoice, ...(contextId ? { context: { id: contextId } } : {}) }
    }

    return {
      type: 'text',
      text: { body: text },
      ...(contextId ? { context: { id: contextId } } : {}),
    }
  }

  // --- Media ----------------------------------------------------------
  for (const kind of MEDIA_KINDS) {
    const node = content[kind.field]
    if (!node) continue

    const mimeType: string = node.mimetype || 'application/octet-stream'
    try {
      const buffer = await deps.downloadMedia(msg)
      // The message key id doubles as the media id: unique, already known
      // to the CRM, and it is what the media proxy will ask us for.
      await storeMedia(orgId, messageId, buffer, mimeType)
    } catch (err) {
      // Without bytes there is nothing to proxy. Fall back to a text
      // placeholder so the conversation still shows that something was
      // sent, instead of an unexplained gap in the thread.
      console.error(
        `[wa-gateway] media download failed for ${messageId} (${kind.type}):`,
        err instanceof Error ? err.message : err,
      )
      return {
        type: 'text',
        text: { body: `[${kind.type} non récupéré]` },
      }
    }

    const payload: Record<string, unknown> = { id: messageId, mime_type: mimeType }
    if (node.caption) payload.caption = node.caption
    if (kind.field === 'documentMessage' && node.fileName) {
      payload.filename = node.fileName
    }

    const contextId: string | undefined = node.contextInfo?.stanzaId
    return {
      type: kind.type,
      [kind.type]: payload,
      ...(contextId ? { context: { id: contextId } } : {}),
    }
  }

  // --- Location -------------------------------------------------------
  if (content.locationMessage) {
    const loc = content.locationMessage
    return {
      type: 'location',
      location: {
        latitude: loc.degreesLatitude,
        longitude: loc.degreesLongitude,
        ...(loc.name ? { name: loc.name } : {}),
        ...(loc.address ? { address: loc.address } : {}),
      },
    }
  }

  console.warn(
    `[wa-gateway] unsupported message type from ${remoteJid}, keys: ${Object.keys(
      content,
    ).join(',')}`,
  )
  return null
}

function interactiveReply(
  kind: 'button_reply' | 'list_reply',
  id: unknown,
  title: unknown,
): Record<string, unknown> | null {
  if (typeof id !== 'string' || !id) return null
  return {
    type: 'interactive',
    interactive: {
      type: kind,
      [kind]: { id, title: typeof title === 'string' ? title : id },
    },
  }
}

/**
 * Resolve a free-text reply against the menu we last sent this contact.
 *
 * Accepts either the printed index ("2") or the option label ("Tarifs"),
 * case- and accent-insensitively. Anything else is treated as ordinary
 * text — a customer who ignores the menu and types a real question must
 * not have it silently rewritten into a button press, because that would
 * advance the flow down a branch they never chose.
 */
async function matchPendingPrompt(
  orgId: string,
  remoteJid: string,
  text: string,
): Promise<Record<string, unknown> | null> {
  const trimmed = text.trim()
  if (!trimmed) return null

  const prompt = await takePendingPrompt(orgId, remoteJid)
  if (!prompt) return null

  const byIndex = Number.parseInt(trimmed, 10)
  if (
    String(byIndex) === trimmed &&
    byIndex >= 1 &&
    byIndex <= prompt.options.length
  ) {
    const option = prompt.options[byIndex - 1]!
    return interactiveReply('button_reply', option.id, option.title)
  }

  const normalise = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()

  const needle = normalise(trimmed)
  const match = prompt.options.find((o) => normalise(o.title) === needle)
  if (match) {
    return interactiveReply('button_reply', match.id, match.title)
  }

  // No match: the prompt has already been consumed by takePendingPrompt,
  // which is intentional. The Flows engine owns re-prompt policy
  // (src/lib/flows/fallback.ts); re-arming here would fight it.
  return null
}
