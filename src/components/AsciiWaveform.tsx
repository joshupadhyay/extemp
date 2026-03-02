import { useEffect, useRef } from "react";

const CHARS = " .:-=+*#%@";

interface AsciiWaveformProps {
  className?: string;
}

export function AsciiWaveform({ className }: AsciiWaveformProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function computeFrame(cols: number, rows: number, time: number): string {
      let output = "";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const nx = x / cols;
          const ny = (y - rows / 2) / (rows / 2);

          // Layered sine waves to create soundwave pattern
          const wave1 = Math.sin(nx * 12 + time * 1.5) * 0.4;
          const wave2 = Math.sin(nx * 7 - time * 0.8) * 0.25;
          const wave3 = Math.sin(nx * 20 + time * 2.2) * 0.15;

          // Combine waves and create envelope
          const wave = wave1 + wave2 + wave3;
          const envelope =
            Math.exp(-Math.pow((nx - 0.5) * 2.5, 2)) * 0.8 + 0.2;
          const dist = Math.abs(ny - wave * envelope);

          // Map distance to character
          const val = Math.max(0, 1 - dist * 2.5);
          if (val < 0.05) {
            output += " ";
          } else {
            const charIdx = Math.min(
              Math.floor(val * CHARS.length),
              CHARS.length - 1
            );
            output += CHARS[charIdx];
          }
        }
        output += "\n";
      }
      return output;
    }

    function getSize() {
      const width = el!.clientWidth;
      const height = el!.clientHeight;
      // Fill the container — 7px per char wide, 8px per char tall (matches font-size/line-height)
      const cols = Math.max(40, Math.floor(width / 7));
      const rows = Math.max(30, Math.floor(height / 8));
      return { cols, rows };
    }

    const { cols, rows } = getSize();

    if (prefersReducedMotion) {
      // Render one static frame
      el.innerText = computeFrame(cols, rows, 0);
      return;
    }

    function animate() {
      const { cols, rows } = getSize();
      el!.innerText = computeFrame(cols, rows, timeRef.current);
      timeRef.current += 0.03;
      rafRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <div ref={ref} className={`ascii-art ${className ?? ""}`} />;
}
