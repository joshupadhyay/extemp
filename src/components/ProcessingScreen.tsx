import { useState, useEffect, useRef } from "react";

export type ProcessingStep = "transcribing" | "reviewing" | "analyzing";

interface ProcessingScreenProps {
  currentStep: ProcessingStep;
  completedSteps: ProcessingStep[];
}

const STEPS: { key: ProcessingStep; label: string }[] = [
  { key: "transcribing", label: "Transcribing audio" },
  { key: "reviewing", label: "Reviewing transcription" },
  { key: "analyzing", label: "Collecting analysis" },
];

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

function StepIndicator({ step, isCurrent, isCompleted }: {
  step: { key: ProcessingStep; label: string };
  isCurrent: boolean;
  isCompleted: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Status indicator */}
      <div className="flex-none w-5 h-5 flex items-center justify-center">
        {isCompleted ? (
          <span className="text-foreground font-mono text-sm">&#10003;</span>
        ) : isCurrent ? (
          <span
            className="block w-2 h-2"
            style={{
              backgroundColor: "var(--cta)",
              animation: "processing-step-pulse 1.5s ease-in-out infinite",
            }}
          />
        ) : (
          <span className="block w-1.5 h-1.5 bg-muted-foreground/30" />
        )}
      </div>

      {/* Label */}
      <span
        className={`font-mono text-sm uppercase tracking-[0.05em] transition-colors duration-300 ${
          isCompleted
            ? "text-foreground"
            : isCurrent
              ? "text-foreground font-medium"
              : "text-muted-foreground/40"
        }`}
      >
        {step.label}
      </span>

      {/* Pulsing dots for current step */}
      {isCurrent && <PulsingDots />}
    </div>
  );
}

export function ProcessingScreen({ currentStep, completedSteps }: ProcessingScreenProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-16 w-full max-w-[640px] mx-auto px-4">
      {/* Section label */}
      <span className="section-label mb-0">PROCESSING</span>

      {/* Step progression */}
      <div className="flex flex-col gap-4 w-full">
        {STEPS.map((step) => (
          <StepIndicator
            key={step.key}
            step={step}
            isCurrent={currentStep === step.key}
            isCompleted={completedSteps.includes(step.key)}
          />
        ))}
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

      <style>{`
        @keyframes processing-step-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes processing-step-pulse {
            0%, 100% { opacity: 0.8; }
          }
        }
      `}</style>
    </div>
  );
}
