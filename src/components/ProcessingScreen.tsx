import { useState, useEffect, useRef } from "react";

interface ProcessingScreenProps {
  status: string;
  substatus?: string;
}

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `0:${String(secs).padStart(2, "0")}`;

  return (
    <span
      className="font-mono text-muted-foreground"
      style={{ fontSize: "0.8rem", lineHeight: 1.4 }}
    >
      {display}
    </span>
  );
}

function PulsingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block w-1.5 h-1.5 bg-foreground"
          style={{
            animation: `processing-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes processing-dot {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes processing-dot {
            0%, 100% { opacity: 0.6; }
          }
        }
      `}</style>
    </span>
  );
}

function SkeletonBlock({ width }: { width: string }) {
  return (
    <div
      className="skeleton h-3"
      style={{ width }}
    />
  );
}

export function ProcessingScreen({ status, substatus }: ProcessingScreenProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-16 w-full max-w-[640px] mx-auto px-4">
      {/* Section label */}
      <span className="section-label mb-0">PROCESSING</span>

      {/* Status text with pulsing dots */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-foreground">{status}</span>
          <PulsingDots />
        </div>
        {substatus && (
          <span
            className="font-mono text-muted-foreground"
            style={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}
          >
            {substatus}
          </span>
        )}
      </div>

      {/* Skeleton loading preview */}
      <div className="w-full flex flex-col gap-4 border border-border p-5">
        <SkeletonBlock width="60%" />
        <SkeletonBlock width="100%" />
        <SkeletonBlock width="85%" />
        <SkeletonBlock width="45%" />
        <div className="h-4" />
        <SkeletonBlock width="70%" />
        <SkeletonBlock width="90%" />
      </div>

      {/* Elapsed time */}
      <div className="flex flex-col items-center gap-1">
        <span className="section-label mb-0">ELAPSED</span>
        <ElapsedTimer />
      </div>
    </div>
  );
}
