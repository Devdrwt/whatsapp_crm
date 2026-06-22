import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ISOLATION_TESTS_ENABLED,
  cleanup,
  createAdminClient,
  createOrgFor,
  createTestUser,
  type TestUser,
} from "./__test-utils";

/**
 * Cross-organization isolation suite.
 *
 * Provisions two real users + two real orgs in a Supabase TEST
 * project and asserts, per sensitive table, the three invariants
 * that MUST hold for multi-tenant safety:
 *
 *   1. The org owner CAN insert + read in their own org (no false
 *      negative — the org-based RLS doesn't lock the owner out).
 *   2. A member of org A CANNOT see any row from org B (RLS USING
 *      filters cross-org).
 *   3. A member of org A CANNOT insert with `org_id = <B>` (RLS
 *      WITH CHECK rejects a forged INSERT).
 *
 * Skips entirely without the TEST_SUPABASE_* env trio (see
 * `__test-utils.ts` / `vitest.config.ts`). With them, ~20 cases
 * run in ~30 seconds against the test project.
 */

const SEC = 1000;
const TEST_TIMEOUT = 15 * SEC;

// ────────────────────────────────────────────────────────────────────
// Table specs — each row template knows how to build a payload for
// a given (orgId, userId). `seed` lets the conversations spec
// provision a contact in the given org first, since it has an FK.
// ────────────────────────────────────────────────────────────────────
interface TableSpec {
  /** Table name. */
  table: string;
  /** Build a row payload. May read `parent` returned by `seed`. */
  buildRow: (
    orgId: string,
    userId: string,
    parent?: Record<string, string>,
  ) => Record<string, unknown>;
  /** Optional: provision parent rows. Service-role client; returns a
   *  scratchpad merged into the eventual payload. */
  seed?: (
    admin: SupabaseClient,
    orgId: string,
    userId: string,
  ) => Promise<Record<string, string>>;
}

const TENANT_TABLES: TableSpec[] = [
  {
    table: "contacts",
    buildRow: (org_id, user_id) => ({
      phone: `+1555${Math.floor(Math.random() * 1_000_000_0)
        .toString()
        .padStart(7, "0")}`,
      name: "Iso Test Contact",
      user_id,
      org_id,
    }),
  },
  {
    table: "tags",
    buildRow: (org_id, user_id) => ({
      name: `iso-tag-${crypto.randomUUID().slice(0, 6)}`,
      color: "#3b82f6",
      user_id,
      org_id,
    }),
  },
  {
    table: "broadcasts",
    buildRow: (org_id, user_id) => ({
      name: "Iso broadcast",
      template_name: "iso_tpl",
      template_language: "en_US",
      user_id,
      org_id,
    }),
  },
  {
    table: "flows",
    buildRow: (org_id, user_id) => ({
      name: "Iso flow",
      status: "draft",
      trigger_type: "keyword",
      trigger_config: { keyword: "iso" },
      user_id,
      org_id,
    }),
  },
  {
    table: "ai_agent_configs",
    buildRow: (org_id, user_id) => ({
      enabled: false,
      agent_name: "Iso Agent",
      user_id,
      org_id,
    }),
  },
  {
    table: "conversations",
    // Needs a parent contact row in the SAME org.
    seed: async (admin, org_id, user_id) => {
      const phone = `+1555${Math.floor(Math.random() * 1_000_000_0)
        .toString()
        .padStart(7, "0")}`;
      const { data, error } = await admin
        .from("contacts")
        .insert({ phone, name: "parent contact", user_id, org_id })
        .select("id")
        .single();
      if (error) throw new Error(`seed contact failed: ${error.message}`);
      return { contact_id: data.id as string };
    },
    buildRow: (org_id, user_id, parent) => ({
      contact_id: parent!.contact_id,
      status: "open",
      user_id,
      org_id,
    }),
  },
];

interface Ctx {
  admin: SupabaseClient;
  userA: TestUser;
  userB: TestUser;
  orgA: string;
  orgB: string;
}

describe.skipIf(!ISOLATION_TESTS_ENABLED)("multi-tenant isolation", () => {
  let ctx: Ctx;

  beforeAll(async () => {
    const admin = createAdminClient();
    const userA = await createTestUser(admin, "a");
    const userB = await createTestUser(admin, "b");
    const orgA = await createOrgFor(userA, "Iso Org A");
    const orgB = await createOrgFor(userB, "Iso Org B");
    ctx = { admin, userA, userB, orgA, orgB };
  }, 60 * SEC);

  afterAll(async () => {
    if (!ctx) return;
    await cleanup(ctx.admin, {
      orgIds: [ctx.orgA, ctx.orgB],
      userIds: [ctx.userA.id, ctx.userB.id],
    });
  }, 30 * SEC);

  describe.each(TENANT_TABLES)("table $table", (spec) => {
    it(
      "owner CAN insert + read in their own org",
      async () => {
        const parent = spec.seed
          ? await spec.seed(ctx.admin, ctx.orgA, ctx.userA.id)
          : undefined;
        const payload = spec.buildRow(ctx.orgA, ctx.userA.id, parent);

        const { data: inserted, error: insertErr } = await ctx.userA.client
          .from(spec.table)
          .insert(payload)
          .select()
          .single();

        expect(insertErr).toBeNull();
        expect(inserted).toBeTruthy();
        expect((inserted as { org_id: string }).org_id).toBe(ctx.orgA);
      },
      TEST_TIMEOUT,
    );

    it(
      "member CANNOT see rows from another org",
      async () => {
        // Seed a row in B via service-role (bypasses RLS) so we know
        // there IS something to potentially leak.
        const parent = spec.seed
          ? await spec.seed(ctx.admin, ctx.orgB, ctx.userB.id)
          : undefined;
        const payload = spec.buildRow(ctx.orgB, ctx.userB.id, parent);
        const { error: seedErr } = await ctx.admin
          .from(spec.table)
          .insert(payload);
        expect(seedErr).toBeNull();

        // User A's client tries to read every row in the table. RLS
        // should filter org B's rows out — A should see ONLY org A.
        const { data, error } = await ctx.userA.client
          .from(spec.table)
          .select("org_id");

        expect(error).toBeNull();
        const fromOtherOrg = (data ?? []).filter(
          (r) => (r as { org_id: string }).org_id === ctx.orgB,
        );
        expect(fromOtherOrg).toHaveLength(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "member CANNOT insert with another org's org_id (WITH CHECK rejects)",
      async () => {
        // Seed a parent in org A so the FK is valid — we want the
        // RLS check to be the only thing that fails, not the FK.
        const parent = spec.seed
          ? await spec.seed(ctx.admin, ctx.orgA, ctx.userA.id)
          : undefined;
        // Build the row but stamp the WRONG org_id (org B).
        const payload = spec.buildRow(ctx.orgB, ctx.userA.id, parent);

        const { error } = await ctx.userA.client
          .from(spec.table)
          .insert(payload);

        expect(error).not.toBeNull();
        // PostgREST surfaces the policy violation in the message. Be
        // lenient on the exact wording — Supabase's error string has
        // varied over versions.
        expect(error?.message ?? "").toMatch(/row[- ]level security|violates|new row/i);
      },
      TEST_TIMEOUT,
    );
  });
});
