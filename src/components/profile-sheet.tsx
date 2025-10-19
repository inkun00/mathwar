'use client';

import type { User, Country, ProblemAttempt, ProblemType, ProblemSubType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { useMemo } from "react";

interface ProfileSheetProps {
  currentUser: User;
  userCountry?: Country;
  problemAttempts: ProblemAttempt[];
}

const areaLabels: Record<ProblemSubType, string> = {
  'decimal-add': '소수 덧셈',
  'decimal-subtract': '소수 뺄셈',
  'fraction-add-same-den': '분수 덧셈 (동일 분모)',
  'fraction-subtract-same-den': '분수 뺄셈 (동일 분모)',
  'fraction-add-mixed': '대분수 덧셈',
  'fraction-subtract-mixed': '대분수 뺄셈',
  'fraction-subtract-from-int': '자연수-분수',
  'fraction-add-diff-den': '분수 덧셈 (다른 분모)',
  'fraction-subtract-diff-den': '분수 뺄셈 (다른 분모)',
};

export default function ProfileSheet({ currentUser, userCountry, problemAttempts }: ProfileSheetProps) {
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
      stats.unit[attempt.unit].total++;
      if (attempt.correct) {
        stats.unit[attempt.unit].correct++;
      }

      // Area stats
      if (!stats.area[attempt.area]) {
        stats.area[attempt.area] = { total: 0, correct: 0 };
      }
      stats.area[attempt.area].total++;
      if (attempt.correct) {
        stats.area[attempt.area].correct++;
      }
    });

    const unitStats = [
      {
        name: '소수',
        accuracy: stats.unit.decimal.total > 0 ? (stats.unit.decimal.correct / stats.unit.decimal.total) * 100 : 0,
      },
      {
        name: '분수',
        accuracy: stats.unit.fraction.total > 0 ? (stats.unit.fraction.correct / stats.unit.fraction.total) * 100 : 0,
      },
    ];

    const areaStats = Object.entries(stats.area).map(([area, data]) => ({
      name: areaLabels[area as ProblemSubType] || area,
      accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
    })).sort((a,b) => b.accuracy - a.accuracy);


    return { unitStats, areaStats };
  }, [problemAttempts]);

  return (
    <div className="mt-6 space-y-8">
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
              <Badge variant="secondary">{userCountry?.name || '미지정'}</Badge>
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
            <CardContent>
                 <ChartContainer config={{}} className="h-[150px] w-full">
                    <BarChart data={unitStats} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <XAxis type="number" dataKey="accuracy" domain={[0, 100]} tickFormatter={(v) => `${v}%`} hide />
                        <YAxis type="category" dataKey="name" width={40} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="accuracy" radius={4} fill="var(--color-primary)">
                        </Bar>
                    </BarChart>
                </ChartContainer>
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
                <CardTitle className="text-base">문제 영역별 정답률</CardTitle>
            </CardHeader>
            <CardContent>
                 <ChartContainer config={{}} className="h-[250px] w-full">
                    <BarChart data={areaStats} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <XAxis type="number" dataKey="accuracy" domain={[0, 100]} tickFormatter={(v) => `${v}%`} hide />
                        <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="accuracy" radius={4} fill="var(--color-accent)" />
                    </BarChart>
                </ChartContainer>
            </CardContent>
         </Card>
      </div>

    </div>
  );
}
