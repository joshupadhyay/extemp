import { useState, useEffect, useCallback } from "react";
import { LandingPage } from "@/components/LandingPage";
import { PracticePage } from "@/components/PracticePage";
import { HistoryPage } from "@/components/HistoryPage";
import { SettingsPage } from "@/components/SettingsPage";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { loadSettings, saveSettings } from "@/lib/storage";
import type { Settings } from "@/lib/types";
import "./index.css";

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash || ROUTES.home);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || ROUTES.home);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return hash;
}

const navItems = [
  { hash: ROUTES.home, label: "Home" },
  { hash: ROUTES.practice, label: "Practice" },
  { hash: ROUTES.history, label: "History" },
  { hash: ROUTES.settings, label: "Settings" },
];

export function App() {
  const hash = useHash();
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const handleSettingsChange = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const navigate = useCallback((target: string) => {
    window.location.hash = target;
  }, []);

  const renderPage = () => {
    switch (hash) {
      case ROUTES.practice:
        return <PracticePage settings={settings} />;
      case ROUTES.history:
        return <HistoryPage />;
      case ROUTES.settings:
        return <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} />;
      default:
        return <LandingPage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-14">
          <a
            href={ROUTES.home}
            className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            Extemp
          </a>
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.hash}
                variant={hash === item.hash ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigate(item.hash)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
