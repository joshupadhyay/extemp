-- 003_jobs_table.sql
-- Async job queue for transcription and evaluation
-- Run: psql $DATABASE_URL < migrations/003_jobs_table.sql

BEGIN;

CREATE TABLE IF NOT EXISTS job (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('transcribe', 'evaluate')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input       jsonb NOT NULL DEFAULT '{}',
  result      jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_status ON job(status) WHERE status IN ('pending', 'processing');

COMMIT;
