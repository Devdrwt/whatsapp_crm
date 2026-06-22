import { afterEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();
const mockCookies = {
  get: (name: string) =>
    cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
  set: (name: string, value: string) => {
    cookieStore.set(name, value);
  },
  delete: (name: string) => {
    cookieStore.delete(name);
  },
};

vi.mock("next/headers", () => ({
  cookies: async () => mockCookies,
}));

import {
  ACTIVE_LOCALE_COOKIE,
  DEFAULT_LOCALE,
  getActiveLocale,
  isLocale,
  setActiveLocaleCookie,
} from "./active-locale";

afterEach(() => {
  cookieStore.clear();
});

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("rejects unsupported / wrong-shape inputs", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale("FR")).toBe(false); // case-sensitive
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(123)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("getActiveLocale", () => {
  it("returns the default locale when the cookie is absent", async () => {
    await expect(getActiveLocale()).resolves.toBe(DEFAULT_LOCALE);
  });

  it("returns the cookie value when it holds a supported locale", async () => {
    cookieStore.set(ACTIVE_LOCALE_COOKIE, "en");
    await expect(getActiveLocale()).resolves.toBe("en");
  });

  it("falls back to the default when the cookie holds garbage", async () => {
    cookieStore.set(ACTIVE_LOCALE_COOKIE, "klingon");
    await expect(getActiveLocale()).resolves.toBe(DEFAULT_LOCALE);
  });
});

describe("setActiveLocaleCookie", () => {
  it("writes the cookie", async () => {
    await setActiveLocaleCookie("en");
    expect(cookieStore.get(ACTIVE_LOCALE_COOKIE)).toBe("en");
  });
});
