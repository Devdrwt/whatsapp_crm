-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- Uses IF NOT EXISTS for tables/indexes/columns.
-- ============================================================

-- ============================================================
-- MULTI-TENANT — EXPAND (PR 2)
--
-- Adds a NULLABLE `org_id` column on every tenant table (16 direct
-- tables that have their own `user_id`, plus 9 derived tables that
-- inherit `org_id` from their parent), backs it up from the
-- owner's org (created by migration 015's backfill), and indexes
-- the new column.
--
-- RLS is NOT changed here — every table keeps its `auth.uid() = user_id`
-- policy. App code reads and writes BOTH `user_id` (for the existing
-- RLS WITH CHECK) and `org_id` (for the upcoming org-based RLS in
-- PR 3 / migration 017). Until 017 lands, single-user-per-org accounts
-- see the same data as before; multi-org users see only their active
-- org's data thanks to the new `.eq('org_id', activeOrgId)` filters
-- on the app side.
--
-- Order matters during backfill:
--   1. Direct tables — fill `org_id` from the org whose owner is the
--      row's `user_id`.
--   2. Derived tables — fill `org_id` from the parent row's `org_id`.
-- Running step 2 before step 1 leaves derived rows with NULLs.
-- ============================================================

-- ============================================================
-- 1. DIRECT TABLES — ADD COLUMN + INDEX
-- ============================================================

ALTER TABLE contacts                       ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE tags                           ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE custom_fields                  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE contact_notes                  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE conversations                  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE message_templates              ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE pipelines                      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE deals                          ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE broadcasts                     ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE automations                    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE automation_logs                ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE automation_pending_executions  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE flows                          ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE flow_runs                      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_config                ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ai_agent_configs               ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contacts_org                     ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_tags_org                         ON tags(org_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_org                ON custom_fields(org_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_org                ON contact_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org                ON conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_org            ON message_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_org                    ON pipelines(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_org                        ON deals(org_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_org                   ON broadcasts(org_id);
CREATE INDEX IF NOT EXISTS idx_automations_org                  ON automations(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_org              ON automation_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_pending_executions_org ON automation_pending_executions(org_id);
CREATE INDEX IF NOT EXISTS idx_flows_org                        ON flows(org_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_org                    ON flow_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_org              ON whatsapp_config(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_org             ON ai_agent_configs(org_id);

-- ============================================================
-- 2. DERIVED TABLES — ADD COLUMN + INDEX
-- ============================================================

ALTER TABLE contact_tags          ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE contact_custom_values ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE messages              ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE message_reactions     ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE pipeline_stages       ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE broadcast_recipients  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE automation_steps      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE flow_nodes            ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE flow_run_events       ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contact_tags_org          ON contact_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_contact_custom_values_org ON contact_custom_values(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_org              ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_org     ON message_reactions(org_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org       ON pipeline_stages(org_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_org  ON broadcast_recipients(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_steps_org      ON automation_steps(org_id);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_org            ON flow_nodes(org_id);
CREATE INDEX IF NOT EXISTS idx_flow_run_events_org       ON flow_run_events(org_id);

-- ============================================================
-- 3. BACKFILL — DIRECT TABLES (from organizations.owner_id)
-- Each `WHERE … org_id IS NULL` clause makes the migration safely
-- re-runnable: rows already filled (by us or by app code post-PR2)
-- are skipped.
-- ============================================================

UPDATE contacts                       SET org_id = o.id FROM organizations o WHERE o.owner_id = contacts.user_id                       AND contacts.org_id                       IS NULL;
UPDATE tags                           SET org_id = o.id FROM organizations o WHERE o.owner_id = tags.user_id                           AND tags.org_id                           IS NULL;
UPDATE custom_fields                  SET org_id = o.id FROM organizations o WHERE o.owner_id = custom_fields.user_id                  AND custom_fields.org_id                  IS NULL;
UPDATE contact_notes                  SET org_id = o.id FROM organizations o WHERE o.owner_id = contact_notes.user_id                  AND contact_notes.org_id                  IS NULL;
UPDATE conversations                  SET org_id = o.id FROM organizations o WHERE o.owner_id = conversations.user_id                  AND conversations.org_id                  IS NULL;
UPDATE message_templates              SET org_id = o.id FROM organizations o WHERE o.owner_id = message_templates.user_id              AND message_templates.org_id              IS NULL;
UPDATE pipelines                      SET org_id = o.id FROM organizations o WHERE o.owner_id = pipelines.user_id                      AND pipelines.org_id                      IS NULL;
UPDATE deals                          SET org_id = o.id FROM organizations o WHERE o.owner_id = deals.user_id                          AND deals.org_id                          IS NULL;
UPDATE broadcasts                     SET org_id = o.id FROM organizations o WHERE o.owner_id = broadcasts.user_id                     AND broadcasts.org_id                     IS NULL;
UPDATE automations                    SET org_id = o.id FROM organizations o WHERE o.owner_id = automations.user_id                    AND automations.org_id                    IS NULL;
UPDATE automation_logs                SET org_id = o.id FROM organizations o WHERE o.owner_id = automation_logs.user_id                AND automation_logs.org_id                IS NULL;
UPDATE automation_pending_executions  SET org_id = o.id FROM organizations o WHERE o.owner_id = automation_pending_executions.user_id  AND automation_pending_executions.org_id  IS NULL;
UPDATE flows                          SET org_id = o.id FROM organizations o WHERE o.owner_id = flows.user_id                          AND flows.org_id                          IS NULL;
UPDATE flow_runs                      SET org_id = o.id FROM organizations o WHERE o.owner_id = flow_runs.user_id                      AND flow_runs.org_id                      IS NULL;
UPDATE whatsapp_config                SET org_id = o.id FROM organizations o WHERE o.owner_id = whatsapp_config.user_id                AND whatsapp_config.org_id                IS NULL;
UPDATE ai_agent_configs               SET org_id = o.id FROM organizations o WHERE o.owner_id = ai_agent_configs.user_id               AND ai_agent_configs.org_id               IS NULL;

-- ============================================================
-- 4. BACKFILL — DERIVED TABLES (from the parent row's org_id)
-- ============================================================

UPDATE contact_tags          SET org_id = c.org_id FROM contacts      c WHERE c.id = contact_tags.contact_id          AND contact_tags.org_id          IS NULL;
UPDATE contact_custom_values SET org_id = c.org_id FROM contacts      c WHERE c.id = contact_custom_values.contact_id AND contact_custom_values.org_id IS NULL;
UPDATE messages              SET org_id = c.org_id FROM conversations c WHERE c.id = messages.conversation_id          AND messages.org_id              IS NULL;
UPDATE message_reactions     SET org_id = c.org_id FROM conversations c WHERE c.id = message_reactions.conversation_id AND message_reactions.org_id     IS NULL;
UPDATE pipeline_stages       SET org_id = p.org_id FROM pipelines     p WHERE p.id = pipeline_stages.pipeline_id       AND pipeline_stages.org_id       IS NULL;
UPDATE broadcast_recipients  SET org_id = b.org_id FROM broadcasts    b WHERE b.id = broadcast_recipients.broadcast_id AND broadcast_recipients.org_id  IS NULL;
UPDATE automation_steps      SET org_id = a.org_id FROM automations   a WHERE a.id = automation_steps.automation_id    AND automation_steps.org_id      IS NULL;
UPDATE flow_nodes            SET org_id = f.org_id FROM flows         f WHERE f.id = flow_nodes.flow_id                AND flow_nodes.org_id            IS NULL;
UPDATE flow_run_events       SET org_id = r.org_id FROM flow_runs     r WHERE r.id = flow_run_events.flow_run_id       AND flow_run_events.org_id       IS NULL;
