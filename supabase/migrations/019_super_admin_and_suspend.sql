-- ============================================================
-- 019 — Super-admin back-office + organization suspend
-- ============================================================
--
-- PR 13. Drwintech staff need a way to see every organization on
-- the platform, watch usage, and suspend a misbehaving tenant.
--
-- Convention: a user is a "super admin" when their
-- `profiles.role = 'super_admin'`. We don't add a CHECK constraint
-- so future role values stay easy. To bootstrap the first super
-- admin (or grant the role to a Drwintech staff member), run in
-- the SQL editor:
--
--   UPDATE profiles SET role = 'super_admin'
--    WHERE email = 'admin@drwintech.com';
--
-- Super admins are typically NOT members of any client org — they
-- access /admin directly. Adding a super-admin email to an
-- org_members row is allowed (useful for QA) but not required.
--
-- ============================================================

-- ------------------------------------------------------------
-- Suspend support on organizations
-- ------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Partial index — most orgs are NOT suspended, so a partial
-- index keeps it tiny and only useful when filtering for the
-- suspended ones (the back-office list).
CREATE INDEX IF NOT EXISTS idx_organizations_suspended_at
  ON organizations(suspended_at)
  WHERE suspended_at IS NOT NULL;

-- ------------------------------------------------------------
-- is_super_admin() — STABLE SECURITY DEFINER helper.
--
-- Wraps the `profiles.role = 'super_admin'` check so RLS
-- policies on `profiles` itself don't recurse: the policy on
-- profiles below uses is_super_admin(), and is_super_admin()
-- bypasses RLS via SECURITY DEFINER. Same anti-recursion
-- pattern as user_in_org() / user_org_role() in migration 015.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- ------------------------------------------------------------
-- RLS policies — super-admin cross-org read access
--
-- Existing per-org policies (PR 1-3) keep gating regular members.
-- The new policies are additive: a super-admin satisfies one of
-- the two policies on each table. A regular user satisfies only
-- the per-org one and sees only their own data.
-- ------------------------------------------------------------

-- organizations
DROP POLICY IF EXISTS "Super-admins read all organizations" ON organizations;
CREATE POLICY "Super-admins read all organizations" ON organizations
  FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Super-admins update organizations" ON organizations;
CREATE POLICY "Super-admins update organizations" ON organizations
  FOR UPDATE USING (is_super_admin());

-- org_members (so the back-office can count + list members)
DROP POLICY IF EXISTS "Super-admins read all members" ON org_members;
CREATE POLICY "Super-admins read all members" ON org_members
  FOR SELECT USING (is_super_admin());

-- profiles (so the back-office can resolve owner emails)
DROP POLICY IF EXISTS "Super-admins read all profiles" ON profiles;
CREATE POLICY "Super-admins read all profiles" ON profiles
  FOR SELECT USING (is_super_admin());

-- Optional: super-admins reading tenant tables (contacts,
-- conversations, messages, etc.) is NOT enabled by default.
-- They can view counts via aggregates on the back-office page
-- (which only needs `organizations` / `org_members`); deeper
-- support tickets where an admin must look at a customer's data
-- should go through a manual `SET LOCAL ROLE service_role` in
-- a Supabase SQL Editor session, auditable and explicit.
