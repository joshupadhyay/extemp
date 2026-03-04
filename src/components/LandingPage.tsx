import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

interface LandingPageProps {
  onNavigate: (hash: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-24 px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
          Extemp
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-md">
          Sharpen your impromptu speaking. Get a prompt, think on your feet, and
          receive AI coaching feedback.
        </p>
      </div>
      <Button
        size="lg"
        className="text-lg px-8 py-6 rounded-lg"
        onClick={() => onNavigate(ROUTES.practice)}
      >
        Start Practice
      </Button>
    </div>
  );
}
