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

  // Auth pages — redirect to dashboard if already logged in.
  if (user && (path === '/login' || path === '/signup' || path === '/forgot-password')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p))
  const isOnboarding = path.startsWith(ONBOARDING_PATH)

  // Protected pages — login wall.
  if (!user && (isProtected || isOnboarding)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // API routes that need auth (webhook excluded — Meta hits it unauth'd).
  if (!user && path.startsWith('/api/whatsapp/') && !path.includes('/webhook')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Org gate — once authenticated and visiting a gated route, make sure
  // (a) the user has at least one org (else send them to onboarding) and
  // (b) the active-org cookie points at an org they belong to.
  if (user && (isProtected || isOnboarding)) {
    const { data: rows } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)

    const orgIds = (rows ?? []).map((r) => r.org_id as string)

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
      if (!current || !orgIds.includes(current)) {
        supabaseResponse.cookies.set(ACTIVE_ORG_COOKIE, orgIds[0], {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: ACTIVE_ORG_COOKIE_MAX_AGE,
        })
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
