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
import type { MathProblem } from '@/lib/types';
import { useState, type FormEvent, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface ProblemModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  problem: MathProblem | null;
  onCorrectAnswer: () => void;
}

// Function to parse various answer formats (e.g., "1 1/2", "3/2", "1.5")
const parseAnswer = (input: string): number | null => {
  input = input.trim();
  if (!input) return null;

  // Case 1: Mixed fraction (e.g., "1 2/3")
  if (input.includes(' ') && input.includes('/')) {
    const parts = input.split(' ');
    if (parts.length === 2) {
      const integerPart = parseInt(parts[0], 10);
      const fractionPart = parts[1];
      const fractionParts = fractionPart.split('/');
      if (fractionParts.length === 2) {
        const numerator = parseInt(fractionParts[0], 10);
        const denominator = parseInt(fractionParts[1], 10);
        if (!isNaN(integerPart) && !isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return integerPart + (numerator / denominator);
        }
      }
    }
  }

  // Case 2: Simple fraction (e.g., "3/2")
  if (!input.includes(' ') && input.includes('/')) {
    const fractionParts = input.split('/');
    if (fractionParts.length === 2) {
      const numerator = parseInt(fractionParts[0], 10);
      const denominator = parseInt(fractionParts[1], 10);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
  }

  // Case 3: Decimal or integer (e.g., "1.5" or "2")
  const num = parseFloat(input);
  return isNaN(num) ? null : num;
};


export default function ProblemModal({
  isOpen,
  onOpenChange,
  problem,
  onCorrectAnswer,
}: ProblemModalProps) {
  const [answer, setAnswer] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAnswer('');
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!problem) return;

    const userAnswer = parseAnswer(answer);
    
    // Check if userAnswer is close enough to the correct answer to handle floating point issues
    if (userAnswer !== null && Math.abs(userAnswer - problem.answer) < 0.001) {
      toast({
        title: "정답입니다!",
        description: "확장 토큰을 획득했습니다.",
        className: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        action: <CheckCircle className="text-green-500" />
      });
      onCorrectAnswer();
    } else {
      const correctAnswerString = problem.type === 'fraction'
        ? `정답은 ${problem.answer.toFixed(2)} 또는 분수 형태입니다.`
        : `정답은 ${problem.answer} 입니다.`;

      toast({
        variant: 'destructive',
        title: "오답입니다",
        description: `다시 시도해 보세요!`,
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
              정답을 입력하여 확장 토큰을 획득하세요. 분수는 `1 1/2` 또는 `3/2` 형식으로 입력할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-center text-2xl font-bold font-code tracking-wider bg-muted p-4 rounded-md">
              {problem?.problem}
            </p>
            <Input
              id="answer"
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="정답을 입력하세요 (예: 3.5 또는 7/2)"
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
