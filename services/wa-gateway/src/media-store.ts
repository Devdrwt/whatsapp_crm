import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

/**
 * On-disk cache for inbound media.
 *
 * The Meta transport can defer downloading: a media id stays resolvable
 * for days, so the CRM's `/api/whatsapp/media/[mediaId]` proxy fetches
 * lazily when an agent opens the conversation. WhatsApp Web gives no such
 * grace — media is end-to-end encrypted and the keys arrive inside the
 * message, so if we do not decrypt it on receipt we can never get it
 * again. The gateway therefore downloads eagerly and serves the bytes
 * back to the CRM under the same message id.
 *
 * Files are laid out as `<dataDir>/media/<orgId>/<mediaId>` with a
 * sibling `.meta.json` holding the MIME type. `mediaId` is a WhatsApp
 * message key id, which is alphanumeric — but it arrives over the wire,
 * so it is sanitised before touching the filesystem regardless.
 */

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/

function mediaPath(orgId: string, mediaId: string): string {
  if (!SAFE_ID.test(orgId) && !/^[0-9a-f-]{36}$/i.test(orgId)) {
    throw new Error(`Unsafe org id: ${orgId}`)
  }
  if (!SAFE_ID.test(mediaId)) {
    throw new Error(`Unsafe media id: ${mediaId}`)
  }
  return path.join(config.dataDir, 'media', orgId, mediaId)
}

export async function storeMedia(
  orgId: string,
  mediaId: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const file = mediaPath(orgId, mediaId)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, buffer)
  await fs.writeFile(`${file}.meta.json`, JSON.stringify({ contentType }), 'utf8')
}

export async function hasMedia(orgId: string, mediaId: string): Promise<boolean> {
  try {
    await fs.access(mediaPath(orgId, mediaId))
    return true
  } catch {
    return false
  }
}

export async function readMedia(
  orgId: string,
  mediaId: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const file = mediaPath(orgId, mediaId)
  try {
    const buffer = await fs.readFile(file)
    let contentType = 'application/octet-stream'
    try {
      const meta = JSON.parse(await fs.readFile(`${file}.meta.json`, 'utf8')) as {
        contentType?: string
      }
      if (meta.contentType) contentType = meta.contentType
    } catch {
      // Sidecar missing — serve the bytes with the generic type rather
      // than pretending the media is gone.
    }
    return { buffer, contentType }
  } catch {
    return null
  }
}

export async function clearOrgMedia(orgId: string): Promise<void> {
  await fs.rm(path.join(config.dataDir, 'media', orgId), {
    recursive: true,
    force: true,
  })
}
