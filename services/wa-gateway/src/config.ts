/**
 * Environment for the pilot gateway, validated once at boot.
 *
 * Everything required is read here and nowhere else, so a
 * misconfiguration is a startup crash with a readable message rather
 * than a 500 on the first inbound message of a demo.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[wa-gateway] ${name} is required. Refusing to start — see services/wa-gateway/README.md.`,
    )
  }
  return value
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`[wa-gateway] ${name} must be an integer, got "${raw}".`)
  }
  return parsed
}

export const config = {
  port: optionalInt('PORT', 4100),

  /** Bearer token the CRM must present. Mirrors WA_GATEWAY_TOKEN app-side. */
  authToken: required('WA_GATEWAY_TOKEN'),

  /** HMAC key used to sign outbound webhooks. Mirrors WA_GATEWAY_SECRET app-side. */
  webhookSecret: required('WA_GATEWAY_SECRET'),

  /** Absolute URL of the CRM's webhook, e.g. http://app:4000/api/whatsapp/webhook */
  webhookUrl: required('WA_WEBHOOK_URL'),

  /** Volume root for Signal credentials, cached media and per-org state. */
  dataDir: process.env.WA_DATA_DIR || '/data',

  /**
   * How to render Flows' interactive prompts on a WhatsApp Web session.
   *
   *   'text'   — numbered plain-text menu, and inbound replies are matched
   *              back to option ids (see pending-prompts.ts). Default,
   *              because it works on every handset.
   *   'native' — emit Baileys' own button/list message shapes. WhatsApp
   *              has been progressively restricting these to the official
   *              Business API; they render inconsistently or not at all
   *              depending on the recipient's client version.
   *
   * The fallback is not a downgrade we hide: `text` keeps the Flows engine
   * receiving real option ids either way, which is what the runner needs
   * to advance a run.
   */
  interactiveMode: (process.env.WA_INTERACTIVE_MODE || 'text') as
    | 'text'
    | 'native',

  /** Drop group traffic. The CRM's data model is one contact per conversation. */
  ignoreGroups: process.env.WA_IGNORE_GROUPS !== 'false',

  logLevel: process.env.LOG_LEVEL || 'info',
} as const

if (config.interactiveMode !== 'text' && config.interactiveMode !== 'native') {
  throw new Error(
    `[wa-gateway] WA_INTERACTIVE_MODE must be "text" or "native", got "${config.interactiveMode}".`,
  )
}
