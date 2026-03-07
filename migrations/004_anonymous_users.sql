-- 004_anonymous_users.sql
-- Adds isAnonymous column for Better Auth anonymous plugin
-- Run: psql $DATABASE_URL < migrations/004_anonymous_users.sql

BEGIN;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isAnonymous" boolean NOT NULL DEFAULT false;

COMMIT;
