# Results Page Analysis

What's missing from the feedback page for someone trying to improve at speaking.

## Current State

The results page shows:
- **Confidence score** (X/100) — LLM overall score * 10
- **Coach feedback** — 3-5 sentence prose from LLM
- **Frameworks detected/suggested** — pills with checkmark or "TRY NEXT"
- **5 dimension scores** — Structure, Clarity, Specificity, Persuasiveness, Language (1-10 bars)
- **Strengths** (2-3 bullets) + **Improvement** (1 callout)
- **Confidence killers** — filler word counts (um, like, etc.)
- **Full transcript** with filler word highlighting

## How the Confidence Score Works

From `api/evaluate.ts` system prompt:
- LLM rates 1-10 holistically (not an average of dimensions)
- 1-3 = needs significant work, 4-6 = typical casual speaker, 7-8 = good, 9-10 = exceptional (rare)
- Displayed as X/100 (score * 10)
- **No weighting formula** — LLM synthesizes contextually

## Critical Gaps

### 1. Score is opaque
"70/100" with no explanation. User doesn't know if that's good progress or what 80 looks like.

**Fix**: Add 1-sentence anchor under score: "7/10 = Good. Next level: stronger delivery confidence."

### 2. Dimensions undefined
"Clarity 7" means nothing without context. What's the difference between 5 and 8?

**Fix**: Tooltips or a methodology page with anchors:
- Structure: Clear intro, organized body, definitive conclusion
- Clarity: Clear thesis, logical progression
- Specificity: Concrete examples vs abstract assertions
- Persuasiveness: Logic, evidence, rhetorical effectiveness
- Language: Word choice, naturalness, delivery confidence

### 3. Frameworks detected but not taught
Says "Problem-Solution" but doesn't show how the user's speech maps to it.

**Fix**: Show speech-to-framework mapping and a rewrite example using the suggested framework.

### 4. Hedging language not tracked
System prompt tells LLM to flag hedging ("I think maybe...") but it's buried in prose, not explicit like filler words.

**Fix**: Add hedging to "Confidence Killers" section alongside fillers.

### 5. Voice clarity data hidden
Whisper returns: avg_confidence, pacing_variability, pause_analysis — none surfaced in UI.

**Fix**: New "Vocal Clarity" section with pacing consistency and pause patterns.

### 6. Time usage ignored
Stored as `feedback.time_usage` ("underfilled"/"good"/"overfilled") but never displayed.

**Fix**: Show in footer bar.

### 7. No progression
Every result is standalone. No "you improved Structure from 6 to 8 over 3 sessions."

**Fix**: Session history trends on /history page, link from results.

## Proposed /methodology Page

Sections:
1. **Confidence Score** — What 1-3/4-6/7-8/9-10 mean
2. **The 5 Dimensions** — Definition + anchors (what 3/10, 6/10, 8/10 look like with examples)
3. **Speaking Frameworks** — PREP, STAR, Problem-Solution, etc. with templates + example speeches
4. **Confidence Killers** — Filler words + hedging language with replacements
5. **How We Grade** — LLM system prompt summary, model used, philosophy

## Quick Wins (High Impact, Low Effort)

1. Add score anchor text under the big number
2. Add dimension improvement hints under score bars ("Specificity 6->7: Add one concrete statistic")
3. Surface `time_usage` in footer
4. Add hedging language to Confidence Killers

## Files Referenced

- `src/components/ResultsPanel.tsx` — Results UI
- `src/lib/types.ts` — FeedbackData type
- `api/evaluate.ts` — LLM system prompt + scoring
- `src/lib/mockFeedback.ts` — Sample data
