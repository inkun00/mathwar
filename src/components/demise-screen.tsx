import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { RotateCcw } from "lucide-react";

interface DemiseScreenProps {
  onRestart: () => void;
}

export default function DemiseScreen({ onRestart }: DemiseScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="max-w-md text-center shadow-2xl animate-in fade-in zoom-in-95">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-destructive">You have been conquered!</CardTitle>
          <CardDescription className="text-lg">
            All your territories have been captured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>But a true conqueror never gives up. A new land awaits your rule.</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" onClick={onRestart}>
            <RotateCcw className="mr-2 h-5 w-5" />
            Begin Anew
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
