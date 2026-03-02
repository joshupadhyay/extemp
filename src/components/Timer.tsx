import { useState, useEffect, useRef } from "react";
import { ProgressRing } from "@/components/ProgressRing";

interface TimerProps {
  duration: number;
  onComplete: () => void;
  label: string;
  isActive: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Timer({ duration, onComplete, label, isActive }: TimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);

  useEffect(() => {
    setRemaining(duration);
    firedRef.current = false;
  }, [duration]);

  useEffect(() => {
    if (!isActive) return;

    const start = Date.now();
    firedRef.current = false;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const next = Math.max(0, duration - elapsed);
      setRemaining(next);

      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isActive, duration]);

  const progress = duration > 0 ? remaining / duration : 0;
  const isLow = remaining <= 10 && remaining > 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <ProgressRing
        size={200}
        strokeWidth={8}
        progress={progress}
        strokeColor={isLow ? "hsl(0 84.2% 60.2%)" : "hsl(var(--primary))"}
      >
        <span
          className={`text-5xl font-mono font-bold tabular-nums ${
            isLow ? "text-red-400" : "text-foreground"
          }`}
        >
          {formatTime(remaining)}
        </span>
      </ProgressRing>
    </div>
  );
}
