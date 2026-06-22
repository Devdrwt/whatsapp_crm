"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Language selector for the Appearance panel.
 *
 * Calls `POST /api/locale` to set the cookie, then `router.refresh()`
 * so the server re-renders the layout with the new locale (the
 * `<html lang>` and every server component pick up the new locale
 * via `getRequestConfig`).
 */

const LOCALES = ["fr", "en"] as const;
type SupportedLocale = (typeof LOCALES)[number];

export function LocaleSelector() {
  const t = useTranslations("settings.locale");
  const current = useLocale() as SupportedLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Optimistic value so the Select reflects the user's choice
  // immediately, even before the refresh round-trip completes.
  const [optimistic, setOptimistic] = useState<SupportedLocale | null>(null);

  const value = optimistic ?? current;

  const onChange = async (next: string | null) => {
    if (next == null || next === value) return;
    if (!(LOCALES as readonly string[]).includes(next)) return;
    const locale = next as SupportedLocale;
    setOptimistic(locale);
    try {
      const res = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        setOptimistic(null);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("[locale] save failed:", err);
      toast.error(t("saveError"));
      setOptimistic(null);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="max-w-sm space-y-2">
        <Label htmlFor="locale-select">{t("label")}</Label>
        <Select value={value} onValueChange={onChange} disabled={pending}>
          <SelectTrigger id="locale-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {t(`options.${loc}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
