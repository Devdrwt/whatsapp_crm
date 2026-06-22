import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers for the cross-org isolation suite (`isolation.test.ts`).
 *
 * These reach a REAL Supabase project — they require a separate
 * "test" project (NOT the dev / prod one) with all 18 migrations
 * applied. The suite is gated to skip when the TEST_SUPABASE_* env
 * vars are absent (see `vitest.config.ts`), so importing this file
 * outside of the gated suite is fine but the functions will throw on
 * call.
 *
 * Underscore prefix marks this as a test-only utility module.
 */

export const TEST_URL = process.env.TEST_SUPABASE_URL ?? "";
export const TEST_ANON = process.env.TEST_SUPABASE_ANON_KEY ?? "";
export const TEST_SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";

export const ISOLATION_TESTS_ENABLED = Boolean(
  TEST_URL && TEST_ANON && TEST_SERVICE,
);

/** Service-role client — bypasses RLS. Used to provision users, seed
 *  cross-org data, and clean up after the suite. */
export function createAdminClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Authenticated client for a specific user — its RLS reads come back
 *  as that user, exactly like the browser SDK would. */
function createUserClient(accessToken: string): SupabaseClient {
  return createClient(TEST_URL, TEST_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

/**
 * Provision a real auth user via the admin API and return a client
 * authenticated as that user. Email and password are randomised so
 * concurrent runs (or partial cleanups) don't collide.
 */
export async function createTestUser(
  admin: SupabaseClient,
  label: string,
): Promise<TestUser> {
  const email = `iso-test-${label}-${crypto.randomUUID()}@drwintech.test`;
  const password = `Pwd-${crypto.randomUUID()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Iso Test ${label}` },
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? "no user"}`);
  }

  // Sign in via the anon client to obtain a real JWT — admin.createUser
  // doesn't return one; we need a session-bound client for RLS to see
  // auth.uid().
  const anon = createClient(TEST_URL, TEST_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sess, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !sess.session) {
    throw new Error(`signIn failed: ${signInErr?.message ?? "no session"}`);
  }

  return {
    id: created.user.id,
    email,
    password,
    client: createUserClient(sess.session.access_token),
  };
}

/** Calls `rpc('create_organization', ...)` as the given user. Returns
 *  the new org id. The RPC is `SECURITY DEFINER` and inserts both the
 *  organization row and the (user, owner) membership atomically. */
export async function createOrgFor(
  user: TestUser,
  name: string,
): Promise<string> {
  const { data, error } = await user.client.rpc("create_organization", {
    p_name: name,
  });
  if (error || typeof data !== "string") {
    throw new Error(`create_organization failed: ${error?.message ?? "no id"}`);
  }
  return data;
}

/**
 * Tear-down. Order matters because `organizations.owner_id` is
 * `ON DELETE RESTRICT`: the org has to go before the owner can.
 * `ON DELETE CASCADE` on each tenant table (migration 016) cascades
 * the org deletion through every dependent row.
 */
export async function cleanup(
  admin: SupabaseClient,
  ids: { orgIds?: string[]; userIds?: string[] },
): Promise<void> {
  for (const orgId of ids.orgIds ?? []) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
  for (const userId of ids.userIds ?? []) {
    await admin.auth.admin.deleteUser(userId);
  }
}
