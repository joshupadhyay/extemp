export interface FeedbackScores {
  structure: number;
  clarity: number;
  specificity: number;
  persuasiveness: number;
  language: number;
}

export interface FillerWords {
  count: number;
  details: Record<string, number>;
}

export interface Feedback {
  overall_score: number;
  coach_summary: string;
  scores: FeedbackScores;
  filler_words: FillerWords;
  framework_detected: string | null;
  framework_suggested: string | null;
  time_usage: "underfilled" | "good" | "overfilled";
  strengths: string[];
  improvement: string;
  highlighted_transcript: string;
}

export interface FeedbackData {
  transcript: string;
  feedback: Feedback;
}

export interface SpeechSession {
  id: string;
  date: string;
  prompt: string;
  promptCategory: string;
  feedbackData: FeedbackData;
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
  category: "opinion" | "policy" | "hypothetical" | "current-events";
}
