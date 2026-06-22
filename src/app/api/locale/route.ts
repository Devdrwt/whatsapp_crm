import { NextResponse } from "next/server";
import {
  getActiveLocale,
  isLocale,
  setActiveLocaleCookie,
} from "@/lib/i18n/active-locale";

/**
 * Active-locale endpoint.
 *
 * GET  → read the current active locale from the cookie (fallback
 *        to the default locale when the cookie is absent).
 * POST → switch the active locale. Body: `{ locale: 'fr' | 'en' }`.
 *
 * Public — no auth required: the locale is a UI preference that
 * applies equally to anonymous visitors on /login and authenticated
 * users on /dashboard.
 */

export async function GET() {
  const locale = await getActiveLocale();
  return NextResponse.json({ locale });
}

export async function POST(request: Request) {
  let body: { locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isLocale(body.locale)) {
    return NextResponse.json(
      { error: "Unsupported locale" },
      { status: 400 },
    );
  }

  await setActiveLocaleCookie(body.locale);
  return NextResponse.json({ locale: body.locale });
}
