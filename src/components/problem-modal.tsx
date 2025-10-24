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
import { useState, type FormEvent, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, Swords, Shield } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  generateProblemFromData,
  problemNodeToString,
  AnswerInput,
  isAnswerCorrect,
} from '@/lib/game-logic';
import { cn } from '@/lib/utils';

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
  hasWall?: boolean;
  invasionWallBreaks?: number;
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
  hasWall = false,
  invasionWallBreaks = 0,
}: ProblemModalProps) {
  const [answers, setAnswers] = useState<string[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();

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

  const recordAttempt = async (correctStatus: boolean) => {
    if (!userId || !firestore || !problem || isReview) return;
    try {
      await addDoc(
        collection(firestore, 'problem_attempts', userId, 'attempts'),
        {
          userId: userId,
          unit: problem.type,
          area: problem.subType,
          correct: correctStatus,
          timestamp: serverTimestamp(),
          isReview: isReview,
          problem: problemNodeToString(problem.problem),
        }
      );
    } catch (error) {
      console.error('문제 풀이 기록 오류:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setAnswers(Array(numInputs).fill(''));
    }
  }, [isOpen, numInputs]);

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };
  
  const renderProblemWithInputs = (node: React.ReactNode): React.ReactNode => {
    let inputIndex = 0;

    const processChildren = (children: React.ReactNode): React.ReactNode[] => {
      return React.Children.map(children, child => {
        if (!React.isValidElement(child)) {
          return child;
        }

        if (child.type === AnswerInput) {
          const currentIndex = inputIndex++;
          return (
            <Input
              type="text"
              value={answers[currentIndex] || ''}
              onChange={e => handleAnswerChange(currentIndex, e.target.value)}
              className="inline-block w-20 h-8 text-center mx-1"
              aria-label={`정답 입력 ${currentIndex + 1}`}
              required
              autoFocus={currentIndex === 0}
            />
          );
        }

        if (child.props.children) {
          return React.cloneElement(child, {
            ...child.props,
            children: processChildren(child.props.children),
          });
        }

        return child;
      });
    };
    
    return processChildren(node);
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!problem) return;

    const correct = isAnswerCorrect(answers, problem.answer);

    if (!isReview) {
      await recordAttempt(correct);
    }

    if (correct) {
       let toastTitle = '정답입니다!';
       let toastDescription = '확장 토큰을 획득했습니다.';
       if (isInvasion) {
         if (hasWall && invasionWallBreaks < 1) {
           toastTitle = '성벽 돌파!';
           toastDescription = '첫 번째 방어를 뚫었습니다! 한 문제 더 남았습니다.';
         } else {
           toastTitle = '침략 성공!';
           toastDescription = '적의 영토를 획득했습니다.';
         }
       }

      toast({
        title: toastTitle,
        description: toastDescription,
        className:
          'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        action: <CheckCircle className="text-green-500" />,
      });
      await onCorrectAnswer(problem);
    } else {
      toast({
        variant: 'destructive',
        title: '오답입니다',
        description: (
          <div>
            <p>입력: [{answers.join(', ')}]</p>
            <p>정답: [{problem.answer.join(', ')}]</p>
          </div>
        ),
        action: <XCircle className="text-white" />,
      });
      if (onWrongAnswer) {
        await onWrongAnswer(problem);
      }
    }

    if (!(isInvasion && hasWall && correct)) {
       onOpenChange(false);
    }
  };


  const title = isInvasion
    ? '침략 문제'
    : isReview
    ? '오답노트 문제'
    : '문제 풀기';
    
  const description = isInvasion
    ? `문제를 맞춰 적의 영토를 획득하세요! ${hasWall ? '(성벽이 있어 2번 풀어야 합니다)' : ''}`
    : isReview
    ? '틀렸던 문제입니다. 다시 풀어보세요!'
    : '정답을 입력하여 확장 토큰을 획득하세요.';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isInvasion && <Swords className="text-destructive" />}
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
            {isInvasion && hasWall && (
                <div className="flex justify-center items-center gap-4 pt-2">
                    <Shield className={cn("w-6 h-6", invasionWallBreaks > 0 ? "text-muted-foreground" : "text-yellow-500")}/>
                    <Shield className="w-6 h-6 text-muted-foreground"/>
                </div>
            )}
          </DialogHeader>
          <div className="my-4 text-center text-lg font-semibold font-code tracking-wider bg-muted p-4 rounded-md min-h-[120px] flex items-center justify-center leading-relaxed">
            {problem
              ? renderProblemWithInputs(problem.problem)
              : '문제를 불러오는 중...'}
          </div>
          <DialogFooter>
            <Button type="submit">정답 제출</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
