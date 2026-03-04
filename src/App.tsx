import { useState, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Mic, ArrowLeft, LogOut, Clock } from "lucide-react";
import { AsciiWaveform } from "./components/AsciiWaveform";
import { ScrambleText } from "./components/ScrambleText";
import { Button } from "@/components/ui/button";
import { PracticePage } from "@/components/PracticePage";
import { HistoryPage } from "@/components/HistoryPage";
import { SettingsPage } from "@/components/SettingsPage";
import { DialogueDetailPage } from "@/components/DialogueDetailPage";
import { LoginPage } from "@/components/LoginPage";
import { useSession, signOut } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";
import { loadSessions } from "@/lib/storage";
import type { Settings } from "@/lib/types";
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

  return <AuthenticatedApp user={session.user} />;
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
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}

function PageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center gap-3 px-[var(--pad)] py-3 border-b border-hairline">
        <button
          onClick={() => navigate(ROUTES.home)}
          className="flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
          / {title}
        </span>
        <button
          onClick={() => signOut()}
          className="ml-auto flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
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

  const userStats = useMemo(() => {
    const sessions = loadSessions();
    const totalWords = sessions.reduce((sum, s) => {
      const words = s.feedbackData?.transcript?.split(/\s+/).filter(Boolean).length ?? 0;
      return sum + words;
    }, 0);
    const joined = user.createdAt
      ? new Date(user.createdAt)
      : sessions.length > 0
        ? new Date(sessions[sessions.length - 1]!.date)
        : new Date();
    const joinedStr = `${String(joined.getMonth() + 1).padStart(2, "0")}-${String(joined.getFullYear()).slice(2)}`;
    return { wordsSpoken: totalWords, dialogues: sessions.length, dateJoined: joinedStr };
  }, [user.createdAt]);

  return (
    <div className="split-panel">
      {/* Left panel — ASCII waveform */}
      <div className="relative border-r border-hairline flex flex-col items-center justify-center bg-bg-subtle overflow-hidden max-lg:h-[200px] lg:h-auto">
        <AsciiWaveform />
        <div className="absolute bottom-0 left-0 right-0 grid grid-cols-2 gap-px border-t border-hairline font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground" style={{ backgroundColor: "var(--border)" }}>
          <div className="bg-bg-subtle px-3 py-2">USER: {user.name?.toUpperCase()}</div>
          <div className="bg-bg-subtle px-3 py-2">WORDS SPOKEN: {userStats.wordsSpoken.toLocaleString()}</div>
          <div className="bg-bg-subtle px-3 py-2">DIALOGUES HAD: {userStats.dialogues}</div>
          <div className="bg-bg-subtle px-3 py-2">DATE JOINED: {userStats.dateJoined}</div>
        </div>
      </div>

      {/* Right panel — content */}
      <div className="flex flex-col justify-center px-[var(--pad)] py-12 lg:py-0">
        <div className="max-w-[520px]">
          <span className="section-label">Practice / Index 01</span>

          <h1 className="text-[1.75rem] lg:text-[2.5rem] font-medium tracking-tight leading-[1.1] mb-8">
            <ScrambleText text="Think fast. Speak clearly." />
          </h1>

          <p className="text-[1rem] lg:text-[1.1rem] leading-[1.6] mb-12 text-foreground">
            Get a random prompt, organize your thoughts, speak, and receive AI
            coaching feedback with framework detection. Train yourself to sound
            prepared when you're not.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              variant="cta"
              size="touch"
              onClick={() => navigate(ROUTES.practice)}
            >
              <Mic className="size-4" />
              Let's Go
            </Button>
            <button
              onClick={() => navigate(ROUTES.history)}
              className="flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Clock className="size-3.5" />
              Previous Sessions
            </button>
          </div>

          <div className="mt-20 pt-6 border-t border-hairline flex flex-wrap items-center gap-x-8 gap-y-2 font-mono text-[0.7rem] text-muted-foreground">
            <span>FRAMEWORKS: PREP, STAR, ADD</span>
            <span>FEEDBACK: AI COACH</span>
            <span>USER: {user.name?.toUpperCase()}</span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
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
