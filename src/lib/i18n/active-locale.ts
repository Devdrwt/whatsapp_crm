import { cookies } from "next/headers";

/**
 * Active-locale cookie helpers (server-side).
 *
 * The active locale is carried in a cookie set by `POST /api/locale`.
 * Server Components, Route Handlers, the i18n request config
 * (i18n/request.ts), and the root layout (for `<html lang>`) all
 * read it via `getActiveLocale()`.
 *
 * Parallel mechanism to `getActiveOrgIdFromCookies` in
 * `src/lib/orgs/active-org.ts` and the theme cookie wired into the
 * boot script in `src/app/layout.tsx`.
 */

export const ACTIVE_LOCALE_COOKIE = "drwintech.locale";

/** 1 year. The locale is a stable user preference, not a session
 *  state — keep it across logouts. */
export const ACTIVE_LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** French is the default — Drwintech ships to francophone SMEs. */
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/** Read the active locale from the request cookies. Falls back to
 *  `DEFAULT_LOCALE` when the cookie is absent or holds an unsupported
 *  value. */
export async function getActiveLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(ACTIVE_LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Set the cookie from a Route Handler. Not httpOnly — the value is
 *  not sensitive and the LocaleSelector can read it for hydration if
 *  ever needed. */
export async function setActiveLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_LOCALE_COOKIE_MAX_AGE,
  });
}
