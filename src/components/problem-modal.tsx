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
        title: "Correct!",
        description: "You've earned an expansion token.",
        className: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        action: <CheckCircle className="text-green-500" />
      });
      onCorrectAnswer();
    } else {
      toast({
        variant: 'destructive',
        title: "Incorrect",
        description: `The correct answer was ${problem.answer}. Try again!`,
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
            <DialogTitle>Solve the Problem</DialogTitle>
            <DialogDescription>
              Enter the correct answer to earn an expansion token.
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
              placeholder="Your answer"
              required
              className="text-center text-lg"
              aria-label="Math problem answer"
            />
          </div>
          <DialogFooter>
            <Button type="submit">Submit Answer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
