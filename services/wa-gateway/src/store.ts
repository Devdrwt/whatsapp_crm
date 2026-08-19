import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

/**
 * Per-org scratch state that has to survive a restart but does not belong
 * in the CRM's database.
 *
 * Two things live here:
 *
 *  1. `messageKeys` — WhatsApp Web addresses a message by a full key
 *     ({ remoteJid, id, fromMe, participant }), while the CRM only ever
 *     carries the flat `messages.message_id` string. Reacting to a message
 *     therefore needs a lookup from id back to key. Meta has no equivalent
 *     problem, which is why nothing in the CRM models it.
 *
 *  2. `pendingPrompts` — when a Flows menu is rendered as numbered text
 *     (the default), the customer answers "2" or "Tarifs". Turning that
 *     back into the option id the Flows runner is waiting for requires
 *     remembering what we last offered that contact. See
 *     translate-inbound.ts.
 *
 * Storage is one JSON file per org on the data volume. That is deliberate
 * for a pilot: a handful of orgs, a few thousand keys each, no extra
 * service to run. It is also the first thing that would have to change if
 * this ever became a product, which it will not.
 */

const MAX_TRACKED_KEYS = 2000
const FLUSH_DEBOUNCE_MS = 500

export interface StoredMessageKey {
  remoteJid: string
  id: string
  fromMe: boolean
  participant?: string
}

export interface PendingPrompt {
  /** The options we offered, in the order they were rendered. */
  options: { id: string; title: string }[]
  /** Message id of the prompt itself, for logging. */
  promptMessageId: string
  at: number
}

interface OrgState {
  messageKeys: Record<string, StoredMessageKey>
  /** Insertion order of `messageKeys`, oldest first — the eviction queue. */
  keyOrder: string[]
  /** Keyed by the contact's JID. */
  pendingPrompts: Record<string, PendingPrompt>
}

function emptyState(): OrgState {
  return { messageKeys: {}, keyOrder: [], pendingPrompts: {} }
}

const cache = new Map<string, OrgState>()
const flushTimers = new Map<string, NodeJS.Timeout>()

function stateFile(orgId: string): string {
  return path.join(config.dataDir, 'state', `${orgId}.json`)
}

export async function loadState(orgId: string): Promise<OrgState> {
  const cached = cache.get(orgId)
  if (cached) return cached

  let state: OrgState
  try {
    const raw = await fs.readFile(stateFile(orgId), 'utf8')
    const parsed = JSON.parse(raw) as Partial<OrgState>
    state = {
      messageKeys: parsed.messageKeys ?? {},
      keyOrder: parsed.keyOrder ?? [],
      pendingPrompts: parsed.pendingPrompts ?? {},
    }
  } catch {
    // Missing or corrupt file — a fresh state is always a safe answer
    // here. Losing the key index costs a failed reaction at worst.
    state = emptyState()
  }

  cache.set(orgId, state)
  return state
}

function scheduleFlush(orgId: string): void {
  const existing = flushTimers.get(orgId)
  if (existing) clearTimeout(existing)

  // Inbound bursts (a customer sending five messages at once) would
  // otherwise write the whole file five times.
  flushTimers.set(
    orgId,
    setTimeout(() => {
      flushTimers.delete(orgId)
      void flushState(orgId)
    }, FLUSH_DEBOUNCE_MS),
  )
}

export async function flushState(orgId: string): Promise<void> {
  const state = cache.get(orgId)
  if (!state) return
  const file = stateFile(orgId)
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    // Write-then-rename so a crash mid-write cannot leave a truncated
    // file that fails to parse on the next boot.
    const tmp = `${file}.tmp`
    await fs.writeFile(tmp, JSON.stringify(state), 'utf8')
    await fs.rename(tmp, file)
  } catch (err) {
    console.error(`[wa-gateway] failed to persist state for org ${orgId}:`, err)
  }
}

export async function rememberMessageKey(
  orgId: string,
  key: StoredMessageKey,
): Promise<void> {
  const state = await loadState(orgId)
  if (!state.messageKeys[key.id]) {
    state.keyOrder.push(key.id)
    // Bounded on purpose: an unbounded map is how a long-lived pilot
    // session turns into an OOM three months later.
    while (state.keyOrder.length > MAX_TRACKED_KEYS) {
      const evicted = state.keyOrder.shift()
      if (evicted) delete state.messageKeys[evicted]
    }
  }
  state.messageKeys[key.id] = key
  scheduleFlush(orgId)
}

export async function lookupMessageKey(
  orgId: string,
  messageId: string,
): Promise<StoredMessageKey | null> {
  const state = await loadState(orgId)
  return state.messageKeys[messageId] ?? null
}

export async function setPendingPrompt(
  orgId: string,
  jid: string,
  prompt: PendingPrompt,
): Promise<void> {
  const state = await loadState(orgId)
  state.pendingPrompts[jid] = prompt
  scheduleFlush(orgId)
}

export async function takePendingPrompt(
  orgId: string,
  jid: string,
): Promise<PendingPrompt | null> {
  const state = await loadState(orgId)
  const prompt = state.pendingPrompts[jid]
  if (!prompt) return null
  // One-shot: a menu answers once. Leaving it armed would make every
  // later "1" in the conversation re-trigger the same branch.
  delete state.pendingPrompts[jid]
  scheduleFlush(orgId)
  return prompt
}

export async function clearOrgState(orgId: string): Promise<void> {
  cache.delete(orgId)
  const timer = flushTimers.get(orgId)
  if (timer) {
    clearTimeout(timer)
    flushTimers.delete(orgId)
  }
  await fs.rm(stateFile(orgId), { force: true })
}
