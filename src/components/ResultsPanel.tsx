import { ArrowRight, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { ROUTES } from "@/lib/routes";
import type { FeedbackData, FillerWordsResult } from "@/lib/types";
import { toDisplayScore, getScoreLabel } from "@/lib/utils";

interface ResultsPanelProps {
  data: FeedbackData;
  prompt?: string;
  onPracticeAgain?: () => void;
  onDone?: () => void;
  onBack?: () => void;
  isGuest?: boolean;
}

function sanitizeHighlightedTranscript(html: string): string {
  // Strip all tags except <mark> and </mark>, then remove any attributes from <mark>
  const noTags = html.replace(/<\/?(?!mark[\s>])[^>]*>/gi, "");
  return noTags.replace(/<mark\s[^>]*>/gi, "<mark>");
}

const ASCII_WAVEFORM = `  .                               .
 .:.                             .:.
.:::.                           .:::.
 .:::::.                         .:::::.
.:::::::.                       .:::::::.
 .:::::::::.                     .:::::::::.
.:::::::::::.                   .:::::::::::.
 .:::::::::::::.                 .:::::::::::::.
.:::::::::::::::.               .:::::::::::::::.
 .:::::::::::::::::.             .:::::::::::::::::.
.:::::::::::::::::::.           .:::::::::::::::::::.
 .:::::::::::::::::::::.         .:::::::::::::::::::::.
.:::::::::::::::::::::::.       .:::::::::::::::::::::::.
 .:::::::::::::::::::::::::.     .:::::::::::::::::::::::::.
.:::::::::::::::::::::::::::.   .:::::::::::::::::::::::::::.
 .:::::::::::::::::::::::::::::. .:::::::::::::::::::::::::::::.
.::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::.
 .::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::.
.::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::.
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
'::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::'
 '::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::'
  '::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::'
   ':::::::::::::::::::::::::::::. .:::::::::::::::::::::::::::::'
    ':::::::::::::::::::::::::::'   ':::::::::::::::::::::::::::'
     ':::::::::::::::::::::::::'     ':::::::::::::::::::::::::'
      ':::::::::::::::::::::::'       ':::::::::::::::::::::::'
       ':::::::::::::::::::::'         ':::::::::::::::::::::'
        ':::::::::::::::::::'           ':::::::::::::::::::'
         ':::::::::::::::::'             ':::::::::::::::::'
          ':::::::::::::::'               ':::::::::::::::'
           ':::::::::::::'                 ':::::::::::::'
            ':::::::::::'                   ':::::::::::'
             ':::::::::'                     ':::::::::'
              ':::::::'                       ':::::::'
               ':::::'                         ':::::'
                ':::'                           ':::'
                 ':'                             ':'
                  .                               .`;

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = (score / 10) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{score}/10</span>
      </div>
      <div className="w-full h-1.5 bg-neutral-100">
        <div
          className="h-full bg-foreground transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ResultsPanel({ data, prompt, onPracticeAgain, onDone, onBack, isGuest }: ResultsPanelProps) {
  const { feedback, transcript, transcription } = data;
  const score = toDisplayScore(feedback.overall_score);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const fillerWords: FillerWordsResult | null = transcription?.filler_words ?? null;
  const highlightedTranscript: string | null = transcription?.highlighted_transcript ?? null;
  const durationSec = transcription?.duration ?? null;
  const durationStr = durationSec != null
    ? `${String(Math.floor(durationSec / 60)).padStart(2, "0")}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`
    : "--:--";
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Split coach summary into paragraphs on sentence boundaries
  const coachParagraphs = feedback.coach_summary
    .split(/(?<=\.)\s+/)
    .reduce<string[]>((acc, sentence) => {
      if (acc.length === 0) return [sentence];
      const last = acc[acc.length - 1]!;
      // Group ~2-3 sentences per paragraph
      if (last.split(/\.\s/).length < 2) {
        acc[acc.length - 1] = last + " " + sentence;
      } else {
        acc.push(sentence);
      }
      return acc;
    }, []);

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row bg-white text-neutral-900" style={{ zIndex: 50 }}>
      {/* Left Panel — sidebar on desktop only, hidden on mobile */}
      <div className="hidden lg:flex w-3/12 h-full flex-col justify-between p-8 border-r border-neutral-100 bg-neutral-50/20 relative">
        {/* Checkmark icon */}
        <div className="absolute top-8 left-8">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" fill="#111" />
            <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* ASCII waveform */}
        <div className="flex-1 flex flex-col items-center justify-center opacity-80">
          <div className="ascii-art font-mono text-neutral-800 text-[8px] leading-[8px] overflow-hidden">
            {ASCII_WAVEFORM}
          </div>
          <div className="mt-8 font-mono text-xs text-neutral-400 text-center">
            SESSION_WAVEFORM_RENDER_01.DAT
          </div>
        </div>

        {/* Bottom stats */}
        <div className="w-full pt-8 border-t border-neutral-200">
          <div className="grid grid-cols-3 gap-4 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            <div>
              <span className="block text-neutral-300 mb-1">Duration</span>
              <span className="text-neutral-900">{durationStr}</span>
            </div>
            <div className="text-center">
              <span className="block text-neutral-300 mb-1">Word Count</span>
              <span className="text-neutral-900">{wordCount}</span>
            </div>
            <div className="text-right">
              <span className="block text-neutral-300 mb-1">Fillers</span>
              <span className="text-neutral-900">{fillerWords?.count ?? "--"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-9/12 min-h-0 lg:h-full flex-1 flex flex-col relative bg-white">
        {/* Back button */}
        {onBack && (
          <div className="px-4 pt-4 lg:px-8 lg:pt-6">
            <Button variant="outline" onClick={onBack} className="gap-1 -ml-2 border-neutral-900">
              <ChevronLeft className="size-4" />
              Back
            </Button>
          </div>
        )}

        {/* Mobile stats banner — shown only on mobile */}
        <div className="lg:hidden w-full bg-neutral-50/30 border-b border-neutral-100 flex flex-col items-center pt-4 pb-4 px-4">
          <div className="flex items-center gap-6 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            <div className="flex flex-col items-center">
              <span className="text-neutral-900 font-bold">{durationStr}</span>
              <span>Duration</span>
            </div>
            <div className="h-8 w-px bg-neutral-300" />
            <div className="flex flex-col items-center">
              <span className="text-neutral-900 font-bold">{wordCount}</span>
              <span>Words</span>
            </div>
            <div className="h-8 w-px bg-neutral-300" />
            <div className="flex flex-col items-center">
              <span className="text-neutral-900 font-bold">{fillerWords?.count ?? "--"}</span>
              <span>Fillers</span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 pb-12">
          {/* Header */}
          <div className="pt-8 lg:pt-12 pb-4">
            <div className="font-mono text-xs text-neutral-400 uppercase tracking-widest mb-8">
              Practice / Report 01
            </div>

            <div className="border-b border-neutral-100 pb-8">
              {prompt && (
                <p className="text-base lg:text-lg font-medium text-neutral-900 leading-snug mb-3">
                  &ldquo;{prompt}&rdquo;
                </p>
              )}
              <div className="flex items-center gap-4 mb-1">
                <span className="font-mono text-2xl font-bold text-neutral-900 tabular-nums">
                  {score}<span className="text-base text-neutral-400 font-normal">/100</span>
                </span>
                <span className="text-sm font-medium text-neutral-500">
                  {getScoreLabel(score)}
                </span>
                <Link
                  to={ROUTES.methodology}
                  className="ml-auto font-mono text-[10px] uppercase tracking-wider text-neutral-400 underline underline-offset-2 hover:text-neutral-600 transition-colors"
                >
                  Methodology
                </Link>
              </div>
              <p className="text-neutral-500 text-sm">{dateStr}</p>
            </div>
          </div>
          {/* Coach Feedback */}
          <div className="py-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-[#E8302A]" />
              <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
                Coach Feedback
              </h2>
            </div>
            <div className="space-y-6 leading-relaxed">
              {coachParagraphs.map((p, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "text-lg text-neutral-800 font-light"
                      : "text-base text-neutral-600"
                  }
                >
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* Framework detected — compact inline tag */}
          {feedback.framework_detected && (
            <div className="py-6 border-t border-neutral-100">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  Framework used
                </span>
                <div className="inline-flex items-center gap-2 border border-neutral-900 bg-neutral-900 text-white px-3 py-1.5">
                  <span className="font-bold text-sm tracking-wide">
                    {feedback.framework_detected}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="#E8302A">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Dimension Scores */}
          <div className="py-8 border-t border-neutral-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-neutral-300" />
              <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
                Dimension Scores
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <ScoreBar score={feedback.scores.structure} label="Structure" />
              <ScoreBar score={feedback.scores.clarity} label="Clarity" />
              <ScoreBar score={feedback.scores.specificity} label="Specificity" />
              <ScoreBar score={feedback.scores.persuasiveness} label="Persuasion" />
              <ScoreBar score={feedback.scores.language} label="Language" />
            </div>
          </div>

          {/* Strengths + Improvement */}
          <div className="py-8 border-t border-neutral-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-neutral-300" />
              <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
                Key Takeaways
              </h2>
            </div>

            {/* Strengths */}
            <div className="mb-6">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block mb-3">
                What went well
              </span>
              <ul className="space-y-2">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-neutral-600">
                    <span className="text-[#E8302A] font-mono text-sm mt-0.5 shrink-0">+</span>
                    <span className="text-sm">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Focus next time — prominent callout */}
            <div className="border border-neutral-900 bg-neutral-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-[#E8302A]" />
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-900 font-medium">
                  Focus next time
                </span>
              </div>
              <p className="text-base text-neutral-800 leading-relaxed">
                {feedback.improvement}
              </p>
              {feedback.framework_suggested &&
                feedback.framework_suggested !== feedback.framework_detected && (
                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block mb-2">
                      Try this framework
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold tracking-wide text-neutral-900">
                        {feedback.framework_suggested}
                      </span>
                      <Link
                        to={ROUTES.methodology}
                        className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 underline underline-offset-2 hover:text-neutral-600 transition-colors"
                      >
                        Learn more
                      </Link>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Filler Words / Confidence Killers */}
          {fillerWords && fillerWords.count > 0 && (
            <div className="py-8 border-t border-neutral-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-neutral-300" />
                <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
                  Filler Words
                  <span className="ml-2 text-neutral-400 normal-case">
                    ({fillerWords.count} filler word{fillerWords.count !== 1 ? "s" : ""})
                  </span>
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(fillerWords.details).map(([word, count]) => (
                  <div
                    key={word}
                    className="flex items-center gap-2 border border-neutral-200 px-3 py-1.5 text-sm font-mono"
                  >
                    <span className="text-neutral-900">"{word}"</span>
                    <span className="text-[10px] text-neutral-400">x{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlighted Transcript */}
          <div className="py-8 border-t border-neutral-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-neutral-300" />
              <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
                Your Speech
              </h2>
            </div>
            {highlightedTranscript ? (
              <p
                className="transcript-highlight text-sm text-neutral-600 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHighlightedTranscript(highlightedTranscript),
                }}
              />
            ) : (
              <p className="text-sm text-neutral-600 leading-relaxed">
                {transcript}
              </p>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {isGuest ? (
              <>
                <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 mb-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    Sign up to save your session and track progress over time
                  </p>
                </div>
                <Button
                  variant="cta"
                  size="lg"
                  onClick={() => {
                    signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } });
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 group"
                >
                  <span>Save & Create Account</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </>
            ) : (
              <>
                {onPracticeAgain && (
                  <Button
                    variant="cta"
                    size="lg"
                    onClick={onPracticeAgain}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 group"
                  >
                    <span>Another Round?</span>
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                )}
                {onDone && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={onDone}
                    className="w-full sm:w-auto"
                  >
                    Done
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer bar */}
        <div className="px-6 lg:px-12 py-4 border-t border-neutral-100 bg-white">
          <div className="font-mono text-[10px] text-neutral-400 flex flex-wrap gap-x-6 gap-y-2 uppercase tracking-wider">
            <span className="text-neutral-900">
              {feedback.framework_detected
                ? `Framework: ${feedback.framework_detected}`
                : "Framework: None"}
            </span>
            <span>{feedback.framework_detected ? "Detected" : ""}</span>
            <span>Words: {wordCount}</span>
            <span className="ml-auto">Status: Complete</span>
          </div>
          <div className="w-full h-1 bg-neutral-100 mt-3">
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${score}%`, backgroundColor: "#E8302A" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
