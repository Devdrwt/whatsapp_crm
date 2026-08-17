-- ============================================================
-- 020 — WhatsApp provider column (Meta / Baileys pilot)
-- ============================================================
--
-- Idempotent migration — safe to run multiple times.
--
-- Until now every org went through the Meta Cloud API: the config row
-- carried a `phone_number_id` + an encrypted long-lived `access_token`.
-- This migration makes the transport explicit so a second provider can
-- coexist behind the same `whatsapp_config` row.
--
--   provider = 'meta'     → Meta Cloud API. Unchanged, still the default,
--                           the ONLY provider that may be put in front of
--                           a paying client.
--   provider = 'baileys'  → unofficial WhatsApp Web transport, served by
--                           the `wa-gateway` side-car. INTERNAL PILOT ONLY
--                           (demos, end-to-end testing). It violates
--                           WhatsApp's ToS and can get the connected
--                           number banned — see docs/pilote-baileys.md.
--
-- Nothing here switches any existing row: the DEFAULT is 'meta' and the
-- backfill is a no-op on a fresh column. Rolling this migration out on
-- its own changes no behaviour.
--
-- ============================================================

-- ------------------------------------------------------------
-- 1. The provider column
-- ------------------------------------------------------------
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta';

-- Existing rows predate the column; they are all Meta by construction.
UPDATE whatsapp_config SET provider = 'meta' WHERE provider IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'whatsapp_config_provider_check'
       AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_provider_check
      CHECK (provider IN ('meta', 'baileys'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. access_token becomes provider-dependent
-- ------------------------------------------------------------
--
-- A Baileys row has no token at all — the credentials are Signal keys
-- held by the gateway, never by Postgres. Rather than storing a fake
-- encrypted placeholder (which would silently satisfy a NOT NULL and
-- then explode at decrypt time), drop the blanket NOT NULL and require
-- the token only where it is meaningful.
--
ALTER TABLE whatsapp_config ALTER COLUMN access_token DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'whatsapp_config_meta_needs_token'
       AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_meta_needs_token
      CHECK (provider <> 'meta' OR access_token IS NOT NULL);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Session bookkeeping for the pilot transport
-- ------------------------------------------------------------
--
-- The gateway owns the actual Signal credentials on its own volume.
-- What we keep here is only what the CRM needs to render state and to
-- route a send: which number is paired, and how the last connection
-- attempt went. `session_status` mirrors the gateway's socket state.
--
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS session_status TEXT;
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS session_last_error TEXT;
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS session_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'whatsapp_config_session_status_check'
       AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_session_status_check
      CHECK (
        session_status IS NULL
        OR session_status IN ('pairing', 'connected', 'disconnected', 'logged_out')
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Notes on constraints we deliberately did NOT touch
-- ------------------------------------------------------------
--
-- `UNIQUE(phone_number_id)` (migration 013) still applies and still
-- earns its keep: for a Baileys row we store the paired number's JID
-- user part (E.164 without the leading '+') in `phone_number_id`, so the
-- webhook's existing lookup-by-phone_number_id resolves a gateway event
-- to exactly one org with no new code path. The constraint additionally
-- stops two orgs from claiming the same physical handset.
--
-- `UNIQUE(org_id)` (migration 017) also stands: one org, one transport.
-- Switching an org between providers is a deliberate update of the
-- existing row, not a second row — which is what we want, since two
-- live transports for one inbox would double-deliver every message.

COMMENT ON COLUMN whatsapp_config.provider IS
  'Transport for this org: ''meta'' (Meta Cloud API, production) or ''baileys'' (unofficial WhatsApp Web via the wa-gateway side-car — INTERNAL PILOT ONLY, never client-facing).';
