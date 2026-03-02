import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResultsPanel } from "@/components/ResultsPanel";
import { loadSessions } from "@/lib/storage";
import type { SpeechSession } from "@/lib/types";
import { ChevronLeft } from "lucide-react";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HistoryPage() {
  const [sessions, setSessions] = useState<SpeechSession[]>(loadSessions);
  const [selected, setSelected] = useState<SpeechSession | null>(null);

  if (selected) {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto py-8 px-4">
        <div className="w-full">
          <Button
            variant="ghost"
            onClick={() => setSelected(null)}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            Back to History
          </Button>
        </div>
        <Card className="bg-card/50 backdrop-blur-sm border-muted w-full">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              {formatDate(selected.date)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{selected.prompt}</p>
          </CardContent>
        </Card>
        <ResultsPanel data={{
          ...selected.feedbackData,
          transcription: selected.feedbackData.transcription ?? selected.transcription,
        }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-semibold">Practice History</h2>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">No sessions yet.</p>
          <p className="text-sm text-muted-foreground">
            Complete a practice round and your results will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="bg-card/50 backdrop-blur-sm border-muted cursor-pointer hover:bg-card/70 transition-colors"
              onClick={() => setSelected(session)}
            >
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(session.date)}
                  </p>
                  <p className="font-medium truncate">
                    {session.prompt}
                  </p>
                  {session.feedbackData.feedback.framework_detected && (
                    <span className="text-xs text-muted-foreground">
                      {session.feedbackData.feedback.framework_detected}
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-2xl font-bold">
                  {session.feedbackData.feedback.overall_score}
                  <span className="text-sm text-muted-foreground font-normal">/10</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
