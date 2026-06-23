import { NextResponse } from 'next/server'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { requireOrgMembership } from '@/lib/orgs/active-org'
import type { AutomationTriggerType } from '@/types'

/**
 * Manual trigger for testing or for external integrations that want
 * to fire automations. Auth is required, and the caller must belong
 * to the active org — `requireOrgMembership` runs that gate so a
 * forged `drwintech.org-id` cookie can't fire automations in a tenant
 * the caller isn't a member of.
 */
export async function POST(request: Request) {
  const guard = await requireOrgMembership()
  if (!guard.ok) return guard.response
  const { user, orgId } = guard

  const body = await request.json().catch(() => null)
  if (!body?.trigger_type) {
    return NextResponse.json({ error: 'trigger_type required' }, { status: 400 })
  }

  await runAutomationsForTrigger({
    userId: user.id,
    orgId,
    triggerType: body.trigger_type as AutomationTriggerType,
    contactId: body.contact_id ?? null,
    context: body.context ?? {},
  })

  return NextResponse.json({ ok: true })
}
