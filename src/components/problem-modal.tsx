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
import type { MathProblem, StorableProblem } from '@/lib/types';
import { useState, type FormEvent, useEffect } from 'react';
import { CheckCircle, XCircle, Swords } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateProblemFromData, problemNodeToString } from '@/lib/game-logic';


interface ProblemModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  problem: MathProblem | null;
  onCorrectAnswer: (problem: MathProblem) => Promise<void> | void;
  onWrongAnswer?: (problem: MathProblem) => Promise<void> | void;
  userId?: string;
  isInvasion?: boolean;
  isReview?: boolean;
  reviewProblem?: StorableProblem | null;
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
  problem: initialProblem,
  onCorrectAnswer,
  onWrongAnswer,
  userId,
  isInvasion = false,
  isReview = false,
  reviewProblem = null,
}: ProblemModalProps) {
  const [answer, setAnswer] = useState('');
  const [integerPart, setIntegerPart] = useState('');
  const [numeratorPart, setNumeratorPart] = useState('');
  const [denominatorPart, setDenominatorPart] = useState('');
  const { toast } = useToast();
  const firestore = useFirestore();

  // The actual problem being solved, either newly generated or from a review.
  const problem = reviewProblem ? generateProblemFromData(reviewProblem) : initialProblem;

  useEffect(() => {
    if (isOpen) {
      setAnswer('');
      setIntegerPart('');
      setNumeratorPart('');
      setDenominatorPart('');
    }
  }, [isOpen]);

  const recordAttempt = async (isCorrect: boolean) => {
    if (!userId || !firestore || !problem) return;
    try {
      // Path updated to reflect new top-level collection structure: problem_attempts/{userId}/attempts/{attemptId}
      await addDoc(collection(firestore, 'problem_attempts', userId, 'attempts'), {
        userId: userId,
        unit: problem.type,
        area: problem.subType,
        correct: isCorrect,
        timestamp: serverTimestamp(),
        isReview: isReview,
        problem: problemNodeToString(problem.problem)
      });
    } catch (error) {
      console.error("Error recording problem attempt:", error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!problem) return;

    let userAnswer: number | null = null;
    let isCorrect = false;

    if (problem.type === 'fraction' || (problem.type === 'conversion' && problem.subType === 'decimal-to-fraction')) {
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

    } else { // decimal or fraction-to-decimal
        userAnswer = parseDecimalAnswer(answer);
    }
    
    // Check if userAnswer is close enough to the correct answer to handle floating point issues
    if (userAnswer !== null && Math.abs(userAnswer - problem.answer) < 0.001) {
      isCorrect = true;
      toast({
        title: isInvasion ? "침략 성공!" : "정답입니다!",
        description: isInvasion ? "적의 영토를 획득했습니다." : "확장 토큰을 획득했습니다.",
        className: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        action: <CheckCircle className="text-green-500" />
      });
      await onCorrectAnswer(problem);
    } else {
      isCorrect = false;
      toast({
        variant: 'destructive',
        title: isInvasion ? "침략 실패" : "오답입니다",
        description: isInvasion ? "토큰을 잃고 영토 획득에 실패했습니다." : (isReview ? "오답노트에서 문제가 삭제됩니다." : `오답노트에 추가되었습니다.`),
        action: <XCircle className="text-white" />
      });
      if (onWrongAnswer) {
        await onWrongAnswer(problem);
      }
    }
    
    await recordAttempt(isCorrect);
    onOpenChange(false);
  };

  const title = isInvasion ? '침략 문제' : (isReview ? '오답노트 문제' : '문제 풀기');
  const description = isInvasion
    ? '문제를 맞춰 적의 영토를 획득하세요!'
    : (isReview ? '틀렸던 문제입니다. 다시 풀어보세요!' : '정답을 입력하여 확장 토큰을 획득하세요.');

  const isFractionInput = problem?.type === 'fraction' || problem?.subType === 'decimal-to-fraction';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                {isInvasion && <Swords className="text-destructive" />}
                {title}
            </DialogTitle>
            <DialogDescription>
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="text-center text-xl font-bold font-code tracking-wider bg-muted p-4 rounded-md h-24 flex items-center justify-center">
              {problem?.problem}
            </div>

            {isFractionInput ? (
                <div className="flex items-center justify-center gap-2">
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
                        <div className="w-full h-px bg-current my-1"></div>
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
