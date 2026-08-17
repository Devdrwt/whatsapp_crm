import type { AnyMessageContent, MiscMessageGenerationOptions, WAMessageKey } from 'baileys'
import { config } from './config.js'

/**
 * CRM send payload → Baileys message content.
 *
 * The payload shapes are the Meta ones (see
 * src/lib/whatsapp/baileys-gateway.ts), so this file is where the Meta
 * vocabulary stops and WhatsApp Web's begins.
 */

export type SendPayload =
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

export interface OutboundMessage {
  content: AnyMessageContent
  options: MiscMessageGenerationOptions
  /**
   * When the prompt was rendered as numbered text, these are the options
   * in printed order. The session manager arms them as the contact's
   * pending prompt so the reply can be mapped back to an option id.
   * Undefined when the handset got a real interactive message (native
   * mode), because then WhatsApp returns the id itself.
   */
  promptOptions?: { id: string; title: string }[]
}

export function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

/**
 * Baileys quotes by passing the message being replied to. The CRM only
 * stores flat message ids, so we hand back a minimal stub carrying the
 * key — enough for WhatsApp to attach the reply context. The quoted
 * preview bubble may render without its original text, which is a
 * cosmetic gap we accept on the pilot rather than mirroring every
 * message body into the gateway.
 */
function quotedStub(key: WAMessageKey) {
  return { key, message: { conversation: '' } }
}

function buildOptions(quotedKey: WAMessageKey | null): MiscMessageGenerationOptions {
  return quotedKey ? { quoted: quotedStub(quotedKey) } : {}
}

/**
 * Render a menu as numbered plain text.
 *
 * Deliberately the default. WhatsApp has been narrowing native button and
 * list support to the official Business API, and a prompt that silently
 * renders as a blank bubble on the customer's handset is a dead flow. A
 * numbered list works on every client, and translate-inbound.ts maps the
 * answer back to the real option id, so the Flows runner cannot tell the
 * difference.
 */
function renderTextMenu(
  bodyText: string,
  options: { id: string; title: string }[],
  headerText?: string,
  footerText?: string,
): string {
  const lines: string[] = []
  if (headerText) lines.push(`*${headerText}*`, '')
  lines.push(bodyText, '')
  options.forEach((option, index) => {
    lines.push(`${index + 1}. ${option.title}`)
  })
  if (footerText) lines.push('', `_${footerText}_`)
  return lines.join('\n')
}

export function translateOutbound(
  payload: SendPayload,
  quotedKey: WAMessageKey | null,
): OutboundMessage {
  switch (payload.kind) {
    case 'text':
      return {
        content: { text: payload.text },
        options: buildOptions(quotedKey),
      }

    case 'buttons': {
      const options = payload.buttons.map((b) => ({ id: b.id, title: b.title }))

      if (config.interactiveMode === 'native') {
        return {
          content: {
            text: payload.bodyText,
            footer: payload.footerText,
            buttons: payload.buttons.map((b) => ({
              buttonId: b.id,
              buttonText: { displayText: b.title },
              type: 1,
            })),
            headerType: 1,
          } as AnyMessageContent,
          options: buildOptions(quotedKey),
        }
      }

      return {
        content: {
          text: renderTextMenu(
            payload.bodyText,
            options,
            payload.headerText,
            payload.footerText,
          ),
        },
        options: buildOptions(quotedKey),
        promptOptions: options,
      }
    }

    case 'list': {
      const flattened = payload.sections.flatMap((s) => s.rows)
      const options = flattened.map((r) => ({ id: r.id, title: r.title }))

      if (config.interactiveMode === 'native') {
        return {
          content: {
            text: payload.bodyText,
            footer: payload.footerText,
            title: payload.headerText,
            buttonText: payload.buttonLabel,
            sections: payload.sections.map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                title: r.title,
                rowId: r.id,
                description: r.description,
              })),
            })),
          } as unknown as AnyMessageContent,
          options: buildOptions(quotedKey),
        }
      }

      // Section titles are kept as separators so a long list stays
      // readable, but the numbering runs continuously across sections —
      // the customer answers with one number, not a section/row pair.
      const lines: string[] = []
      if (payload.headerText) lines.push(`*${payload.headerText}*`, '')
      lines.push(payload.bodyText, '')

      let index = 1
      for (const section of payload.sections) {
        if (section.title) lines.push(`*${section.title}*`)
        for (const row of section.rows) {
          lines.push(
            row.description
              ? `${index}. ${row.title} — ${row.description}`
              : `${index}. ${row.title}`,
          )
          index++
        }
        lines.push('')
      }
      if (payload.footerText) lines.push(`_${payload.footerText}_`)

      return {
        content: { text: lines.join('\n').trimEnd() },
        options: buildOptions(quotedKey),
        promptOptions: options,
      }
    }

    case 'reaction': {
      if (!quotedKey) {
        throw new Error(
          `Cannot react to message ${payload.targetMessageId}: the gateway has no stored key for it. Reactions only work on messages exchanged since the session was paired.`,
        )
      }
      return {
        // An empty emoji removes the reaction, matching Meta's contract.
        content: { react: { text: payload.emoji, key: quotedKey } },
        options: {},
      }
    }
  }
}
