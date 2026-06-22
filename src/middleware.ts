import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_MAX_AGE } from '@/lib/orgs/active-org'

// Routes a signed-in user must have an org to access. Anything below
// these prefixes is gated through the onboarding flow if the user has
// no org yet.
const PROTECTED_PATHS = [
  '/dashboard',
  '/inbox',
  '/contacts',
  '/pipelines',
  '/broadcasts',
  '/automations',
  '/flows',
  '/settings',
]

const ONBOARDING_PATH = '/onboarding'
const CREATE_ORG_PATH = '/onboarding/create-org'

// Paths that require auth but NOT an active org — an invited user lands
// on /accept-invite/<token> before they belong to any org.
const ACCEPT_INVITE_PATH = '/accept-invite'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Auth pages — redirect to dashboard (or the requested `next` if
  // it's an internal path) if already logged in.
  if (user && (path === '/login' || path === '/signup' || path === '/forgot-password')) {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.searchParams.get('next')
    url.pathname = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p))
  const isOnboarding = path.startsWith(ONBOARDING_PATH)
  const isAcceptInvite = path.startsWith(ACCEPT_INVITE_PATH)
  // The super-admin console lives at /admin/*. It's auth-required
  // but NOT org-gated — the assertSuperAdmin() server-side check in
  // the (admin) layout handles role enforcement.
  const isAdmin = path === '/admin' || path.startsWith('/admin/')
  const isSuspended = path === '/suspended'

  // Protected pages — login wall.
  if (
    !user &&
    (isProtected || isOnboarding || isAcceptInvite || isAdmin || isSuspended)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Round-trip the requested path so we redirect back after sign-in.
    // Keep query string too — invitations don't carry one but a future
    // protected route might.
    url.searchParams.set('next', path + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  // API routes that need auth (webhook excluded — Meta hits it unauth'd).
  if (!user && path.startsWith('/api/whatsapp/') && !path.includes('/webhook')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // /api/admin/* — super-admin only; the route handlers re-check via
  // checkSuperAdmin() but the unauth path can be short-circuited here.
  if (!user && path.startsWith('/api/admin/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Org gate — once authenticated and visiting a gated route, make sure
  // (a) the user has at least one org (else send them to onboarding) and
  // (b) the active-org cookie points at an org they belong to.
  // /accept-invite is intentionally excluded: an invited user lands
  // there before they belong to any org.
  if (user && (isProtected || isOnboarding) && !isAcceptInvite) {
    // Join organizations so we can see suspended_at in one round-trip
    // — the suspension gate below would otherwise need a 2nd query.
    const { data: rows } = await supabase
      .from('org_members')
      .select('org_id, organizations!inner(suspended_at)')
      .eq('user_id', user.id)

    const memberships = (rows ?? []) as unknown as Array<{
      org_id: string
      organizations: { suspended_at: string | null }
    }>
    const orgIds = memberships.map((m) => m.org_id)

    if (orgIds.length === 0) {
      // No org yet. Onboarding is allowed; everything else funnels there.
      if (!isOnboarding) {
        const url = request.nextUrl.clone()
        url.pathname = CREATE_ORG_PATH
        return NextResponse.redirect(url)
      }
    } else {
      // At least one org. Sync the active-org cookie if missing or stale.
      const current = request.cookies.get(ACTIVE_ORG_COOKIE)?.value
      let resolvedCurrent = current
      if (!current || !orgIds.includes(current)) {
        resolvedCurrent = orgIds[0]
        supabaseResponse.cookies.set(ACTIVE_ORG_COOKIE, orgIds[0], {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: ACTIVE_ORG_COOKIE_MAX_AGE,
        })
      }

      // Suspension gate (PR 13). If the active org is suspended, funnel
      // the user to /suspended which surfaces the explanation page +
      // the org switcher. Onboarding is still reachable so they can
      // pivot to a fresh org if they want.
      const activeMembership = memberships.find(
        (m) => m.org_id === resolvedCurrent,
      )
      if (
        activeMembership?.organizations.suspended_at &&
        path !== '/suspended' &&
        !isOnboarding
      ) {
        const url = request.nextUrl.clone()
        url.pathname = '/suspended'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
