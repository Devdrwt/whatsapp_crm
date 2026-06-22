"use client";

import { Check, Sun, Moon, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTheme } from "@/hooks/use-theme";
import { type Mode } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { LocaleSelector } from "@/components/settings/locale-selector";

/**
 * Appearance panel — light / dark / system selector + locale selector.
 *
 * One proprietary accent (emerald), so the only choice is the mode.
 * Click a card → applies + persists immediately (a single `.dark`
 * class toggle on <html>); the boot script replays it before first
 * paint on later loads. Saved to this device.
 *
 * Language sits in the same panel — both are "how the app looks"
 * preferences. Saved to the browser via cookie.
 */

const OPTIONS: {
  id: Mode;
  icon: typeof Sun;
}[] = [
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
  { id: "system", icon: Monitor },
];

export function AppearancePanel() {
  const { mode, setMode } = useTheme();
  const t = useTranslations("settings.appearance");
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const isActive = o.id === mode;
            const name = t(`modes.${o.id}.name`);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setMode(o.id)}
                aria-pressed={isActive}
                aria-label={t("themeAria", { name })}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-card transition-colors",
                  isActive
                    ? "border-primary/60 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <o.icon className="h-4 w-4" />
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Check className="h-3 w-3" />
                      {t("active")}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {name}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t(`modes.${o.id}.hint`)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <LocaleSelector />
    </div>
  );
}
