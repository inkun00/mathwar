'use client';

import * as React from 'react';
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
import type { MathProblem, StorableProblem } from '@/lib/types';
import { useState, type FormEvent, useEffect, useMemo, useRef, createContext } from 'react';
import { CheckCircle, XCircle, Swords } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateProblemFromData, problemNodeToString } from '@/lib/game-logic';

interface ProblemInputContextType {
    getInputElement: () => React.ReactNode;
}

export const ProblemInputContext = createContext<ProblemInputContextType | null>(null);

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
  const [answers, setAnswers] = useState<string[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();
  const inputIndexRef = useRef(0);

  const problem = useMemo(() => {
    if (reviewProblem && reviewProblem.operands) {
      return generateProblemFromData(reviewProblem);
    }
    return initialProblem;
  }, [reviewProblem, initialProblem]);

  const numInputs = useMemo(() => {
    if (!problem) return 0;
    return problem.answer.length;
  }, [problem]);

  useEffect(() => {
    if (isOpen) {
      setAnswers(Array(numInputs).fill(''));
      inputIndexRef.current = 0; // Reset index when modal opens
    }
  }, [isOpen, numInputs]);

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const getInputElement = () => {
    const currentIndex = inputIndexRef.current;
    inputIndexRef.current += 1;
    return (
        <Input
            type="text"
            value={answers[currentIndex] || ''}
            onChange={(e) => handleAnswerChange(currentIndex, e.target.value)}
            className="inline-block w-20 h-8 text-center mx-1"
            aria-label={`정답 입력 ${currentIndex + 1}`}
            required
            autoFocus={currentIndex === 0}
        />
    );
  };


  const recordAttempt = async (isCorrect: boolean) => {
    if (!userId || !firestore || !problem) return;
    try {
      await addDoc(collection(firestore, 'problem_attempts', userId, 'attempts'), {
        userId: userId,
        unit: problem.type,
        area: problem.subType,
        correct: isCorrect,
        timestamp: serverTimestamp(),
        isReview: isReview,
        problem: problemNodeToString(problem.problem),
      });
    } catch (error) {
      console.error("문제 풀이 기록 오류:", error);
    }
  };
  

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!problem) return;

    const { answer: correctAnswers } = problem;
    const userAnswers = answers;

    const isCorrect = userAnswers.length === correctAnswers.length && userAnswers.every((userAns, i) => {
        const correctAns = correctAnswers[i];
        // Treat empty user input as '0' only if the correct answer is a number that can be interpreted as 0.
        const isCorrectAnsNumericZero = !isNaN(parseFloat(correctAns)) && parseFloat(correctAns) === 0;
        const processedUserAns = (userAns.trim() === '' && isCorrectAnsNumericZero) ? '0' : userAns.trim();
        return processedUserAns === correctAns.trim();
    });


    if (isCorrect) {
      toast({
        title: isInvasion ? "침략 성공!" : "정답입니다!",
        description: isInvasion ? "적의 영토를 획득했습니다." : "확장 토큰을 획득했습니다.",
        className: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        action: <CheckCircle className="text-green-500" />,
      });
      await onCorrectAnswer(problem);
    } else {
       toast({
        variant: 'destructive',
        title: "오답입니다",
        description: (
            <div>
              <p>입력: [{userAnswers.join(', ')}]</p>
              <p>정답: [{correctAnswers.join(', ')}]</p>
            </div>
        ),
        action: <XCircle className="text-white" />,
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

  // Reset index before rendering the problem
  inputIndexRef.current = 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
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
          <div className="my-4 text-center text-lg font-semibold font-code tracking-wider bg-muted p-4 rounded-md min-h-[120px] flex items-center justify-center leading-relaxed">
            <ProblemInputContext.Provider value={{ getInputElement }}>
              {problem ? problem.problem : "문제를 불러오는 중..."}
            </ProblemInputContext.Provider>
          </div>
          <DialogFooter>
            <Button type="submit">정답 제출</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
