-- 001_app_tables.sql
-- Creates app tables for Extemp: category, prompt, dialogue_chain, dialogue, transcript, feedback
-- Run: psql $DATABASE_URL < migrations/001_app_tables.sql

BEGIN;

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- category
-- ============================================================================
CREATE TABLE IF NOT EXISTS category (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  label         text NOT NULL,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed categories
INSERT INTO category (slug, label, description) VALUES
  ('opinion',        'Opinion',        'Questions asking for your personal stance'),
  ('policy',         'Policy',         'Questions about public policy and governance'),
  ('hypothetical',   'Hypothetical',   'Speculative "what if" scenarios'),
  ('current-events', 'Current Events', 'Questions about recent news and developments'),
  ('philosophical',  'Philosophical',  'Deep questions about ethics, meaning, and values'),
  ('professional',   'Professional',   'Workplace and career-related questions')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- prompt
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text                 text NOT NULL,
  category_id          uuid NOT NULL REFERENCES category(id),
  difficulty           text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  suggested_framework  text,
  author_id            text REFERENCES "user"(id),
  is_public            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_category ON prompt(category_id);
CREATE INDEX IF NOT EXISTS idx_prompt_author ON prompt(author_id);

-- ============================================================================
-- dialogue_chain
-- ============================================================================
CREATE TABLE IF NOT EXISTS dialogue_chain (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL REFERENCES "user"(id),
  title             text,
  settings_snapshot jsonb NOT NULL DEFAULT '{}',
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dialogue_chain_user ON dialogue_chain(user_id);

-- ============================================================================
-- dialogue
-- ============================================================================
CREATE TABLE IF NOT EXISTS dialogue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id        uuid NOT NULL REFERENCES dialogue_chain(id) ON DELETE CASCADE,
  prompt_id       uuid NOT NULL REFERENCES prompt(id),
  sequence        int NOT NULL DEFAULT 1,
  prep_time       int,
  speaking_time   int,
  actual_duration real,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  UNIQUE (chain_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_dialogue_chain ON dialogue(chain_id);

-- ============================================================================
-- transcript
-- ============================================================================
CREATE TABLE IF NOT EXISTS transcript (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id        uuid NOT NULL UNIQUE REFERENCES dialogue(id) ON DELETE CASCADE,
  text               text NOT NULL DEFAULT '',
  highlighted_text   text,
  duration           real,
  speech_rate_wpm    real,
  words              jsonb,
  segments           jsonb,
  filler_words       jsonb,
  clarity_metrics    jsonb,
  audio_storage_key  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- feedback
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id           uuid NOT NULL UNIQUE REFERENCES dialogue(id) ON DELETE CASCADE,
  overall_score         real NOT NULL,
  coach_summary         text NOT NULL DEFAULT '',
  score_structure       real,
  score_clarity         real,
  score_specificity     real,
  score_persuasiveness  real,
  score_language        real,
  framework_detected    text,
  framework_suggested   text,
  time_usage            text CHECK (time_usage IN ('underfilled', 'good', 'overfilled')),
  strengths             jsonb NOT NULL DEFAULT '[]',
  improvement           text,
  model_used            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMIT;
