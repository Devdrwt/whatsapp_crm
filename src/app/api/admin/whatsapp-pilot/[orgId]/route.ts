import { NextResponse } from 'next/server'
import { checkSuperAdmin } from '@/lib/admin/guard'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  connectSession,
  getSessionState,
  logoutSession,
  GatewayError,
} from '@/lib/whatsapp/baileys-gateway'

/**
 * Pair / inspect / unpair an org's Baileys pilot session.
 *
 *   GET    /api/admin/whatsapp-pilot/[orgId]  → current gateway state
 *   POST   /api/admin/whatsapp-pilot/[orgId]  → start pairing (QR or code)
 *   DELETE /api/admin/whatsapp-pilot/[orgId]  → log out, back to no transport
 *
 * Deliberately mounted under /api/admin and gated on `super_admin`, not on
 * org membership. The Baileys transport is an internal pilot: it runs an
 * unofficial WhatsApp Web client, it can get the paired handset banned, and
 * it is not something a client may switch on for themselves. Keeping the
 * only entry point behind the Drwintech staff guard is what makes
 * "pilot-only" an enforced property rather than a note in a doc.
 *
 * There is no UI for this on purpose — it is driven by staff from the
 * admin console or by hand. Shipping a self-service pairing screen is the
 * step that would turn the pilot into a product, and that decision has
 * not been taken. See docs/pilote-baileys.md.
 */

interface RouteContext {
  params: Promise<{ orgId: string }>
}

function gatewayConfigured(): boolean {
  return Boolean(process.env.WA_GATEWAY_URL && process.env.WA_GATEWAY_TOKEN)
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        'The Baileys pilot gateway is not enabled on this deployment. Start the wa-gateway service and set WA_GATEWAY_URL / WA_GATEWAY_TOKEN / WA_GATEWAY_SECRET.',
    },
    { status: 503 },
  )
}

/** Map a GatewayError onto its own status; anything else is a 500. */
function gatewayFailure(err: unknown, context: string) {
  if (err instanceof GatewayError) {
    console.error(`[whatsapp-pilot] ${context}:`, err.message)
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(`[whatsapp-pilot] ${context}:`, err)
  return NextResponse.json({ error: 'Gateway call failed' }, { status: 500 })
}

/**
 * Mirror the gateway's view of the socket onto the config row so the rest
 * of the app (and the admin console) can read session health without a
 * round-trip to the side-car. The gateway stays the source of truth; this
 * is a cache, so a write failure is logged and swallowed.
 */
async function mirrorSessionState(
  orgId: string,
  state: { state: string; phoneNumber: string | null; lastError: string | null },
) {
  const patch: Record<string, unknown> = {
    session_status: state.state,
    session_last_error: state.lastError,
    session_updated_at: new Date().toISOString(),
    status: state.state === 'connected' ? 'connected' : 'disconnected',
    updated_at: new Date().toISOString(),
  }
  // Only claim the number once WhatsApp has actually told us what it is —
  // writing a placeholder would collide with UNIQUE(phone_number_id).
  if (state.phoneNumber) {
    patch.phone_number_id = state.phoneNumber
    patch.connected_at = new Date().toISOString()
  }

  const { error } = await supabaseAdmin()
    .from('whatsapp_config')
    .update(patch)
    .eq('org_id', orgId)
    .eq('provider', 'baileys')

  if (error) {
    console.error(
      '[whatsapp-pilot] failed to mirror session state onto whatsapp_config:',
      error.message,
    )
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const admin = await checkSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!gatewayConfigured()) return notConfigured()

  const { orgId } = await context.params

  try {
    const state = await getSessionState(orgId)
    await mirrorSessionState(orgId, state)
    return NextResponse.json(state)
  } catch (err) {
    return gatewayFailure(err, `GET state for org ${orgId}`)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await checkSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!gatewayConfigured()) return notConfigured()

  const { orgId } = await context.params

  let body: { phoneNumber?: unknown } = {}
  try {
    body = (await request.json()) ?? {}
  } catch {
    // No body is the normal case (QR pairing). Only pairing-code mode
    // needs to say which number it is about to pair.
  }
  const phoneNumber =
    typeof body.phoneNumber === 'string' && /^\d{8,15}$/.test(body.phoneNumber)
      ? body.phoneNumber
      : undefined

  const db = supabaseAdmin()

  const { data: org, error: orgError } = await db
    .from('organizations')
    .select('id, owner_id')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Refuse to hijack an org that is live on the official API. Flipping a
  // Meta org onto the pilot would silently drop its WABA credentials and
  // point a client's inbox at an unofficial socket — the exact accident
  // the pilot-only rule exists to prevent. Moving an org back to Meta is
  // a normal save on the settings page; moving it here is not.
  const { data: existing } = await db
    .from('whatsapp_config')
    .select('id, provider')
    .eq('org_id', orgId)
    .maybeSingle()

  if (existing && existing.provider !== 'baileys') {
    return NextResponse.json(
      {
        error:
          'This organization is configured for the Meta Cloud API. Reset its WhatsApp configuration first if you really intend to move it onto the pilot transport.',
      },
      { status: 409 },
    )
  }

  let state
  try {
    state = await connectSession(orgId, phoneNumber)
  } catch (err) {
    return gatewayFailure(err, `connect org ${orgId}`)
  }

  if (existing) {
    await mirrorSessionState(orgId, state)
  } else {
    // First pairing for this org. `phone_number_id` is NOT NULL, and we
    // may not know the real number until the handset finishes pairing, so
    // seed it with the org id — unique by construction, and overwritten
    // with the true number by the next mirrorSessionState.
    const { error: insertError } = await db.from('whatsapp_config').insert({
      user_id: org.owner_id,
      org_id: orgId,
      provider: 'baileys',
      phone_number_id: state.phoneNumber ?? `pilot:${orgId}`,
      access_token: null,
      status: state.state === 'connected' ? 'connected' : 'disconnected',
      session_status: state.state,
      session_last_error: state.lastError,
      session_updated_at: new Date().toISOString(),
      connected_at: state.state === 'connected' ? new Date().toISOString() : null,
    })

    if (insertError) {
      console.error(
        '[whatsapp-pilot] gateway paired but config insert failed:',
        insertError.message,
      )
      return NextResponse.json(
        {
          error: `Gateway session started but the config row could not be saved: ${insertError.message}`,
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json(state)
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await checkSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!gatewayConfigured()) return notConfigured()

  const { orgId } = await context.params

  try {
    await logoutSession(orgId)
  } catch (err) {
    // A gateway that has already forgotten the session (404) is the state
    // we were aiming for, so let it fall through to the row cleanup.
    if (!(err instanceof GatewayError && err.status === 404)) {
      return gatewayFailure(err, `logout org ${orgId}`)
    }
  }

  // Drop the row entirely rather than leaving a disconnected pilot config
  // behind: an org with no transport shows the normal "WhatsApp not
  // configured" path, which is the honest state after an unpair.
  const { error } = await supabaseAdmin()
    .from('whatsapp_config')
    .delete()
    .eq('org_id', orgId)
    .eq('provider', 'baileys')

  if (error) {
    console.error('[whatsapp-pilot] config cleanup failed:', error.message)
    return NextResponse.json(
      { error: `Logged out of the gateway but config cleanup failed: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
