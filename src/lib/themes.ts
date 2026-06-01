/**
 * Light/dark MODE catalog (Drwintech design system).
 *
 * The product has ONE proprietary accent (emerald) — there is no
 * accent picker. The only user-facing axis is light vs dark, with a
 * "system" option that follows the OS.
 *
 * Mode is applied by toggling the `.dark` class on <html> (see the
 * boot script in layout.tsx and use-theme.tsx). The token values for
 * each mode live in `src/app/globals.css` (`:root` = light, `.dark` =
 * dark).
 */

export const MODES = ["light", "dark", "system"] as const;

export type Mode = (typeof MODES)[number];

/** Concrete mode after resolving "system" against the OS preference. */
export type ResolvedMode = "light" | "dark";

export const DEFAULT_MODE: Mode = "light";

export const STORAGE_KEY = "drwintech.mode";

export function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" && (MODES as ReadonlyArray<string>).includes(value)
  );
}
