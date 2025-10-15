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
          <CardTitle className="text-3xl font-bold text-destructive">정복당했습니다!</CardTitle>
          <CardDescription className="text-lg">
            모든 영토를 빼앗겼습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>하지만 진정한 정복자는 포기하지 않습니다. 새로운 땅이 당신의 통치를 기다립니다.</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" onClick={onRestart}>
            <RotateCcw className="mr-2 h-5 w-5" />
            새로 시작
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
