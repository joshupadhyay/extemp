import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeedbackData } from "@/lib/types";

interface ResultsPanelProps {
  data: FeedbackData;
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 10;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={score >= 7 ? "hsl(142 76% 36%)" : score >= 4 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function getHeadline(score: number): string {
  if (score >= 9) return "Outstanding!";
  if (score >= 7) return "Nice work!";
  if (score >= 5) return "Solid effort!";
  if (score >= 3) return "Getting there!";
  return "Keep practicing!";
}

function timeUsageLabel(usage: "underfilled" | "good" | "overfilled"): string {
  if (usage === "underfilled") return "Could have used more time";
  if (usage === "overfilled") return "Went a bit long";
  return "Good time usage";
}

export function ResultsPanel({ data }: ResultsPanelProps) {
  const { feedback } = data;

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      {/* Score + Headline */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted">
        <CardContent className="pt-6 flex flex-col items-center gap-2">
          <div className="text-6xl font-bold">
            {feedback.overall_score}
            <span className="text-2xl text-muted-foreground">/10</span>
          </div>
          <p className="text-xl font-medium">
            {getHeadline(feedback.overall_score)}
          </p>
          <span className="text-sm text-muted-foreground">
            {timeUsageLabel(feedback.time_usage)}
          </span>
        </CardContent>
      </Card>

      {/* Coach Summary */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted">
        <CardHeader>
          <CardTitle className="text-base">Coach Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {feedback.coach_summary}
          </p>
        </CardContent>
      </Card>

      {/* Framework Spotlight */}
      {(feedback.framework_detected || feedback.framework_suggested) && (
        <Card className="bg-card/50 backdrop-blur-sm border-muted">
          <CardHeader>
            <CardTitle className="text-base">Framework Spotlight</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {feedback.framework_detected && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                  Detected
                </span>
                <span className="font-medium">{feedback.framework_detected}</span>
              </div>
            )}
            {feedback.framework_suggested && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                  Try next time
                </span>
                <span className="font-medium">{feedback.framework_suggested}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted">
        <CardHeader>
          <CardTitle className="text-base">What went well</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-muted-foreground flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Improvement */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted">
        <CardHeader>
          <CardTitle className="text-base">One thing to improve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {feedback.improvement}
          </p>
        </CardContent>
      </Card>

      {/* Confidence Killers (Filler Words) */}
      {feedback.filler_words.count > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-muted">
          <CardHeader>
            <CardTitle className="text-base">
              Confidence Killers
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {feedback.filler_words.count} filler word{feedback.filler_words.count !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(feedback.filler_words.details).map(([word, count]) => (
                <div
                  key={word}
                  className="flex items-center gap-2 bg-amber-500/10 text-amber-300 px-3 py-1.5 rounded-full text-sm"
                >
                  <span className="font-medium">"{word}"</span>
                  <span className="text-xs text-amber-400/70">x{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Highlighted Transcript */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted">
        <CardHeader>
          <CardTitle className="text-base">Your Speech</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-muted-foreground leading-relaxed text-sm [&_mark]:bg-amber-500/30 [&_mark]:text-amber-200 [&_mark]:rounded [&_mark]:px-0.5"
            dangerouslySetInnerHTML={{ __html: feedback.highlighted_transcript }}
          />
        </CardContent>
      </Card>

      {/* Quick Stats Bar */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted">
        <CardHeader>
          <CardTitle className="text-base">Dimension Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between gap-2">
            <ScoreRing score={feedback.scores.structure} label="Structure" />
            <ScoreRing score={feedback.scores.clarity} label="Clarity" />
            <ScoreRing score={feedback.scores.specificity} label="Specificity" />
            <ScoreRing score={feedback.scores.persuasiveness} label="Persuasion" />
            <ScoreRing score={feedback.scores.language} label="Language" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
