import { afterEach, describe, expect, it, vi } from "vitest";

// The supabase client returned by createClient(). The mock supports
// the chains we use: auth.getUser() + from().select().eq().maybeSingle().
const fakeClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => fakeClient),
}));

// next/navigation.redirect throws a special error type internally to
// halt rendering. For the test, we throw a tagged Error instead so we
// can assert the redirect path.
const redirectMock = vi.fn((url: string) => {
  throw new Error(`__redirect:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

import { assertSuperAdmin, checkSuperAdmin } from "./guard";

function mockProfileRole(role: string | null) {
  fakeClient.from.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: role ? { role } : null }),
      }),
    }),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("assertSuperAdmin", () => {
  it("redirects to /login when there is no user", async () => {
    fakeClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(assertSuperAdmin()).rejects.toThrow(
      "__redirect:/login?next=/admin",
    );
  });

  it("redirects to /dashboard for a non-super-admin", async () => {
    fakeClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
    });
    mockProfileRole("user");
    await expect(assertSuperAdmin()).rejects.toThrow("__redirect:/dashboard");
  });

  it("returns the user for a super_admin", async () => {
    const user = { id: "u1", email: "admin@drwintech.com" };
    fakeClient.auth.getUser.mockResolvedValueOnce({ data: { user } });
    mockProfileRole("super_admin");
    await expect(assertSuperAdmin()).resolves.toBe(user);
  });
});

describe("checkSuperAdmin", () => {
  it("returns null when not signed in", async () => {
    fakeClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(checkSuperAdmin()).resolves.toBeNull();
  });

  it("returns null for a non-super-admin", async () => {
    fakeClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
    });
    mockProfileRole("user");
    await expect(checkSuperAdmin()).resolves.toBeNull();
  });

  it("returns the user for a super_admin", async () => {
    const user = { id: "u1" };
    fakeClient.auth.getUser.mockResolvedValueOnce({ data: { user } });
    mockProfileRole("super_admin");
    await expect(checkSuperAdmin()).resolves.toBe(user);
  });
});
