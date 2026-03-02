import { useState, useEffect, useCallback } from "react";
import { LandingPage } from "@/components/LandingPage";
import { PracticePage } from "@/components/PracticePage";
import { HistoryPage } from "@/components/HistoryPage";
import { SettingsPage } from "@/components/SettingsPage";
import { Button } from "@/components/ui/button";
import type { Settings } from "@/lib/types";
import "./index.css";

const DEFAULT_SETTINGS: Settings = {
  prepTime: 60,
  speakingTime: 120,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("extemp_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        prepTime: parsed.prepTime === 120 ? 120 : 60,
        speakingTime: parsed.speakingTime === 60 ? 60 : 120,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return hash;
}

const navItems = [
  { hash: "#/", label: "Home" },
  { hash: "#/practice", label: "Practice" },
  { hash: "#/history", label: "History" },
  { hash: "#/settings", label: "Settings" },
];

export function App() {
  const hash = useHash();
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const handleSettingsChange = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem("extemp_settings", JSON.stringify(newSettings));
  }, []);

  const navigate = useCallback((target: string) => {
    window.location.hash = target;
  }, []);

  const renderPage = () => {
    switch (hash) {
      case "#/practice":
        return <PracticePage settings={settings} />;
      case "#/history":
        return <HistoryPage />;
      case "#/settings":
        return <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} />;
      default:
        return <LandingPage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-14">
          <a
            href="#/"
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

      {/* Page content */}
      <main className="flex-1">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
