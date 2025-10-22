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
import type { MathProblem, StorableProblem } from '@/lib/types';
import { useState, type FormEvent, useEffect, useMemo, Children, cloneElement, isValidElement } from 'react';
import { CheckCircle, XCircle, Swords } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateProblemFromData, problemNodeToString, AnswerInput } from '@/lib/game-logic';

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

const parseAnswer = (input: string): string => {
  return input.trim();
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
  const [answers, setAnswers] = useState<string[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();

  const problem = useMemo(() => {
    if (reviewProblem && reviewProblem.operands) {
      return generateProblemFromData(reviewProblem);
    }
    return initialProblem;
  }, [reviewProblem, initialProblem]);

  const numInputs = useMemo(() => problem?.answer.length ?? 0, [problem]);

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
  
  const renderProblemWithInputs = (node: React.ReactNode): React.ReactNode => {
    let inputCounter = 0;
    
    const mapChildren = (children: React.ReactNode): React.ReactNode => {
      return Children.map(children, child => {
        if (!isValidElement(child)) {
          return child;
        }
        
        if (child.type === AnswerInput) {
          const index = inputCounter++;
          return (
            <Input
              type="text"
              value={answers[index] || ''}
              onChange={(e) => handleAnswerChange(index, e.target.value)}
              className="inline-block w-20 h-8 text-center mx-1"
              aria-label={`정답 입력 ${index + 1}`}
              required
              autoFocus={index === 0}
            />
          );
        }
        
        if (child.props.children) {
          return cloneElement(child, {
            ...child.props,
            children: mapChildren(child.props.children),
          });
        }
        
        return child;
      });
    };
    
    return mapChildren(node);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!problem) return;
  
    const userAnswers = answers.map(parseAnswer);
    const correctAnswers = problem.answer;
  
    const isCorrect =
      userAnswers.length === correctAnswers.length &&
      userAnswers.every((userAns, i) => {
        const correctAns = correctAnswers[i];
        // Treat blank as "0" only if the correct answer is also "0" or a numeric representation of 0.
        // This avoids turning blanks into 0 for non-numeric answers like ">".
        const processedUserAns = (userAns === '' && String(correctAns) === '0') ? '0' : userAns;
        return String(processedUserAns).trim() === String(correctAns).trim();
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
        title: isInvasion ? "침략 실패" : "오답입니다",
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
            {problem ? renderProblemWithInputs(problem.problem) : "문제를 불러오는 중..."}
          </div>
          <DialogFooter>
            <Button type="submit">정답 제출</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
