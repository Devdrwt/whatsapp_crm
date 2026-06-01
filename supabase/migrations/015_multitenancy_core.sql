-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- Uses IF NOT EXISTS for tables/indexes/columns and DROP IF EXISTS
-- for policies/triggers (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- MULTI-TENANT SOCLE (PR 1)
-- Introduces organizations / org_members / org_invitations and the
-- RLS helper functions used by the org-based policies that will land
-- with migration 017 (PR 3 — RLS swap). PR 1 itself does NOT touch
-- any existing tenant table: it only seeds the org-membership graph
-- and back-fills one org per existing profile so the app keeps
-- working seamlessly while we ship PR 2/3 behind it.
-- ============================================================

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  -- ON DELETE RESTRICT: dropping a user must not orphan their org —
  -- ownership is transferred via a future "transfer ownership" flow.
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan         TEXT NOT NULL DEFAULT 'trial'
               CHECK (plan IN ('trial','starter','pro','suspended')),
  max_agents   INTEGER NOT NULL DEFAULT 2,
  max_contacts INTEGER NOT NULL DEFAULT 1000,
  currency     TEXT NOT NULL DEFAULT 'TND',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);

-- ============================================================
-- ORG_MEMBERS (the membership graph)
-- ============================================================
CREATE TABLE IF NOT EXISTS org_members (
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'agent'
             CHECK (role IN ('owner','admin','agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Reverse-lookup index — "which orgs does this user belong to?" hits
-- this on every middleware request, so it must be O(log n).
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

-- ============================================================
-- ORG_INVITATIONS (used by PR 4 — not yet exposed in the UI)
-- ============================================================
CREATE TABLE IF NOT EXISTS org_invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent')),
  token       TEXT NOT NULL UNIQUE,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One open invitation per (org, email) — re-invites overwrite.
  UNIQUE(org_id, email)
);

-- ============================================================
-- RLS HELPERS (SECURITY DEFINER bypasses RLS on org_members
-- to break the recursion: "org_members RLS reads org_members".)
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_in_org(target UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
     WHERE user_id = auth.uid() AND org_id = target
  );
$$;

CREATE OR REPLACE FUNCTION public.user_org_role(target UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM org_members
   WHERE user_id = auth.uid() AND org_id = target;
$$;

-- Atomic org creation: the "Admins manage membership" policy on
-- org_members would otherwise reject the very first insert (the user
-- isn't admin of an org that doesn't exist yet). Wrapped in SECURITY
-- DEFINER so the bootstrap insert succeeds, then RLS resumes.
CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO organizations (name, owner_id)
  VALUES (p_name, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner');

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization(TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_organization(TEXT) TO authenticated;

-- ============================================================
-- RLS POLICIES on the socle
-- ============================================================
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;

-- organizations
DROP POLICY IF EXISTS "Members read their org" ON organizations;
CREATE POLICY "Members read their org" ON organizations FOR SELECT
  USING (public.user_in_org(id));

DROP POLICY IF EXISTS "Admins update their org" ON organizations;
CREATE POLICY "Admins update their org" ON organizations FOR UPDATE
  USING (public.user_org_role(id) IN ('owner','admin'))
  WITH CHECK (public.user_org_role(id) IN ('owner','admin'));

-- org_members
DROP POLICY IF EXISTS "Members read membership" ON org_members;
CREATE POLICY "Members read membership" ON org_members FOR SELECT
  USING (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Admins manage membership" ON org_members;
CREATE POLICY "Admins manage membership" ON org_members FOR ALL
  USING (public.user_org_role(org_id) IN ('owner','admin'))
  WITH CHECK (public.user_org_role(org_id) IN ('owner','admin'));

-- org_invitations
DROP POLICY IF EXISTS "Admins manage invitations" ON org_invitations;
CREATE POLICY "Admins manage invitations" ON org_invitations FOR ALL
  USING (public.user_org_role(org_id) IN ('owner','admin'))
  WITH CHECK (public.user_org_role(org_id) IN ('owner','admin'));

-- ============================================================
-- updated_at trigger on organizations
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BACKFILL — give every existing profile an "owner" org.
-- Idempotent (NOT EXISTS / ON CONFLICT). Re-runs do nothing.
--
-- Name defaults to the profile's full_name, then email, then
-- "My workspace". owners can rename it later.
-- ============================================================
INSERT INTO organizations (name, owner_id)
SELECT COALESCE(NULLIF(p.full_name, ''), p.email, 'My workspace'),
       p.user_id
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.owner_id = p.user_id
);

INSERT INTO org_members (org_id, user_id, role)
SELECT o.id, o.owner_id, 'owner'
FROM organizations o
ON CONFLICT (org_id, user_id) DO NOTHING;
