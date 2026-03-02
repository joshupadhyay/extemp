# Extemp — PRD

**Date:** 2026-03-02
**Author:** Josh Upadhyay
**Context:** Fractal Tech Week 5 (Polish Week) — finish something completely.

## One-Liner

Practice tool for impromptu speaking: get a prompt, prep, speak, get AI coaching feedback with framework detection.

---

## Success Criteria (V1 — ship by Wednesday Mar 5)

- [ ] End-to-end flow: prompt → prep timer → record → transcribe → AI feedback
- [ ] Under 20s processing time (stop recording → results displayed) on warm container
- [ ] Conversational coach-style feedback with highlighted transcript + quick stats
- [ ] Speaking framework detection (PREP, STAR, Problem-Solution, etc.) + suggestion
- [ ] Adjustable prep time (1/2 min) and speaking time (1/2 min) via settings
- [ ] Sessions persist to localStorage
- [ ] Session history page showing past attempts with scores
- [ ] Deployed to Vercel with shareable URL
- [ ] README with architecture diagram
- [ ] CI via GitHub Actions

## Non-Goals (V1)

- No auth / user accounts
- No Supabase / remote persistence (localStorage only — add Supabase + Google SSO later)
- No real-time/streaming transcription
- No progress charts or trends
- No voice analysis (pace, volume, tone) — transcript-only analysis
- No audio replay/storage
- No prompt category filtering (random only)

---

## Architecture

```
┌──────────────────┐        ┌──────────────────────┐
│   Next.js App    │        │    Modal (GPU: T4)    │
│   (Vercel)       │        │                      │
│                  │  POST  │  ┌───────────┐       │
│  Audio Recorder ─┼───────►│  │  faster-   │       │
│  Prep Timer      │  WebM  │  │  whisper   │       │
│  Speaking Timer   │        │  │  lg-v3-turbo│      │
│  Results Panel   │◄───────┼──│            │       │
│  History Page    │ text   │  └───────────┘       │
│  Settings        │        └──────────────────────┘
└────────┬─────────┘
         │  ▲
         │  │ feedback JSON
         ▼  │
    ┌────────────────┐      ┌──────────────────────┐
    │  localStorage  │      │   OpenRouter          │
    │  sessions +    │      │   LLM feedback        │
    │  settings      │      │   (cheap/fast model)  │
    └────────────────┘      └──────────────────────┘

Flow: Audio → Modal (transcribe) → Next.js → OpenRouter (feedback) → client
      Next.js orchestrates both calls, can stream transcript before feedback.
      Sessions saved to localStorage. Supabase + auth added later.
```

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audio capture | MediaRecorder API | Simpler than Web Audio, gives clean blob |
| Audio format | WebM/Opus (native browser) | 10x smaller than WAV, Whisper handles it natively |
| Transcription | faster-whisper large-v3-turbo on Modal T4 | ~$0.003/transcription, free tier covers months of use. CTranslate2 engine = ~4x faster than openai-whisper. Turbo variant trades negligible accuracy for significant speed. |
| Feedback LLM | OpenRouter (cheap/fast model) | Model-agnostic, easy to swap, cheaper than direct API |
| Orchestration | Next.js API route | Modal transcribes only; Next.js calls OpenRouter for feedback. Decoupled = faster prompt iteration + can show transcript before feedback. |
| Cold start | `scaledown_window=300` | 5-min warm window covers a full practice session. (Modal 1.0 renamed `container_idle_timeout` → `scaledown_window`) |
| Model cache | Modal Volume (`download_root`) | Avoids re-downloading 3GB model on cold start. First cold start: ~30-60s (download). Subsequent cold starts: ~5-15s (load from volume). Warm: ~3-5s for 2-min audio. |
| Persistence | localStorage | Zero setup, zero friction. Supabase + Google SSO added post-V1. |
| Deploy | Vercel | Free, instant deploys, native Next.js support |

## Cost

| Resource | Per Session | Monthly (10/day) |
|---|---|---|
| Modal T4 (Whisper) | ~$0.003 | $0.90 |
| OpenRouter (LLM feedback) | ~$0.001 | $0.30 |
| localStorage | — | $0 |
| Vercel | Free tier | $0 |
| **Total** | | **~$1.20/mo** |

---

## Feedback Philosophy

**The goal is confidence.** Extemp trains people to collect their thoughts on the fly and sound confident doing it. Feedback should be actionable and framework-aware — not just scores, but *specific coaching on how to structure thinking faster*.

The AI should:
- **Teach frameworks by showing, not telling.** If someone rambles, show them how PREP would have organized that exact response. "You had a strong opinion but no structure. Try PREP: state your point, give one reason, back it with your Tesla example, then restate. That's 4 sentences and you sound like you prepared for an hour."
- **Call out confidence killers directly.** Filler words, hedging language ("I think maybe..."), trailing off, qualifiers. These are the habits that make someone sound unsure even when their content is good.
- **Reinforce what worked.** Confidence comes from knowing what you did right, not just what to fix.

## Feedback UX: Conversational Coach

The results panel is prose-first. The AI talks to you like a coach who wants you to win.

### Layout (top to bottom):

1. **Score + headline** — "Nice work! 7/10" or "Getting there — 5/10"
2. **Coach prose** — 3-5 sentences: what framework was detected (or what framework would have helped), what sounded confident, what undermined confidence. If heavy filler words or hedging, call it out directly with a rewrite suggestion.
3. **Framework spotlight** — If no framework detected: "Here's how you could have structured this using PREP: [concrete rewrite of their opening]". If framework detected: "You used PREP well — your point-reason-example flow was clean."
4. **Confidence killers** — Filler words + hedging language highlighted: "Watch for: 'um' (x3), 'I think maybe' (x2), trailing conclusion"
5. **Highlighted transcript** — Full transcript with filler words and hedging marked inline
6. **Quick stats bar** — Structure 8 | Clarity 7 | Specificity 6 | Persuasiveness 7 | Language 8

### Feedback Dimensions

| Dimension | Scale | What It Measures |
|---|---|---|
| Structure | 1-10 | Clear intro, organized body, definitive conclusion |
| Clarity | 1-10 | Clear thesis, logical progression |
| Specificity | 1-10 | Concrete examples vs abstract assertions |
| Persuasiveness | 1-10 | Logic, evidence, rhetorical effectiveness |
| Language | 1-10 | Word choice, naturalness |
| Filler words | count | um, uh, like, you know, so, basically, right?, I mean, kind of, sort of |
| Framework detected | string/null | PREP, STAR, Problem-Solution, Past-Present-Future, What-So What-Now What, etc. |
| Time usage | enum | underfilled / good / overfilled |

### Speaking Frameworks (detect + teach)

The LLM detects which framework the speaker used, and if none detected, suggests the best fit for the prompt.

| Framework | Structure | Best For |
|---|---|---|
| PREP | Point → Reason → Example → Point | Opinion questions |
| STAR | Situation → Task → Action → Result | Behavioral/interview |
| Problem-Solution | State problem → Propose solution → Benefits | Policy/persuasive |
| Past-Present-Future | Historical → Current → Projection | Trend analysis |
| What-So What-Now What | Describe → Why it matters → Call to action | Current events |
| Compare-Contrast | Side A → Side B → Synthesis | "Which is better" |
| ADD | Answer → Detail → Describe benefits | Q&A, quick responses |

---

## Data Model

### `SpeechSession` (localStorage)

Sessions stored as a JSON array under `extemp_sessions` key.

```typescript
interface SpeechSession {
  id: string;                  // crypto.randomUUID()
  createdAt: string;           // ISO 8601

  // Input
  promptText: string;
  prepTimeSeconds: number;
  speakingTimeSeconds: number;
  audioDurationSeconds: number | null;

  // Whisper output
  transcript: string;

  // LLM scores (1-10)
  scores: {
    structure: number;
    clarity: number;
    specificity: number;
    persuasiveness: number;
    language: number;
    overall: number;
  };

  // LLM qualitative
  fillerWordCount: number;
  fillerWordDetails: Record<string, number>;  // {"um": 3, "like": 5}
  frameworkDetected: string | null;
  frameworkSuggested: string | null;
  timeUsage: 'underfilled' | 'good' | 'overfilled';
  coachSummary: string;
  strengths: string[];
  improvement: string;

  // Full LLM response (future-proofing)
  rawFeedback: Record<string, unknown>;
}
```

---

## API Contract

### `POST /api/transcribe`

**Request:** `multipart/form-data`
```
audio: Blob (WebM/Opus or MP4)
prompt: string
prep_time: number (seconds)
speaking_time: number (seconds)
```

**Response:**
```json
{
  "transcript": "I believe that artificial intelligence...",
  "feedback": {
    "overall_score": 7,
    "coach_summary": "Nice work! You used a clear PREP structure...",
    "scores": {
      "structure": 8,
      "clarity": 7,
      "specificity": 6,
      "persuasiveness": 7,
      "language": 8
    },
    "filler_words": {
      "count": 8,
      "details": {"um": 3, "like": 3, "you know": 2}
    },
    "framework_detected": "PREP",
    "framework_suggested": null,
    "time_usage": "good",
    "strengths": ["Clear opening statement", "Good concrete example"],
    "improvement": "Tighten your conclusion — restate your main point with conviction.",
    "highlighted_transcript": "I believe that, [um], artificial intelligence is, [like], going to..."
  }
}
```

---

## Pages

| Route | What | Priority |
|---|---|---|
| `/` | Landing — "Start Practice" CTA, brief explainer | P0 |
| `/practice` | Core flow: prompt → timers → record → results | P0 |
| `/history` | List of past sessions, scores, timestamps | P0 |
| `/settings` | Adjust prep time (1/2 min), speaking time (1/2 min) | P0 |

---

## Build Order

### Phase 1: Modal Backend (Mon morning)
**Done when:** `modal run` with a sample audio file returns a transcript string.

1. `modal setup` + create app
2. faster-whisper endpoint: T4 GPU, `large-v3-turbo` model, cached in Volume via `download_root`
3. `@modal.fastapi_endpoint(method="POST")` — audio in → transcript text out
4. `scaledown_window=300` for 5-min warm window
5. Test with sample recordings, measure cold/warm latency (target: <5s warm for 2-min audio)

### Phase 2: Frontend Shell (Mon afternoon)
**Done when:** Click Start → see prompt → prep timer → speaking timer → audio blob created → mock results displayed.

1. `bunx create-next-app@latest` with app router + Tailwind
2. `useAudioRecorder` hook (MediaRecorder, MIME detection, blob)
3. Timer component (configurable prep + speaking countdown)
4. PromptCard component (random from bank of 50+)
5. ResultsPanel component (render mock feedback JSON in conversational coach layout)
6. Settings page (prep time, speaking time toggles)
7. Wire the practice page flow

### Phase 3: Integration (Tue morning)
**Done when:** Full flow works end-to-end. Speak into mic, get real AI coaching feedback.

1. `/api/transcribe` route — receives FormData, calls Modal for transcript
2. `/api/evaluate` route — receives transcript + prompt, calls OpenRouter for feedback
3. Wire practice page: show transcript immediately, then load feedback
4. Loading states (two-phase: "Transcribing..." then "Generating feedback...")
5. Error handling (mic permission denied, Modal timeout, OpenRouter failure)
6. Test on Chrome + Safari (WebM vs MP4 fallback)

### Phase 4: Persistence + History (Tue afternoon)
**Done when:** Sessions save to localStorage. History page shows past sessions.

1. `useSessions` hook — read/write sessions to localStorage
2. Save session after feedback returns
3. History page — list sessions with date, prompt excerpt, overall score
4. Click into a session to see full feedback

### Phase 5: Polish + Deploy (Wed)
**Done when:** Deployed URL, README, CI. Every edge is smooth.

1. Deploy to Vercel, set env vars (Modal token, OpenRouter API key)
2. GitHub Actions CI (lint + type check on push)
3. README with architecture diagram, setup instructions, demo GIF
4. UI polish: responsive, loading skeletons, empty states, transitions
5. Run QA harness skill, fix gaps
6. Run observability skill, add error tracking
7. Final end-to-end test on deployed URL

---

## Open Questions (must resolve before building)

None. All decisions locked.

---

## What "Done" Looks Like

A URL I can share with anyone at Fractal. They open it, get a random speaking prompt, prep for 1 minute, speak for 2 minutes, and within 20 seconds receive conversational AI coaching that tells them what framework they used (or should have used), highlights their filler words in the transcript, and gives them a single actionable improvement. Their sessions are saved locally and they can see their history. Every loading state is handled. Every error state is handled. The README makes a stranger want to try it.
