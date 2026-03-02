import { useEffect, useRef, useState } from "react";

const SCRAMBLE_CHARS = "!<>-_\\/[]{}—=+*^?#________";

interface ScrambleTextProps {
  text: string;
  className?: string;
  triggerOnMount?: boolean;
}

export function ScrambleText({
  text,
  className,
  triggerOnMount = true,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(triggerOnMount ? "" : text);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!triggerOnMount) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setDisplay(text);
      return;
    }

    const queue: {
      to: string;
      start: number;
      end: number;
      char?: string;
    }[] = [];

    for (let i = 0; i < text.length; i++) {
      const start = Math.floor(Math.random() * 30);
      const end = start + Math.floor(Math.random() * 30);
      queue.push({ to: text[i], start, end });
    }

    let frame = 0;

    function update() {
      let output = "";
      let complete = 0;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (frame >= item.end) {
          complete++;
          output += item.to;
        } else if (frame >= item.start) {
          if (!item.char || Math.random() < 0.28) {
            item.char =
              SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }
          output += item.char;
        } else {
          output += " ";
        }
      }

      setDisplay(output);

      if (complete < queue.length) {
        frame++;
        rafRef.current = requestAnimationFrame(update);
      }
    }

    // Small delay so the component mounts first
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(update);
    }, 200);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [text, triggerOnMount]);

  return <span className={className}>{display}</span>;
}
