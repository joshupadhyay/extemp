import { useState, useEffect } from "react";
import { signIn } from "@/lib/auth-client";
import { AsciiWaveform } from "./AsciiWaveform";
import { Button } from "@/components/ui/button";

const LAST_PROVIDER_KEY = "extemp_last_provider";

function getLastProvider(): "google" | null {
  try {
    const v = localStorage.getItem(LAST_PROVIDER_KEY);
    return v === "google" ? v : null;
  } catch {
    return null;
  }
}

function isReturningUser(): boolean {
  return getLastProvider() !== null;
}

function handleSignIn() {
  try {
    localStorage.setItem(LAST_PROVIDER_KEY, "google");
  } catch {}
  signIn.social({ provider: "google", callbackURL: "/practice" });
}

function handleTryAnonymous() {
  (signIn as any).anonymous();
}

export function LoginPage() {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const returning = isReturningUser();

  useEffect(() => {
    fetch("/api/user-count")
      .then((r) => r.json())
      .then((data) => setMemberCount(data.count))
      .catch(() => {});
  }, []);

  return (
    <div className="split-panel">
      {/* Left panel — ASCII waveform + steps */}
      <div className="relative border-r border-hairline flex flex-col items-center justify-center bg-bg-subtle overflow-hidden max-lg:h-[320px] lg:h-auto">
        <AsciiWaveform />
        <div className="absolute bottom-0 left-0 right-0 border-t border-hairline font-mono text-[0.6rem] lg:text-xs uppercase tracking-[0.1em] text-muted-foreground">
          <div
            className="grid grid-cols-3 gap-px"
            style={{ backgroundColor: "var(--border)" }}
          >
            <div className="bg-bg-subtle px-3 py-2">
              1. Choose a Category
            </div>
            <div className="bg-bg-subtle px-3 py-2">2. Speak</div>
            <div className="bg-bg-subtle px-3 py-2">3. Receive Feedback</div>
          </div>
        </div>
      </div>

      {/* Right panel — login */}
      <div className="flex flex-col justify-center px-[var(--pad)] py-12 lg:py-0">
        <div className="max-w-[520px]">
          <span className="section-label">Auth / Sign In</span>

          <h1 className="text-[2.5rem] lg:text-[4rem] font-medium tracking-tight leading-[1.1] mb-8">
            Extemp
          </h1>

          <p className="text-[1rem] lg:text-[1.1rem] leading-[1.6] mb-12 text-foreground">
            Practice speaking clearly and effectively, under time constraints.
          </p>

          <div className="flex flex-col gap-3">
            {!returning && (
              <Button
                variant="cta"
                size="touch"
                onClick={handleTryAnonymous}
              >
                Try it out
              </Button>
            )}

            <Button
              variant={returning ? "cta" : "outline"}
              size="touch"
              onClick={handleSignIn}
              className="relative"
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </div>

          <p className="mt-6 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
            {memberCount !== null && (
              <>{`ACADEMY MEMBERS: ${memberCount.toLocaleString()} · `}</>
            )}
            <a
              href="https://joshupadhyay.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-muted-foreground/40 hover:text-foreground hover:decoration-foreground/60 transition-all duration-300 ease-out"
            >
              SEE MY WEBSITE &rarr;
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

