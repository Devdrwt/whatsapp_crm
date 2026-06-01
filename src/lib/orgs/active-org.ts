import { cookies } from "next/headers";

/**
 * Active-organization cookie helpers (server-side).
 *
 * The active org is carried in an `httpOnly` cookie that's set by the
 * middleware on every authenticated request (and by the
 * `POST /api/orgs/active` route when the user switches org). Server
 * Components, Route Handlers, and Server Actions can read it via
 * `getActiveOrgIdFromCookies()`.
 *
 * Clients can't read the cookie directly (it's `httpOnly`) — they
 * fetch their orgs + the active org id from the auth context (see
 * `src/hooks/use-auth.tsx`) which calls `GET /api/orgs/active`.
 */

export const ACTIVE_ORG_COOKIE = "drwintech.org-id";

/** 30 days. Re-set on every successful middleware pass so it never
 *  expires while the user is active. */
export const ACTIVE_ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Read the active org id from the request cookies. Returns null when
 *  the cookie is absent. Membership validity is checked by RLS / the
 *  middleware, not here. */
export async function getActiveOrgIdFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

/** Set the cookie from a Server Action or Route Handler. (Middleware
 *  writes the cookie directly on the NextResponse — it doesn't go
 *  through this helper.) */
export async function setActiveOrgCookie(orgId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_ORG_COOKIE_MAX_AGE,
  });
}

export async function clearActiveOrgCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_ORG_COOKIE);
}
