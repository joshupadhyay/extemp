import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert raw 0–10 score from the API to a 0–100 display score. */
export function toDisplayScore(raw: number): number {
  return Math.round(raw * 10);
}

/** Map a 0–100 display score to a qualitative label. */
export function getScoreLabel(score: number): string {
  if (score >= 80) return "Exceptional";
  if (score >= 60) return "Strong";
  if (score >= 30) return "Developing";
  return "Needs work";
}
