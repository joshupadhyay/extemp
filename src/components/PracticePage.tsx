import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/Timer";
import { PromptCard } from "@/components/PromptCard";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { getRandomPromptByCategories, getRandomPrompt } from "@/lib/prompts";
import { mockFeedbackData } from "@/lib/mockFeedback";
import { saveSession } from "@/lib/storage";
import type { PracticePhase, Prompt, FeedbackData, TranscriptionResult, Settings, SpeechSession } from "@/lib/types";
import { Square } from "lucide-react";
import { AsciiWaveform } from "@/components/AsciiWaveform";

import { PromptScreenB } from "@/components/PromptScreenB";

interface PracticePageProps {
  settings: Settings;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
}

/** Send audio blob to the Bun server proxy which forwards to Modal (fallback path). */
async function transcribeAudio(blob: Blob): Promise<TranscriptionResult> {
  const formData = new FormData();
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

/** Tell the server to assemble chunks and forward to Modal for transcription. */
async function finalizeTranscription(sessionId: string, mimeType: string): Promise<TranscriptionResult> {
  const res = await fetch(`/api/audio-chunks/${sessionId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType }),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || "Finalize failed");
  }

  return body as TranscriptionResult;
}

export function PracticePage({ settings, setSettings }: PracticePageProps) {
  const [phase, setPhase] = useState<PracticePhase>("prompt");
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");
  const [processingSubstatus, setProcessingSubstatus] = useState<string | undefined>();
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
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
    setFeedbackData(null);
    setTranscribeError(null);
    setPhase("prompt");
  }, []);

  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownCategoryRef = useRef<string[] | undefined>();

  const handleReady = useCallback((categories?: string[]) => {
    countdownCategoryRef.current = categories;
    setCountdown(3);
    setPhase("countdown");
  }, []);

  // Countdown timer: 3 → 2 → 1 → generate prompt → prep
  useEffect(() => {
    if (phase !== "countdown" || countdown === null) return;
    if (countdown === 0) {
      const prompt = getRandomPromptByCategories(countdownCategoryRef.current);
      setCurrentPrompt(prompt);
      setPhase("prep");
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

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
    setTranscribeError(null);

    // Stop recording — waits for pending chunk uploads to settle
    let audioBlob: Blob | null = null;
    let sid = "";
    let allChunksUploaded = false;
    try {
      const result = await stopRecording();
      audioBlob = result.blob;
      sid = result.sessionId;
      allChunksUploaded = result.allChunksUploaded;
    } catch {
      // If stop fails we have no audio — fall through to mock
    }

    let transcript: string;
    let transcriptionResult: TranscriptionResult | undefined;

    if (audioBlob && audioBlob.size > 0) {
      try {
        if (allChunksUploaded) {
          // Progressive path: chunks already on server, just finalize
          setProcessingSubstatus("Waiting for Whisper");
          transcriptionResult = await finalizeTranscription(sid, audioBlob.type);
        } else {
          // Fallback: upload entire blob as before
          setProcessingSubstatus("Uploading audio to Whisper");
          transcriptionResult = await transcribeAudio(audioBlob);
        }
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

    // Phase 2: generate personalized feedback via LLM
    setProcessingStatus("Analyzing your delivery");
    setProcessingSubstatus("Generating coaching feedback");

    let data: FeedbackData;
    const prompt = currentPromptRef.current;

    if (prompt) {
      try {
        const evalRes = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            prompt: prompt.text,
            prep_time: settings.prepTime,
            speaking_time: settings.speakingTime,
          }),
        });

        if (!evalRes.ok) {
          const errBody = await evalRes.json().catch(() => ({}));
          throw new Error((errBody as any).error || `Evaluate returned ${evalRes.status}`);
        }

        data = await evalRes.json() as FeedbackData;
        // Attach Whisper transcription data (filler words, clarity metrics, etc.)
        data.transcription = transcriptionResult;
      } catch (err) {
        console.error("Evaluation failed, falling back to mock:", err);
        data = { ...mockFeedbackData, transcript, transcription: transcriptionResult };
      }
    } else {
      data = { ...mockFeedbackData, transcript, transcription: transcriptionResult };
    }

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
        <div className="phase-in w-full">
          {transcribeError && (
            <div className="w-full border border-warning p-3 mb-4">
              <span className="section-label mb-0">TRANSCRIPTION NOTE</span>
              <p className="text-sm text-muted-foreground mt-1">
                Live transcription failed ({transcribeError}). Showing mock transcript for demo.
              </p>
            </div>
          )}
          <ResultsPanel data={feedbackData} onPracticeAgain={handleStart} onDone={handleReset} />
        </div>
      )}

      {/* Debug panel — dev only */}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-4 right-4 bg-neutral-900 text-white p-3 font-mono text-[10px] flex flex-col gap-1.5" style={{ zIndex: 9999 }}>
          <span className="text-neutral-500 uppercase tracking-wider">Debug: {phase}</span>
          <div className="flex flex-wrap gap-1">
            {(["idle", "prompt", "countdown", "prep", "speaking", "processing", "results"] as PracticePhase[]).map((p) => (
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
