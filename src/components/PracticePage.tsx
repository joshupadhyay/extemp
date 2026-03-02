import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/Timer";
import { PromptCard } from "@/components/PromptCard";
import { ResultsPanel } from "@/components/ResultsPanel";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { getRandomPrompt } from "@/lib/prompts";
import { mockFeedbackData } from "@/lib/mockFeedback";
import { saveSession } from "@/lib/storage";
import type { PracticePhase, Prompt, FeedbackData, Settings, SpeechSession } from "@/lib/types";
import { Mic, Loader2 } from "lucide-react";

interface PracticePageProps {
  settings: Settings;
}

export function PracticePage({ settings }: PracticePageProps) {
  const [phase, setPhase] = useState<PracticePhase>("idle");
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");
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
    setProcessingStatus("Transcribing...");

    try {
      await stopRecording();
    } catch {
      // Even if stop fails, continue to mock results
    }

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 1500));
    setProcessingStatus("Generating feedback...");
    await new Promise((r) => setTimeout(r, 1500));

    // Use mock data for now
    const data = mockFeedbackData;
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
          <div className="flex items-center gap-2 text-red-400">
            <Mic className="size-5 animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>
          {micError && (
            <p className="text-sm text-red-400 text-center">{micError}</p>
          )}
          <Button
            variant="outline"
            onClick={handleSpeakingComplete}
            className="mt-2"
          >
            Finish Early
          </Button>
        </div>
      )}

      {/* Processing */}
      {phase === "processing" && (
        <div className="flex flex-col items-center gap-6 py-16">
          <Loader2 className="size-10 animate-spin text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{processingStatus}</p>
        </div>
      )}

      {/* Results */}
      {phase === "results" && feedbackData && (
        <div className="flex flex-col items-center gap-6 w-full">
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
