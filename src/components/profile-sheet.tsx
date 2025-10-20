'use client';

import type { User, Country, ProblemAttempt, ProblemSubType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";

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

const CustomTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col space-y-1">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              {label}
            </span>
            <span className="font-bold text-muted-foreground">
              {data.correct}/{data.total} 문제
            </span>
          </div>
          <div className="flex flex-col space-y-1">
             <span className="text-[0.70rem] uppercase text-muted-foreground">
              정답률
            </span>
            <span className="font-bold text-muted-foreground">
              {Math.round(data.accuracy)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default function ProfileSheet({ currentUser, userCountry, problemAttempts }: ProfileSheetProps) {
  const auth = useAuth();
  
  const handleLogout = () => {
    signOut(auth);
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
    <div className="mt-6 flex h-[calc(100%-3rem)] flex-col justify-between">
      <div className="space-y-8">
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
              <CardContent>
                   <ChartContainer config={{}} className="h-[100px] w-full">
                      <BarChart data={unitStats} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <XAxis type="number" dataKey="accuracy" domain={[0, 100]} tickFormatter={(v) => `${v}%`} hide />
                          <YAxis type="category" dataKey="name" width={40} tickLine={false} axisLine={false} />
                          <ChartTooltip content={<CustomTooltipContent />} />
                          <Bar dataKey="accuracy" radius={4} fill="transparent">
                            <LabelList
                              position="right"
                              offset={10}
                              className="fill-foreground"
                              fontSize={12}
                              formatter={(value: number, entry: any) => {
                                const { correct, total } = entry.payload;
                                if (total === 0) return "0/0 (0%)";
                                return `${correct}/${total} (${Math.round(value)}%)`;
                              }}
                            />
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
                      <BarChart data={areaStats} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <XAxis type="number" dataKey="accuracy" domain={[0, 100]} tickFormatter={(v) => `${v}%`} hide />
                          <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
                          <ChartTooltip content={<CustomTooltipContent />} />
                          <Bar dataKey="accuracy" radius={4} fill="transparent">
                            <LabelList
                                position="right"
                                offset={10}
                                className="fill-foreground"
                                fontSize={12}
                                formatter={(value: number, entry: any) => {
                                  const { correct, total } = entry.payload;
                                  if (total === 0) return "0/0 (0%)";
                                  return `${correct}/${total} (${Math.round(value)}%)`;
                                }}
                              />
                          </Bar>
                      </BarChart>
                  </ChartContainer>
              </CardContent>
           </Card>
        </div>
      </div>

      <div className="mt-8">
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
