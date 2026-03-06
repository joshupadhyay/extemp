import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ROUTES } from "@/lib/routes";
import type { DialogueDetail, FeedbackData } from "@/lib/types";

export function DialogueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<DialogueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/dialogues/${id}`)
      .then((res) => {
        if (res.status === 401) {
          navigate(ROUTES.home);
          return null;
        }
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        if (data) setDetail(data as DialogueDetail);
      })
      .catch(() => setError("Dialogue not found"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
          {error ?? "Not found"}
        </span>
      </div>
    );
  }

  const feedbackData: FeedbackData = {
    transcript: detail.transcript,
    feedback: detail.feedback,
    transcription: detail.transcription,
  };

  return (
    <ResultsPanel
      data={feedbackData}
      prompt={detail.prompt_text}
      onBack={() => navigate(ROUTES.history)}
      onPracticeAgain={() => navigate(ROUTES.practice)}
    />
  );
}
