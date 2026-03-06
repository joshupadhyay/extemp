import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const DIMENSIONS = [
  {
    name: "Structure",
    description: "Clear introduction, organized body with logical flow, and a definitive conclusion. Did your speech have a beginning, middle, and end?",
    low: "Rambling or stream-of-consciousness with no clear organization",
    high: "Tight intro, well-organized body, and a memorable close",
  },
  {
    name: "Clarity",
    description: "A clear thesis or central point with logical progression from one idea to the next. Can a listener follow your argument without effort?",
    low: "Unclear main point, ideas jump around without connection",
    high: "Unmistakable thesis with each point building on the last",
  },
  {
    name: "Specificity",
    description: "Concrete examples, data, and real-world references versus vague, abstract assertions. Specifics make arguments believable.",
    low: "Generic statements like \"this is important\" without evidence",
    high: "Named examples, numbers, stories that ground every claim",
  },
  {
    name: "Persuasiveness",
    description: "The strength of your logic, use of evidence, and rhetorical effectiveness. Would this move a skeptical listener?",
    low: "Opinions presented without reasoning or support",
    high: "Compelling logic with evidence and rhetorical awareness",
  },
  {
    name: "Language",
    description: "Word choice, naturalness, and confidence of delivery. This covers hedging language (\"I think maybe...\", \"sort of\") and trailing conclusions.",
    low: "Heavy hedging, uncertain phrasing, weak conclusions",
    high: "Decisive word choice, natural tone, confident delivery",
  },
];

const FRAMEWORKS = [
  {
    name: "PREP",
    expansion: "Point, Reason, Example, Point",
    use: "Opinion questions",
    description: "State your position, explain why, give a concrete example, then restate your point. The most versatile framework for quick responses.",
  },
  {
    name: "STAR",
    expansion: "Situation, Task, Action, Result",
    use: "Behavioral / interview questions",
    description: "Set the scene, describe your responsibility, explain what you did, and share the outcome. Standard for experience-based questions.",
  },
  {
    name: "Problem-Solution",
    expansion: "State problem, Propose solution, Benefits",
    use: "Policy / persuasive topics",
    description: "Define the problem clearly, propose a specific solution, then explain the benefits. Forces you to be constructive rather than just critical.",
  },
  {
    name: "Past-Present-Future",
    expansion: "Historical, Current, Projection",
    use: "Trend analysis",
    description: "Trace how something evolved, where it stands today, and where it's heading. Natural structure for topics about change.",
  },
  {
    name: "What-So What-Now What",
    expansion: "Describe, Why it matters, Call to action",
    use: "Current events",
    description: "Explain what happened, why the audience should care, then suggest what should be done. Keeps responses relevant and actionable.",
  },
  {
    name: "Compare-Contrast",
    expansion: "Side A, Side B, Synthesis",
    use: "\"Which is better\" questions",
    description: "Present both sides fairly, then synthesize a position. Shows nuance and critical thinking.",
  },
  {
    name: "ADD",
    expansion: "Answer, Detail, Describe benefits",
    use: "Q&A / quick responses",
    description: "Give a direct answer, add supporting detail, then describe the implications. The fastest framework for short-form responses.",
  },
];

const SCALE = [
  { range: "0\u201330", label: "Needs work", description: "Significant gaps in this dimension. Common for first attempts at impromptu speaking." },
  { range: "30\u201360", label: "Developing", description: "Typical casual speaker. The foundation is there but not yet consistent." },
  { range: "60\u201380", label: "Strong", description: "Clear competence. Most listeners would find this effective and engaging." },
  { range: "80\u2013100", label: "Exceptional", description: "Rare. Demonstrates mastery that would stand out in competitive or professional settings." },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="w-2 h-2 bg-[#E8302A]" />
      <h2 className="text-sm font-mono uppercase tracking-wider text-neutral-900">
        {children}
      </h2>
    </div>
  );
}

export function MethodologyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <div className="max-w-2xl mx-auto px-5 lg:px-8 py-8 lg:py-12">
        {/* Back button */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-1 border-neutral-900"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
        </div>

        {/* Page title */}
        <div className="mb-12">
          <div className="font-mono text-xs text-neutral-400 uppercase tracking-widest mb-4">
            Reference
          </div>
          <h1 className="text-3xl lg:text-4xl font-medium tracking-tight text-neutral-900 leading-tight">
            How Your Score Is Calculated
          </h1>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            Every practice session is evaluated by an AI speech coach that analyzes
            your transcript for structure, clarity, and delivery. Here's exactly
            what it looks for and how the numbers work.
          </p>
        </div>

        {/* Confidence Score */}
        <section className="mb-12">
          <SectionLabel>The Confidence Score</SectionLabel>
          <div className="space-y-4 text-base text-neutral-600 leading-relaxed">
            <p>
              Your score (0&ndash;100) is a holistic assessment
              of your overall speaking performance. The AI coach evaluates your speech
              as a whole&mdash;not as a mechanical average of subscores&mdash;considering
              how well you organized your thoughts, supported your arguments, and delivered
              them with confidence.
            </p>
            <p>
              The coach is calibrated to be encouraging but honest: most casual speakers land
              in the 30&ndash;60 range, and scores above 80 require genuinely strong performance.
            </p>
          </div>
        </section>

        {/* Scoring Scale */}
        <section className="mb-12">
          <SectionLabel>Scoring Scale</SectionLabel>
          <div className="space-y-3">
            {SCALE.map((s) => (
              <div key={s.range} className="flex gap-4 items-baseline border-b border-neutral-100 pb-3">
                <span className="font-mono text-sm text-neutral-900 shrink-0 w-12">{s.range}</span>
                <div>
                  <span className="text-sm font-medium text-neutral-900">{s.label}</span>
                  <span className="text-sm text-neutral-500 ml-2">{s.description}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Five Dimensions */}
        <section className="mb-12">
          <SectionLabel>Five Dimensions</SectionLabel>
          <p className="text-base text-neutral-600 leading-relaxed mb-6">
            Each dimension is scored independently on the same 1&ndash;10 scale.
            These give you targeted feedback on where to improve.
          </p>
          <div className="space-y-6">
            {DIMENSIONS.map((d) => (
              <div key={d.name} className="border-l-2 border-neutral-200 pl-4">
                <h3 className="text-base font-medium text-neutral-900 mb-1">{d.name}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed mb-2">{d.description}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">
                      Low score
                    </span>
                    <span className="text-neutral-500">{d.low}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">
                      High score
                    </span>
                    <span className="text-neutral-500">{d.high}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Filler Words */}
        <section className="mb-12">
          <SectionLabel>Filler Word Detection</SectionLabel>
          <div className="space-y-4 text-base text-neutral-600 leading-relaxed">
            <p>
              Filler words (um, uh, like, you know) are detected separately by the
              transcription system, not by the AI coach. They appear under
              "Confidence Killers" in your results with exact counts and positions.
            </p>
            <p>
              The coach deliberately ignores fillers when scoring&mdash;it focuses
              on hedging patterns and structure instead. Hedging language
              ("I think maybe...", "I guess", "sort of") is called out with
              concrete rewrite suggestions because it undermines perceived confidence
              more than filler words do.
            </p>
          </div>
        </section>

        {/* Speech Frameworks */}
        <section className="mb-12">
          <SectionLabel>Speech Frameworks</SectionLabel>
          <p className="text-base text-neutral-600 leading-relaxed mb-6">
            Frameworks give structure to impromptu responses. The coach detects
            if you naturally used one and suggests the best fit for next time.
          </p>
          <div className="space-y-4">
            {FRAMEWORKS.map((f) => (
              <div key={f.name} className="border border-neutral-200 p-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-sm font-bold tracking-wide text-neutral-900">{f.name}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    {f.use}
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-400 mb-2">{f.expansion}</p>
                <p className="text-sm text-neutral-600 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="border-t border-neutral-100 pt-8">
          <Button
            variant="cta"
            size="lg"
            onClick={() => navigate(ROUTES.practice)}
            className="w-full sm:w-auto"
          >
            Put It Into Practice
          </Button>
        </div>
      </div>
    </div>
  );
}
