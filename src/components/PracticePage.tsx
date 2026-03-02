import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/Timer";
import { PromptCard } from "@/components/PromptCard";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { getRandomPrompt } from "@/lib/prompts";
import { mockFeedbackData } from "@/lib/mockFeedback";
import { saveSession } from "@/lib/storage";
import type { PracticePhase, Prompt, FeedbackData, TranscriptionResult, Settings, SpeechSession } from "@/lib/types";
import { Square } from "lucide-react";
import { AsciiWaveform } from "@/components/AsciiWaveform";

interface PracticePageProps {
  settings: Settings;
}

/** Send audio blob to the Bun server proxy which forwards to Modal. */
async function transcribeAudio(blob: Blob): Promise<TranscriptionResult> {
  const formData = new FormData();
  // Derive extension from mime type for the filename
  const ext = blob.type.includes("mp4") ? ".mp4" : ".webm";
  formData.append("file", blob, `recording${ext}`);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || "Transcription failed");
  }

  return body as TranscriptionResult;
}

export function PracticePage({ settings }: PracticePageProps) {
  const [phase, setPhase] = useState<PracticePhase>("idle");
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");
  const [processingSubstatus, setProcessingSubstatus] = useState<string | undefined>();
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const { isRecording, startRecording, stopRecording, error: micError } = useAudioRecorder();

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
    const prompt = getRandomPrompt();
    setCurrentPrompt(prompt);
    setFeedbackData(null);
    setTranscribeError(null);
    setPhase("prompt");
  }, []);

  const handleBeginPrep = useCallback(() => {
    setPhase("prep");
  }, []);

  const handlePrepComplete = useCallback(async () => {
    try {
      await startRecording();
      setPhase("speaking");
    } catch {
      setPhase("prompt");
    }
  }, [startRecording]);

  const handleSpeakingComplete = useCallback(async () => {
    // Guard against double-fire (timer + button)
    if (phaseRef.current !== "speaking") return;

    setPhase("processing");
    setProcessingStatus("Transcribing your speech");
    setProcessingSubstatus("Sending audio to Whisper");
    setTranscribeError(null);

    // Stop recording and get the audio blob
    let audioBlob: Blob | null = null;
    try {
      audioBlob = await stopRecording();
    } catch {
      // If stop fails we have no audio — fall through to mock
    }

    let transcript: string;
    let transcriptionResult: TranscriptionResult | undefined;

    if (audioBlob && audioBlob.size > 0) {
      try {
        // Real transcription via Modal
        transcriptionResult = await transcribeAudio(audioBlob);
        transcript = transcriptionResult.transcript;
      } catch (err) {
        // If transcription fails, fall back to mock data
        console.error("Transcription failed, using mock:", err);
        setTranscribeError(
          err instanceof Error ? err.message : "Transcription failed",
        );
        transcript = mockFeedbackData.transcript;
      }
    } else {
      // No audio blob — use mock transcript
      transcript = mockFeedbackData.transcript;
    }

    // Phase 2: generate feedback (mock for now — LLM integration later)
    setProcessingStatus("Analyzing your delivery");
    setProcessingSubstatus("Generating feedback");

    // Use mock feedback but inject the real transcript
    const data: FeedbackData = {
      ...mockFeedbackData,
      transcript,
    };
    setFeedbackData(data);

    // Save session
    const prompt = currentPromptRef.current;
    if (prompt) {
      const session: SpeechSession = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        prompt: prompt.text,
        promptCategory: prompt.category,
        feedbackData: data,
        transcription: transcriptionResult,
      };
      saveSession(session);
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
    setPhase("idle");
    setCurrentPrompt(null);
    setFeedbackData(null);
    setProcessingStatus("");
    setProcessingSubstatus(undefined);
    setTranscribeError(null);
  }, []);

  // Debug: jump to any phase with mock data
  const debugSetPhase = useCallback((target: PracticePhase) => {
    const mockPrompt = currentPrompt ?? getRandomPrompt();
    setCurrentPrompt(mockPrompt);
    setTranscribeError(null);

    if (target === "idle") {
      handleReset();
    } else if (target === "processing") {
      setProcessingStatus("Transcribing your speech");
      setProcessingSubstatus("Sending audio to Whisper");
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
      {/* Idle */}
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-6 py-16">
          <h2 className="text-2xl font-semibold text-center">
            Ready to practice?
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            You'll get a random prompt, {settings.prepTime === 60 ? "1 minute" : "2 minutes"} to
            prep, and {settings.speakingTime === 60 ? "1 minute" : "2 minutes"} to speak. Then
            we'll give you feedback.
          </p>
          <Button size="lg" onClick={handleStart} className="text-lg px-8 py-6">
            Start Practice
          </Button>
        </div>
      )}

      {/* Prompt reveal */}
      {phase === "prompt" && currentPrompt && (
        <div className="flex flex-col items-center gap-6 w-full">
          <p className="text-sm text-muted-foreground">Your prompt:</p>
          <PromptCard prompt={currentPrompt} />
          <Button size="lg" onClick={handleBeginPrep} className="text-lg px-8 py-6">
            Begin Prep
          </Button>
        </div>
      )}

      {/* Prep phase */}
      {phase === "prep" && currentPrompt && (
        <div className="flex flex-col items-center gap-6 w-full">
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
        </div>
      )}

      {/* Speaking phase */}
      {phase === "speaking" && currentPrompt && (
        <div className="fixed inset-0 flex flex-col bg-background" style={{ zIndex: 50 }}>
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
              End Session
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
        <ProcessingScreen status={processingStatus} substatus={processingSubstatus} />
      )}

      {/* Results */}
      {phase === "results" && feedbackData && (
        <>
          {transcribeError && (
            <div className="w-full border border-warning p-3 mb-4">
              <span className="section-label mb-0">TRANSCRIPTION NOTE</span>
              <p className="text-sm text-muted-foreground mt-1">
                Live transcription failed ({transcribeError}). Showing mock transcript for demo.
              </p>
            </div>
          )}
          <ResultsPanel data={feedbackData} onPracticeAgain={handleStart} onDone={handleReset} />
        </>
      )}

      {/* Debug panel — dev only */}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-4 right-4 bg-neutral-900 text-white p-3 font-mono text-[10px] flex flex-col gap-1.5" style={{ zIndex: 9999 }}>
          <span className="text-neutral-500 uppercase tracking-wider">Debug: {phase}</span>
          <div className="flex flex-wrap gap-1">
            {(["idle", "prompt", "prep", "speaking", "processing", "results"] as PracticePhase[]).map((p) => (
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
