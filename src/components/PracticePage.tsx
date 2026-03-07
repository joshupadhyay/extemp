import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/Timer";
import { PromptCard } from "@/components/PromptCard";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ProcessingScreen, type ProcessingStep } from "@/components/ProcessingScreen";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { getRandomPromptByCategories, getRandomPrompt, getTwoRandomPrompts } from "@/lib/prompts";
import { mockFeedbackData } from "@/lib/mockFeedback";
import { saveSession } from "@/lib/storage";
import type { PracticePhase, Prompt, FeedbackData, TranscriptionResult, Settings, SpeechSession } from "@/lib/types";
import { Square, ArrowRight } from "lucide-react";
import { AsciiWaveform } from "@/components/AsciiWaveform";

import { PromptScreenB } from "@/components/PromptScreenB";

interface PracticePageProps {
  settings: Settings;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  isGuest?: boolean;
}

/** Upload a single audio chunk to the server during recording. */
async function uploadChunk(sessionId: string, chunk: Blob, index: number): Promise<void> {
  const res = await fetch(`/api/audio-chunks/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": chunk.type || "audio/webm",
      "X-Chunk-Index": String(index),
    },
    body: chunk,
  });
  if (!res.ok) {
    throw new Error(`Chunk upload failed: ${res.status}`);
  }
}

/** Poll a job until it completes or fails. */
async function pollJob<T>(jobId: string, interval = 2000, maxWait = 120000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Job poll failed: ${res.status}`);
    const job = await res.json();
    if (job.status === "completed") return job.result as T;
    if (job.status === "failed") throw new Error(job.error || "Job failed");
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Job timed out");
}

/** Submit audio for transcription and return the job ID. */
async function startTranscription(blob: Blob): Promise<string> {
  const formData = new FormData();
  const ext = blob.type.includes("mp4") ? ".mp4" : ".webm";
  formData.append("file", blob, `recording${ext}`);
  const res = await fetch("/api/transcribe", { method: "POST", body: formData });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Failed to start transcription");
  return body.jobId;
}

/** Submit transcript for evaluation and return the job ID. */
async function startEvaluation(transcript: string, prompt: string, prepTime: number, speakingTime: number): Promise<string> {
  const res = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, prompt, prep_time: prepTime, speaking_time: speakingTime }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Failed to start evaluation");
  return body.jobId;
}

/** Tell the server to assemble chunks and forward to Modal for transcription. */
async function finalizeTranscription(sessionId: string, mimeType: string): Promise<string> {
  const res = await fetch(`/api/audio-chunks/${sessionId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Finalize failed");
  // If the finalize endpoint returns a jobId, use it; otherwise return inline result
  return body.jobId ?? body;
}

export function PracticePage({ settings, setSettings, isGuest }: PracticePageProps) {
  const [phase, setPhase] = useState<PracticePhase>("prompt");
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [promptChoices, setPromptChoices] = useState<[Prompt, Prompt] | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("transcribing");
  const [completedSteps, setCompletedSteps] = useState<ProcessingStep[]>([]);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);
  const { isRecording, startRecording, stopRecording, error: micError } = useAudioRecorder({
    onChunk: uploadChunk,
    chunkInterval: 3000,
  });

  // Refs for stable callback access
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const currentPromptRef = useRef(currentPrompt);
  currentPromptRef.current = currentPrompt;

  // Elapsed timer for speaking phase (counts UP)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const speakingStartRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSpeakingCompleteRef = useRef<() => void>(() => {});

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const handleStart = useCallback(() => {
    setCurrentPrompt(null);
    setPromptChoices(null);
    setFeedbackData(null);
    setTranscribeError(null);
    setPhase("prompt");
  }, []);

  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownCategoryRef = useRef<string[] | undefined>();

  // Track whether mic permission has been granted this session
  const micPermissionGrantedRef = useRef(false);

  const handleReady = useCallback(async (categories?: string[]) => {
    // Request mic permission upfront so the browser dialog doesn't interrupt mid-flow
    if (!micPermissionGrantedRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release the stream immediately — we just needed the permission grant
        stream.getTracks().forEach((track) => track.stop());
        micPermissionGrantedRef.current = true;
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotFoundError") {
          alert("No microphone found. Please connect a microphone and try again.");
        } else {
          alert("Microphone access is required to practice. Please allow microphone access and try again.");
        }
        return;
      }
    }

    countdownCategoryRef.current = categories;
    setCountdown(3);
    setPhase("countdown");
  }, []);

  // Countdown timer: 3 → 2 → 1 → generate prompt → prep
  useEffect(() => {
    if (phase !== "countdown" || countdown === null) return;
    if (countdown === 0) {
      const choices = getTwoRandomPrompts(countdownCategoryRef.current);
      setPromptChoices(choices);
      setPhase("select");
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  const handleSelectPrompt = useCallback((prompt: Prompt) => {
    setCurrentPrompt(prompt);
    setPromptChoices(null);
    setPhase("prep");
  }, []);

  const handlePrepComplete = useCallback(async () => {
    try {
      await startRecording();
      setPhase("speaking");
      // Prewarm Modal so the container is hot when they finish speaking
      fetch("/api/prewarm", { method: "POST" }).catch(() => {});
    } catch {
      setPhase("prompt");
    }
  }, [startRecording]);

  const handleSpeakingComplete = useCallback(async () => {
    // Guard against double-fire (timer + button)
    if (phaseRef.current !== "speaking") return;

    setPhase("processing");
    setProcessingStep("transcribing");
    setCompletedSteps([]);
    setTranscribeError(null);
    setEvaluateError(null);

    try {
      // Stop recording — waits for pending chunk uploads to settle
      let audioBlob: Blob | null = null;
      try {
        const result = await stopRecording();
        audioBlob = result.blob;
      } catch {
        // If stop fails we have no audio — will show error state
      }

      let transcript: string;
      let transcriptionResult: TranscriptionResult | undefined;

      // Step 1: Transcription
      if (audioBlob && audioBlob.size > 0) {
        try {
          const jobId = await startTranscription(audioBlob);
          transcriptionResult = await pollJob<TranscriptionResult>(jobId);
          transcript = transcriptionResult.transcript;
        } catch (err) {
          console.error("Transcription failed:", err);
          setTranscribeError(
            err instanceof Error ? err.message : "Transcription failed",
          );
          transcript = "";
        }
      } else {
        setTranscribeError("No audio recorded");
        transcript = "";
      }

      // Step 2: Reviewing transcription (brief transitional step)
      setCompletedSteps(["transcribing"]);
      setProcessingStep("reviewing");

      // Step 3: Evaluation
      setCompletedSteps(["transcribing", "reviewing"]);
      setProcessingStep("analyzing");

      let data: FeedbackData | null;
      const prompt = currentPromptRef.current;

      if (prompt && transcript) {
        try {
          const evalJobId = await startEvaluation(
            transcript, prompt.text, settings.prepTime, settings.speakingTime,
          );
          data = await pollJob<FeedbackData>(evalJobId);
          data.transcription = transcriptionResult;
        } catch (err) {
          console.error("Evaluation failed:", err);
          setEvaluateError(err instanceof Error ? err.message : "Evaluation failed");
          data = null;
        }
      } else {
        // No transcript or no prompt — skip evaluation
        data = null;
      }

      setCompletedSteps(["transcribing", "reviewing", "analyzing"]);
      if (data) {
        setFeedbackData(data);

        // Save session
        if (prompt) {
          const session: SpeechSession = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            prompt: prompt.text,
            promptCategory: prompt.category,
            feedbackData: data,
          };
          saveSession(session);

          // Save to Supabase (non-blocking)
          fetch("/api/dialogues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt_text: prompt.text,
              prompt_category: prompt.category,
              prep_time: settings.prepTime,
              speaking_time: settings.speakingTime,
              actual_duration: transcriptionResult?.duration ?? null,
              transcript: transcriptionResult ?? null,
              feedback: data.feedback,
              settings: { prepTime: settings.prepTime, speakingTime: settings.speakingTime },
            }),
          }).catch((err) => console.error("Supabase save failed:", err));
        }
      }
    } catch (err) {
      console.error("Unexpected error in handleSpeakingComplete:", err);
      setEvaluateError(err instanceof Error ? err.message : "Something went wrong");
    }

    setPhase("results");
  }, [stopRecording]);

  // Keep ref in sync for use in useEffect without circular dependency
  handleSpeakingCompleteRef.current = handleSpeakingComplete;

  useEffect(() => {
    if (phase === "speaking") {
      speakingStartRef.current = Date.now();
      setElapsedSeconds(0);

      elapsedIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - speakingStartRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }, 250);

      // Auto-complete when speaking time limit reached
      speakingTimeoutRef.current = setTimeout(() => {
        handleSpeakingCompleteRef.current();
      }, settings.speakingTime * 1000);

      return () => {
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
      };
    }
  }, [phase, settings.speakingTime]);

  const handleReset = useCallback(() => {
    setPhase("prompt");
    setCurrentPrompt(null);
    setPromptChoices(null);
    setFeedbackData(null);
    setProcessingStep("transcribing");
    setCompletedSteps([]);
    setTranscribeError(null);
    setEvaluateError(null);
  }, []);

  // Debug: jump to any phase with mock data
  const debugSetPhase = useCallback((target: PracticePhase) => {
    const mockPrompt = currentPrompt ?? getRandomPrompt();
    setCurrentPrompt(mockPrompt);
    setTranscribeError(null);

    if (target === "idle") {
      handleReset();
    } else if (target === "select") {
      setPromptChoices(getTwoRandomPrompts());
      setPhase("select");
    } else if (target === "processing") {
      setProcessingStep("transcribing");
      setCompletedSteps([]);
      setPhase("processing");
    } else if (target === "results") {
      setFeedbackData(mockFeedbackData);
      setPhase("results");
    } else {
      setPhase(target);
    }
  }, [currentPrompt, handleReset]);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto py-8 px-4">
      {/* Category selection + config */}
      {phase === "prompt" && (
        <PromptScreenB
          settings={settings}
          setSettings={(s) => setSettings?.((prev) => ({ ...prev, ...s }))}
          onReady={handleReady}
        />
      )}

      {/* Fullscreen countdown */}
      {phase === "countdown" && countdown !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-background" style={{ zIndex: 50 }}>
          <span key={countdown} className="countdown-number font-mono text-[8rem] font-bold tabular-nums leading-none text-foreground">
            {countdown}
          </span>
        </div>
      )}

      {/* Prompt selection phase */}
      {phase === "select" && promptChoices && (
        <div className="phase-in flex flex-col items-center gap-6 w-full">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
            Choose Your Prompt
          </span>
          <div className="flex flex-col gap-4 w-full">
            {promptChoices.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSelectPrompt(prompt)}
                className="w-full text-left border border-border p-6 transition-colors duration-200 ease-out hover:border-foreground hover:bg-foreground/[0.03] cursor-pointer group"
              >
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground group-hover:text-foreground/60 transition-colors">
                  {prompt.category}
                </span>
                <p className="text-lg font-medium leading-snug mt-2 text-foreground">
                  {prompt.text}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prep phase */}
      {phase === "prep" && currentPrompt && (
        <div className="phase-in flex flex-col items-center gap-6 w-full">
          <PromptCard prompt={currentPrompt} />
          <Timer
            duration={settings.prepTime}
            onComplete={handlePrepComplete}
            label="Prep Time"
            isActive={true}
          />
          <p className="text-sm text-muted-foreground text-center">
            Organize your thoughts. Recording starts automatically when prep ends.
          </p>
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrepComplete}
            className="w-full h-12 text-base gap-2"
          >
            <ArrowRight className="size-4" />
            I'm Ready
          </Button>
        </div>
      )}

      {/* Speaking phase */}
      {phase === "speaking" && currentPrompt && (
        <div className="fixed inset-0 flex flex-col bg-background" style={{ zIndex: 50 }}>
          {/* Countdown overlay for final 3 seconds */}
          {(() => {
            const remaining = settings.speakingTime - elapsedSeconds;
            if (remaining >= 1 && remaining <= 3) {
              return (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm" style={{ zIndex: 60 }}>
                  <span key={remaining} className="countdown-number font-mono text-[8rem] font-bold tabular-nums leading-none text-foreground">
                    {remaining}
                  </span>
                </div>
              );
            }
            return null;
          })()}

          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span
                className="recording-dot inline-block w-2 h-2"
                style={{ backgroundColor: "var(--cta)" }}
              />
              <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--cta)" }}>
                REC
              </span>
            </div>
            <span className="section-label mb-0">PRACTICE / INDEX 01</span>
          </div>

          {/* ASCII Waveform area with gradient fade */}
          <div className="waveform-container flex-none" style={{ height: "35%" }}>
            <AsciiWaveform className="w-full h-full" />
          </div>

          {/* Content area */}
          <div className="flex flex-col flex-1 px-5 py-4 overflow-hidden">
            {/* Prompt heading */}
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight leading-tight">
                {currentPrompt.text}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">
                {currentPrompt.category}
              </p>
            </div>

            {/* Live transcript area */}
            <div className="flex-1 overflow-y-auto mb-4">
              <p className="text-base text-muted-foreground leading-relaxed">
                Listening...<span className="cursor-blink" />
              </p>
            </div>

            {/* Mic error */}
            {micError && (
              <p className="text-sm mb-2" style={{ color: "var(--cta)" }}>{micError}</p>
            )}

            {/* Time remaining warning */}
            {(() => {
              const remaining = settings.speakingTime - elapsedSeconds;
              if (remaining <= 30 && remaining > 10) {
                return (
                  <div className="mb-3 px-3 py-2 border border-foreground/20 bg-foreground/[0.03] phase-in">
                    <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
                      {remaining} seconds remaining
                    </span>
                  </div>
                );
              }
              if (remaining <= 10 && remaining > 3) {
                return (
                  <div className="mb-3 px-3 py-2 border phase-in" style={{ borderColor: "var(--cta)", backgroundColor: "color-mix(in srgb, var(--cta) 8%, transparent)" }}>
                    <span className="font-mono text-xs uppercase tracking-[0.1em] font-semibold" style={{ color: "var(--cta)" }}>
                      {remaining} seconds remaining
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Timer + level bars */}
            <div className="flex items-end justify-between mb-4">
              <span className="font-mono text-4xl font-semibold tabular-nums leading-none">
                {formatElapsed(elapsedSeconds)}
              </span>
              <div className="flex items-end gap-1">
                <div className="level-bar" />
                <div className="level-bar" />
                <div className="level-bar" />
                <div className="level-bar" />
              </div>
            </div>

            {/* End Session button */}
            <Button
              variant="cta"
              size="lg"
              onClick={handleSpeakingComplete}
              className="w-full h-12 text-base gap-2"
            >
              <Square className="size-4 fill-current" />
              I'm Done
            </Button>
          </div>

          {/* Footer bar */}
          <div className="grid grid-cols-2 gap-px border-t border-border" style={{ backgroundColor: "var(--border)" }}>
            <div className="bg-background px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">Frameworks: Detecting...</span>
            </div>
            <div className="bg-background px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">Feedback: AI Coach</span>
            </div>
            <div className="bg-background px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">Status: Recording</span>
            </div>
            <div className="bg-background px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">Mic: Built-in</span>
            </div>
          </div>
        </div>
      )}

      {/* Processing */}
      {phase === "processing" && (
        <ProcessingScreen currentStep={processingStep} completedSteps={completedSteps} />
      )}

      {/* Results — no phase-in wrapper: ResultsPanel uses position:fixed which breaks under CSS transforms */}
      {phase === "results" && feedbackData && (
        <ResultsPanel data={feedbackData} prompt={currentPrompt?.text} onPracticeAgain={isGuest ? undefined : handleStart} onDone={isGuest ? undefined : handleReset} isGuest={isGuest} />
      )}

      {/* Error state — transcription or evaluation failed */}
      {phase === "results" && !feedbackData && (
        <div className="flex flex-col items-center gap-6 py-16 w-full">
          <div className="w-2 h-2 bg-[#E8302A]" />
          <h2 className="text-xl font-semibold text-center">
            Sorry, there was an error with the analysis.
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {transcribeError
              ? `Transcription failed: ${transcribeError}`
              : evaluateError
                ? `Evaluation failed: ${evaluateError}`
                : "Something went wrong. Please try again."}
          </p>
          <Button
            variant="cta"
            size="lg"
            onClick={handleReset}
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Debug panel — dev only */}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-4 right-4 bg-neutral-900 text-white p-3 font-mono text-[10px] flex flex-col gap-1.5" style={{ zIndex: 9999 }}>
          <span className="text-neutral-500 uppercase tracking-wider">Debug: {phase}</span>
          <div className="flex flex-wrap gap-1">
            {(["idle", "prompt", "countdown", "select", "prep", "speaking", "processing", "results"] as PracticePhase[]).map((p) => (
              <button
                key={p}
                onClick={() => debugSetPhase(p)}
                className={`px-2 py-1 uppercase tracking-wider cursor-pointer ${
                  phase === p
                    ? "bg-[#E8302A] text-white"
                    : "bg-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
