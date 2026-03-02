import { Card, CardContent } from "@/components/ui/card";
import type { Prompt } from "@/lib/types";

const categoryLabels: Record<Prompt["category"], string> = {
  opinion: "Opinion",
  policy: "Policy",
  hypothetical: "Hypothetical",
  "current-events": "Current Events",
};

const categoryColors: Record<Prompt["category"], string> = {
  opinion: "bg-blue-500/20 text-blue-300",
  policy: "bg-emerald-500/20 text-emerald-300",
  hypothetical: "bg-purple-500/20 text-purple-300",
  "current-events": "bg-amber-500/20 text-amber-300",
};

interface PromptCardProps {
  prompt: Prompt;
}

export function PromptCard({ prompt }: PromptCardProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-muted">
      <CardContent className="pt-6 pb-6 flex flex-col items-center gap-4">
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full ${categoryColors[prompt.category]}`}
        >
          {categoryLabels[prompt.category]}
        </span>
        <p className="text-2xl md:text-3xl font-semibold text-center leading-relaxed max-w-2xl">
          {prompt.text}
        </p>
      </CardContent>
    </Card>
  );
}
