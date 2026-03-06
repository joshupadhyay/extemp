import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ResultsPanel } from "@/components/ResultsPanel";
import { loadSessions } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import type { SpeechSession, DialogueSummary } from "@/lib/types";
import { toDisplayScore } from "@/lib/utils";

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

type HistoryItem =
  | { source: "local"; session: SpeechSession }
  | { source: "supabase"; summary: DialogueSummary };

export function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocal, setSelectedLocal] = useState<SpeechSession | null>(null);

  const lastLoadRef = useRef(0);

  const loadHistory = useCallback(() => {
    // Skip if loaded less than 5 seconds ago (prevents rapid focus/blur hammering)
    const now = Date.now();
    if (now - lastLoadRef.current < 5000) return;
    lastLoadRef.current = now;
    const localSessions = loadSessions();
    const localItems: HistoryItem[] = localSessions.map((s) => ({ source: "local" as const, session: s }));

    // Show local sessions immediately so there's no flash of empty state
    setItems((prev) => prev.length === 0 ? localItems : prev);

    fetch("/api/dialogues?limit=50")
      .then((res) => (res.ok ? res.json() : { dialogues: [] }))
      .then(({ dialogues }: { dialogues: DialogueSummary[] }) => {
        const supabaseItems: HistoryItem[] = dialogues.map((d) => ({ source: "supabase" as const, summary: d }));

        // Deduplicate: if a local session matches a Supabase one by prompt + close timestamp, prefer Supabase
        const supabaseTimes = new Set(
          dialogues.map((d) => `${d.prompt_text}|${new Date(d.started_at).toISOString().slice(0, 16)}`),
        );
        const dedupedLocal = localItems.filter((item) => {
          const key = `${item.session.prompt}|${new Date(item.session.date).toISOString().slice(0, 16)}`;
          return !supabaseTimes.has(key);
        });

        // Merge and sort by date descending
        const merged = [...supabaseItems, ...dedupedLocal].sort((a, b) => {
          const dateA = a.source === "supabase" ? a.summary.started_at : a.session.date;
          const dateB = b.source === "supabase" ? b.summary.started_at : b.session.date;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        setItems(merged);
      })
      .catch(() => {
        // API unavailable — show local only
        setItems(localItems);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Reload when the tab/window regains focus (covers navigating back from results)
  useEffect(() => {
    const handleFocus = () => loadHistory();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadHistory]);

  if (selectedLocal) {
    return (
      <ResultsPanel
        data={selectedLocal.feedbackData}
        prompt={selectedLocal.prompt}
        onBack={() => setSelectedLocal(null)}
        onPracticeAgain={() => navigate(ROUTES.practice)}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-semibold">Practice History</h2>

      {loading ? (
        <div className="flex flex-col gap-3 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 border border-border p-4 flex items-center justify-between">
              <div className="flex flex-col gap-2 flex-1">
                <div className="skeleton h-3 w-28" />
                <div className="skeleton h-4" style={{ width: `${60 + i * 10}%` }} />
              </div>
              <div className="skeleton h-8 w-14" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="section-label">HISTORY</span>
          <p className="font-mono text-sm text-muted-foreground">No dialogues found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          {items.map((item) => {
            if (item.source === "local") {
              const s = item.session;
              return (
                <Card
                  key={s.id}
                  className="bg-card/50 backdrop-blur-sm border-muted cursor-pointer hover:bg-card/70 transition-colors"
                  onClick={() => setSelectedLocal(s)}
                >
                  <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">{formatDate(s.date)}</p>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-muted px-1">
                          local
                        </span>
                      </div>
                      <p className="font-medium truncate">{s.prompt}</p>
                      {s.feedbackData.feedback.framework_detected && (
                        <span className="text-xs text-muted-foreground">
                          {s.feedbackData.feedback.framework_detected}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-2xl font-bold">
                      {toDisplayScore(s.feedbackData.feedback.overall_score)}
                      <span className="text-sm text-muted-foreground font-normal">/100</span>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            const d = item.summary;
            return (
              <Card
                key={d.dialogue_id}
                className="bg-card/50 backdrop-blur-sm border-muted cursor-pointer hover:bg-card/70 transition-colors"
                onClick={() => navigate(ROUTES.dialogue(d.dialogue_id))}
              >
                <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{formatDate(d.started_at)}</p>
                    <p className="font-medium truncate">{d.prompt_text}</p>
                    {d.framework_detected && (
                      <span className="text-xs text-muted-foreground">
                        {d.framework_detected}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-2xl font-bold">
                    {d.overall_score != null ? toDisplayScore(d.overall_score) : "--"}
                    <span className="text-sm text-muted-foreground font-normal">/100</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
