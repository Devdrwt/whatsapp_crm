import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { providerFromConfig } from '@/lib/whatsapp/provider'
import { getActiveOrgIdFromCookies } from '@/lib/orgs/active-org'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const orgId = await getActiveOrgIdFromCookies()
    if (!orgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 })
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('org_id', orgId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 400 }
      )
    }

    // Two very different fetches behind one call: Meta resolves the id to
    // a short-lived CDN URL and downloads it, the gateway serves bytes it
    // already decrypted at receive time. Either way the browser only ever
    // sees this org-scoped proxy, never a provider URL.
    const { buffer, contentType } = await providerFromConfig(config).fetchMedia(
      mediaId
    )

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Error in WhatsApp media GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}
