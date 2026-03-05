# Async Job Architecture

## Problem

Extemp's speech processing pipeline has two slow steps:

1. **Transcription** — Audio is sent to a Modal-hosted Whisper endpoint. Cold starts can take 30s+.
2. **Evaluation** — The transcript is sent to OpenRouter (LLM) for coaching feedback. Takes 5-15s.

Vercel Hobby plan has a **10-second function timeout**. If either step exceeds this, the serverless function is killed mid-flight and the client gets a 504 or no response at all — resulting in a blank results screen.

## Solution: Fire-and-Forget + Polling

Decouple the HTTP response from the actual work using Vercel's `waitUntil()` API and a Postgres job queue.

### Components

```
┌─────────┐     ┌──────────────────┐     ┌──────────┐     ┌───────────────┐
│  Client  │────▶│  Vercel Functions │────▶│ Supabase │     │ Modal / LLM   │
│ (React)  │◀────│  (Serverless)    │◀────│ (Postgres)│     │ (Whisper, OR) │
└─────────┘     └──────────────────┘     └──────────┘     └───────────────┘
                         │                                        ▲
                         └──── waitUntil (background) ────────────┘
```

| Component | Role |
|-----------|------|
| **Client** | Submits work, polls for results |
| **Vercel Functions** | Creates jobs, processes in background, serves poll results |
| **Supabase (Postgres)** | Stores job state — the shared memory between submit/poll/background |
| **Modal** | Runs Whisper transcription (external, no DB access) |
| **OpenRouter** | Runs LLM evaluation (external, no DB access) |

### The `job` Table

```sql
CREATE TABLE job (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL,        -- 'transcribe' | 'evaluate'
  status      text NOT NULL,        -- 'pending' → 'processing' → 'completed' | 'failed'
  input       jsonb DEFAULT '{}',   -- metadata about the request
  result      jsonb,                -- full response payload when completed
  error       text,                 -- error message if failed
  created_at  timestamptz,
  updated_at  timestamptz
);
```

Postgres generates the job UUID automatically via `gen_random_uuid()`. The Vercel function reads it back with `RETURNING id`.

## Request Flow

### Step 1: Submit (< 1 second)

```
Client                         Vercel Function              Postgres
  │                            │                             │
  │── POST /api/transcribe ──▶│                             │
  │   (audio in FormData)      │── INSERT job (pending) ───▶│
  │                            │◀── RETURNING id ───────────│
  │                            │                             │
  │                            │── waitUntil(process...) ───│── (registers background work)
  │◀── 202 { jobId } ─────────│  (function returns)         │
```

The function responds **immediately** with the job ID. The `waitUntil()` call tells Vercel: "I have more work — keep this function alive after the response is sent."

This is the key insight: **the response and the work are decoupled**. The 10-second timeout applies to *sending the response*, not to `waitUntil` continuations.

### Step 2: Background Processing (up to ~60s)

```
                               Vercel (background)          Modal         Postgres
                               │                            │             │
                               │── UPDATE status=processing─│────────────▶│
                               │                            │             │
                               │── POST audio ─────────────▶│             │
                               │   (Whisper runs ~10-30s)   │             │
                               │◀── { transcript, ... } ────│             │
                               │                            │             │
                               │── UPDATE status=completed ─│────────────▶│
                               │   result = { transcript }  │             │
```

The `waitUntil` continuation runs in the same function instance but **after** the HTTP response is already sent. It:
1. Updates the job to `processing`
2. Calls the external service (Modal or OpenRouter)
3. Writes the result back to the job row
4. Updates status to `completed` (or `failed` with an error message)

Modal/OpenRouter never touch the database. They're just HTTP endpoints that receive input and return output. The Vercel function is the intermediary.

### Step 3: Client Polls (each poll < 100ms)

```
Client                         Vercel Function              Postgres
  │                            │                             │
  │── GET /api/jobs/:id ─────▶│── SELECT * FROM job ───────▶│
  │◀── { status: processing } ─│◀── row ────────────────────│
  │                            │                             │
  │   (wait 2 seconds)         │                             │
  │                            │                             │
  │── GET /api/jobs/:id ─────▶│── SELECT * FROM job ───────▶│
  │◀── { status: completed,   ─│◀── row ────────────────────│
  │      result: {...} }       │                             │
```

Each poll is a **new, independent serverless function invocation**. It reads one row from Postgres — trivially fast. The client polls every 2 seconds until `status` is `completed` or `failed`.

## Full Pipeline (Transcription + Evaluation)

```
User clicks "I'm Done"
        │
        ▼
┌─ handleSpeakingComplete ─────────────────────────────────────┐
│                                                               │
│  1. Stop recording, get audio blob                           │
│                                                               │
│  2. POST /api/transcribe  →  { jobId: "abc" }               │
│     Poll /api/jobs/abc every 2s                              │
│     Eventually: { status: completed, result: transcript }    │
│                                                               │
│  3. POST /api/evaluate  →  { jobId: "def" }                 │
│     (sends transcript + prompt to LLM)                       │
│     Poll /api/jobs/def every 2s                              │
│     Eventually: { status: completed, result: feedback }      │
│                                                               │
│  4. Show results                                              │
└───────────────────────────────────────────────────────────────┘
```

## Modal Prewarming

Modal containers have cold starts (10-30s to load Whisper into GPU memory). We mitigate this by **prewarming the container early in the user flow**:

```
Recording starts (speaking phase begins)
        │
        └── fire-and-forget: POST /api/prewarm
                │
                └── Sends empty FormData to Modal endpoint
                    Modal spins up the container (~10-30s)
                    (returns error on empty file — that's fine)
```

Modal cold starts take ~10-30 seconds. By firing the prewarm when speaking begins, the container is hot by the time the user finishes their 1-2 minute speech. Firing earlier (e.g., during prep) risks the container cooling down before the actual request.

The prewarm is best-effort — if it fails, the transcription still works, just with a cold start delay.

## Local Development (Bun)

The Bun dev server (`src/index.tsx`) uses the same API contract but with an **in-memory job store** instead of Postgres:

```typescript
const jobs = new Map<string, Job>();
```

This means:
- Same client code works in dev and production
- No DB migration needed for local dev
- Jobs are lost on server restart (fine for dev)
- Bun has no timeout issues, but the async pattern is preserved for API compatibility

## Error Handling

| Scenario | What happens |
|----------|-------------|
| Modal times out | Job status → `failed`, client falls back to mock transcript |
| OpenRouter fails (both models) | Job status → `failed`, client falls back to mock feedback |
| DB insert fails | Submit returns 500, client falls back to mock data |
| Poll timeout (2 min) | Client gives up, shows mock results |
| `waitUntil` crashes | Job stays `processing` forever — client poll times out after 2 min |

The client always shows *something*. Mock data is the ultimate fallback so the user never sees a blank screen.

## File Map

```
api/
  transcribe.ts          Submit transcription job (Vercel)
  evaluate.ts            Submit evaluation job (Vercel)
  prewarm.ts             Prewarm Modal container (Vercel)
  jobs/[id].ts           Poll job status (Vercel)
  _lib/db.ts             Postgres connection pool

src/
  index.tsx              Bun dev server (in-memory job store)
  components/
    PracticePage.tsx      Client: pollJob(), startTranscription(), startEvaluation()

migrations/
  003_jobs_table.sql     Job table schema
```
