/**
 * Transport façade over the WhatsApp senders.
 *
 * Every call site used to reach straight into `meta-api.ts` with a
 * `phoneNumberId` + `accessToken` pair pulled out of the org's
 * `whatsapp_config` row. That hard-wired the Meta Cloud API into nine
 * files, so adding any second transport meant touching all nine.
 *
 * This module inverts it: a call site resolves a provider from the config
 * row once, then sends. The row's `provider` column decides which
 * implementation it gets, and the argument shapes are the Meta ones minus
 * the two credential fields — so the refactor at each call site is
 * mechanical and the Meta path keeps byte-identical behaviour.
 *
 *   provider = 'meta'    → Meta Cloud API. Production. The only transport
 *                          that may ever face a paying client.
 *   provider = 'baileys' → unofficial WhatsApp Web via the `wa-gateway`
 *                          side-car. INTERNAL PILOT ONLY — demos and
 *                          end-to-end testing. See docs/pilote-baileys.md.
 *
 * The façade is worth having regardless of Baileys: it is also what a
 * future BSP or Meta-Tech-Provider onboarding plugs into, without another
 * nine-file sweep.
 */

import {
  sendTextMessage,
  sendTemplateMessage,
  sendReactionMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  getMediaUrl,
  downloadMedia,
  verifyPhoneNumber,
  type MetaSendResult,
  type MetaPhoneInfo,
  type SendTextMessageArgs,
  type SendTemplateMessageArgs,
  type SendReactionMessageArgs,
  type SendInteractiveButtonsArgs,
  type SendInteractiveListArgs,
} from './meta-api'
import { decrypt } from './encryption'
import {
  connectSession,
  getSessionState,
  logoutSession,
  sendViaGateway,
  fetchGatewayMedia,
  headGatewayMedia,
  GatewayError,
  type GatewaySessionState,
} from './baileys-gateway'

export type ProviderKind = 'meta' | 'baileys'

export type WhatsAppSendResult = MetaSendResult
export type WhatsAppPhoneInfo = MetaPhoneInfo

/**
 * Credentials are supplied by the provider, so they are stripped from
 * every argument shape. Keeping the rest of each Meta shape verbatim is
 * deliberate — call sites pass the exact same object literal they used
 * before, so a mistake shows up as a type error rather than a silently
 * dropped field.
 */
type Credentialless<T> = Omit<T, 'phoneNumberId' | 'accessToken'>

export type SendTextArgs = Credentialless<SendTextMessageArgs>
export type SendTemplateArgs = Credentialless<SendTemplateMessageArgs>
export type SendReactionArgs = Credentialless<SendReactionMessageArgs>
export type SendButtonsArgs = Credentialless<SendInteractiveButtonsArgs>
export type SendListArgs = Credentialless<SendInteractiveListArgs>

export interface WhatsAppProvider {
  readonly kind: ProviderKind
  sendText(args: SendTextArgs): Promise<WhatsAppSendResult>
  sendTemplate(args: SendTemplateArgs): Promise<WhatsAppSendResult>
  sendReaction(args: SendReactionArgs): Promise<WhatsAppSendResult>
  sendInteractiveButtons(args: SendButtonsArgs): Promise<WhatsAppSendResult>
  sendInteractiveList(args: SendListArgs): Promise<WhatsAppSendResult>
  /** Health check used by the settings page's "test connection" button. */
  verifyConnection(): Promise<WhatsAppPhoneInfo>
  /**
   * Assert an inbound media item is actually retrievable, without paying
   * for the bytes. The webhook calls this before writing a proxy URL into
   * `messages.media_url` — storing a URL for media we can't fetch is what
   * produced empty image bubbles in the inbox. Throws if unavailable.
   */
  verifyMedia(mediaId: string): Promise<void>
  /** Bytes for an inbound media item, for the `/api/whatsapp/media` proxy. */
  fetchMedia(mediaId: string): Promise<{ buffer: Buffer; contentType: string }>
}

/**
 * The subset of a `whatsapp_config` row the façade needs. Declared
 * structurally rather than imported from a generated DB type so callers
 * can keep passing their existing `select('*')` result unchanged.
 */
export interface WhatsAppConfigRow {
  org_id: string
  provider?: string | null
  phone_number_id: string
  access_token?: string | null
}

export function providerKindOf(config: WhatsAppConfigRow): ProviderKind {
  // Rows written before migration 020 have no column at all; Meta is the
  // only thing they could have been.
  return config.provider === 'baileys' ? 'baileys' : 'meta'
}

/**
 * Build the transport for an org's config row.
 *
 * Throws if the row cannot yield working credentials — notably when the
 * stored Meta token no longer decrypts under the current ENCRYPTION_KEY.
 * That throw is load-bearing: `/api/whatsapp/config` catches it to report
 * `token_corrupted` and offer a reset, which is the difference between a
 * self-service fix and a support ticket.
 */
export function providerFromConfig(config: WhatsAppConfigRow): WhatsAppProvider {
  if (providerKindOf(config) === 'baileys') {
    return createBaileysProvider(config)
  }
  return createMetaProvider(config)
}

// ============================================================
// Meta Cloud API
// ============================================================

function createMetaProvider(config: WhatsAppConfigRow): WhatsAppProvider {
  if (!config.access_token) {
    throw new Error(
      'WhatsApp config is set to the Meta provider but has no access token.',
    )
  }
  const phoneNumberId = config.phone_number_id
  const accessToken = decrypt(config.access_token)

  return {
    kind: 'meta',

    sendText: (args) => sendTextMessage({ ...args, phoneNumberId, accessToken }),

    sendTemplate: (args) =>
      sendTemplateMessage({ ...args, phoneNumberId, accessToken }),

    sendReaction: (args) =>
      sendReactionMessage({ ...args, phoneNumberId, accessToken }),

    sendInteractiveButtons: (args) =>
      sendInteractiveButtons({ ...args, phoneNumberId, accessToken }),

    sendInteractiveList: (args) =>
      sendInteractiveList({ ...args, phoneNumberId, accessToken }),

    verifyConnection: () => verifyPhoneNumber({ phoneNumberId, accessToken }),

    verifyMedia: async (mediaId) => {
      await getMediaUrl({ mediaId, accessToken })
    },

    fetchMedia: async (mediaId) => {
      // Two hops by Meta's design: resolve the id to a short-lived
      // authenticated CDN URL, then fetch the bytes with the same token.
      const info = await getMediaUrl({ mediaId, accessToken })
      const { buffer, contentType } = await downloadMedia({
        downloadUrl: info.url,
        accessToken,
      })
      return { buffer, contentType: contentType || info.mimeType }
    },
  }
}

// ============================================================
// Baileys pilot gateway
// ============================================================

function createBaileysProvider(config: WhatsAppConfigRow): WhatsAppProvider {
  const orgId = config.org_id

  return {
    kind: 'baileys',

    sendText: (args) =>
      sendViaGateway(orgId, {
        kind: 'text',
        to: args.to,
        text: args.text,
        contextMessageId: args.contextMessageId,
      }),

    // WhatsApp templates are a Cloud API construct — approval, categories
    // and the 24h-window exemption all live on Meta's side. Over WhatsApp
    // Web there is no such object, so a template send has no honest
    // equivalent. Failing loudly beats quietly posting the raw template
    // name into a customer's chat.
    sendTemplate: () =>
      Promise.reject(
        new Error(
          'Templates are not available on the Baileys pilot transport — they only exist on the Meta Cloud API. Send text instead, or move this org to the Meta provider.',
        ),
      ),

    sendReaction: (args) =>
      sendViaGateway(orgId, {
        kind: 'reaction',
        to: args.to,
        targetMessageId: args.targetMessageId,
        emoji: args.emoji,
      }),

    // Interactive limits are already enforced at flow-save time by
    // src/lib/flows/validate.ts against INTERACTIVE_LIMITS, so a flow that
    // is valid for Meta arrives here well-formed. The gateway decides
    // whether the handset gets true interactive bubbles or the numbered
    // text fallback — see services/wa-gateway/src/translate-outbound.ts.
    sendInteractiveButtons: (args) =>
      sendViaGateway(orgId, {
        kind: 'buttons',
        to: args.to,
        bodyText: args.bodyText,
        headerText: args.headerText,
        footerText: args.footerText,
        buttons: args.buttons.map((b) => ({ id: b.id, title: b.title })),
        contextMessageId: args.contextMessageId,
      }),

    sendInteractiveList: (args) =>
      sendViaGateway(orgId, {
        kind: 'list',
        to: args.to,
        bodyText: args.bodyText,
        buttonLabel: args.buttonLabel,
        headerText: args.headerText,
        footerText: args.footerText,
        sections: args.sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
          })),
        })),
        contextMessageId: args.contextMessageId,
      }),

    verifyConnection: async () => {
      const state = await getSessionState(orgId)
      if (state.state !== 'connected') {
        throw new Error(
          `Baileys session is "${state.state}"${
            state.lastError ? ` — ${state.lastError}` : ''
          }`,
        )
      }
      // Shaped like Meta's phone metadata so the settings page renders
      // both providers through one code path.
      return {
        id: state.phoneNumber ?? config.phone_number_id,
        display_phone_number: state.phoneNumber ?? config.phone_number_id,
        verified_name: 'WhatsApp Web (pilote)',
      }
    },

    verifyMedia: (mediaId) => headGatewayMedia(orgId, mediaId),

    fetchMedia: (mediaId) => fetchGatewayMedia(orgId, mediaId),
  }
}

// Re-exported so call sites that only need session control don't have to
// know the gateway module exists.
export {
  connectSession,
  getSessionState,
  logoutSession,
  GatewayError,
  type GatewaySessionState,
}
