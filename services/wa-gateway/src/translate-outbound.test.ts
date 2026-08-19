import { afterEach, describe, expect, it, vi } from 'vitest'
import { phoneToJid, translateOutbound, type SendPayload } from './translate-outbound.js'

// Outbound translation is where the CRM's Meta vocabulary becomes
// WhatsApp Web's. The numbered-menu path matters most: it is the only
// reason the Flows engine works at all on this transport, and its output
// is what translate-inbound.ts has to be able to match a reply against.

const KEY = { remoteJid: '21612345678@s.whatsapp.net', id: 'ABC123', fromMe: false }

describe('phoneToJid', () => {
  it('builds a personal JID from a bare number', () => {
    expect(phoneToJid('21612345678')).toBe('21612345678@s.whatsapp.net')
  })

  it('strips formatting the CRM may have stored', () => {
    expect(phoneToJid('+216 12 345 678')).toBe('21612345678@s.whatsapp.net')
  })
})

describe('text', () => {
  it('sends the body as-is with no pending prompt', () => {
    const result = translateOutbound(
      { kind: 'text', to: '21612345678', text: 'bonjour' },
      null,
    )
    expect(result.content).toEqual({ text: 'bonjour' })
    expect(result.promptOptions).toBeUndefined()
    expect(result.options).toEqual({})
  })

  it('quotes the target when a key is known', () => {
    const result = translateOutbound(
      { kind: 'text', to: '21612345678', text: 'réponse', contextMessageId: 'ABC123' },
      KEY,
    )
    // Baileys quotes by whole message, so we pass a stub carrying the key.
    expect(result.options.quoted).toMatchObject({ key: KEY })
  })
})

describe('buttons — numbered text mode (default)', () => {
  const payload: SendPayload = {
    kind: 'buttons',
    to: '21612345678',
    bodyText: 'Que voulez-vous faire ?',
    headerText: 'Menu',
    footerText: 'Répondez par un chiffre',
    buttons: [
      { id: 'opt_pricing', title: 'Tarifs' },
      { id: 'opt_support', title: 'Support' },
    ],
  }

  it('renders a numbered menu with header and footer', () => {
    const { content } = translateOutbound(payload, null)
    const text = (content as { text: string }).text
    expect(text).toContain('*Menu*')
    expect(text).toContain('Que voulez-vous faire ?')
    expect(text).toContain('1. Tarifs')
    expect(text).toContain('2. Support')
    expect(text).toContain('_Répondez par un chiffre_')
  })

  // The printed order IS the contract: translate-inbound resolves "2" by
  // indexing into this array. A mismatch would advance the flow down the
  // wrong branch, silently.
  it('returns the options in printed order for reply matching', () => {
    const { promptOptions } = translateOutbound(payload, null)
    expect(promptOptions).toEqual([
      { id: 'opt_pricing', title: 'Tarifs' },
      { id: 'opt_support', title: 'Support' },
    ])
  })

  it('omits header and footer lines when unset', () => {
    const { content } = translateOutbound(
      { ...payload, headerText: undefined, footerText: undefined },
      null,
    )
    const text = (content as { text: string }).text
    expect(text.startsWith('Que voulez-vous faire ?')).toBe(true)
    expect(text).not.toContain('_')
  })
})

describe('list — numbered text mode (default)', () => {
  const payload: SendPayload = {
    kind: 'list',
    to: '21612345678',
    bodyText: 'Choisissez un service',
    buttonLabel: 'Voir',
    sections: [
      {
        title: 'Ventes',
        rows: [
          { id: 'row_quote', title: 'Devis', description: 'Sous 24h' },
          { id: 'row_demo', title: 'Démo' },
        ],
      },
      { title: 'Après-vente', rows: [{ id: 'row_sav', title: 'SAV' }] },
    ],
  }

  // One number, not a section/row pair — the customer cannot express
  // "section 2, row 1" in a text reply.
  it('numbers rows continuously across sections', () => {
    const { content } = translateOutbound(payload, null)
    const text = (content as { text: string }).text
    expect(text).toContain('1. Devis — Sous 24h')
    expect(text).toContain('2. Démo')
    expect(text).toContain('3. SAV')
  })

  it('keeps section titles as separators', () => {
    const { content } = translateOutbound(payload, null)
    const text = (content as { text: string }).text
    expect(text).toContain('*Ventes*')
    expect(text).toContain('*Après-vente*')
  })

  it('flattens every row into the reply-matching options', () => {
    const { promptOptions } = translateOutbound(payload, null)
    expect(promptOptions?.map((o) => o.id)).toEqual([
      'row_quote',
      'row_demo',
      'row_sav',
    ])
  })
})

describe('reaction', () => {
  it('reacts against the resolved message key', () => {
    const { content } = translateOutbound(
      { kind: 'reaction', to: '21612345678', targetMessageId: 'ABC123', emoji: '👍' },
      KEY,
    )
    expect(content).toEqual({ react: { text: '👍', key: KEY } })
  })

  it('passes an empty emoji through as a removal, matching Meta', () => {
    const { content } = translateOutbound(
      { kind: 'reaction', to: '21612345678', targetMessageId: 'ABC123', emoji: '' },
      KEY,
    )
    expect(content).toEqual({ react: { text: '', key: KEY } })
  })

  // WhatsApp Web addresses a message by full key; without one there is
  // nothing to react to, and guessing would react to the wrong message.
  it('fails loudly when the key was never indexed', () => {
    expect(() =>
      translateOutbound(
        { kind: 'reaction', to: '21612345678', targetMessageId: 'GONE', emoji: '👍' },
        null,
      ),
    ).toThrow(/no stored key/i)
  })
})

describe('native interactive mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  // config.ts freezes the mode at import time, so the module graph has to
  // be rebuilt to exercise the other branch.
  async function loadNative() {
    vi.stubEnv('WA_INTERACTIVE_MODE', 'native')
    vi.resetModules()
    return import('./translate-outbound.js')
  }

  it('emits real button shapes and arms no text fallback', async () => {
    const { translateOutbound: native } = await loadNative()
    const result = native(
      {
        kind: 'buttons',
        to: '21612345678',
        bodyText: 'Choisir',
        buttons: [{ id: 'opt_a', title: 'A' }],
      },
      null,
    )
    expect(result.content).toMatchObject({
      text: 'Choisir',
      buttons: [{ buttonId: 'opt_a', buttonText: { displayText: 'A' } }],
    })
    // WhatsApp returns the id itself, so there is nothing to remap.
    expect(result.promptOptions).toBeUndefined()
  })

  it('emits real list sections', async () => {
    const { translateOutbound: native } = await loadNative()
    const result = native(
      {
        kind: 'list',
        to: '21612345678',
        bodyText: 'Choisir',
        buttonLabel: 'Voir',
        sections: [{ title: 'S', rows: [{ id: 'r1', title: 'R1' }] }],
      },
      null,
    )
    expect(result.content).toMatchObject({
      buttonText: 'Voir',
      sections: [{ title: 'S', rows: [{ rowId: 'r1', title: 'R1' }] }],
    })
    expect(result.promptOptions).toBeUndefined()
  })
})
