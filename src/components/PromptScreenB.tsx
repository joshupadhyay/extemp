import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shuffle, ArrowRight, Pencil } from "lucide-react";
import type { Prompt, Settings } from "@/lib/types";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "opinion", label: "Opinion" },
  { key: "policy", label: "Policy" },
  { key: "hypothetical", label: "Behavioral" },
  { key: "current-events", label: "Current Events" },
] as const;

type CategoryFilter = (typeof CATEGORIES)[number]["key"];

interface PromptScreenBProps {
  currentPrompt: Prompt;
  setCurrentPrompt: (prompt: Prompt) => void;
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onBeginPrep: () => void;
  onShuffle: (category?: string) => void;
}

const PREP_OPTIONS = [
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
] as const;

const SPEAKING_OPTIONS = [
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
] as const;

export function PromptScreenB({
  currentPrompt,
  setCurrentPrompt,
  settings,
  setSettings,
  onBeginPrep,
  onShuffle,
}: PromptScreenBProps) {
  const [promptLocked, setPromptLocked] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [editedText, setEditedText] = useState(currentPrompt.text);
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleShuffle = useCallback(() => {
    const cat = activeCategory === "all" ? undefined : activeCategory;
    onShuffle(cat);
  }, [activeCategory, onShuffle]);

  // Sync edited text when prompt changes externally (e.g. shuffle)
  const [lastPromptText, setLastPromptText] = useState(currentPrompt.text);
  if (currentPrompt.text !== lastPromptText) {
    setEditedText(currentPrompt.text);
    setLastPromptText(currentPrompt.text);
  }

  const handleLockPrompt = useCallback(() => {
    if (editedText.trim() && editedText !== currentPrompt.text) {
      setCurrentPrompt({ ...currentPrompt, text: editedText.trim() });
    }
    setPromptLocked(true);
  }, [editedText, currentPrompt, setCurrentPrompt]);

  const handleUnlockPrompt = useCallback(() => {
    setPromptLocked(false);
    setCountdown(null);
  }, []);

  const handleStart = useCallback(() => {
    setCountdown(3);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      onBeginPrep();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onBeginPrep]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Prompt section */}
      <div className={`transition-opacity duration-300 ${promptLocked ? "opacity-50" : ""}`}>
        {/* Section label */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
            Your Prompt
          </span>
          {promptLocked ? (
            <button
              onClick={handleUnlockPrompt}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors duration-200 ease-out cursor-pointer"
            >
              <Pencil className="size-3" />
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em]">
                Edit
              </span>
            </button>
          ) : (
            <button
              onClick={handleShuffle}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors duration-200 ease-out cursor-pointer"
            >
              <Shuffle className="size-3.5" />
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em]">
                Shuffle
              </span>
            </button>
          )}
        </div>

        {/* Prompt textarea / display */}
        <div className="border border-border">
          {promptLocked ? (
            <div className="p-5 md:p-8">
              <p className="text-xl md:text-2xl font-semibold leading-relaxed">
                {currentPrompt.text}
              </p>
            </div>
          ) : (
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full bg-transparent text-xl md:text-2xl font-semibold leading-relaxed p-5 md:p-8 resize-none focus:outline-none min-h-[160px] placeholder:text-muted-foreground/50"
              placeholder="Type your own prompt or shuffle for one..."
              rows={3}
            />
          )}
        </div>

        {/* Category filters — always visible */}
        <div className="flex flex-wrap gap-2 mt-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={promptLocked ? undefined : () => setActiveCategory(cat.key)}
              className={`font-mono text-[0.7rem] uppercase tracking-[0.1em] px-3 py-2 border transition-colors duration-200 ease-out ${
                promptLocked
                  ? "cursor-default border-border text-muted-foreground"
                  : "cursor-pointer"
              } ${
                !promptLocked && activeCategory === cat.key
                  ? "border-foreground bg-foreground text-background"
                  : !promptLocked
                    ? "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    : ""
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lock prompt button (when not yet locked) */}
      {!promptLocked && (
        <Button
          variant="cta"
          size="lg"
          onClick={handleLockPrompt}
          disabled={!editedText.trim()}
          className="w-full h-12 text-base gap-2"
        >
          Use This Prompt
          <ArrowRight className="size-4" />
        </Button>
      )}

      {/* Config section — appears after prompt is locked */}
      {promptLocked && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Divider */}
          <div className="border-t border-border" />

          {/* Prep time toggle */}
          <div>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground block mb-3">
              Prep Time
            </span>
            <div className="flex">
              {PREP_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ ...settings, prepTime: opt.value })}
                  className={`flex-1 font-mono text-sm py-3 border transition-colors duration-200 ease-out cursor-pointer ${
                    settings.prepTime === opt.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  } ${i === 0 ? "border-r-0" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speaking time toggle */}
          <div>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground block mb-3">
              Speaking Time
            </span>
            <div className="flex">
              {SPEAKING_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ ...settings, speakingTime: opt.value })}
                  className={`flex-1 font-mono text-sm py-3 border transition-colors duration-200 ease-out cursor-pointer ${
                    settings.speakingTime === opt.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  } ${i === 0 ? "border-r-0" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start / Countdown button */}
          {countdown !== null ? (
            <div className="flex items-center justify-center h-12 border border-foreground bg-foreground text-background">
              <span className="font-mono text-2xl font-bold tabular-nums">
                {countdown}
              </span>
            </div>
          ) : (
            <Button
              variant="cta"
              size="lg"
              onClick={handleStart}
              className="w-full h-12 text-base gap-2"
            >
              Start
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
