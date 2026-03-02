/**
 * End-to-end pipeline test script.
 *
 * Usage:
 *   bun scripts/test-pipeline.ts <audio_file>
 *   bun scripts/test-pipeline.ts recordings/recording-2026-03-02T*.webm
 *
 * Tests:
 *   1. POST /api/transcribe  — sends to Modal Whisper, validates response shape
 *      (also saves audio server-side automatically)
 *   2. POST /api/evaluate    — sends transcript to OpenRouter LLM, validates feedback
 */

import type {
  TranscriptionResult,
  FeedbackData,
  FeedbackScores,
} from "@/lib/types";

const BASE = "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS  ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL  ${msg}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const audioPath = process.argv[2];
  if (!audioPath) {
    console.error("Usage: bun scripts/test-pipeline.ts <audio_file>");
    console.error("  e.g.: bun scripts/test-pipeline.ts recordings/recording-2026-03-02T12-00-00.webm");
    process.exit(1);
  }

  const file = Bun.file(audioPath);
  if (!(await file.exists())) {
    console.error(`File not found: ${audioPath}`);
    process.exit(1);
  }

  const fileSize = file.size;
  const mimeType = file.type || "audio/webm";
  console.log(`Audio file: ${audioPath} (${(fileSize / 1024).toFixed(1)} KB, ${mimeType})`);

  // ----- Step 1: Transcribe -----
  section("Step 1: POST /api/transcribe (Modal Whisper)");
  let transcription: TranscriptionResult;
  {
    const form = new FormData();
    form.append("file", Bun.file(audioPath), audioPath.split("/").pop()!);

    console.log("  Sending to Modal (may take 10-60s on cold start)...");
    const start = performance.now();
    const res = await fetch(`${BASE}/api/transcribe`, { method: "POST", body: form });
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const data = await res.json();

    if (!res.ok) {
      console.error(`  ERROR: ${res.status}`, data);
      assert(false, `Transcription failed: ${data.error || "unknown"}`);
      console.log(`\nResults: ${passed} passed, ${failed} failed`);
      process.exit(1);
    }

    transcription = data as TranscriptionResult;

    assert(res.ok, `Status ${res.status} (${elapsed}s)`);
    assert(typeof transcription.transcript === "string" && transcription.transcript.length > 0, `transcript: "${transcription.transcript.slice(0, 80)}..."`);
    assert(typeof transcription.audio_id === "string", `audio_id: ${transcription.audio_id}`);
    assert(typeof transcription.duration === "number", `server duration: ${transcription.duration}s`);
    assert(Array.isArray(transcription.words), `words: ${transcription.words.length} items`);
    assert(Array.isArray(transcription.segments), `segments: ${transcription.segments.length} items`);
    assert(typeof transcription.speech_rate_wpm === "number", `speech_rate_wpm: ${transcription.speech_rate_wpm}`);

    // Validate word timestamps
    if (transcription.words.length > 0) {
      const words = transcription.words;
      let ordered = true;
      let validTimes = true;

      for (let i = 0; i < words.length; i++) {
        const w = words[i]!;
        if (w.start >= w.end) validTimes = false;
        if (i > 0 && w.start < words[i - 1]!.start) ordered = false;
      }

      assert(validTimes, "All word timestamps have start < end");
      assert(ordered, "Word timestamps are monotonically increasing");

      const probs = words.map(w => w.probability);
      const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
      assert(avgProb > 0.1, `Average word probability: ${avgProb.toFixed(3)} (should be > 0.1)`);
    }

    // Validate segments
    if (transcription.segments.length > 0) {
      const segs = transcription.segments;
      let segOrdered = true;
      for (let i = 1; i < segs.length; i++) {
        if (segs[i]!.start < segs[i - 1]!.start) segOrdered = false;
      }
      assert(segOrdered, "Segments are ordered by start time");

      const totalSegText = segs.map(s => s.text).join(" ");
      assert(totalSegText.length > 0, `Total segment text length: ${totalSegText.length}`);
    }

    // Speech rate sanity
    assert(transcription.speech_rate_wpm > 50 && transcription.speech_rate_wpm < 300, `Speech rate ${transcription.speech_rate_wpm} WPM is in reasonable range (50-300)`);

    // Filler words (deterministic from Whisper timestamps)
    assert(typeof transcription.filler_words === "object", `filler_words present`);
    assert(typeof transcription.filler_words.count === "number", `filler_words.count: ${transcription.filler_words.count}`);
    assert(typeof transcription.filler_words.details === "object", `filler_words.details present`);
    assert(Array.isArray(transcription.filler_words.positions), `filler_words.positions: ${transcription.filler_words.positions.length} items`);

    // Validate filler positions have timestamps
    if (transcription.filler_words.positions.length > 0) {
      const pos = transcription.filler_words.positions;
      const allHaveTimestamps = pos.every(p => typeof p.start === "number" && typeof p.end === "number" && typeof p.word === "string");
      assert(allHaveTimestamps, "All filler positions have word, start, end");

      const posOrdered = pos.every((p, i) => i === 0 || p.start >= pos[i - 1]!.start);
      assert(posOrdered, "Filler positions are ordered by start time");
    }

    // Highlighted transcript
    assert(typeof transcription.highlighted_transcript === "string", `highlighted_transcript present`);
    assert(transcription.highlighted_transcript.length > 0, `highlighted_transcript non-empty`);
    const markCount = (transcription.highlighted_transcript.match(/<mark>/g) || []).length;
    assert(markCount === transcription.filler_words.count, `<mark> count (${markCount}) matches filler count (${transcription.filler_words.count})`);

    console.log(`\n  Transcript preview:`);
    console.log(`  "${transcription.transcript.slice(0, 200)}${transcription.transcript.length > 200 ? "..." : ""}"`);
    console.log(`  Words: ${transcription.words.length}, Segments: ${transcription.segments.length}, WPM: ${transcription.speech_rate_wpm}`);
    console.log(`  Filler words: ${transcription.filler_words.count} total`);
    if (Object.keys(transcription.filler_words.details).length > 0) {
      console.log(`  Filler details: ${JSON.stringify(transcription.filler_words.details)}`);
    }
    if (markCount > 0) {
      console.log(`  Highlighted transcript preview: "${transcription.highlighted_transcript.slice(0, 200)}..."`);
    }
  }

  // ----- Step 2: Evaluate -----
  section("Step 2: POST /api/evaluate (OpenRouter LLM)");
  {
    const payload = {
      transcript: transcription.transcript,
      prompt: "Should social media companies be responsible for the mental health effects of their platforms on teenagers?",
      prep_time: 60,
      speaking_time: 120,
    };

    console.log("  Sending to OpenRouter for coaching feedback...");
    const start = performance.now();
    const res = await fetch(`${BASE}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const data = await res.json();

    if (!res.ok) {
      console.error(`  ERROR: ${res.status}`, data);
      assert(false, `Evaluate failed: ${data.error || "unknown"}`);
      console.log(`\nResults: ${passed} passed, ${failed} failed`);
      process.exit(1);
    }

    const feedback = data as FeedbackData;

    assert(res.ok, `Status ${res.status} (${elapsed}s)`);
    assert(typeof feedback.transcript === "string", `transcript present`);
    assert(typeof feedback.feedback === "object", `feedback object present`);

    const fb = feedback.feedback;
    assert(typeof fb.overall_score === "number" && fb.overall_score >= 1 && fb.overall_score <= 10, `overall_score: ${fb.overall_score} (1-10)`);
    assert(typeof fb.coach_summary === "string" && fb.coach_summary.length > 20, `coach_summary: "${fb.coach_summary.slice(0, 80)}..."`);

    // Scores
    const scoreKeys: (keyof FeedbackScores)[] = ["structure", "clarity", "specificity", "persuasiveness", "language"];
    for (const key of scoreKeys) {
      const val = fb.scores[key];
      assert(typeof val === "number" && val >= 1 && val <= 10, `scores.${key}: ${val}`);
    }

    // Framework
    assert(fb.framework_detected === null || typeof fb.framework_detected === "string", `framework_detected: ${fb.framework_detected}`);
    assert(fb.framework_suggested === null || typeof fb.framework_suggested === "string", `framework_suggested: ${fb.framework_suggested}`);

    // Time usage
    assert(["underfilled", "good", "overfilled"].includes(fb.time_usage), `time_usage: ${fb.time_usage}`);

    // Strengths + improvement
    assert(Array.isArray(fb.strengths) && fb.strengths.length > 0, `strengths: ${fb.strengths.length} items`);
    assert(typeof fb.improvement === "string" && fb.improvement.length > 0, `improvement present`);

    console.log(`\n  Coach Summary:`);
    console.log(`  "${fb.coach_summary}"`);
    console.log(`\n  Overall Score: ${fb.overall_score}/10`);
    console.log(`  Framework Detected: ${fb.framework_detected || "none"}`);
    console.log(`  Framework Suggested: ${fb.framework_suggested || "none"}`);
  }

  // ----- Summary -----
  section("Summary");
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log("\n  Pipeline is working end-to-end!\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
