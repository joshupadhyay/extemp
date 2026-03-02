# Extemp Testing Strategy

## Overview

This document defines the testing strategy for Extemp, a speech practice app built with
Bun, React, Tailwind CSS, and external services (Modal for Whisper transcription, OpenRouter
for LLM feedback). The goal is to maximize confidence in the codebase with the least
maintenance burden, using tools native to the stack.

**Current state**: 6 Playwright E2E tests in `tests/practice-flow.spec.ts` covering basic
navigation and UI states. No unit or integration tests yet.

---

## Testing Pyramid

```
         /  E2E  \           ~10 tests   (Playwright)
        /----------\
       / Integration\        ~15 tests   (bun test + Bun.serve)
      /--------------\
     /   Unit Tests    \     ~30 tests   (bun test)
    /____________________\
```

**Rationale**: The app is small but has clear boundaries between layers: pure
utility functions, server API routes with external service calls, and a React
frontend with browser-specific APIs (MediaRecorder, localStorage). The pyramid
reflects that:

- **Unit tests** are cheap, fast, and cover the most code paths (prompts, storage
  logic, types, utility functions, prompt construction).
- **Integration tests** validate that Bun.serve routes behave correctly with mocked
  external services (Modal, OpenRouter), without needing a browser.
- **E2E tests** validate the full user journey in a real browser, but are slow and
  brittle for edge cases.

---

## Layer 1: Unit Tests (`bun test`)

### What to Test

| File | What to test | Priority |
|------|-------------|----------|
| `src/lib/prompts.ts` | `getRandomPrompt()` returns valid `Prompt` objects, all prompts have required fields, no duplicate texts | High |
| `src/lib/storage.ts` | `loadSessions`, `saveSession`, `loadSettings`, `saveSettings` with mocked localStorage | High |
| `src/lib/types.ts` | Type guards / validation helpers (if added) | Medium |
| `src/lib/utils.ts` | `cn()` class merging | Low |
| `src/lib/routes.ts` | Route constants are correct strings | Low |
| `src/api/evaluate.ts` | System prompt construction, JSON cleaning regex, request validation logic | High |
| `src/lib/mockFeedback.ts` | Mock data conforms to `Feedback` type shape | Low |

### Example: Prompt validation

```ts
// tests/unit/prompts.test.ts
import { test, expect, describe } from "bun:test";
import { getRandomPrompt, prompts } from "../../src/lib/prompts";

describe("prompts", () => {
  test("getRandomPrompt returns a valid Prompt", () => {
    const prompt = getRandomPrompt();
    expect(prompt).toHaveProperty("text");
    expect(prompt).toHaveProperty("category");
    expect(typeof prompt.text).toBe("string");
    expect(prompt.text.length).toBeGreaterThan(0);
  });

  test("all prompts have required fields", () => {
    const validCategories = [
      "opinion", "policy", "hypothetical",
      "current-events", "philosophical", "professional",
    ];
    for (const p of prompts) {
      expect(typeof p.text).toBe("string");
      expect(validCategories).toContain(p.category);
    }
  });

  test("no duplicate prompt texts", () => {
    const texts = prompts.map((p) => p.text);
    const unique = new Set(texts);
    expect(unique.size).toBe(texts.length);
  });
});
```

### Example: Storage with mocked localStorage

```ts
// tests/unit/storage.test.ts
import { test, expect, describe, beforeEach, mock } from "bun:test";

// Mock localStorage before importing storage module
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: mock((key: string) => store[key] ?? null),
  setItem: mock((key: string, value: string) => { store[key] = value; }),
  removeItem: mock((key: string) => { delete store[key]; }),
  clear: mock(() => { for (const k in store) delete store[k]; }),
  get length() { return Object.keys(store).length; },
  key: mock((i: number) => Object.keys(store)[i] ?? null),
};

// Must mock before the module loads
mock.module("../../src/lib/storage", () => {
  // Re-export the module but with our localStorage mock injected
  // This requires the storage module to be refactored to accept
  // a storage backend, OR we use globalThis override:
  Object.defineProperty(globalThis, "localStorage", {
    value: mockLocalStorage,
    writable: true,
  });
  return import("../../src/lib/storage");
});

describe("storage", () => {
  beforeEach(() => {
    for (const k in store) delete store[k];
    mock.restore();
  });

  test("loadSessions returns empty array when no data", async () => {
    const { loadSessions } = await import("../../src/lib/storage");
    expect(loadSessions()).toEqual([]);
  });

  test("saveSession prepends to existing sessions", async () => {
    const { saveSession, loadSessions } = await import("../../src/lib/storage");
    const session = {
      id: "test-1",
      date: new Date().toISOString(),
      prompt: "Test prompt",
      promptCategory: "opinion",
      feedbackData: {
        transcript: "hello",
        feedback: {
          overall_score: 7,
          coach_summary: "Good job",
          scores: { structure: 7, clarity: 7, specificity: 7, persuasiveness: 7, language: 7 },
          filler_words: { count: 0, details: {} },
          framework_detected: null,
          framework_suggested: null,
          time_usage: "good" as const,
          strengths: ["clear"],
          improvement: "none",
          highlighted_transcript: "hello",
        },
      },
    };
    saveSession(session);
    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("test-1");
  });

  test("loadSettings returns defaults when no saved settings", async () => {
    const { loadSettings } = await import("../../src/lib/storage");
    const settings = loadSettings();
    expect(settings).toEqual({ prepTime: 60, speakingTime: 120 });
  });
});
```

### Example: Evaluate request validation (extracted logic)

The `handleEvaluate` function in `src/api/evaluate.ts` has inline validation. To
unit test this cleanly, extract the validation into a pure function:

```ts
// src/api/evaluate.ts — extract this function
export function validateEvaluateRequest(body: unknown): {
  valid: true; data: EvaluateRequest;
} | {
  valid: false; error: string;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid JSON body." };
  }
  const { transcript, prompt, prep_time, speaking_time } = body as any;
  if (!transcript || typeof transcript !== "string") {
    return { valid: false, error: "Missing or invalid 'transcript' field." };
  }
  if (!prompt || typeof prompt !== "string") {
    return { valid: false, error: "Missing or invalid 'prompt' field." };
  }
  if (typeof prep_time !== "number" || typeof speaking_time !== "number") {
    return { valid: false, error: "Missing or invalid 'prep_time' or 'speaking_time' fields." };
  }
  return { valid: true, data: { transcript, prompt, prep_time, speaking_time } };
}
```

Then test it:

```ts
// tests/unit/evaluate-validation.test.ts
import { test, expect, describe } from "bun:test";
import { validateEvaluateRequest } from "../../src/api/evaluate";

describe("validateEvaluateRequest", () => {
  test("rejects missing transcript", () => {
    const result = validateEvaluateRequest({ prompt: "hi", prep_time: 60, speaking_time: 120 });
    expect(result.valid).toBe(false);
  });

  test("rejects non-string transcript", () => {
    const result = validateEvaluateRequest({ transcript: 123, prompt: "hi", prep_time: 60, speaking_time: 120 });
    expect(result.valid).toBe(false);
  });

  test("rejects missing prep_time", () => {
    const result = validateEvaluateRequest({ transcript: "hi", prompt: "hi", speaking_time: 120 });
    expect(result.valid).toBe(false);
  });

  test("accepts valid request", () => {
    const result = validateEvaluateRequest({
      transcript: "hello world",
      prompt: "What is your opinion?",
      prep_time: 60,
      speaking_time: 120,
    });
    expect(result.valid).toBe(true);
  });
});
```

### Test file naming and location

```
tests/
  unit/
    prompts.test.ts
    storage.test.ts
    evaluate-validation.test.ts
    utils.test.ts
  integration/
    api-evaluate.test.ts
    api-transcribe.test.ts
    api-hello.test.ts
  e2e/
    practice-flow.spec.ts      (move from tests/practice-flow.spec.ts)
    history.spec.ts
    settings.spec.ts
    full-practice-with-audio.spec.ts
```

### Running unit tests

Add to `package.json`:
```json
{
  "scripts": {
    "test": "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:e2e": "bunx playwright test",
    "test:all": "bun test tests/unit && bun test tests/integration && bunx playwright test"
  }
}
```

---

## Layer 2: Integration Tests (`bun test` with Bun.serve)

Integration tests start a real Bun server and make HTTP requests to API routes,
but mock external services (Modal, OpenRouter) so tests are fast and deterministic.

### Strategy: Mock `fetch` at the global level

Bun's `mock.module()` or `spyOn(globalThis, "fetch")` lets us intercept outbound
fetch calls to Modal and OpenRouter without changing application code.

### Example: /api/evaluate with mocked OpenRouter

```ts
// tests/integration/api-evaluate.test.ts
import { test, expect, describe, beforeAll, afterAll, spyOn, mock } from "bun:test";
import type { Server } from "bun";

let server: Server;
const TEST_PORT = 4111;

// Mock environment
process.env.OPENROUTER_API_KEY = "test-key-123";

beforeAll(async () => {
  // Intercept fetch to mock OpenRouter responses
  spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("openrouter.ai")) {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              overall_score: 7,
              coach_summary: "Test feedback",
              scores: { structure: 7, clarity: 7, specificity: 7, persuasiveness: 7, language: 7 },
              filler_words: { count: 0, details: {} },
              framework_detected: null,
              framework_suggested: "PREP",
              time_usage: "good",
              strengths: ["clear structure"],
              improvement: "add examples",
              highlighted_transcript: "test transcript",
            }),
          },
        }],
      }), { status: 200 });
    }

    // Fall through to real fetch for local requests
    return globalThis.fetch(input, init);
  });

  // Dynamic import to pick up mocked env vars
  const { default: index } = await import("../../src/index.tsx");
  // Note: The server starts automatically on import. If the server binds
  // to a fixed port, you may need to refactor index.tsx to export a
  // factory function. See "Refactoring for Testability" below.
});

afterAll(() => {
  server?.stop();
  mock.restore();
});

describe("/api/evaluate", () => {
  test("returns 400 for missing transcript", async () => {
    const res = await fetch(`http://localhost:3000/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", prep_time: 60, speaking_time: 120 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("transcript");
  });

  test("returns 400 for invalid JSON", async () => {
    const res = await fetch(`http://localhost:3000/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  test("returns feedback for valid request", async () => {
    const res = await fetch(`http://localhost:3000/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: "I believe education is important because...",
        prompt: "What is the most important issue facing education?",
        prep_time: 60,
        speaking_time: 120,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBeDefined();
    expect(body.feedback.overall_score).toBeGreaterThanOrEqual(1);
    expect(body.feedback.overall_score).toBeLessThanOrEqual(10);
  });
});
```

### Example: /api/transcribe with mocked Modal

```ts
// tests/integration/api-transcribe.test.ts
import { test, expect, describe, beforeAll, afterAll, spyOn, mock } from "bun:test";

process.env.MODAL_ENDPOINT_URL = "https://fake-modal.example.com/transcribe";

beforeAll(() => {
  const originalFetch = globalThis.fetch;
  spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("fake-modal.example.com")) {
      return new Response(JSON.stringify({
        transcript: "This is a test transcription.",
        duration: 45.2,
        audio_id: "test-audio-123",
        words: [{ word: "This", start: 0, end: 0.5, probability: 0.99 }],
        segments: [{ id: 0, start: 0, end: 5, text: "This is a test.", avg_logprob: -0.3 }],
        speech_rate_wpm: 130,
      }), { status: 200 });
    }

    return originalFetch(input, init);
  });
});

afterAll(() => {
  mock.restore();
});

describe("/api/transcribe", () => {
  test("returns 400 when no file is provided", async () => {
    const formData = new FormData();
    const res = await fetch("http://localhost:3000/api/transcribe", {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No audio file");
  });

  test("proxies audio to Modal and returns transcription", async () => {
    const formData = new FormData();
    // Create a minimal valid audio blob
    const audioBlob = new Blob(["fake audio data"], { type: "audio/webm" });
    formData.append("file", audioBlob, "recording.webm");

    const res = await fetch("http://localhost:3000/api/transcribe", {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe("This is a test transcription.");
    expect(body.speech_rate_wpm).toBe(130);
  });

  test("returns 502 when Modal is unreachable", async () => {
    // Override the mock to simulate failure
    const originalImpl = globalThis.fetch;
    spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("fake-modal.example.com")) {
        throw new Error("Connection refused");
      }
      return originalImpl(input, init);
    });

    const formData = new FormData();
    const audioBlob = new Blob(["fake audio"], { type: "audio/webm" });
    formData.append("file", audioBlob, "recording.webm");

    const res = await fetch("http://localhost:3000/api/transcribe", {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(502);

    mock.restore();
  });
});
```

### Refactoring for Testability

The current `src/index.tsx` starts the server as a side effect on import. For
integration tests to control the server lifecycle (custom port, startup/shutdown),
extract a factory:

```ts
// src/server.ts — new file
import index from "./index.html";
import { handleEvaluate } from "./api/evaluate";

export function createServer(port?: number) {
  const MODAL_ENDPOINT_URL = process.env.MODAL_ENDPOINT_URL;

  return Bun.serve({
    port: port ?? 3000,
    routes: {
      "/*": index,
      "/api/hello": { /* ... */ },
      "/api/evaluate": { async POST(req) { return handleEvaluate(req); } },
      "/api/transcribe": { async POST(req) { /* ... */ } },
    },
    development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
  });
}

// src/index.tsx — becomes a thin entry point
import { createServer } from "./server";
const server = createServer();
console.log(`Server running at ${server.url}`);
```

This lets integration tests do:

```ts
import { createServer } from "../../src/server";
const server = createServer(4111);
// ... run tests ...
server.stop();
```

---

## Layer 3: E2E Tests (Playwright)

### Current Coverage

The existing `tests/practice-flow.spec.ts` covers:
1. Landing page loads with "Start Practice" button
2. Navigation to practice page
3. Prompt display after clicking Start Practice
4. Navigation to history page
5. Navigation to settings page
6. Back navigation from practice page

### Gaps to Fill

| Test | Description | Priority |
|------|------------|----------|
| Full practice flow with audio | Start -> Prep -> Speaking (with fake mic) -> Processing -> Results | High |
| Results page content | Verify scores, transcript, coach summary render correctly | High |
| Settings persistence | Change settings, reload, verify they persist | Medium |
| History page with data | Complete a session, verify it appears in history | Medium |
| Mobile viewport | Verify touch targets and layout on 375px width | Medium |
| Error states | Missing microphone, API failures | Low |
| Accessibility | Keyboard navigation through practice flow | Low |

### Mocking Audio in Playwright

Chromium supports fake media devices via launch args. Update `playwright.config.ts`:

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            // Optionally provide a real audio file:
            // "--use-file-for-fake-audio-capture=/path/to/test-audio.wav",
          ],
        },
        permissions: ["microphone"],
      },
    },
  ],
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
```

With these flags:
- `--use-fake-device-for-media-stream`: Provides a synthetic audio stream to
  `getUserMedia()` without needing a real microphone.
- `--use-fake-ui-for-media-stream`: Auto-grants microphone permission without a
  dialog.

### Mocking API Responses in E2E

Use Playwright's `page.route()` to intercept API calls and return deterministic data:

```ts
// tests/e2e/full-practice-with-audio.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Full Practice Flow", () => {
  test("complete practice session with feedback", async ({ page }) => {
    // Mock the transcribe API
    await page.route("**/api/transcribe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transcript: "I believe the most important issue is the digital divide...",
          duration: 58.3,
          audio_id: "test-123",
          words: [],
          segments: [],
          speech_rate_wpm: 140,
        }),
      });
    });

    // Mock the evaluate API
    await page.route("**/api/evaluate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transcript: "I believe the most important issue is the digital divide...",
          feedback: {
            overall_score: 7,
            coach_summary: "Strong structure with clear examples.",
            scores: { structure: 8, clarity: 7, specificity: 6, persuasiveness: 7, language: 6 },
            filler_words: { count: 2, details: { um: 1, like: 1 } },
            framework_detected: "Problem-Solution",
            framework_suggested: null,
            time_usage: "good",
            strengths: ["Clear thesis", "Good examples"],
            improvement: "Reduce filler words",
            highlighted_transcript: "I believe...",
          },
        }),
      });
    });

    // Start
    await page.goto("/");
    await page.getByRole("button", { name: /start practice/i }).click();
    await expect(page).toHaveURL(/#\/practice/);

    // Idle -> Prompt
    await page.getByRole("button", { name: /start practice/i }).click();
    await expect(page.getByText("Your prompt:")).toBeVisible();

    // Prompt -> Prep (Begin Prep starts the timer)
    await page.getByRole("button", { name: /begin prep/i }).click();
    await expect(page.getByText("Prep Time")).toBeVisible();

    // Wait for prep timer to complete (or skip in test by mocking timers)
    // For a real test, you might want a shorter prep time in test settings

    // Speaking phase (after prep completes, recording starts automatically)
    // With fake media devices, this should work without errors
    await expect(page.getByText("RECORDING")).toBeVisible({ timeout: 70000 });

    // Click Done to end speaking
    await page.getByRole("button", { name: /done/i }).click();

    // Processing screen
    await expect(page.getByText(/transcribing|analyzing/i)).toBeVisible();

    // Results
    await expect(page.getByText("7")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Strong structure")).toBeVisible();
  });
});
```

### Mocking Timers for Faster E2E Tests

The prep and speaking phases use `setTimeout` and `setInterval`. For faster tests,
inject a settings override or use Playwright's clock API:

```ts
test("practice flow with short timers", async ({ page }) => {
  // Navigate to settings first and set minimum times
  await page.goto("/#/settings");
  // Select 1-minute prep and 1-minute speaking times
  // ... interact with settings UI ...

  // Or inject settings via localStorage before navigation
  await page.addInitScript(() => {
    localStorage.setItem("extemp_settings", JSON.stringify({
      prepTime: 60,
      speakingTime: 60,
    }));
  });
});
```

---

## Mocking External Services: Summary

| Service | Unit Tests | Integration Tests | E2E Tests |
|---------|-----------|-------------------|-----------|
| **OpenRouter** (LLM) | Not called; test validation logic only | `spyOn(globalThis, "fetch")` to intercept requests to `openrouter.ai` | `page.route("**/api/evaluate")` to mock the Bun API response |
| **Modal** (Whisper) | Not called; test is client-side only | `spyOn(globalThis, "fetch")` to intercept requests to Modal URL | `page.route("**/api/transcribe")` to mock the Bun API response |
| **localStorage** | `Object.defineProperty(globalThis, "localStorage", ...)` | N/A (server-side tests) | `page.addInitScript()` to seed localStorage |
| **MediaRecorder** | N/A (browser API) | N/A (server-side tests) | Chromium `--use-fake-device-for-media-stream` flag |

---

## Test Data Management

### Mock Audio Files

For E2E tests that need a real audio file (instead of Chromium's synthetic stream):

1. Store a short (5-second) `.wav` file at `tests/fixtures/test-audio.wav`
2. Reference it in Playwright config:
   ```
   --use-file-for-fake-audio-capture=tests/fixtures/test-audio.wav
   ```

### Mock API Responses

Store reusable mock responses as fixtures:

```
tests/
  fixtures/
    mock-transcription.json     # TranscriptionResult shape
    mock-feedback.json          # FeedbackData shape
    test-audio.wav              # Short audio clip for fake capture
```

The existing `src/lib/mockFeedback.ts` can be reused in tests via direct import.

### Type Safety for Mocks

Import types from `src/lib/types.ts` in test files to ensure mock data stays
in sync with the real schema:

```ts
import type { FeedbackData, TranscriptionResult } from "../../src/lib/types";

const mockFeedback: FeedbackData = {
  // TypeScript will error if the shape is wrong
};
```

---

## Naming Conventions

| Convention | Example |
|-----------|---------|
| Unit test files | `tests/unit/<module>.test.ts` |
| Integration test files | `tests/integration/api-<route>.test.ts` |
| E2E test files | `tests/e2e/<feature>.spec.ts` |
| Test descriptions | Use plain language: `"returns 400 when transcript is missing"` |
| Describe blocks | Name after the module or route: `describe("/api/evaluate", ...)` |
| Fixture files | `tests/fixtures/<name>.<ext>` |

---

## Priority Order: What to Write First

### Phase 1 (Immediate) — High-value, low-effort

1. **Unit: prompts.test.ts** — Validates all prompts have correct shape. Catches
   data issues from `src/data/prompts.json` additions. ~10 minutes to write.

2. **Unit: storage.test.ts** — Tests localStorage wrappers. Catches serialization
   bugs and the MAX_SESSIONS cap. ~15 minutes to write.

3. **Unit: evaluate-validation.test.ts** — Tests the request validation logic in
   `handleEvaluate`. Requires extracting a pure `validateEvaluateRequest` function
   first. ~20 minutes total.

### Phase 2 (Next sprint) — Integration tests

4. **Integration: api-evaluate.test.ts** — Tests the full evaluate route with mocked
   OpenRouter. Validates the primary/fallback model logic, JSON cleaning, and error
   responses. Requires the `createServer()` refactor.

5. **Integration: api-transcribe.test.ts** — Tests the transcribe proxy with mocked
   Modal. Validates FormData forwarding, error handling, missing env var responses.

### Phase 3 (When UI stabilizes) — E2E expansion

6. **E2E: full-practice-with-audio.spec.ts** — Tests the complete flow from landing
   to results with fake audio and mocked API responses.

7. **E2E: settings.spec.ts** — Tests settings persistence across reloads.

8. **E2E: history.spec.ts** — Tests that completed sessions appear in history.

### Phase 4 (Polish) — Edge cases and confidence

9. **E2E: error-states.spec.ts** — Tests microphone denial, API failures, network
   timeouts.

10. **Unit: Additional type validation tests** — If you add runtime validation
    for the `Feedback` JSON response from OpenRouter.

---

## CI Integration (GitHub Actions)

### Recommended workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, "feat/*"]
  pull_request:
    branches: [main]

jobs:
  unit-and-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install

      - name: Unit tests
        run: bun test tests/unit

      - name: Integration tests
        run: bun test tests/integration

  e2e:
    runs-on: ubuntu-latest
    needs: unit-and-integration
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: Run E2E tests
        run: bunx playwright test

      - name: Upload test report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Key decisions:**
- Unit and integration tests run first (fast, ~5s). E2E only runs if they pass.
- Only install Chromium for E2E (not all browsers) to save CI time.
- Upload Playwright HTML report as artifact on failure for debugging.
- Use `oven-sh/setup-bun@v2` for Bun installation.
- E2E tests need the dev server, which Playwright starts automatically via the
  `webServer` config in `playwright.config.ts`.

### Environment Variables in CI

Set these as GitHub repository secrets:
- `OPENROUTER_API_KEY` — Only needed if running integration tests against real API
  (not recommended for CI; use mocks instead).
- `MODAL_ENDPOINT_URL` — Same: mock in CI.

For CI, all external calls should be mocked. The integration tests above use
`spyOn(globalThis, "fetch")` so no real API keys are needed.

---

## Component Testing: Decision

**Recommendation: Skip React Testing Library for now.**

Rationale:
- The app has ~10 components, most with minimal logic (display-only).
- `PracticePage.tsx` is the only complex component, and its behavior is best tested
  via E2E (it depends on MediaRecorder, timers, and API calls).
- Adding `@testing-library/react` introduces JSDOM, which has known compatibility
  issues with Bun and adds complexity.
- The unit + integration + E2E layers already cover the critical paths.

**Revisit when:**
- You add complex form validation or state machines to components.
- You have reusable component libraries that need isolated testing.
- The E2E tests become too slow for the feedback loop.

---

## Summary

| Layer | Tool | Count (target) | Runs in | Speed |
|-------|------|----------------|---------|-------|
| Unit | `bun test` | ~30 tests | CI + local | <1s |
| Integration | `bun test` | ~15 tests | CI + local | <3s |
| E2E | Playwright | ~10 tests | CI + local | ~30-60s |

**Total target: ~55 tests** covering prompts, storage, API validation, API routes
with mocked services, and full user journeys with fake audio.
