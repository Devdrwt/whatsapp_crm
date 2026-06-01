"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_MODE,
  STORAGE_KEY,
  isMode,
  type Mode,
  type ResolvedMode,
} from "@/lib/themes";

/**
 * ThemeProvider — owns the active light/dark MODE for the whole app.
 *
 * The boot script in `src/app/layout.tsx` has already toggled the
 * `.dark` class on <html> before React hydrates, so the first paint
 * is already in the right mode. This provider reads the stored mode,
 * keeps the `.dark` class in sync, follows the OS when mode="system",
 * and syncs across tabs.
 *
 * Persistence is localStorage only (device-scoped).
 */

interface ThemeContextValue {
  mode: Mode;
  /** Concrete light|dark after resolving "system". */
  resolved: ResolvedMode;
  setMode: (next: Mode) => void;
  /** Convenience flip between light and dark (used by the header toggle). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolveMode(mode: Mode): ResolvedMode {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyMode(mode: Mode): ResolvedMode {
  const resolved = resolveMode(mode);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }
  return resolved;
}

function readInitialMode(): Mode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isMode(stored)) return stored;
  } catch {
    // localStorage can throw in private-browsing / sandboxed contexts.
  }
  return DEFAULT_MODE;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readInitialMode);
  const [resolved, setResolved] = useState<ResolvedMode>(() =>
    resolveMode(readInitialMode()),
  );

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    setResolved(applyMode(next));
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // In-memory state still updates so the current tab works.
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  // Follow the OS while mode === "system".
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyMode("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  // Sync from other tabs.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !isMode(e.newValue)) return;
      setModeState(e.newValue);
      setResolved(applyMode(e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: DEFAULT_MODE,
      resolved: "light",
      setMode: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
