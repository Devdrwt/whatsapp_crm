-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- ============================================================

-- ============================================================
-- MULTI-TENANT — LOCK (PR 3)
--
-- After PR 2's expand+backfill, every tenant row carries a real
-- `org_id` and every code path writes/reads it. This migration:
--
--   1. SET NOT NULL on `org_id` for the 25 tenant tables.
--   2. Drop the old `auth.uid() = user_id` RLS policies.
--   3. Create new org-based policies that use `public.user_in_org(org_id)`
--      (the SECURITY DEFINER helper installed by migration 015).
--   4. Swap UNIQUE constraints on whatsapp_config and ai_agent_configs
--      from `(user_id)` to `(org_id)` — one config per org, not per user.
--   5. Swap the partial unique index on flow_runs from
--      `(user_id, contact_id)` to `(org_id, contact_id)` so at most one
--      active run per (org, contact) rather than per (user, contact).
--
-- After this migration, two members of the same org see the same data,
-- and a member of org A can't access org B's rows even via direct
-- Postgres queries with their own JWT.
--
-- `user_id` columns stay (still NOT NULL, still on every INSERT) as
-- audit info — "who originally created this row" — but the RLS no
-- longer references them. `profiles` is identity-only and is NOT
-- migrated. `automation_pending_executions` is service-role-only and
-- keeps that posture (no user-facing policy added).
-- ============================================================

-- ============================================================
-- PHASE A — SET NOT NULL on org_id (25 tables)
-- If a row has org_id IS NULL the ALTER fails loudly: a code path in
-- PR 2 missed it. Find and fix that row (set org_id manually) and
-- re-run; everything is idempotent.
-- ============================================================

-- Direct (16)
ALTER TABLE contacts                       ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE tags                           ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE custom_fields                  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE contact_notes                  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE conversations                  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE message_templates              ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE pipelines                      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE deals                          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE broadcasts                     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE automations                    ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE automation_logs                ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE automation_pending_executions  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE flows                          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE flow_runs                      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE whatsapp_config                ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE ai_agent_configs               ALTER COLUMN org_id SET NOT NULL;

-- Derived (9)
ALTER TABLE contact_tags          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE contact_custom_values ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE messages              ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE message_reactions     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE pipeline_stages       ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE broadcast_recipients  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE automation_steps      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE flow_nodes            ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE flow_run_events       ALTER COLUMN org_id SET NOT NULL;

-- ============================================================
-- PHASE B — DROP old user_id-based policies
-- (named exactly as created in migrations 001 / 006 / 009 / 010 / 014)
-- ============================================================

DROP POLICY IF EXISTS "Users can manage own contacts"            ON contacts;
DROP POLICY IF EXISTS "Users can manage own tags"                ON tags;
DROP POLICY IF EXISTS "Users can manage contact tags"            ON contact_tags;
DROP POLICY IF EXISTS "Users can manage own custom fields"       ON custom_fields;
DROP POLICY IF EXISTS "Users can manage custom values"           ON contact_custom_values;
DROP POLICY IF EXISTS "Users can manage own notes"               ON contact_notes;
DROP POLICY IF EXISTS "Users can manage own conversations"       ON conversations;
DROP POLICY IF EXISTS "Users can view own messages"              ON messages;
DROP POLICY IF EXISTS "Service role can insert messages"         ON messages;
DROP POLICY IF EXISTS "Users can manage own config"              ON whatsapp_config;
DROP POLICY IF EXISTS "Users can manage own templates"           ON message_templates;
DROP POLICY IF EXISTS "Users can manage own pipelines"           ON pipelines;
DROP POLICY IF EXISTS "Users can manage pipeline stages"         ON pipeline_stages;
DROP POLICY IF EXISTS "Users can manage own deals"               ON deals;
DROP POLICY IF EXISTS "Users can manage own broadcasts"          ON broadcasts;
DROP POLICY IF EXISTS "Users can manage broadcast recipients"    ON broadcast_recipients;
DROP POLICY IF EXISTS "Users can manage own automations"         ON automations;
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
DROP POLICY IF EXISTS "Users can view own automation logs"       ON automation_logs;
DROP POLICY IF EXISTS "Users see reactions on their conversations"      ON message_reactions;
DROP POLICY IF EXISTS "Users insert reactions on their conversations"   ON message_reactions;
DROP POLICY IF EXISTS "Users update their own agent reactions"          ON message_reactions;
DROP POLICY IF EXISTS "Users delete their own agent reactions"          ON message_reactions;
DROP POLICY IF EXISTS "Users can manage own flows"               ON flows;
DROP POLICY IF EXISTS "Users manage nodes on their flows"        ON flow_nodes;
DROP POLICY IF EXISTS "Users see own flow runs"                  ON flow_runs;
DROP POLICY IF EXISTS "Users see events on their runs"           ON flow_run_events;
DROP POLICY IF EXISTS "Users can manage own ai agent config"     ON ai_agent_configs;

-- ============================================================
-- PHASE C — CREATE new org-based policies
-- Standard pattern: `FOR ALL USING (user_in_org(org_id))
--                          WITH CHECK (user_in_org(org_id))`.
-- The DROP IF EXISTS guards keep the migration idempotent.
-- ============================================================

DROP POLICY IF EXISTS "Org members access contacts" ON contacts;
CREATE POLICY "Org members access contacts" ON contacts FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access tags" ON tags;
CREATE POLICY "Org members access tags" ON tags FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access contact_tags" ON contact_tags;
CREATE POLICY "Org members access contact_tags" ON contact_tags FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access custom_fields" ON custom_fields;
CREATE POLICY "Org members access custom_fields" ON custom_fields FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access contact_custom_values" ON contact_custom_values;
CREATE POLICY "Org members access contact_custom_values" ON contact_custom_values FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access contact_notes" ON contact_notes;
CREATE POLICY "Org members access contact_notes" ON contact_notes FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access conversations" ON conversations;
CREATE POLICY "Org members access conversations" ON conversations FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

-- messages: single FOR ALL policy. The webhook uses the service_role
-- client (RLS bypass), so we don't need an explicit "service role can
-- insert" policy anymore.
DROP POLICY IF EXISTS "Org members access messages" ON messages;
CREATE POLICY "Org members access messages" ON messages FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access whatsapp_config" ON whatsapp_config;
CREATE POLICY "Org members access whatsapp_config" ON whatsapp_config FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access message_templates" ON message_templates;
CREATE POLICY "Org members access message_templates" ON message_templates FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access pipelines" ON pipelines;
CREATE POLICY "Org members access pipelines" ON pipelines FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access pipeline_stages" ON pipeline_stages;
CREATE POLICY "Org members access pipeline_stages" ON pipeline_stages FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access deals" ON deals;
CREATE POLICY "Org members access deals" ON deals FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access broadcasts" ON broadcasts;
CREATE POLICY "Org members access broadcasts" ON broadcasts FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access broadcast_recipients" ON broadcast_recipients;
CREATE POLICY "Org members access broadcast_recipients" ON broadcast_recipients FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access automations" ON automations;
CREATE POLICY "Org members access automations" ON automations FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access automation_steps" ON automation_steps;
CREATE POLICY "Org members access automation_steps" ON automation_steps FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access automation_logs" ON automation_logs;
CREATE POLICY "Org members access automation_logs" ON automation_logs FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access flows" ON flows;
CREATE POLICY "Org members access flows" ON flows FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access flow_nodes" ON flow_nodes;
CREATE POLICY "Org members access flow_nodes" ON flow_nodes FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members access ai_agent_configs" ON ai_agent_configs;
CREATE POLICY "Org members access ai_agent_configs" ON ai_agent_configs FOR ALL
  USING (public.user_in_org(org_id)) WITH CHECK (public.user_in_org(org_id));

-- flow_runs / flow_run_events: SELECT only at the user surface — writes
-- are performed by the engine via service_role (which bypasses RLS).
DROP POLICY IF EXISTS "Org members see flow_runs" ON flow_runs;
CREATE POLICY "Org members see flow_runs" ON flow_runs FOR SELECT
  USING (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members see flow_run_events" ON flow_run_events;
CREATE POLICY "Org members see flow_run_events" ON flow_run_events FOR SELECT
  USING (public.user_in_org(org_id));

-- message_reactions: four policies. The agent-self constraint on
-- DELETE/UPDATE is tenant-orthogonal — an agent can only mutate their
-- OWN reaction even within the same org.
DROP POLICY IF EXISTS "Org members read reactions" ON message_reactions;
CREATE POLICY "Org members read reactions" ON message_reactions FOR SELECT
  USING (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Org members insert reactions" ON message_reactions;
CREATE POLICY "Org members insert reactions" ON message_reactions FOR INSERT
  WITH CHECK (public.user_in_org(org_id));

DROP POLICY IF EXISTS "Agents update their own reaction" ON message_reactions;
CREATE POLICY "Agents update their own reaction" ON message_reactions FOR UPDATE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND public.user_in_org(org_id)
  );

DROP POLICY IF EXISTS "Agents delete their own reaction" ON message_reactions;
CREATE POLICY "Agents delete their own reaction" ON message_reactions FOR DELETE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND public.user_in_org(org_id)
  );

-- automation_pending_executions has no user-facing policy: writes/reads
-- happen via service_role only (the cron). Nothing to add here.

-- ============================================================
-- PHASE D — UNIQUE constraints + partial index
-- ============================================================

-- whatsapp_config: one row per org (was: per user)
ALTER TABLE whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_user_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_config_org_id_key'
      AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_org_id_key UNIQUE (org_id);
  END IF;
END $$;

-- ai_agent_configs: one row per org (was: per user)
ALTER TABLE ai_agent_configs DROP CONSTRAINT IF EXISTS ai_agent_configs_user_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_agent_configs_org_id_key'
      AND conrelid = 'ai_agent_configs'::regclass
  ) THEN
    ALTER TABLE ai_agent_configs
      ADD CONSTRAINT ai_agent_configs_org_id_key UNIQUE (org_id);
  END IF;
END $$;

-- flow_runs: at most one active run per (org, contact). The old index
-- enforced it per (user, contact), which is now wrong for multi-agents.
DROP INDEX IF EXISTS idx_one_active_run_per_contact;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_run_per_contact_org
  ON flow_runs (org_id, contact_id)
  WHERE status = 'active';
