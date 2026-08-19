import crypto from 'node:crypto'
import http from 'node:http'
import { config } from './config.js'
import { readMedia, hasMedia } from './media-store.js'
import {
  connect,
  logout,
  restoreSessions,
  send,
  shutdownAll,
  snapshot,
} from './session-manager.js'
import type { SendPayload } from './translate-outbound.js'

/**
 * HTTP surface of the pilot gateway.
 *
 * Small enough to route by hand — five endpoints and a health check — so
 * the service carries no web framework on top of Baileys' own dependency
 * tree. Everything except /health requires the bearer token, and the
 * service is only ever published on the internal Docker network.
 */

function unauthorized(res: http.ServerResponse): void {
  json(res, 401, { error: 'Unauthorized' })
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function isAuthorized(req: http.IncomingMessage): boolean {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return false
  const presented = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(config.authToken)
  if (presented.length !== expected.length) return false
  return crypto.timingSafeEqual(presented, expected)
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    // Outbound payloads are menus and message text; anything larger is a
    // bug or an attack, and buffering it would be the vulnerability.
    if (size > 1_000_000) throw new Error('Request body too large')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const SESSION_ROUTE = /^\/sessions\/([^/]+)(\/.*)?$/

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://gateway')
  const pathname = url.pathname

  if (pathname === '/health') {
    return json(res, 200, { ok: true })
  }

  if (!isAuthorized(req)) return unauthorized(res)

  const match = SESSION_ROUTE.exec(pathname)
  if (!match) return json(res, 404, { error: 'Not found' })

  const orgId = decodeURIComponent(match[1]!)
  const rest = match[2] ?? ''

  // POST /sessions/:orgId/connect
  if (rest === '/connect' && req.method === 'POST') {
    const body = (await readJsonBody(req)) as { phoneNumber?: unknown }
    const phoneNumber =
      typeof body.phoneNumber === 'string' && /^\d{8,15}$/.test(body.phoneNumber)
        ? body.phoneNumber
        : undefined
    const state = await connect(orgId, phoneNumber)
    return json(res, 200, state)
  }

  // GET /sessions/:orgId
  if (rest === '' && req.method === 'GET') {
    return json(res, 200, snapshot(orgId))
  }

  // DELETE /sessions/:orgId
  if (rest === '' && req.method === 'DELETE') {
    await logout(orgId)
    return json(res, 200, { ok: true })
  }

  // POST /sessions/:orgId/messages
  if (rest === '/messages' && req.method === 'POST') {
    const payload = (await readJsonBody(req)) as SendPayload
    if (!payload || typeof payload !== 'object' || !('kind' in payload)) {
      return json(res, 400, { error: 'Missing message kind' })
    }
    try {
      const result = await send(orgId, payload)
      return json(res, 200, result)
    } catch (err) {
      // 502: the CRM asked for something reasonable and the transport
      // could not deliver. It maps this straight onto its own 502.
      return json(res, 502, { error: errorMessage(err) })
    }
  }

  // GET|HEAD /sessions/:orgId/media/:mediaId
  const mediaMatch = /^\/media\/([^/]+)$/.exec(rest)
  if (mediaMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    const mediaId = decodeURIComponent(mediaMatch[1]!)

    if (req.method === 'HEAD') {
      const exists = await hasMedia(orgId, mediaId).catch(() => false)
      res.writeHead(exists ? 200 : 404)
      return void res.end()
    }

    const media = await readMedia(orgId, mediaId).catch(() => null)
    if (!media) return json(res, 404, { error: 'Media not found' })

    res.writeHead(200, {
      'Content-Type': media.contentType,
      'Content-Length': media.buffer.length,
    })
    return void res.end(media.buffer)
  }

  return json(res, 404, { error: 'Not found' })
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[wa-gateway] unhandled request error:', err)
    if (!res.headersSent) json(res, 500, { error: errorMessage(err) })
    else res.end()
  })
})

server.listen(config.port, () => {
  console.warn(
    `[wa-gateway] listening on :${config.port} — INTERNAL PILOT ONLY, unofficial WhatsApp Web transport (interactive mode: ${config.interactiveMode})`,
  )
  void restoreSessions()
})

async function shutdown(signal: string): Promise<void> {
  console.warn(`[wa-gateway] ${signal} received, shutting down`)
  server.close()
  // Flush per-org state before the process dies, otherwise the debounced
  // writes in store.ts lose up to 500ms of message keys.
  await shutdownAll()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
