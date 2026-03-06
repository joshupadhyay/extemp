/**
 * Transcription analysis utilities — TypeScript port of pipeline/transcribe.py
 *
 * Handles filler word detection, clarity metrics, and highlighted transcript
 * generation from Groq Whisper word-level timestamps.
 */

// --- Filler word detection ---

const SINGLE_WORD_FILLERS = new Set(["um", "uh", "like", "so", "basically", "right"]);
const MULTI_WORD_FILLERS = new Set(["you know", "kind of", "sort of", "i mean"]);

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface FillerPosition {
  word: string;
  start: number;
  end: number;
  _indices: number[];
}

interface FillerWordsResult {
  count: number;
  details: Record<string, number>;
  positions: Array<Omit<FillerPosition, "_indices">>;
}

interface ClarityMetrics {
  avg_confidence: number;
  low_confidence_count: number;
  pacing_variability: number;
  pause_analysis: {
    total_pauses: number;
    long_pauses: number;
    avg_pause_duration: number;
    longest_pause: number;
  };
  segment_pacing: Array<{
    segment_id: number;
    wpm: number;
    word_count: number;
    duration: number;
    pace_label: "fast" | "normal" | "slow";
  }>;
}

function stripWord(w: string): string {
  return w.toLowerCase().replace(/[^\w']/g, "");
}

export function detectFillerWords(wordsList: WordTimestamp[]): { result: FillerWordsResult; _positions: FillerPosition[] } {
  const details: Record<string, number> = {};
  const positions: FillerPosition[] = [];
  const consumed = new Set<number>();

  // Pass 1: multi-word fillers
  for (let i = 0; i < wordsList.length - 1; i++) {
    const w1 = wordsList[i]!;
    const w2 = wordsList[i + 1]!;
    const pair = stripWord(w1.word) + " " + stripWord(w2.word);
    if (MULTI_WORD_FILLERS.has(pair)) {
      details[pair] = (details[pair] || 0) + 1;
      positions.push({
        word: pair,
        start: w1.start,
        end: w2.end,
        _indices: [i, i + 1],
      });
      consumed.add(i);
      consumed.add(i + 1);
    }
  }

  // Pass 2: single-word fillers (skip consumed)
  for (let i = 0; i < wordsList.length; i++) {
    if (consumed.has(i)) continue;
    const w = wordsList[i]!;
    const cleaned = stripWord(w.word);
    if (SINGLE_WORD_FILLERS.has(cleaned)) {
      details[cleaned] = (details[cleaned] || 0) + 1;
      positions.push({
        word: cleaned,
        start: w.start,
        end: w.end,
        _indices: [i],
      });
    }
  }

  positions.sort((a, b) => a.start - b.start);

  const count = Object.values(details).reduce((sum, v) => sum + v, 0);

  return {
    result: {
      count,
      details,
      positions: positions.map(({ _indices, ...rest }) => rest),
    },
    _positions: positions,
  };
}

export function computeClarityMetrics(wordsList: WordTimestamp[], segmentsList: TranscriptionSegment[]): ClarityMetrics {
  // Average confidence
  let avgConfidence = 0;
  let lowConfidenceCount = 0;
  if (wordsList.length > 0) {
    const probs = wordsList.map((w) => w.probability ?? 0);
    avgConfidence = Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 10000) / 10000;
    lowConfidenceCount = probs.filter((p) => p < 0.5).length;
  }

  // Pause analysis
  const PAUSE_THRESHOLD = 0.3;
  const LONG_PAUSE_THRESHOLD = 1.0;
  const pauses: number[] = [];
  for (let i = 1; i < wordsList.length; i++) {
    const gap = wordsList[i]!.start - wordsList[i - 1]!.end;
    if (gap > PAUSE_THRESHOLD) {
      pauses.push(Math.round(gap * 1000) / 1000);
    }
  }

  const pauseAnalysis = {
    total_pauses: pauses.length,
    long_pauses: pauses.filter((p) => p > LONG_PAUSE_THRESHOLD).length,
    avg_pause_duration: pauses.length > 0 ? Math.round((pauses.reduce((a, b) => a + b, 0) / pauses.length) * 1000) / 1000 : 0,
    longest_pause: pauses.length > 0 ? Math.round(Math.max(...pauses) * 1000) / 1000 : 0,
  };

  // Per-segment pacing
  const segmentPacing: ClarityMetrics["segment_pacing"] = [];
  const segmentWpms: number[] = [];

  for (const seg of segmentsList) {
    const segDuration = seg.end - seg.start;
    if (segDuration <= 0) continue;

    const segWords = wordsList.filter((w) => w.start >= seg.start && w.end <= seg.end);
    const wordCount = segWords.length;
    const wpm = segDuration > 0 ? Math.round((wordCount / segDuration) * 60 * 10) / 10 : 0;
    segmentWpms.push(wpm);

    const paceLabel: "fast" | "normal" | "slow" = wpm < 100 ? "slow" : wpm > 180 ? "fast" : "normal";

    segmentPacing.push({
      segment_id: seg.id,
      wpm,
      word_count: wordCount,
      duration: Math.round(segDuration * 1000) / 1000,
      pace_label: paceLabel,
    });
  }

  // Pacing variability
  let pacingVariability = 0;
  if (segmentWpms.length >= 2) {
    const mean = segmentWpms.reduce((a, b) => a + b, 0) / segmentWpms.length;
    const variance = segmentWpms.reduce((sum, w) => sum + (w - mean) ** 2, 0) / segmentWpms.length;
    pacingVariability = Math.round(Math.sqrt(variance) * 100) / 100;
  }

  return {
    avg_confidence: avgConfidence,
    low_confidence_count: lowConfidenceCount,
    pacing_variability: pacingVariability,
    pause_analysis: pauseAnalysis,
    segment_pacing: segmentPacing,
  };
}

export function generateHighlightedTranscript(wordsList: WordTimestamp[], fillerPositions: FillerPosition[]): string {
  const fillerIndices = new Map<number, string>();

  for (const pos of fillerPositions) {
    if (pos._indices.length === 2) {
      fillerIndices.set(pos._indices[0]!, "multi_start");
      fillerIndices.set(pos._indices[1]!, "multi_end");
    } else {
      fillerIndices.set(pos._indices[0]!, "single");
    }
  }

  const parts: string[] = [];
  let i = 0;
  while (i < wordsList.length) {
    const wordText = wordsList[i]!.word;
    const tag = fillerIndices.get(i);

    if (tag === "multi_start" && i + 1 < wordsList.length) {
      const nextText = wordsList[i + 1]!.word;
      parts.push(`<mark>${wordText} ${nextText}</mark>`);
      i += 2;
    } else if (tag === "single") {
      parts.push(`<mark>${wordText}</mark>`);
      i += 1;
    } else {
      parts.push(wordText);
      i += 1;
    }
  }

  return parts.join(" ");
}

/**
 * Process Groq Whisper verbose_json response into our TranscriptionResult format.
 */
export function processGroqResponse(groqResponse: any): {
  transcript: string;
  words: WordTimestamp[];
  segments: TranscriptionSegment[];
  speech_rate_wpm: number;
  filler_words: FillerWordsResult;
  highlighted_transcript: string;
  clarity_metrics: ClarityMetrics;
  duration: number;
} {
  const transcript = (groqResponse.text || "").trim();
  const duration = groqResponse.duration || 0;

  // Extract words from Groq's verbose_json response
  const wordsList: WordTimestamp[] = (groqResponse.words || []).map((w: any) => ({
    word: (w.word || "").trim(),
    start: Math.round((w.start || 0) * 1000) / 1000,
    end: Math.round((w.end || 0) * 1000) / 1000,
    probability: w.probability != null ? Math.round(w.probability * 10000) / 10000 : undefined,
  }));

  // Extract segments
  const segmentsList: TranscriptionSegment[] = (groqResponse.segments || []).map((s: any, i: number) => ({
    id: i,
    start: Math.round((s.start || 0) * 1000) / 1000,
    end: Math.round((s.end || 0) * 1000) / 1000,
    text: (s.text || "").trim(),
  }));

  // Speech rate
  const speechDuration = wordsList.length > 0 ? wordsList[wordsList.length - 1]!.end : 0;
  const speechRateWpm = speechDuration > 0
    ? Math.round((wordsList.length / speechDuration) * 60 * 10) / 10
    : 0;

  // Filler words
  const { result: fillerWords, _positions } = detectFillerWords(wordsList);

  // Highlighted transcript
  const highlightedTranscript = generateHighlightedTranscript(wordsList, _positions);

  // Clarity metrics
  const clarityMetrics = computeClarityMetrics(wordsList, segmentsList);

  return {
    transcript,
    words: wordsList,
    segments: segmentsList,
    speech_rate_wpm: speechRateWpm,
    filler_words: fillerWords,
    highlighted_transcript: highlightedTranscript,
    clarity_metrics: clarityMetrics,
    duration,
  };
}
