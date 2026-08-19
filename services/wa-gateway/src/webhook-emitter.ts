import crypto from 'node:crypto'
import { config } from './config.js'
import type { MetaWebhookBody } from './translate-inbound.js'

/**
 * Ship a Meta-shaped webhook payload to the CRM.
 *
 * The whole point of the shape is that the CRM's inbound pipeline —
 * contact/conversation upsert, media proxy URLs, automations, flows, the
 * AI agent — stays a single code path. The gateway does the translating
 * so nothing downstream has to branch on transport.
 *
 * Signed with `WA_GATEWAY_SECRET` under our own header. We deliberately
 * do NOT hold Meta's App Secret: the CRM verifies the two independently,
 * so a gateway compromise cannot forge Meta traffic.
 */

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 400

export async function emitWebhook(body: MetaWebhookBody): Promise<void> {
  // Sign the exact bytes we send — the CRM HMACs the raw request body
  // before parsing, so any re-encoding between here and there breaks it.
  const rawBody = JSON.stringify(body)
  const signature =
    'sha256=' +
    crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex')

  let lastError: unknown = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wacrm-gateway-signature': signature,
        },
        body: rawBody,
      })

      if (response.ok) return

      // 401 means the shared secret does not match. Retrying cannot fix
      // that and would just spam the log — fail loudly and immediately.
      if (response.status === 401) {
        throw new Error(
          'CRM rejected the gateway signature (401). WA_GATEWAY_SECRET differs between the app and the gateway.',
        )
      }

      lastError = new Error(`CRM answered ${response.status}`)
    } catch (err) {
      lastError = err
      if (err instanceof Error && err.message.includes('401')) throw err
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, BASE_BACKOFF_MS * 2 ** (attempt - 1)),
      )
    }
  }

  // An inbound message that never reaches the CRM is invisible to the
  // operator — it simply never appears in the inbox. Log it loudly with
  // enough context to replay by hand.
  console.error(
    '[wa-gateway] giving up on webhook delivery after %d attempts: %s\npayload: %s',
    MAX_ATTEMPTS,
    lastError instanceof Error ? lastError.message : String(lastError),
    rawBody.slice(0, 2000),
  )
}
