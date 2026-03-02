import type { SpeechSession, Settings } from "./types";

const SESSIONS_KEY = "extemp_sessions";
const SETTINGS_KEY = "extemp_settings";
const MAX_SESSIONS = 200;

const DEFAULT_SETTINGS: Settings = {
  prepTime: 60,
  speakingTime: 120,
};

export function loadSessions(): SpeechSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: SpeechSession): void {
  try {
    const sessions = loadSessions();
    sessions.unshift(session);
    if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // Silently fail if localStorage is full
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        prepTime: parsed.prepTime === 120 ? 120 : 60,
        speakingTime: parsed.speakingTime === 60 ? 60 : 120,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
