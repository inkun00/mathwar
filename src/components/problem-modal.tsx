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
import { Label } from '@/components/ui/label';
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

// Function to parse a simple decimal/integer string
const parseDecimalAnswer = (input: string): number | null => {
  input = input.trim();
  if (!input) return null;
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
  const [integerPart, setIntegerPart] = useState('');
  const [numeratorPart, setNumeratorPart] = useState('');
  const [denominatorPart, setDenominatorPart] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAnswer('');
      setIntegerPart('');
      setNumeratorPart('');
      setDenominatorPart('');
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!problem) return;

    let userAnswer: number | null = null;

    if (problem.type === 'fraction') {
        const integer = parseInt(integerPart || '0', 10);
        const numerator = parseInt(numeratorPart || '0', 10);
        const denominator = parseInt(denominatorPart || '1', 10);

        if (isNaN(integer) || isNaN(numerator) || isNaN(denominator) || denominator === 0) {
             toast({
                variant: 'destructive',
                title: "입력 오류",
                description: `유효한 숫자를 입력해주세요.`,
            });
            return;
        }
        userAnswer = integer + (numerator / denominator);

    } else { // decimal
        userAnswer = parseDecimalAnswer(answer);
    }
    
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
      toast({
        variant: 'destructive',
        title: "오답입니다",
        description: `다시 시도해 보세요!`,
        action: <XCircle className="text-white" />
      });
    }
    
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
            <div className="text-center text-2xl font-bold font-code tracking-wider bg-muted p-4 rounded-md h-24 flex items-center justify-center">
              {problem?.problem}
            </div>

            {problem?.type === 'fraction' ? (
                <div className="flex items-end justify-center gap-2">
                    <div className="flex-shrink-0">
                        <Label htmlFor="integerPart" className="sr-only">자연수</Label>
                        <Input
                        id="integerPart"
                        type="number"
                        value={integerPart}
                        onChange={(e) => setIntegerPart(e.target.value)}
                        placeholder="자연수"
                        className="w-20 text-center text-lg"
                        aria-label="자연수 부분"
                        />
                    </div>
                    <div className="flex flex-col items-center">
                        <Label htmlFor="numeratorPart" className="sr-only">분자</Label>
                        <Input
                        id="numeratorPart"
                        type="number"
                        value={numeratorPart}
                        onChange={(e) => setNumeratorPart(e.target.value)}
                        placeholder="분자"
                        className="w-20 text-center text-lg"
                        aria-label="분자 부분"
                        />
                        <div className="w-full h-px bg-foreground my-1"></div>
                        <Label htmlFor="denominatorPart" className="sr-only">분모</Label>
                        <Input
                        id="denominatorPart"
                        type="number"
                        value={denominatorPart}
                        onChange={(e) => setDenominatorPart(e.target.value)}
                        placeholder="분모"
                        className="w-20 text-center text-lg"
                        aria-label="분모 부분"
                        />
                    </div>
                </div>
            ) : (
                <Input
                id="answer"
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="정답을 입력하세요 (예: 3.5)"
                required
                className="text-center text-lg"
                aria-label="수학 문제 정답"
                />
            )}
          </div>
          <DialogFooter>
            <Button type="submit">정답 제출</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
