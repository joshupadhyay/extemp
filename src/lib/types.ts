export interface FeedbackScores {
  structure: number;
  clarity: number;
  specificity: number;
  persuasiveness: number;
  language: number;
}

export interface Feedback {
  overall_score: number;
  coach_summary: string;
  scores: FeedbackScores;
  framework_detected: string | null;
  framework_suggested: string | null;
  time_usage: "underfilled" | "good" | "overfilled";
  strengths: string[];
  improvement: string;
}

export interface FeedbackData {
  transcript: string;
  feedback: Feedback;
  transcription?: TranscriptionResult;
}

export interface SpeechSession {
  id: string;
  date: string;
  prompt: string;
  promptCategory: string;
  feedbackData: FeedbackData;
}

export interface Settings {
  prepTime: number;
  speakingTime: number;
}

export type PracticePhase =
  | "idle"
  | "prompt"
  | "countdown"
  | "prep"
  | "speaking"
  | "processing"
  | "results";

export interface Prompt {
  text: string;
  category: "opinion" | "hypothetical" | "philosophical" | "interviews" | "leadership";
  suggestedFramework?: string;
  difficulty?: "easy" | "medium" | "hard";
}

// ---------------------------------------------------------------------------
// Whisper transcription response types
// ---------------------------------------------------------------------------

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
}

export interface FillerWordPosition {
  word: string;
  start: number;
  end: number;
}

export interface FillerWordsResult {
  count: number;
  details: Record<string, number>;
  positions: FillerWordPosition[];
}

// ---------------------------------------------------------------------------
// Voice clarity metrics (Tier 1 — derived from Whisper output, no extra APIs)
// ---------------------------------------------------------------------------

export interface PauseAnalysis {
  /** Number of pauses > 0.3s between consecutive words */
  total_pauses: number;
  /** Number of pauses > 1.0s */
  long_pauses: number;
  /** Mean duration of all detected pauses (seconds) */
  avg_pause_duration: number;
  /** Duration of the longest pause (seconds) */
  longest_pause: number;
}

export interface SegmentPacing {
  segment_id: number;
  /** Words per minute for this segment */
  wpm: number;
  word_count: number;
  /** Segment duration in seconds */
  duration: number;
  pace_label: "fast" | "normal" | "slow";
}

export interface ClarityMetrics {
  /** Mean Whisper word probability (0-1). Higher = clearer speech. */
  avg_confidence: number;
  /** Count of words with probability < 0.5 */
  low_confidence_count: number;
  /** Std dev of per-segment WPM. Lower = more consistent pacing. */
  pacing_variability: number;
  /** Pause detection from word timestamp gaps */
  pause_analysis: PauseAnalysis;
  /** Per-segment pacing breakdown */
  segment_pacing: SegmentPacing[];
}

// ---------------------------------------------------------------------------
// API response types for Supabase-persisted dialogues
// ---------------------------------------------------------------------------

export interface DialogueSummary {
  dialogue_id: string;
  started_at: string;
  finished_at: string | null;
  actual_duration: number | null;
  prompt_text: string;
  prompt_category: string;
  overall_score: number | null;
  framework_detected: string | null;
  coach_summary: string | null;
}

export interface DialogueDetail {
  dialogue_id: string;
  prompt_text: string;
  prompt_category: string;
  prep_time: number | null;
  speaking_time: number | null;
  actual_duration: number | null;
  started_at: string;
  finished_at: string | null;
  transcript: string;
  feedback: Feedback;
  transcription?: TranscriptionResult;
}

export interface TranscriptionResult {
  transcript: string;
  duration: number;
  audio_id: string;
  words: WordTimestamp[];
  segments: TranscriptionSegment[];
  speech_rate_wpm: number;
  filler_words: FillerWordsResult;
  highlighted_transcript: string;
  clarity_metrics?: ClarityMetrics;
}
