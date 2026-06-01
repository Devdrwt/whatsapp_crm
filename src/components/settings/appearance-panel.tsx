"use client";

import { Check, Sun, Moon, Monitor } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { type Mode } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Appearance panel — light / dark / system selector.
 *
 * One proprietary accent (emerald), so the only choice is the mode.
 * Click a card → applies + persists immediately (a single `.dark`
 * class toggle on <html>); the boot script replays it before first
 * paint on later loads. Saved to this device.
 */

const OPTIONS: {
  id: Mode;
  name: string;
  hint: string;
  icon: typeof Sun;
}[] = [
  { id: "light", name: "Light", hint: "Bright and airy.", icon: Sun },
  { id: "dark", name: "Dark", hint: "Easy on the eyes.", icon: Moon },
  { id: "system", name: "System", hint: "Follows your device.", icon: Monitor },
];

export function AppearancePanel() {
  const { mode, setMode } = useTheme();
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the interface theme. Saved to this device.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => {
          const isActive = o.id === mode;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              aria-pressed={isActive}
              aria-label={`Thème ${o.name}`}
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
                    Active
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {o.name}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {o.hint}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
