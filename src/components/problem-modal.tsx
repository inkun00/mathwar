'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { DecimalProblem } from '@/lib/types';
import { useState, type FormEvent } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface ProblemModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  problem: DecimalProblem | null;
  onCorrectAnswer: () => void;
}

export default function ProblemModal({
  isOpen,
  onOpenChange,
  problem,
  onCorrectAnswer,
}: ProblemModalProps) {
  const [answer, setAnswer] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!problem) return;

    const userAnswer = parseFloat(answer);
    if (userAnswer === problem.answer) {
      toast({
        title: "정답입니다!",
        description: "확장 토큰을 획득했습니다.",
        className: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        action: <CheckCircle className="text-green-500" />
      });
      onCorrectAnswer();
    } else {
      toast({
        variant: 'destructive',
        title: "오답입니다",
        description: `정답은 ${problem.answer} 입니다. 다시 시도해 보세요!`,
        action: <XCircle className="text-white" />
      });
    }
    setAnswer('');
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>문제 풀기</DialogTitle>
            <DialogDescription>
              정답을 입력하여 확장 토큰을 획득하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-center text-2xl font-bold font-code tracking-wider bg-muted p-4 rounded-md">
              {problem?.problem}
            </p>
            <Input
              id="answer"
              type="number"
              step="0.01"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="정답을 입력하세요"
              required
              className="text-center text-lg"
              aria-label="수학 문제 정답"
            />
          </div>
          <DialogFooter>
            <Button type="submit">정답 제출</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
