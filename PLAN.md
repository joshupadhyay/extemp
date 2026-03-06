# Extemp Feedback Implementation Plan

Based on user feedback + Josh's clarifications. Each item is a separate worktree branch + PR.

---

## 1. Fix: Feedback not showing after session (Bug)
**Priority: P0 — Multiple users reporting**

**Problem:** After completing a speaking session, the ResultsPanel doesn't display all feedback until a hard refresh. The history page also doesn't show the new session until refresh.

**Root cause investigation needed:**
- `PracticePage.tsx`: Check if the evaluation job polling (`/api/jobs/:id`) resolves correctly before transitioning to results phase
- `ResultsPanel.tsx`: Check if feedback data is fully passed through on initial render
- `HistoryPage.tsx` (lines 30-62): The local+remote merge may have a race condition — session saved to localStorage but component doesn't re-read it
- Possible: Supabase `POST /api/dialogues` call is fire-and-forget (non-blocking), so history page fetch may not include it yet

**Fix approach:**
- Ensure ResultsPanel receives complete `feedbackData` before rendering (not partial)
- In HistoryPage, add the newly completed session to state immediately (optimistic update) rather than relying on refetch
- Add proper loading/skeleton states if data is still arriving

**Files:** `src/components/PracticePage.tsx`, `src/components/ResultsPanel.tsx`, `src/components/HistoryPage.tsx`

---

## 2. Fix: Request microphone permission upfront (UX)
**Priority: P0 — Jarring flow**

**Problem:** Mic permission is requested only when the speaking phase begins (after countdown + prep), causing a jarring browser dialog mid-flow.

**Current flow:**
```
Category Select → Countdown → Prompt Selection → Prep Phase → [MIC DIALOG] → Speaking
```

**Target flow:**
```
Category Select → [MIC PERMISSION] → Countdown → Prompt Selection → Prep Phase → Speaking (mic already granted)
```

**Fix approach:**
- In `PracticePage.tsx`, call `navigator.mediaDevices.getUserMedia({ audio: true })` when user clicks "Start" (before countdown phase)
- Store the stream reference or just release it after permission granted
- If denied, show error immediately and don't proceed to countdown
- In `useAudioRecorder.ts`, skip the permission request if already granted

**Files:** `src/components/PracticePage.tsx`, `src/hooks/useAudioRecorder.ts`

---

## 3. Feature: First-time login → straight to new session
**Priority: P1**

**Problem:** After first login, user lands on HomePage and has to click through to start practicing.

**Fix approach:**
- After OAuth callback, check if user has zero prior sessions (no dialogues in Supabase, no localStorage sessions)
- If first-time user: redirect to `/practice` automatically instead of `/`
- Add a flag in localStorage (`extemp_has_visited`) to avoid repeated redirects
- Returning users still land on HomePage as normal

**Files:** `src/App.tsx`, `src/components/HomePage.tsx`

---

## 4. UX: De-emphasize/remove numerical score
**Priority: P1 — Score doesn't mean anything to users**

**Problem:** The big "X/100" score is prominent but not actionable. The methodology page also unnecessarily explains the 0-10 → 0-100 mapping.

**Fix approach:**
- ResultsPanel: Remove or significantly de-emphasize the giant score number
- Lead with the coach's narrative feedback instead (the 3-5 sentence summary)
- Keep dimension breakdown bars (structure, clarity, etc.) but as secondary visual
- MethodologyPage: Simplify scoring guide — remove "adjusted from 0-10" language, just describe qualitative bands if scores are kept at all
- Consider replacing score with qualitative label: "Developing", "Strong", "Exceptional"

**Files:** `src/components/ResultsPanel.tsx`, `src/components/MethodologyPage.tsx`

---

## 5. UX: Show concrete, actionable feedback on results card
**Priority: P1 — User wants specific coaching**

**Problem:** After speaking, the results card shows generic feedback. Users want concrete, actionable items like "Speak louder", "Low quality of argument", "Logical fallacy detected: straw man". Currently have to navigate to full session page.

**Fix approach:**
- Enhance the LLM evaluation prompt (`api/evaluate.ts`) to generate:
  - 2-3 specific, blunt coaching items (e.g., "Your central argument lacked evidence", "Avoid hedging with 'I think'")
  - Logical fallacy detection if applicable
  - Delivery notes (pacing, filler word density)
- Update ResultsPanel to show these prominently near the top, right after coach summary
- Make the "Focus next time" section more specific and prominent

**Files:** `api/evaluate.ts`, `src/components/ResultsPanel.tsx`, `src/lib/types.ts`

---

## 6. UX: Clarify category/topic selection
**Priority: P1**

**Problem:** Topic selection UI is unclear — users don't realize they can select multiple categories, and the category names/questions aren't intuitive.

**Fix approach:**
- In `PromptScreenB.tsx`: Add clear visual indication that multi-select is allowed (e.g., "Select one or more topics" header, checkbox-style instead of radio-style)
- Simplify category labels and add brief descriptions
- Show a selected count indicator
- Consider renaming categories to be more user-friendly

**Files:** `src/components/PromptScreenB.tsx`

---

## 7. Feature: More time duration settings
**Priority: P2**

**Problem:** Users want more control over speaking duration, including shorter times for quick practice.

**Fix approach:**
- Add more granular time options in settings and/or PromptScreenB:
  - Prep time: 30s, 60s, 90s, 120s
  - Speaking time: 30s, 60s, 90s, 120s, 180s
- Shorter speaking times for rapid-fire practice
- Persist preferences in localStorage/settings

**Files:** `src/components/PromptScreenB.tsx`, `src/components/SettingsPage.tsx`

---

## Implementation Order

1. **Feedback bug fix** (#1) — P0, blocking multiple users
2. **Mic permission fix** (#2) — P0, easy fix, big UX improvement
3. **De-emphasize score** (#4) — P1, quick UI change
4. **Concrete feedback** (#5) — P1, prompt engineering + UI
5. **First-time login flow** (#3) — P1, moderate complexity
6. **Category selection UX** (#6) — P1, UI refinement
7. **Time duration settings** (#7) — P2, additive feature

Each item gets its own worktree, Playwright MCP test, and PR.
