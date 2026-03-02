import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/types";

interface SettingsPageProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export function SettingsPage({ settings, onSettingsChange }: SettingsPageProps) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto py-8 px-4">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <Card className="bg-card/50 backdrop-blur-sm border-muted w-full">
        <CardHeader>
          <CardTitle className="text-base">Prep Time</CardTitle>
          <CardDescription>How long to organize your thoughts before speaking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={settings.prepTime === 60 ? "default" : "outline"}
              onClick={() => onSettingsChange({ ...settings, prepTime: 60 })}
              className="flex-1"
            >
              1 minute
            </Button>
            <Button
              variant={settings.prepTime === 120 ? "default" : "outline"}
              onClick={() => onSettingsChange({ ...settings, prepTime: 120 })}
              className="flex-1"
            >
              2 minutes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-muted w-full">
        <CardHeader>
          <CardTitle className="text-base">Speaking Time</CardTitle>
          <CardDescription>How long you have to deliver your response</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={settings.speakingTime === 60 ? "default" : "outline"}
              onClick={() => onSettingsChange({ ...settings, speakingTime: 60 })}
              className="flex-1"
            >
              1 minute
            </Button>
            <Button
              variant={settings.speakingTime === 120 ? "default" : "outline"}
              onClick={() => onSettingsChange({ ...settings, speakingTime: 120 })}
              className="flex-1"
            >
              2 minutes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
