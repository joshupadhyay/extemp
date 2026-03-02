# Simplify Review — PR #2: Frontend Practice Flow UI

## What was reviewed

Three parallel review agents analyzed all 14 changed files for code reuse, code quality, and efficiency issues.

## Changes made

### Extracted shared `ProgressRing` component (reuse)
- **New file:** `src/components/ProgressRing.tsx`
- Timer.tsx and ResultsPanel.tsx both had identical SVG circular progress ring implementations (same math, same markup). Extracted into a single shared component with `size`, `strokeWidth`, `progress`, `strokeColor`, and `children` props.

### Centralized localStorage access (reuse)
- **New file:** `src/lib/storage.ts`
- `loadSessions()`, `saveSession()`, `loadSettings()`, `saveSettings()` were duplicated across PracticePage.tsx, HistoryPage.tsx, and App.tsx with identical try/catch + JSON parse/stringify boilerplate. Consolidated into one module with shared storage key constants.
- Added session cap of 200 to prevent unbounded localStorage growth.

### Extracted route constants (quality)
- **New file:** `src/lib/routes.ts`
- Route strings (`"#/"`, `"#/practice"`, etc.) were raw string literals scattered across App.tsx, LandingPage.tsx, and the nav config. Extracted into `ROUTES` constant object so a typo becomes a type error.

### Fixed double-fire bug in `handleSpeakingComplete` (quality + efficiency)
- **File:** `src/components/PracticePage.tsx`
- The handler was wired to both the Timer's `onComplete` and the "Finish Early" button's `onClick`. If both fired simultaneously, it would save duplicate sessions and call `stopRecording()` twice. Added `phaseRef` guard: `if (phaseRef.current !== "speaking") return;`
- Also moved `currentPrompt` access to a ref to stabilize the callback identity.

### Fixed Timer side effect in state updater (quality)
- **File:** `src/components/Timer.tsx`
- `onCompleteRef.current()` was called inside the `setRemaining` updater function, which React docs say should be pure. Rewrote to use wall-clock-anchored timing (`Date.now()`) with 250ms tick interval, which also fixes timer drift when the tab is backgrounded. Completion is now triggered outside the state updater with a `firedRef` guard.

### Fixed MediaRecorder resource leaks (efficiency)
- **File:** `src/hooks/useAudioRecorder.ts`
- **Unmount leak:** No cleanup existed if the user navigated away while recording. Added `useEffect` cleanup that stops the recorder and releases the mic stream on unmount.
- **Constructor error leak:** If `getUserMedia` succeeded but `new MediaRecorder()` threw, the stream was never released. Added `releaseStream(stream)` in the catch block.
- Extracted `releaseStream()` helper to deduplicate track cleanup.

### Sanitized `dangerouslySetInnerHTML` (quality / security)
- **File:** `src/components/ResultsPanel.tsx`
- The highlighted transcript was rendered as raw HTML. Added `sanitizeHighlightedTranscript()` that strips all tags except `<mark>` to prevent XSS when the backend is wired up.

### Removed redundant JS truncation (reuse)
- **File:** `src/components/HistoryPage.tsx`
- Manual `session.prompt.slice(0, 60) + "..."` was redundant alongside the Tailwind `truncate` class already on the element. Removed the JS truncation.

### Fixed HistoryPage flash (quality)
- **File:** `src/components/HistoryPage.tsx`
- `useState([])` + `useEffect(() => setSessions(loadSessions()))` caused a flash of "No sessions yet" before data loaded. Replaced with `useState(loadSessions)` which runs synchronously on first render.

### Removed unused import (quality)
- **File:** `src/components/SettingsPage.tsx`
- `Label` was imported but never used. Removed.

## Skipped (acceptable as-is)

- Repeated glass card class string (13 instances) — style concern, not logic
- Repeated badge/pill pattern — only 3 instances, not worth extracting yet
- Copy-pasted settings toggles — only 2 instances
- `processingStatus` redundant state — acceptable for mock phase, will restructure when real APIs are wired
