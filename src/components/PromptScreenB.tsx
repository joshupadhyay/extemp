import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Shuffle, ArrowRight, ChevronLeft } from "lucide-react";
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
  const [step, setStep] = useState<1 | 2>(1);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [editedText, setEditedText] = useState(currentPrompt.text);

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

  const handleUsePrompt = useCallback(() => {
    // Apply any edits the user made
    if (editedText.trim() && editedText !== currentPrompt.text) {
      setCurrentPrompt({ ...currentPrompt, text: editedText.trim() });
    }
    setStep(2);
  }, [editedText, currentPrompt, setCurrentPrompt]);

  const handleBack = useCallback(() => {
    setStep(1);
  }, []);

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto min-h-[80dvh] relative">
      {/* Step 1: Prompt Selection */}
      <div
        className={`flex flex-col gap-6 w-full transition-all duration-300 ease-out ${
          step === 1
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none absolute inset-0"
        }`}
      >
        {/* Section label */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
            Select Prompt
          </span>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
            Step 1 / 2
          </span>
        </div>

        {/* Editable prompt textarea */}
        <div className="border border-border">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full bg-transparent text-xl md:text-2xl font-semibold leading-relaxed p-5 md:p-8 resize-none focus:outline-none min-h-[200px] placeholder:text-muted-foreground/50"
            placeholder="Type your own prompt or shuffle for one..."
            rows={4}
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`font-mono text-[0.7rem] uppercase tracking-[0.1em] px-3 py-2 border transition-colors duration-200 ease-out cursor-pointer ${
                activeCategory === cat.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Shuffle button */}
        <button
          onClick={handleShuffle}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200 ease-out cursor-pointer self-start"
        >
          <Shuffle className="size-4" />
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em]">
            Shuffle Prompt
          </span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Use This Prompt button */}
        <Button
          variant="cta"
          size="lg"
          onClick={handleUsePrompt}
          disabled={!editedText.trim()}
          className="w-full h-12 text-base gap-2"
        >
          Use This Prompt
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* Step 2: Config */}
      <div
        className={`flex flex-col gap-6 w-full transition-all duration-300 ease-out ${
          step === 2
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none absolute inset-0"
        }`}
      >
        {/* Back + section label */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors duration-200 ease-out cursor-pointer"
          >
            <ChevronLeft className="size-4" />
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em]">
              Back
            </span>
          </button>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
            Step 2 / 2
          </span>
        </div>

        {/* Selected prompt (read-only) */}
        <div className="border border-border p-5">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground block mb-3">
            Your Prompt
          </span>
          <p className="text-lg font-semibold leading-relaxed">
            {currentPrompt.text}
          </p>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground mt-2 block">
            {currentPrompt.category}
          </span>
        </div>

        {/* Prep time toggle */}
        <div>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground block mb-3">
            Prep Time
          </span>
          <div className="flex gap-0">
            {PREP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setSettings({ ...settings, prepTime: opt.value })
                }
                className={`flex-1 font-mono text-sm py-3 border transition-colors duration-200 ease-out cursor-pointer ${
                  settings.prepTime === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                } ${opt === PREP_OPTIONS[0] ? "border-r-0" : ""}`}
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
          <div className="flex gap-0">
            {SPEAKING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setSettings({ ...settings, speakingTime: opt.value })
                }
                className={`flex-1 font-mono text-sm py-3 border transition-colors duration-200 ease-out cursor-pointer ${
                  settings.speakingTime === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                } ${opt === SPEAKING_OPTIONS[0] ? "border-r-0" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Begin Prep button */}
        <Button
          variant="cta"
          size="lg"
          onClick={onBeginPrep}
          className="w-full h-12 text-base gap-2"
        >
          Begin Prep
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
