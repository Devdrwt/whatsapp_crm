import { getRequestConfig } from "next-intl/server";
import { getActiveLocale } from "@/lib/i18n/active-locale";

/**
 * next-intl request configuration.
 *
 * We don't use the segment-based [locale] routing (no /fr/... URL
 * prefix — Drwintech is a private dashboard behind auth, no SEO
 * benefit). The active locale comes from the `drwintech.locale`
 * cookie. `requestLocale` from next-intl is intentionally ignored.
 *
 * Messages are loaded from `messages/<locale>.json` at the repo root.
 */
export default getRequestConfig(async () => {
  const locale = await getActiveLocale();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
