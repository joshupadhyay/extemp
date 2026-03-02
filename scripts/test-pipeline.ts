/**
 * End-to-end pipeline test script.
 *
 * Usage:
 *   bun scripts/test-pipeline.ts <audio_file>
 *   bun scripts/test-pipeline.ts recordings/recording-2026-03-02T*.webm
 *
 * Tests:
 *   1. POST /api/save-audio  — saves the file (sanity check)
 *   2. POST /api/transcribe  — sends to Modal Whisper, validates response shape
 *   3. POST /api/evaluate    — sends transcript to OpenRouter LLM, validates feedback
 */

const BASE = "http://localhost:3000";

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  probability: number;
}

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface FillerWordsResult {
  count: number;
  details: Record<string, number>;
  positions: { word: string; start: number; end: number }[];
}

interface TranscriptionResult {
  transcript: string;
  duration: number;
  audio_id: string;
  words: WordTimestamp[];
  segments: Segment[];
  speech_rate_wpm: number;
  filler_words: FillerWordsResult;
  highlighted_transcript: string;
}

interface FeedbackScores {
  structure: number;
  clarity: number;
  specificity: number;
  persuasiveness: number;
  language: number;
}

interface Feedback {
  overall_score: number;
  coach_summary: string;
  scores: FeedbackScores;
  filler_words: { count: number; details: Record<string, number> };
  framework_detected: string | null;
  framework_suggested: string | null;
  time_usage: string;
  strengths: string[];
  improvement: string;
  highlighted_transcript: string;
}

interface FeedbackData {
  transcript: string;
  feedback: Feedback;
}

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

  // ----- Step 1: Save audio -----
  section("Step 1: POST /api/save-audio");
  {
    const form = new FormData();
    form.append("file", file, audioPath.split("/").pop()!);

    const start = performance.now();
    const res = await fetch(`${BASE}/api/save-audio`, { method: "POST", body: form });
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const data = await res.json();

    assert(res.ok, `Status ${res.status} (${elapsed}s)`);
    assert(data.saved === true, `saved: ${data.saved}`);
    assert(typeof data.filename === "string", `filename: ${data.filename}`);
    assert(data.size > 0, `size: ${data.size} bytes`);
    console.log(`  Saved as: ${data.filename}`);
  }

  // ----- Step 2: Transcribe -----
  section("Step 2: POST /api/transcribe (Modal Whisper)");
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
        const w = words[i];
        if (w.start >= w.end) validTimes = false;
        if (i > 0 && w.start < words[i - 1].start) ordered = false;
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
        if (segs[i].start < segs[i - 1].start) segOrdered = false;
      }
      assert(segOrdered, "Segments are ordered by start time");

      const totalSegText = segs.map(s => s.text).join(" ");
      assert(totalSegText.length > 0, `Total segment text length: ${totalSegText.length}`);
    }

    // Speech rate sanity
    assert(transcription.speech_rate_wpm > 50 && transcription.speech_rate_wpm < 300, `Speech rate ${transcription.speech_rate_wpm} WPM is in reasonable range (50-300)`);

    console.log(`\n  Transcript preview:`);
    console.log(`  "${transcription.transcript.slice(0, 200)}${transcription.transcript.length > 200 ? "..." : ""}"`);
    console.log(`  Words: ${transcription.words.length}, Segments: ${transcription.segments.length}, WPM: ${transcription.speech_rate_wpm}`);
  }

  // ----- Step 3: Evaluate -----
  section("Step 3: POST /api/evaluate (OpenRouter LLM)");
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

    // Filler words
    assert(typeof fb.filler_words === "object", `filler_words present`);
    assert(typeof fb.filler_words.count === "number", `filler_words.count: ${fb.filler_words.count}`);

    // Framework
    assert(fb.framework_detected === null || typeof fb.framework_detected === "string", `framework_detected: ${fb.framework_detected}`);
    assert(fb.framework_suggested === null || typeof fb.framework_suggested === "string", `framework_suggested: ${fb.framework_suggested}`);

    // Time usage
    assert(["underfilled", "good", "overfilled"].includes(fb.time_usage), `time_usage: ${fb.time_usage}`);

    // Strengths + improvement
    assert(Array.isArray(fb.strengths) && fb.strengths.length > 0, `strengths: ${fb.strengths.length} items`);
    assert(typeof fb.improvement === "string" && fb.improvement.length > 0, `improvement present`);

    // Highlighted transcript
    assert(typeof fb.highlighted_transcript === "string", `highlighted_transcript present`);
    const markCount = (fb.highlighted_transcript.match(/<mark>/g) || []).length;
    console.log(`  Filler words highlighted with <mark>: ${markCount} instances`);

    console.log(`\n  Coach Summary:`);
    console.log(`  "${fb.coach_summary}"`);
    console.log(`\n  Overall Score: ${fb.overall_score}/10`);
    console.log(`  Framework Detected: ${fb.framework_detected || "none"}`);
    console.log(`  Framework Suggested: ${fb.framework_suggested || "none"}`);
    console.log(`  Filler Words: ${fb.filler_words.count} total`);
    if (Object.keys(fb.filler_words.details).length > 0) {
      console.log(`  Filler Details: ${JSON.stringify(fb.filler_words.details)}`);
    }
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
