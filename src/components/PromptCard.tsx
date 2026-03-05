import { Card, CardContent } from "@/components/ui/card";
import type { Prompt } from "@/lib/types";

const categoryLabels: Record<Prompt["category"], string> = {
  opinion: "Opinion",
  hypothetical: "Hypothetical",
  philosophical: "Philosophical",
  interviews: "Interviews",
  leadership: "Leadership",
};

const categoryColors: Record<Prompt["category"], string> = {
  opinion: "bg-blue-100 text-blue-900",
  hypothetical: "bg-purple-100 text-purple-900",
  philosophical: "bg-rose-100 text-rose-900",
  interviews: "bg-cyan-100 text-cyan-900",
  leadership: "bg-orange-100 text-orange-900",
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
