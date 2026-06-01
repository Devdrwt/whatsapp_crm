-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- Uses IF NOT EXISTS for tables/indexes and DROP IF EXISTS
-- for policies/triggers (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- AI_AGENT_CONFIGS
-- Per-account LLM "AI agent" that replies in natural language to
-- inbound WhatsApp messages no flow or automation handled.
--
-- Keyed by user_id (one config per account, mirroring
-- whatsapp_config). The multi-tenant refactor (migrations 014+ per
-- the SaaS plan) will add org_id via expand -> backfill -> lock;
-- this table follows the same `auth.uid() = user_id` RLS pattern
-- so that conversion is mechanical.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  agent_name TEXT NOT NULL DEFAULT 'Assistant',
  -- Tone + behavioural instructions for the agent persona.
  persona TEXT NOT NULL DEFAULT '',
  -- Business knowledge (menu, prices, FAQ) pasted inline. Injected
  -- into the cached system prompt block at generation time.
  knowledge_base TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'
    CHECK (model IN ('claude-sonnet-4-6', 'claude-haiku-4-5-20251001')),
  -- Sent (and conversation flipped to pending) when the agent has no
  -- answer. Lets a human take over instead of the bot hallucinating.
  fallback_message TEXT NOT NULL DEFAULT
    'Je n''ai pas cette information, je transmets votre demande à un conseiller.',
  -- How many past messages of the conversation to feed as context.
  max_history INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_user ON ai_agent_configs(user_id);

ALTER TABLE ai_agent_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own ai agent config" ON ai_agent_configs;
CREATE POLICY "Users can manage own ai agent config" ON ai_agent_configs FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON ai_agent_configs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
