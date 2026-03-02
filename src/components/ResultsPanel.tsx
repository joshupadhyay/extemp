import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FeedbackData } from "@/lib/types";

interface ResultsPanelProps {
  data: FeedbackData;
  onPracticeAgain?: () => void;
  onDone?: () => void;
}

function sanitizeHighlightedTranscript(html: string): string {
  return html.replace(/<\/?(?!mark\b)[^>]*>/gi, "");
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

export function ResultsPanel({ data, onPracticeAgain, onDone }: ResultsPanelProps) {
  const { feedback, transcript } = data;
  const score = Math.round(feedback.overall_score * 10);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
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
    <div className="fixed inset-0 flex bg-white text-neutral-900" style={{ zIndex: 50 }}>
      {/* Left Panel — desktop only */}
      <div className="hidden lg:flex w-5/12 h-full flex-col justify-between p-12 border-r border-neutral-100 bg-neutral-50/20 relative">
        {/* Checkmark icon */}
        <div className="absolute top-12 left-12">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" fill="#111" />
            <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* ASCII waveform */}
        <div className="flex-1 flex flex-col items-center justify-center opacity-80">
          <div className="ascii-art font-mono text-neutral-800">
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
              <span className="text-neutral-900">--:--</span>
            </div>
            <div className="text-center">
              <span className="block text-neutral-300 mb-1">Word Count</span>
              <span className="text-neutral-900">{wordCount}</span>
            </div>
            <div className="text-right">
              <span className="block text-neutral-300 mb-1">Fillers</span>
              <span className="text-neutral-900">{feedback.filler_words.count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-7/12 h-full flex flex-col relative bg-white">
        {/* Mobile stats banner — shown only on mobile */}
        <div className="lg:hidden w-full bg-neutral-50/30 border-b border-neutral-100 flex flex-col items-center pt-6 pb-4 px-4">
          <div className="flex items-center gap-6 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            <div className="flex flex-col items-center">
              <span className="text-neutral-900 font-bold">--:--</span>
              <span>Duration</span>
            </div>
            <div className="h-8 w-px bg-neutral-300" />
            <div className="flex flex-col items-center">
              <span className="text-neutral-900 font-bold">{wordCount}</span>
              <span>Words</span>
            </div>
            <div className="h-8 w-px bg-neutral-300" />
            <div className="flex flex-col items-center">
              <span className="text-neutral-900 font-bold">{feedback.filler_words.count}</span>
              <span>Fillers</span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="pt-8 lg:pt-12 px-6 lg:px-12 pb-4 bg-white z-10">
          <div className="font-mono text-xs text-neutral-400 uppercase tracking-widest mb-8">
            Practice / Report 01
          </div>

          <div className="border-b border-neutral-100 pb-8">
            <div className="flex items-end justify-between mb-2">
              <h1 className="text-6xl font-bold tracking-tighter text-neutral-900 leading-none">
                {score}<span className="text-3xl text-neutral-300 font-light">/100</span>
              </h1>
            </div>
            <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "#E8302A" }}>
              Confidence Score
            </p>
            <p className="text-neutral-500 text-sm mt-1">{dateStr}</p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 pb-12">
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

          {/* Frameworks Detected */}
          {(feedback.framework_detected || feedback.framework_suggested) && (
            <div className="py-8 border-t border-neutral-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-neutral-300" />
                <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
                  Frameworks Detected
                </h2>
              </div>
              <div className="flex flex-wrap gap-4">
                {feedback.framework_detected && (
                  <div className="border border-neutral-900 bg-neutral-900 text-white p-4 cursor-default w-full sm:w-auto flex-1 min-w-[240px]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm tracking-wide">
                        {feedback.framework_detected}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="#E8302A">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-xs text-neutral-400 font-mono">
                      Detected structural alignment in your speech.
                    </p>
                  </div>
                )}
                {feedback.framework_suggested &&
                  feedback.framework_suggested !== feedback.framework_detected && (
                    <div className="border border-neutral-200 text-neutral-400 p-4 cursor-default w-full sm:w-auto flex-1 min-w-[240px] opacity-60">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm tracking-wide">
                          {feedback.framework_suggested}
                        </span>
                        <span className="text-[10px] border border-neutral-200 px-1 font-mono">
                          TRY NEXT
                        </span>
                      </div>
                      <p className="text-xs font-mono">
                        Suggested for next session.
                      </p>
                    </div>
                  )}
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

            {/* Improvement callout */}
            <div className="border-l-2 border-neutral-200 pl-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block mb-2">
                Focus next time
              </span>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {feedback.improvement}
              </p>
            </div>
          </div>

          {/* Filler Words / Confidence Killers */}
          {feedback.filler_words.count > 0 && (
            <div className="py-8 border-t border-neutral-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-neutral-300" />
                <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
                  Confidence Killers
                  <span className="ml-2 text-neutral-400 normal-case">
                    ({feedback.filler_words.count} filler word{feedback.filler_words.count !== 1 ? "s" : ""})
                  </span>
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(feedback.filler_words.details).map(([word, count]) => (
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
            <p
              className="transcript-highlight text-sm text-neutral-600 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: sanitizeHighlightedTranscript(feedback.highlighted_transcript),
              }}
            />
          </div>

          {/* CTA Buttons */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {onPracticeAgain && (
              <Button
                variant="cta"
                size="lg"
                onClick={onPracticeAgain}
                className="w-full sm:w-auto flex items-center justify-center gap-2 group"
              >
                <span>Practice Again</span>
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
