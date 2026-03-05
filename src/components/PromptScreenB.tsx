import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { Settings } from "@/lib/types";

const CATEGORIES = [
  { key: "all", label: "All Topics" },
  { key: "opinion", label: "Opinion" },
  { key: "hypothetical", label: "Hypothetical" },
  { key: "philosophical", label: "Philosophical" },
  { key: "interviews", label: "Interviews" },
  { key: "leadership", label: "Leadership" },
] as const;

const NON_ALL_KEYS = CATEGORIES.filter((c) => c.key !== "all").map((c) => c.key);

interface PromptScreenBProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onReady: (categories?: string[]) => void;
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
  settings,
  setSettings,
  onReady,
}: PromptScreenBProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(["all"]));

  const toggleCategory = useCallback((key: string) => {
    setSelectedCategories((prev) => {
      if (key === "all") {
        return new Set(["all"]);
      }

      const next = new Set(prev);
      next.delete("all");

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      // If empty, revert to "all"
      if (next.size === 0) {
        return new Set(["all"]);
      }

      // If all non-"all" categories selected, switch to "all"
      if (NON_ALL_KEYS.every((k) => next.has(k))) {
        return new Set(["all"]);
      }

      return next;
    });
  }, []);

  const handleReady = useCallback(() => {
    if (selectedCategories.has("all")) {
      onReady(undefined);
    } else {
      onReady(Array.from(selectedCategories));
    }
  }, [selectedCategories, onReady]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Category selection */}
      <div>
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-foreground block mb-3">
          Choose a Category
        </span>
        <p className="text-sm text-muted-foreground mb-4">
          A random prompt from your chosen category will be revealed when prep begins.
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => toggleCategory(cat.key)}
              className={`font-mono text-[0.7rem] uppercase tracking-[0.1em] px-3 py-2 border transition-colors duration-200 ease-out cursor-pointer ${
                selectedCategories.has(cat.key)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Prep time toggle */}
      <div>
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-foreground block mb-3">
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
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-foreground block mb-3">
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

      {/* I'm Ready button */}
      <Button
        variant="cta"
        size="lg"
        onClick={handleReady}
        className="w-full h-12 text-base gap-2"
      >
        I'm Ready!
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
