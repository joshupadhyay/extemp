# Database Schema Plan

## Overview

Supabase (Postgres) for persistence. Better Auth for authentication (Google + GitHub OAuth). All times UTC. UUIDs for primary keys.

---

## Better Auth Core Tables

These are managed by Better Auth — we don't modify their structure, but we reference `user.id` as our foreign key everywhere.

| Table | Key Columns |
|-------|------------|
| `user` | id, name, email, emailVerified, image, createdAt, updatedAt |
| `session` | id, token, expiresAt, userId, ipAddress, userAgent, createdAt, updatedAt |
| `account` | id, accountId, providerId, userId, accessToken, refreshToken, scope, createdAt, updatedAt |
| `verification` | id, identifier, value, expiresAt, createdAt, updatedAt |

---

## App Tables

### `category`

Prompt categories. Seeded at deploy time, user-extensible later.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `slug` | text | unique, e.g. `opinion`, `policy` |
| `label` | text | display name |
| `description` | text | nullable, short blurb |
| `created_at` | timestamptz | default now() |

### `prompt`

Speaking prompts. System-seeded prompts have `author_id = null`. Users can submit their own.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `text` | text | the prompt |
| `category_id` | uuid | FK → category.id |
| `difficulty` | text | `easy` / `medium` / `hard`, nullable |
| `suggested_framework` | text | PREP, STAR, etc., nullable |
| `author_id` | uuid | FK → user.id, nullable (null = system prompt) |
| `is_public` | boolean | default true. false = only visible to author |
| `created_at` | timestamptz | default now() |

Index on `category_id`. Index on `author_id`.

### `dialogue_chain`

Groups multiple dialogues into a session (e.g. "5 rounds back-to-back"). A single standalone dialogue still belongs to a chain of length 1 — keeps queries uniform.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → user.id |
| `title` | text | nullable, auto-generated or user-named |
| `settings_snapshot` | jsonb | `{ prepTime, speakingTime }` at time of chain start |
| `started_at` | timestamptz | default now() |
| `finished_at` | timestamptz | nullable, set when last dialogue completes |

Index on `user_id`.

### `dialogue`

One round of speaking. Always belongs to a chain.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `chain_id` | uuid | FK → dialogue_chain.id |
| `prompt_id` | uuid | FK → prompt.id |
| `sequence` | int | position within chain (1-indexed) |
| `prep_time` | int | seconds allowed for prep |
| `speaking_time` | int | seconds allowed for speaking |
| `actual_duration` | real | seconds of actual audio, nullable |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz | nullable |

Unique constraint on `(chain_id, sequence)`. Index on `chain_id`.

### `transcript`

Raw transcription output from Whisper. One per dialogue.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `dialogue_id` | uuid | FK → dialogue.id, unique |
| `text` | text | plain transcript |
| `highlighted_text` | text | HTML with filler words marked |
| `duration` | real | audio duration in seconds |
| `speech_rate_wpm` | real | words per minute |
| `words` | jsonb | `WordTimestamp[]` — word-level timestamps |
| `segments` | jsonb | `TranscriptionSegment[]` |
| `filler_words` | jsonb | `{ count, details, positions }` |
| `clarity_metrics` | jsonb | `ClarityMetrics` object, nullable |
| `audio_storage_key` | text | nullable, path/key if we store audio blobs later |
| `created_at` | timestamptz | default now() |

### `feedback`

LLM coaching feedback. One per dialogue.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `dialogue_id` | uuid | FK → dialogue.id, unique |
| `overall_score` | real | 1–10 |
| `coach_summary` | text | 3–5 sentence coaching narrative |
| `score_structure` | real | 1–10 |
| `score_clarity` | real | 1–10 |
| `score_specificity` | real | 1–10 |
| `score_persuasiveness` | real | 1–10 |
| `score_language` | real | 1–10 |
| `framework_detected` | text | nullable |
| `framework_suggested` | text | nullable |
| `time_usage` | text | `underfilled` / `good` / `overfilled` |
| `strengths` | jsonb | `string[]` |
| `improvement` | text | single biggest area |
| `model_used` | text | which LLM produced this, nullable |
| `created_at` | timestamptz | default now() |

---

## Design Decisions

### Why flat score columns instead of JSONB for feedback?

Individual columns (`score_structure`, `score_clarity`, etc.) let us:
- Query/sort by any single dimension (`ORDER BY score_clarity DESC`)
- Build per-dimension trend charts without JSON extraction
- Add indexes on specific scores later

The tradeoff is more columns, but there are only 5 scores and they're stable.

### Why JSONB for transcript data?

`words`, `segments`, `filler_words`, and `clarity_metrics` are deeply nested, variable-length arrays. Normalizing them into rows would add 4+ tables with no query benefit — we always read/write them as a unit.

### Why always create a chain, even for single dialogues?

Avoids a `chain_id nullable` pattern on `dialogue` and two code paths (chained vs standalone). A chain of 1 is cheap. Later features (chain stats, streaks, "do 5 rounds") work without schema changes.

### Why `settings_snapshot` on chain?

User might change their prep/speaking times between sessions. The snapshot preserves what settings were in effect for historical accuracy.

### Prompt authorship

`author_id = null` means system-seeded. When user-submitted prompts ship, rows get an `author_id` and `is_public` defaults true. Private prompts (`is_public = false`) are only visible to the author.

---

## Row-Level Security (Supabase RLS)

| Table | Policy |
|-------|--------|
| `category` | read: everyone. write: admin only (for now). |
| `prompt` | read: `is_public = true OR author_id = auth.uid()`. write: own rows only. |
| `dialogue_chain` | read/write: `user_id = auth.uid()` |
| `dialogue` | read/write: via chain ownership (join to dialogue_chain) |
| `transcript` | read/write: via dialogue → chain ownership |
| `feedback` | read/write: via dialogue → chain ownership |

---

## Migration Order

1. Better Auth tables (auto-migrated via CLI)
2. `category` + seed data
3. `prompt` + seed data (migrate existing `prompts.json`)
4. `dialogue_chain`
5. `dialogue`
6. `transcript`
7. `feedback`
8. RLS policies

---

## Future Considerations (not building now)

- `audio_blob` storage via Supabase Storage (currently not storing audio)
- `tag` / `prompt_tag` tables for prompt tagging
- `user_stats` materialized view for dashboard aggregates
- `shared_chain` table for sharing results with others
- Leaderboard / public profiles (opt-in)
