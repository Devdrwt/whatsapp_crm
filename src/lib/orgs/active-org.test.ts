import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the Supabase server client. Mock cookies() too so we can flip
// the active-org cookie between cases.
const fakeClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => fakeClient),
}));

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { requireOrgMembership } from "./active-org";

function setCookie(value: string | null) {
  cookieStore.get.mockReturnValue(value ? { value } : undefined);
}

function mockMembership(found: boolean) {
  fakeClient.from.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: found ? { org_id: "org-1" } : null,
        }),
      }),
    }),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireOrgMembership", () => {
  it("401 when there is no user", async () => {
    fakeClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    setCookie("org-1");
    const result = await requireOrgMembership();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("400 when there is no active-org cookie", async () => {
    fakeClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
    });
    setCookie(null);
    const result = await requireOrgMembership();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it("403 when the cookie names an org the user does not belong to", async () => {
    fakeClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
    });
    setCookie("org-victim");
    // RLS would return no row for a non-member.
    mockMembership(false);
    const result = await requireOrgMembership();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns the validated context for a real member", async () => {
    const user = { id: "u1", email: "ali@example.com" };
    fakeClient.auth.getUser.mockResolvedValueOnce({ data: { user } });
    setCookie("org-1");
    mockMembership(true);
    const result = await requireOrgMembership();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toBe(user);
      expect(result.orgId).toBe("org-1");
      expect(result.supabase).toBe(fakeClient);
    }
  });
});
