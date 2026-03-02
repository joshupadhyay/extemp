import { Mic } from "lucide-react";
import { AsciiWaveform } from "./components/AsciiWaveform";
import { ScrambleText } from "./components/ScrambleText";
import { Button } from "@/components/ui/button";
import "./index.css";

export function App() {
  return (
    <div className="split-panel">
      {/* Left panel — ASCII waveform */}
      <div className="relative border-r border-hairline flex items-center justify-center bg-bg-subtle overflow-hidden max-lg:h-[200px] lg:h-auto">
        <AsciiWaveform />
      </div>

      {/* Right panel — content */}
      <div className="flex flex-col justify-center px-[var(--pad)] py-12 lg:py-0">
        <div className="max-w-[520px]">
          <span className="section-label">Practice / Index 01</span>

          <h1 className="text-[1.75rem] lg:text-[2.5rem] font-medium tracking-tight leading-[1.1] mb-8">
            <ScrambleText text="Think fast. Speak clearly." />
          </h1>

          <p className="text-[1rem] lg:text-[1.1rem] leading-[1.6] mb-12 text-foreground">
            Get a random prompt, organize your thoughts, speak, and receive AI
            coaching feedback with framework detection. Train yourself to sound
            prepared when you're not.
          </p>

          <Button variant="cta" size="touch">
            <Mic className="size-4" />
            Start Practice
          </Button>

          <div className="mt-20 pt-6 border-t border-hairline flex flex-wrap gap-x-8 gap-y-2 font-mono text-[0.7rem] text-muted-foreground">
            <span>FRAMEWORKS: PREP, STAR, ADD</span>
            <span>FEEDBACK: AI COACH</span>
            <span>STATUS: READY</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
