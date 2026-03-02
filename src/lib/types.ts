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
  transcription?: TranscriptionResult;
}

export interface Settings {
  prepTime: 60 | 120;
  speakingTime: 60 | 120;
}

export type PracticePhase =
  | "idle"
  | "prompt"
  | "prep"
  | "speaking"
  | "processing"
  | "results";

export interface Prompt {
  text: string;
  category: "opinion" | "policy" | "hypothetical" | "current-events" | "philosophical" | "professional";
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
  avg_logprob: number;
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

export interface TranscriptionResult {
  transcript: string;
  duration: number;
  audio_id: string;
  words: WordTimestamp[];
  segments: TranscriptionSegment[];
  speech_rate_wpm: number;
  filler_words: FillerWordsResult;
  highlighted_transcript: string;
}
