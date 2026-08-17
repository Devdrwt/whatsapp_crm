import crypto from 'node:crypto'

/**
 * HMAC-SHA256 signing shared with the `wa-gateway` side-car.
 *
 * The gateway re-emits Baileys events as Meta-shaped webhook payloads and
 * POSTs them to the very same `/api/whatsapp/webhook` route Meta calls.
 * That route fails closed on Meta's `x-hub-signature-256`, and the gateway
 * cannot produce one — it has no Meta App Secret, and inventing a shared
 * "app secret" between the two would mean the gateway could forge Meta
 * traffic. So the gateway signs with its own key and its own header, and
 * the webhook accepts either signature independently.
 *
 * `WA_GATEWAY_SECRET` must be identical in the app and in the gateway
 * container. Unset ⇒ fail closed, exactly like the Meta path: without a
 * secret, anyone who can reach the route could inject inbound messages
 * into any tenant's inbox.
 *
 * The signed bytes are the raw request body, so the caller must verify
 * before `JSON.parse` — re-encoding would change the bytes and break the
 * comparison.
 */
export const GATEWAY_SIGNATURE_HEADER = 'x-wacrm-gateway-signature'

export function signGatewayPayload(rawBody: string, secret: string): string {
  return (
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  )
}

export function verifyGatewaySignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.WA_GATEWAY_SECRET
  if (!secret) {
    // Silent by design. Unlike META_APP_SECRET this is an optional
    // pilot-only component: on a normal Meta-only deployment the gateway
    // is not running, and logging an error on every webhook call would be
    // pure noise. The caller logs the rejection once, with both paths
    // accounted for.
    return false
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false

  const expected = signGatewayPayload(rawBody, secret)
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
