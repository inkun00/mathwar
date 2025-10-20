'use client';

import type { User, Country, ProblemAttempt, ProblemSubType, WrongAnswer, StorableProblem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, Trash2 } from "lucide-react";
import { useAuth, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import ProblemModal from "./problem-modal";
import { deleteWrongAnswer } from "@/firebase/firestore/data";
import { doc, updateDoc, increment } from "firebase/firestore";

interface ProfileSheetProps {
  currentUser: User;
  userCountry?: Country;
  problemAttempts: ProblemAttempt[];
  wrongAnswers: WrongAnswer[];
}

const areaLabels: Record<ProblemSubType, string> = {
  'decimal-add': '소수 덧셈',
  'decimal-subtract': '소수 뺄셈',
  'fraction-add-same-den': '분수 덧셈 (동일 분모)',
  'fraction-subtract-same-den': '분수 뺄셈 (동일 분모)',
  'fraction-add-mixed': '대분수 덧셈',
  'fraction-subtract-mixed': '대분수 뺄셈',
  'fraction-subtract-from-int': '자연수-분수',
};

export default function ProfileSheet({ currentUser, userCountry, problemAttempts, wrongAnswers }: ProfileSheetProps) {
  const auth = useAuth();
  const firestore = useFirestore();

  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewProblem, setSelectedReviewProblem] = useState<WrongAnswer | null>(null);
  
  const handleLogout = () => {
    signOut(auth);
  };

  const handleReviewProblemClick = (problem: WrongAnswer) => {
    setSelectedReviewProblem(problem);
    setReviewModalOpen(true);
  };

  const handleCorrectReview = async () => {
    if (!selectedReviewProblem || !firestore || !currentUser) return;
    // 1. Delete from wrong answers
    await deleteWrongAnswer(firestore, currentUser.id, selectedReviewProblem.id);
    // 2. Grant token
    const userRef = doc(firestore, "users", currentUser.id);
    await updateDoc(userRef, {
      tokens: increment(1),
    });
    setSelectedReviewProblem(null);
  };

  const handleWrongReview = async () => {
    if (!selectedReviewProblem || !firestore || !currentUser) return;
    // Just delete from wrong answers
    await deleteWrongAnswer(firestore, currentUser.id, selectedReviewProblem.id);
    setSelectedReviewProblem(null);
  };


  const { unitStats, areaStats } = useMemo(() => {
    const stats = {
      unit: {
        decimal: { total: 0, correct: 0 },
        fraction: { total: 0, correct: 0 },
      },
      area: {} as Record<ProblemSubType, { total: number, correct: number }>
    };

    problemAttempts.forEach(attempt => {
      // Unit stats
      if (!stats.unit[attempt.unit]) {
         stats.unit[attempt.unit] = { total: 0, correct: 0 };
      }
      stats.unit[attempt.unit].total++;
      if (attempt.correct) {
        stats.unit[attempt.unit].correct++;
      }

      // Area stats
      if (attempt.area && !stats.area[attempt.area]) {
        stats.area[attempt.area] = { total: 0, correct: 0 };
      }
       if (attempt.area) {
        stats.area[attempt.area].total++;
        if (attempt.correct) {
          stats.area[attempt.area].correct++;
        }
      }
    });

    const unitStats = [
      {
        name: '소수',
        total: stats.unit.decimal.total,
        correct: stats.unit.decimal.correct,
        accuracy: stats.unit.decimal.total > 0 ? (stats.unit.decimal.correct / stats.unit.decimal.total) * 100 : 0,
      },
      {
        name: '분수',
        total: stats.unit.fraction.total,
        correct: stats.unit.fraction.correct,
        accuracy: stats.unit.fraction.total > 0 ? (stats.unit.fraction.correct / stats.unit.fraction.total) * 100 : 0,
      },
    ];

    const areaStats = Object.entries(stats.area).map(([area, data]) => ({
      name: areaLabels[area as ProblemSubType] || area,
      total: data.total,
      correct: data.correct,
      accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
    })).sort((a,b) => b.total - a.total);


    return { unitStats, areaStats };
  }, [problemAttempts]);

  return (
    <>
      <div className="mt-6 flex h-[calc(100%-3rem)] flex-col justify-between">
        <div className="space-y-8 overflow-y-auto pr-4">
          <div>
            <Card>
              <CardHeader>
                <CardTitle>기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">닉네임</span>
                  <span className="font-semibold">{currentUser.nickname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">국가</span>
                  <Badge variant="secondary" style={{ backgroundColor: userCountry?.color }}>{userCountry?.name || '미지정'}</Badge>
                </div>
                 <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">보유 토큰</span>
                  <span className="font-semibold">{currentUser.tokens}개</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
             <h3 className="text-lg font-semibold tracking-tight">정답률 현황</h3>
             <Card>
                <CardHeader>
                    <CardTitle className="text-base">단원별 정답률</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {unitStats.map(stat => (
                    <div key={stat.name} className="flex justify-between">
                      <span>{stat.name}</span>
                      <span className="font-medium">{stat.correct}/{stat.total} ({Math.round(stat.accuracy)}%)</span>
                    </div>
                  ))}
                </CardContent>
             </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="text-base">문제 영역별 정답률</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                   {areaStats.length > 0 ? (
                      areaStats.map(stat => (
                        <div key={stat.name} className="flex justify-between">
                          <span>{stat.name}</span>
                          <span className="font-medium">{stat.correct}/{stat.total} ({Math.round(stat.accuracy)}%)</span>
                        </div>
                      ))
                   ) : (
                      <p className="text-muted-foreground">아직 푼 문제가 없습니다.</p>
                   )}
                </CardContent>
             </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">오답노트</h3>
            <Card>
              <CardContent className="pt-4">
                {wrongAnswers.length > 0 ? (
                  <ul className="space-y-2">
                    {wrongAnswers.map((wa) => (
                      <li key={wa.id} className="flex items-center justify-between rounded-md bg-muted p-2">
                        <span className="font-code text-sm">{wa.problemString}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReviewProblemClick(wa)}
                        >
                          <BookOpen className="mr-2 h-4 w-4" />
                          다시 풀기
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-muted-foreground">틀린 문제가 없습니다!</p>
                )}
              </CardContent>
            </Card>
          </div>

        </div>

        <div className="mt-8 pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </Button>
        </div>
      </div>
      <ProblemModal
        isOpen={isReviewModalOpen}
        onOpenChange={setReviewModalOpen}
        problem={null} // We pass reviewProblemData instead
        reviewProblem={selectedReviewProblem?.problemData}
        isReview={true}
        onCorrectAnswer={handleCorrectReview}
        onWrongAnswer={handleWrongReview}
        userId={currentUser.id}
      />
    </>
  );
}
