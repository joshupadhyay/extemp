// Self-contained types for Vercel serverless functions.
// Kept in sync with src/lib/types.ts but copied here so api/ has
// zero imports from outside its own directory tree.

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

export interface PauseAnalysis {
  total_pauses: number;
  long_pauses: number;
  avg_pause_duration: number;
  longest_pause: number;
}

export interface SegmentPacing {
  segment_id: number;
  wpm: number;
  word_count: number;
  duration: number;
  pace_label: "fast" | "normal" | "slow";
}

export interface ClarityMetrics {
  avg_confidence: number;
  low_confidence_count: number;
  pacing_variability: number;
  pause_analysis: PauseAnalysis;
  segment_pacing: SegmentPacing[];
}

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
