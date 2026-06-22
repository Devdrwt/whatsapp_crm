-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- ============================================================

-- ============================================================
-- INVITATIONS — accept_invitation RPC (PR 4)
--
-- Accepts an invitation atomically:
--   1. validates the token (exists, not expired, not yet accepted),
--   2. confirms the JWT's email matches the invitation email,
--   3. inserts the (org, user, role) row in org_members,
--   4. marks the invitation accepted_at.
--
-- Why SECURITY DEFINER: the user accepting isn't a member of the org
-- yet, so the "Admins manage membership" policy on org_members would
-- reject the INSERT. The function bypasses RLS to perform the bootstrap.
--
-- Errors are raised as SQLERROR strings the API can map to HTTP codes:
--   - invitation_not_found            → 410
--   - invitation_already_accepted     → 410
--   - invitation_expired              → 410
--   - invitation_email_mismatch       → 403
--   - not_authenticated               → 401
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   RECORD;
  v_email TEXT;
BEGIN
  SELECT * INTO v_inv FROM org_invitations WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_already_accepted';
  END IF;

  IF v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'invitation_expired';
  END IF;

  -- Pull the JWT's email (auth.uid() is set; auth.users join is fine
  -- because SECURITY DEFINER runs as postgres which can read auth.*).
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Case-insensitive match — Supabase Auth stores emails lowercased
  -- but invitation emails come from a form and may carry capitals.
  IF LOWER(v_email) <> LOWER(v_inv.email) THEN
    RAISE EXCEPTION 'invitation_email_mismatch';
  END IF;

  -- Idempotent: a re-clicked acceptance just no-ops on the membership
  -- and still updates accepted_at below.
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_inv.org_id, auth.uid(), v_inv.role)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE org_invitations SET accepted_at = NOW() WHERE id = v_inv.id;

  RETURN v_inv.org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
