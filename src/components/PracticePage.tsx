import { useState, useCallback, useRef } from "react";
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
import { Mic } from "lucide-react";

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

  const handleReset = useCallback(() => {
    setPhase("idle");
    setCurrentPrompt(null);
    setFeedbackData(null);
    setProcessingStatus("");
    setProcessingSubstatus(undefined);
    setTranscribeError(null);
  }, []);

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
        <div className="flex flex-col items-center gap-6 w-full">
          <PromptCard prompt={currentPrompt} />
          <Timer
            duration={settings.speakingTime}
            onComplete={handleSpeakingComplete}
            label="Speaking Time"
            isActive={true}
          />
          <div className="flex items-center gap-2">
            <span
              className="recording-dot inline-block w-2 h-2"
              style={{ backgroundColor: "var(--cta)" }}
            />
            <Mic className="size-5" style={{ color: "var(--cta)" }} />
            <span className="section-label mb-0">RECORDING</span>
          </div>
          {micError && (
            <p className="text-sm text-center" style={{ color: "var(--cta)" }}>{micError}</p>
          )}
          <Button
            variant="outline"
            onClick={handleSpeakingComplete}
            className="mt-2"
          >
            Done
          </Button>
        </div>
      )}

      {/* Processing */}
      {phase === "processing" && (
        <ProcessingScreen status={processingStatus} substatus={processingSubstatus} />
      )}

      {/* Results */}
      {phase === "results" && feedbackData && (
        <div className="flex flex-col items-center gap-6 w-full">
          {transcribeError && (
            <div className="w-full border border-warning p-3">
              <span className="section-label mb-0">TRANSCRIPTION NOTE</span>
              <p className="text-sm text-muted-foreground mt-1">
                Live transcription failed ({transcribeError}). Showing mock transcript for demo.
              </p>
            </div>
          )}
          <ResultsPanel data={feedbackData} />
          <div className="flex gap-3 pt-4">
            <Button size="lg" onClick={handleStart}>
              Try Another
            </Button>
            <Button size="lg" variant="outline" onClick={handleReset}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
