import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WAMessage } from 'baileys'

// The filesystem-touching collaborators are mocked: these tests are about
// the translation, not about disk. storeMedia is asserted on, because
// "did we actually persist the bytes before promising the CRM a proxy
// URL" is part of the contract.
const storeMedia = vi.fn(async () => {})
const takePendingPrompt = vi.fn(async () => null as unknown)

vi.mock('./media-store.js', () => ({ storeMedia: (...a: unknown[]) => storeMedia(...(a as [])) }))
vi.mock('./store.js', () => ({
  takePendingPrompt: (...a: unknown[]) => takePendingPrompt(...(a as [])),
}))

const { isGroupJid, jidToPhone, translateInbound } = await import(
  './translate-inbound.js'
)

const ORG = '11111111-1111-1111-1111-111111111111'
const PAIRED = '21699999999'
const CUSTOMER = '21612345678@s.whatsapp.net'

const deps = { downloadMedia: vi.fn(async () => Buffer.from('bytes')) }

/** Minimal inbound WAMessage; `message` is what each test varies. */
function inbound(message: unknown, overrides: Record<string, unknown> = {}) {
  return {
    key: { remoteJid: CUSTOMER, id: 'MSG1', fromMe: false },
    pushName: 'Amine',
    messageTimestamp: 1755000000,
    message,
    ...overrides,
  } as unknown as WAMessage
}

/** Pull the single translated message out of the Meta envelope. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstMessage(body: any) {
  return body.entry[0].changes[0].value.messages[0]
}

beforeEach(() => {
  storeMedia.mockClear()
  takePendingPrompt.mockReset()
  takePendingPrompt.mockResolvedValue(null)
  deps.downloadMedia.mockClear()
  deps.downloadMedia.mockResolvedValue(Buffer.from('bytes'))
})

describe('jidToPhone', () => {
  it('extracts the bare number', () => {
    expect(jidToPhone(CUSTOMER)).toBe('21612345678')
  })

  // Multi-device JIDs carry a ':<device>' suffix that is not part of the
  // phone number. Leaving it in would create a duplicate contact per
  // device the customer uses.
  it('drops the multi-device suffix', () => {
    expect(jidToPhone('21612345678:12@s.whatsapp.net')).toBe('21612345678')
  })

  it('recognises group JIDs', () => {
    expect(isGroupJid('12345-67890@g.us')).toBe(true)
    expect(isGroupJid(CUSTOMER)).toBe(false)
  })
})

describe('messages that must be ignored', () => {
  it('drops our own outbound echo', async () => {
    // The CRM already persisted these at send time; re-ingesting would
    // duplicate every agent reply in the thread.
    const msg = inbound({ conversation: 'coucou' }, {
      key: { remoteJid: CUSTOMER, id: 'MSG1', fromMe: true },
    })
    expect(await translateInbound(ORG, PAIRED, msg, deps)).toBeNull()
  })

  it('drops group traffic', async () => {
    const msg = inbound({ conversation: 'salut' }, {
      key: { remoteJid: '12345-67890@g.us', id: 'MSG1', fromMe: false },
    })
    expect(await translateInbound(ORG, PAIRED, msg, deps)).toBeNull()
  })

  it('drops status broadcasts', async () => {
    const msg = inbound({ conversation: 'story' }, {
      key: { remoteJid: 'status@broadcast', id: 'MSG1', fromMe: false },
    })
    expect(await translateInbound(ORG, PAIRED, msg, deps)).toBeNull()
  })

  it('drops message types with no Meta equivalent', async () => {
    const msg = inbound({ pollCreationMessage: { name: 'Sondage' } })
    expect(await translateInbound(ORG, PAIRED, msg, deps)).toBeNull()
  })
})

describe('envelope', () => {
  it('addresses the payload with the paired number', async () => {
    // phone_number_id is how the CRM's webhook resolves the payload back
    // to an org — it must match whatsapp_config.phone_number_id.
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ conversation: 'bonjour' }),
      deps,
    )
    const value = body!.entry[0]!.changes[0]!.value
    expect(value.metadata.phone_number_id).toBe(PAIRED)
    expect(value.contacts?.[0]).toEqual({
      profile: { name: 'Amine' },
      wa_id: '21612345678',
    })
    expect(value.messaging_product).toBe('whatsapp')
  })

  it('falls back to the number when the contact has no pushName', async () => {
    const msg = inbound({ conversation: 'bonjour' }, { pushName: undefined })
    const body = await translateInbound(ORG, PAIRED, msg, deps)
    expect(body!.entry[0]!.changes[0]!.value.contacts?.[0]?.profile.name).toBe(
      '21612345678',
    )
  })
})

describe('text', () => {
  it('maps a plain conversation', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ conversation: 'bonjour' }),
      deps,
    )
    expect(firstMessage(body)).toMatchObject({
      id: 'MSG1',
      from: '21612345678',
      type: 'text',
      text: { body: 'bonjour' },
    })
  })

  it('maps an extended text and carries the reply context', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({
        extendedTextMessage: {
          text: 'oui',
          contextInfo: { stanzaId: 'PARENT1' },
        },
      }),
      deps,
    )
    expect(firstMessage(body)).toMatchObject({
      type: 'text',
      text: { body: 'oui' },
      context: { id: 'PARENT1' },
    })
  })
})

describe('numbered-menu replies', () => {
  const prompt = {
    options: [
      { id: 'opt_pricing', title: 'Tarifs' },
      { id: 'opt_support', title: 'Support' },
    ],
    promptMessageId: 'PROMPT1',
    at: 0,
  }

  // This is the whole reason Flows work on this transport: the runner
  // only ever advances on an interactive reply id.
  it('resolves a numeric answer to the matching option id', async () => {
    takePendingPrompt.mockResolvedValue(prompt)
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ conversation: '2' }),
      deps,
    )
    expect(firstMessage(body)).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'opt_support', title: 'Support' },
      },
    })
  })

  it('resolves an answer typed as the label, ignoring case and accents', async () => {
    takePendingPrompt.mockResolvedValue(prompt)
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ conversation: '  tarifs ' }),
      deps,
    )
    expect(firstMessage(body).interactive.button_reply.id).toBe('opt_pricing')
  })

  // A customer who ignores the menu and asks a real question must NOT
  // have it rewritten into a button press — that would advance the flow
  // down a branch they never chose.
  it('leaves an unrelated reply as ordinary text', async () => {
    takePendingPrompt.mockResolvedValue(prompt)
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ conversation: 'vous ouvrez à quelle heure ?' }),
      deps,
    )
    expect(firstMessage(body)).toMatchObject({
      type: 'text',
      text: { body: 'vous ouvrez à quelle heure ?' },
    })
  })

  it('leaves an out-of-range number as ordinary text', async () => {
    takePendingPrompt.mockResolvedValue(prompt)
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ conversation: '7' }),
      deps,
    )
    expect(firstMessage(body).type).toBe('text')
  })

  it('leaves text alone when no menu is pending', async () => {
    takePendingPrompt.mockResolvedValue(null)
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ conversation: '2' }),
      deps,
    )
    expect(firstMessage(body).type).toBe('text')
  })
})

describe('native interactive replies', () => {
  it('maps a button response', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({
        buttonsResponseMessage: {
          selectedButtonId: 'opt_pricing',
          selectedDisplayText: 'Tarifs',
        },
      }),
      deps,
    )
    expect(firstMessage(body).interactive).toEqual({
      type: 'button_reply',
      button_reply: { id: 'opt_pricing', title: 'Tarifs' },
    })
  })

  it('maps a list response', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({
        listResponseMessage: {
          title: 'Devis',
          singleSelectReply: { selectedRowId: 'row_quote' },
        },
      }),
      deps,
    )
    expect(firstMessage(body).interactive).toEqual({
      type: 'list_reply',
      list_reply: { id: 'row_quote', title: 'Devis' },
    })
  })
})

describe('media', () => {
  it('downloads, caches and points the CRM at the message id', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({
        imageMessage: { mimetype: 'image/jpeg', caption: 'la facture' },
      }),
      deps,
    )
    // The message key id doubles as the media id — it is what the CRM's
    // media proxy will ask the gateway for.
    expect(storeMedia).toHaveBeenCalledWith(
      ORG,
      'MSG1',
      expect.anything(),
      'image/jpeg',
    )
    expect(firstMessage(body)).toMatchObject({
      type: 'image',
      image: { id: 'MSG1', mime_type: 'image/jpeg', caption: 'la facture' },
    })
  })

  it('carries the filename on documents', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({
        documentMessage: { mimetype: 'application/pdf', fileName: 'devis.pdf' },
      }),
      deps,
    )
    expect(firstMessage(body).document).toMatchObject({
      filename: 'devis.pdf',
      mime_type: 'application/pdf',
    })
  })

  // Media keys are single-use: a failed download can never be retried.
  // A placeholder keeps the thread honest instead of leaving a silent gap.
  it('degrades to a text placeholder when the download fails', async () => {
    deps.downloadMedia.mockRejectedValue(new Error('media key expired'))
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({ imageMessage: { mimetype: 'image/jpeg' } }),
      deps,
    )
    expect(storeMedia).not.toHaveBeenCalled()
    expect(firstMessage(body)).toMatchObject({ type: 'text' })
    expect(firstMessage(body).text.body).toMatch(/image/i)
  })
})

describe('reactions and location', () => {
  it('maps a reaction onto the target message id', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({
        reactionMessage: { key: { id: 'TARGET1' }, text: '👍' },
      }),
      deps,
    )
    expect(firstMessage(body)).toMatchObject({
      type: 'reaction',
      reaction: { message_id: 'TARGET1', emoji: '👍' },
    })
  })

  it('maps a location', async () => {
    const body = await translateInbound(
      ORG,
      PAIRED,
      inbound({
        locationMessage: {
          degreesLatitude: 36.8,
          degreesLongitude: 10.18,
          name: 'Tunis',
        },
      }),
      deps,
    )
    expect(firstMessage(body)).toMatchObject({
      type: 'location',
      location: { latitude: 36.8, longitude: 10.18, name: 'Tunis' },
    })
  })
})
