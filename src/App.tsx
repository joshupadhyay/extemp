import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Mic, ArrowLeft, LogOut, Clock } from "lucide-react";
import { AsciiWaveform } from "./components/AsciiWaveform";
import { ScrambleText } from "./components/ScrambleText";
import { Button } from "@/components/ui/button";
import { PracticePage } from "@/components/PracticePage";
import { HistoryPage } from "@/components/HistoryPage";
import { SettingsPage } from "@/components/SettingsPage";
import { DialogueDetailPage } from "@/components/DialogueDetailPage";
import { MethodologyPage } from "@/components/MethodologyPage";
import { LoginPage } from "@/components/LoginPage";
import { useSession, signOut } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";
import { loadSessions } from "@/lib/storage";
import type { Settings, SpeechSession, FeedbackScores } from "@/lib/types";
import "./index.css";

export function App() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  if (!session?.user) {
    return <LoginPage />;
  }

  const isGuest = !!(session.user as any).isAnonymous;

  if (isGuest) {
    return <GuestApp />;
  }

  return <AuthenticatedApp user={session.user} />;
}

function GuestApp() {
  const [settings, setSettings] = useState<Settings>({
    prepTime: 60,
    speakingTime: 120,
  });

  return (
    <Routes>
      <Route
        path={ROUTES.practice}
        element={
          <GuestPageLayout>
            <PracticePage settings={settings} setSettings={setSettings} isGuest />
          </GuestPageLayout>
        }
      />
      <Route path={ROUTES.methodology} element={<MethodologyPage />} />
      <Route path="*" element={<Navigate to={ROUTES.practice} replace />} />
    </Routes>
  );
}

function GuestPageLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center gap-3 px-[var(--pad)] py-4 border-b border-hairline">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-foreground">
          Extemp
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            signOut({ fetchOptions: { onSuccess: () => navigate("/") } });
          }}
          className="ml-auto font-mono text-xs uppercase tracking-[0.1em]"
        >
          Sign Up
        </Button>
      </nav>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

function AuthenticatedApp({ user }: { user: { name: string; image?: string | null; createdAt?: Date } }) {
  const [settings, setSettings] = useState<Settings>({
    prepTime: 60,
    speakingTime: 120,
  });

  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage user={user} settings={settings} setSettings={setSettings} />} />
      <Route path={ROUTES.practice} element={<PageLayout title="PRACTICE"><PracticePage settings={settings} setSettings={setSettings} /></PageLayout>} />
      <Route path={ROUTES.history} element={<PageLayout title="HISTORY"><HistoryPage /></PageLayout>} />
      <Route path={ROUTES.settings} element={<PageLayout title="SETTINGS"><SettingsPage settings={settings} onSettingsChange={setSettings} /></PageLayout>} />
      <Route path="/dialogues/:id" element={<PageLayout title="DIALOGUE"><DialogueDetailPage /></PageLayout>} />
      <Route path={ROUTES.methodology} element={<MethodologyPage />} />
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}

function PageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center gap-3 px-[var(--pad)] py-4 border-b border-hairline">
        <button
          onClick={() => navigate(ROUTES.home)}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-foreground hover:text-foreground/70 transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Homepage
        </button>
        <button
          onClick={() => signOut()}
          className="ml-auto flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-foreground hover:text-foreground/70 transition-colors cursor-pointer"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </nav>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard data helpers
// ---------------------------------------------------------------------------

interface DashboardData {
  totalSessions: number;
  totalWords: number;
  avgScore: number;
  mostUsedFramework: string;
  recentScores: number[];
  dimensionAvgs: Record<keyof FeedbackScores, number>;
  strongestDim: string;
  weakestDim: string;
  latestImprovement: string;
  dateJoined: string;
}

function computeDashboard(sessions: SpeechSession[], createdAt?: Date): DashboardData {
  const joined = createdAt ? new Date(createdAt) : new Date();
  const dateJoined = `${String(joined.getMonth() + 1).padStart(2, "0")}-${String(joined.getFullYear()).slice(2)}`;

  const totalWords = sessions.reduce(
    (sum, s) => sum + (s.feedbackData?.transcript?.split(/\s+/).filter(Boolean).length ?? 0),
    0,
  );

  // Sessions with feedback
  const scored = sessions.filter((s) => s.feedbackData?.feedback?.overall_score != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, x) => s + x.feedbackData.feedback.overall_score, 0) / scored.length)
    : 0;

  // Recent scores (most recent first, take up to 10)
  const recentScores = scored.slice(0, 10).map((s) => s.feedbackData.feedback.overall_score);

  // Framework frequency
  const fwCounts: Record<string, number> = {};
  for (const s of scored) {
    const fw = s.feedbackData.feedback.framework_detected;
    if (fw) fwCounts[fw] = (fwCounts[fw] || 0) + 1;
  }
  const mostUsedFramework =
    Object.entries(fwCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

  // Dimension averages
  const dims: (keyof FeedbackScores)[] = ["structure", "clarity", "specificity", "persuasiveness", "language"];
  const dimSums: Record<string, number> = {};
  const dimCounts: Record<string, number> = {};
  for (const d of dims) {
    dimSums[d] = 0;
    dimCounts[d] = 0;
  }
  for (const s of scored) {
    const sc = s.feedbackData.feedback.scores;
    if (!sc) continue;
    for (const d of dims) {
      if (sc[d] != null) {
        dimSums[d] += sc[d];
        dimCounts[d] += 1;
      }
    }
  }
  const dimensionAvgs = {} as Record<keyof FeedbackScores, number>;
  for (const d of dims) {
    dimensionAvgs[d] = dimCounts[d] ? Math.round(dimSums[d] / dimCounts[d]) : 0;
  }

  const sortedDims = dims.filter((d) => dimensionAvgs[d] > 0).sort((a, b) => dimensionAvgs[b] - dimensionAvgs[a]);
  const strongestDim = sortedDims[0] ?? "N/A";
  const weakestDim = sortedDims[sortedDims.length - 1] ?? "N/A";

  const latestImprovement = scored[0]?.feedbackData.feedback.improvement ?? "";

  return {
    totalSessions: sessions.length,
    totalWords,
    avgScore,
    mostUsedFramework,
    recentScores,
    dimensionAvgs,
    strongestDim,
    weakestDim,
    latestImprovement,
    dateJoined,
  };
}

/** Render a mini ASCII bar: filled blocks proportional to value (0-100), width chars wide */
function asciiBar(value: number, width = 12): string {
  const filled = Math.round((value / 100) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

/** Simple sparkline using block elements for an array of scores (0-100) */
function sparkline(scores: number[]): string {
  if (scores.length === 0) return "";
  const blocks = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
  // Reverse so oldest is on left
  const ordered = [...scores].reverse();
  const min = Math.min(...ordered);
  const max = Math.max(...ordered);
  const range = max - min || 1;
  return ordered.map((v) => blocks[Math.min(7, Math.floor(((v - min) / range) * 7))]).join("");
}

// ---------------------------------------------------------------------------
// HomePage component
// ---------------------------------------------------------------------------

function HomePage({
  user,
  settings,
  setSettings,
}: {
  user: { name: string; image?: string | null; createdAt?: Date };
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}) {
  const navigate = useNavigate();

  const [userStats, setUserStats] = useState({ wordsSpoken: 0, dialogues: 0 });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    const sessions = loadSessions();
    const data = computeDashboard(sessions, user.createdAt);
    setDashboard(data);
    setUserStats({ wordsSpoken: data.totalWords, dialogues: data.totalSessions });

    // Remote stats override
    fetch("/api/user-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((remote) => {
        if (remote) {
          setUserStats((prev) => ({
            wordsSpoken: Math.max(remote.wordsSpoken, prev.wordsSpoken),
            dialogues: Math.max(remote.dialogues, prev.dialogues),
          }));
        }
      })
      .catch(() => {});
  }, [user.createdAt]);

  const dims: { key: keyof FeedbackScores; label: string }[] = [
    { key: "structure", label: "STRUCTURE" },
    { key: "clarity", label: "CLARITY" },
    { key: "specificity", label: "SPECIFICITY" },
    { key: "persuasiveness", label: "PERSUASION" },
    { key: "language", label: "LANGUAGE" },
  ];

  const hasSessions = dashboard && dashboard.totalSessions > 0 && dashboard.avgScore > 0;

  return (
    <div className="split-panel">
      {/* Left panel — ASCII waveform */}
      <div className="relative border-r border-hairline flex flex-col items-center justify-center bg-bg-subtle overflow-hidden max-lg:h-[200px] lg:h-auto">
        <AsciiWaveform />
        <div className="absolute bottom-0 left-0 right-0 grid grid-cols-2 gap-px border-t border-hairline font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground" style={{ backgroundColor: "var(--border)" }}>
          <div className="bg-bg-subtle px-3 py-2">USER: {user.name?.toUpperCase()}</div>
          <div className="bg-bg-subtle px-3 py-2">WORDS SPOKEN: {userStats.wordsSpoken.toLocaleString()}</div>
          <div className="bg-bg-subtle px-3 py-2">DIALOGUES HAD: {userStats.dialogues}</div>
          <div className="bg-bg-subtle px-3 py-2">DATE JOINED: {dashboard?.dateJoined ?? "..."}</div>
        </div>
      </div>

      {/* Right panel — dashboard */}
      <div className="flex flex-col justify-center px-[var(--pad)] py-12 lg:py-0 overflow-y-auto">
        <div className="max-w-[520px]">
          <span className="section-label">Dashboard / Overview</span>

          <h1 className="text-[1.75rem] lg:text-[2.5rem] font-medium tracking-tight leading-[1.1] mb-2">
            <ScrambleText text="Extemp" />
          </h1>
          <p className="text-[1rem] lg:text-[1.1rem] text-muted-foreground mb-6">
            Think fast. Speak clearly.
          </p>

          {/* ── Quick Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-hairline font-mono text-[0.65rem] uppercase tracking-[0.08em]" style={{ backgroundColor: "var(--border)" }}>
            <div className="bg-background px-3 py-3">
              <div className="text-muted-foreground mb-1">Sessions</div>
              <div className="text-foreground text-[1rem] font-medium">{userStats.dialogues}</div>
            </div>
            <div className="bg-background px-3 py-3">
              <div className="text-muted-foreground mb-1">Words</div>
              <div className="text-foreground text-[1rem] font-medium">{userStats.wordsSpoken.toLocaleString()}</div>
            </div>
            <div className="bg-background px-3 py-3">
              <div className="text-muted-foreground mb-1">Avg Score</div>
              <div className="text-foreground text-[1rem] font-medium">{hasSessions ? `${dashboard.avgScore}/100` : "--"}</div>
            </div>
            <div className="bg-background px-3 py-3">
              <div className="text-muted-foreground mb-1">Framework</div>
              <div className="text-foreground text-[1rem] font-medium">{hasSessions ? dashboard.mostUsedFramework : "--"}</div>
            </div>
          </div>

          {hasSessions ? (
            <>
              {/* ── Score Trend ── */}
              {dashboard.recentScores.length >= 2 && (
                <div className="mt-6">
                  <span className="section-label">Score Trend (recent)</span>
                  <div className="font-mono text-[1.1rem] tracking-[0.15em] text-foreground mt-1" title={dashboard.recentScores.slice().reverse().join(", ")}>
                    {sparkline(dashboard.recentScores)}
                    <span className="text-[0.65rem] text-muted-foreground ml-2 tracking-normal">
                      {dashboard.recentScores[dashboard.recentScores.length - 1]} → {dashboard.recentScores[0]}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Strengths & Weaknesses ── */}
              <div className="mt-6">
                <span className="section-label">Dimension Scores</span>
                <div className="mt-2 space-y-1.5">
                  {dims.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.08em]">
                      <span className="w-[80px] text-muted-foreground text-right shrink-0">{label}</span>
                      <span className="text-foreground leading-none" style={{ letterSpacing: "1px" }}>
                        {asciiBar(dashboard.dimensionAvgs[key])}
                      </span>
                      <span className="text-muted-foreground">{dashboard.dimensionAvgs[key]}</span>
                      {key === dashboard.strongestDim && <span className="text-[0.55rem]" style={{ color: 'var(--success)' }}>BEST</span>}
                      {key === dashboard.weakestDim && dashboard.strongestDim !== dashboard.weakestDim && (
                        <span className="text-[0.55rem]" style={{ color: 'var(--warning)' }}>GROW</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Recent Improvement Tip ── */}
              {dashboard.latestImprovement && (
                <div className="mt-6 border border-hairline px-4 py-3 bg-bg-subtle">
                  <span className="section-label">Latest Tip</span>
                  <p className="text-[0.85rem] leading-[1.5] text-foreground mt-1">
                    {dashboard.latestImprovement}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="mt-6 text-[0.9rem] leading-[1.6] text-muted-foreground">
              Complete your first session to see scores, trends, and personalized coaching insights here.
            </p>
          )}

          {/* ── CTA Buttons ── */}
          <div className="flex flex-col gap-3 mt-8">
            <Button
              variant="cta"
              size="touch"
              onClick={() => navigate(ROUTES.practice)}
            >
              <Mic className="size-4" />
              Let's Go
            </Button>
            <Button
              variant="outline"
              size="touch"
              onClick={() => navigate(ROUTES.history)}
              className="gap-2"
            >
              <Clock className="size-4" />
              Previous Sessions
            </Button>
          </div>

          <div className="mt-12 pt-6 border-t border-hairline flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[0.7rem] text-muted-foreground">
            <span>FRAMEWORKS: PREP, STAR, ADD</span>
            <span>FEEDBACK: AI COACH</span>
            <span>USER: {user.name?.toUpperCase()}</span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-foreground hover:text-foreground/70 transition-colors cursor-pointer"
            >
              <LogOut className="size-3" />
              SIGN OUT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
