'use client';

import type { User, Country, ProblemAttempt, ProblemSubType, WrongAnswer, StorableProblem, Tile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, ChevronsUpDown, Check, Crown, Handshake, Flag, Swords, Pencil } from "lucide-react";
import { useAuth, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import ProblemModal from "./problem-modal";
import { deleteWrongAnswer } from "@/firebase/firestore/data";
import { doc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useToast } from "@/hooks/use-toast";
import { moderateText } from "@/ai/flows/moderate-text-flow";
import FlagDisplay from "./flag-display";
import FlagEditor from "./flag-editor";

interface ProfileSheetProps {
  currentUser: User;
  userCountry?: Country;
  problemAttempts: ProblemAttempt[];
  wrongAnswers: WrongAnswer[];
  landTiles: Tile[];
  users: User[];
}

const areaLabels: Record<ProblemSubType, string> = {
  'decimal-add': '소수 덧셈',
  'decimal-subtract': '소수 뺄셈',
  'fraction-add-same-den': '분수 덧셈 (동일 분모)',
  'fraction-subtract-same-den': '분수 뺄셈 (동일 분모)',
  'fraction-add-mixed': '대분수 덧셈',
  'fraction-subtract-mixed': '대분수 뺄셈',
  'fraction-subtract-from-int': '자연수-분수',
  'fraction-word-problem': '분수 문장제',
  'fraction-comparison': '분수 크기 비교',
  'fraction-to-decimal': '분수->소수 변환',
  'decimal-to-fraction': '소수->분수 변환',
  'direct-calculation': '직접 계산',
  'process-decomposition': '과정 분해',
  'vertical-calculation': '세로셈',
  'error-correction': '오류 수정',
  'multi-step-word-problem': '복합 문장제',
  'unit-conversion-concept': '단위 변환',
  'conditional-operation': '조건부 연산',
  'find-and-operate': '찾아서 연산',
  'fill-in-the-blanks-process': '과정 빈칸 채우기',
  'fill-in-the-blanks-concept': '개념 빈칸 채우기',
  'comparison': '크기 비교',
  'word-problem': '문장제',
  'error-analysis': '오류 분석',
  'conditional': '조건부 문제',
  'list-navigation': '목록 탐색',
  'multiple-choice': '객관식',
  'diagram': '도형 문제',
};

export default function ProfileSheet({ currentUser, userCountry, problemAttempts, wrongAnswers, landTiles, users }: ProfileSheetProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewProblem, setSelectedReviewProblem] = useState<WrongAnswer | null>(null);
  const [isWrongAnswerComboboxOpen, setWrongAnswerComboboxOpen] = useState(false);
  const [isAllianceComboboxOpen, setAllianceComboboxOpen] = useState(false);
  const [isIndependenceAlertOpen, setIndependenceAlertOpen] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFlagEditorOpen, setFlagEditorOpen] = useState(false);


  const countriesQuery = useMemoFirebase(() => collection(firestore, 'countries'), [firestore]);
  const { data: countries } = useCollection<Country>(countriesQuery);

  
  const handleLogout = () => {
    signOut(auth);
  };

  const handleReviewProblemClick = (problem: WrongAnswer) => {
    setSelectedReviewProblem(problem);
    setReviewModalOpen(true);
    setWrongAnswerComboboxOpen(false); // Close combobox when a problem is selected
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
        conversion: { total: 0, correct: 0 },
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
       {
        name: '변환',
        total: stats.unit.conversion.total,
        correct: stats.unit.conversion.correct,
        accuracy: stats.unit.conversion.total > 0 ? (stats.unit.conversion.correct / stats.unit.conversion.total) * 100 : 0,
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
  
  const conqueredCountryNames = useMemo(() => {
    if (!currentUser.conqueredCountries || !countries) return [];
    return currentUser.conqueredCountries.map(id => {
      const country = countries.find(c => c.id === id);
      return country ? country.name : null;
    }).filter(name => name !== null);
  }, [currentUser.conqueredCountries, countries]);

  const countryMembers = useMemo(() => {
    if (!currentUser.countryId || !users) return [];
    return users.filter(u => u.countryId === currentUser.countryId);
  }, [users, currentUser.countryId]);
  
  const adjacentCountries = useMemo(() => {
    if (!currentUser || !countries || !landTiles || !users) return [];
    const myTiles = landTiles.filter(t => t.ownerId === currentUser.id);
    const adjacentCountryIds = new Set<string>();

    for (const tile of myTiles) {
      const neighbors = [
        landTiles.find(t => t.x === tile.x && t.y === tile.y - 1),
        landTiles.find(t => t.x === tile.x && t.y === tile.y + 1),
        landTiles.find(t => t.x === tile.x - 1 && t.y === tile.y),
        landTiles.find(t => t.x === tile.x + 1 && t.y === tile.y),
      ];

      for (const neighbor of neighbors) {
        if (neighbor && neighbor.ownerId && neighbor.ownerId !== currentUser.id) {
          const neighborUser = users.find(u => u.id === neighbor.ownerId);
          if (neighborUser && neighborUser.countryId !== currentUser.countryId) {
            adjacentCountryIds.add(neighborUser.countryId);
          }
        }
      }
    }
    return countries.filter(c => adjacentCountryIds.has(c.id));
  }, [landTiles, users, countries, currentUser]);

  const handleJoinCountry = async (countryId: string) => {
    if (!firestore || !currentUser) return;
    setIsProcessing(true);
    const userRef = doc(firestore, 'users', currentUser.id);
    try {
      await updateDoc(userRef, { countryId: countryId });
      toast({
        title: "동맹 체결!",
        description: `새로운 국가에 가입했습니다.`,
      });
      setAllianceComboboxOpen(false);
    } catch (error) {
      console.error("국가 가입 오류:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "동맹 체결 중 오류가 발생했습니다.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeclareIndependence = async () => {
    if (!firestore || !currentUser) return;

    if (!newCountryName || newCountryName.length === 0) {
      toast({ variant: 'destructive', title: '입력 오류', description: '새 국가 이름을 입력해주세요.' });
      return;
    }
    if (newCountryName.length > 6) {
      toast({ variant: 'destructive', title: '입력 오류', description: '국가 이름은 6자 이하로만 만들 수 있습니다.' });
      return;
    }

    setIsProcessing(true);

    try {
      const nameModeration = await moderateText(newCountryName);
      if (!nameModeration.isAppropriate) {
        toast({
          variant: 'destructive',
          title: '부적절한 국가 이름',
          description: nameModeration.reason || '입력한 국가 이름은 사용할 수 없습니다.',
        });
        return;
      }

      const countryRef = await addDoc(collection(firestore, 'countries'), {
        name: newCountryName,
        createdBy: currentUser.id,
        color: `hsl(${Math.random() * 360}, 60%, 70%)`,
        demised: false,
      });

      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { countryId: countryRef.id });

      toast({
        title: "독립 선언!",
        description: `새로운 국가 '${newCountryName}'를 건국했습니다!`,
      });
      setNewCountryName("");
      setIndependenceAlertOpen(false);
    } catch (error) {
      console.error("독립 선언 오류:", error);
       toast({
        variant: "destructive",
        title: "오류",
        description: "독립 선언 중 오류가 발생했습니다.",
      });
    } finally {
      setIsProcessing(false);
    }
  };


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
                <div className="flex justify-between items-center">
                   <span className="font-medium text-muted-foreground">국가</span>
                   <div className="flex items-center gap-2">
                     {currentUser.isCountryOwner ? (
                       <button
                         onClick={() => setFlagEditorOpen(true)}
                         className="relative group cursor-pointer hover:opacity-80 transition-opacity"
                       >
                         {userCountry && <FlagDisplay flagData={userCountry.flag} width={40} />}
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="w-4 h-4 text-white" />
                         </div>
                       </button>
                     ) : (
                       <div>
                         {userCountry && <FlagDisplay flagData={userCountry.flag} width={40} />}
                       </div>
                     )}
                     <Badge variant="secondary" style={{ backgroundColor: userCountry?.color }}>{userCountry?.name || '미지정'}</Badge>
                   </div>
                </div>
                 <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">보유 토큰</span>
                  <span className="font-semibold">{currentUser.tokens}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">보유 성벽</span>
                  <span className="font-semibold">{currentUser.walls ?? 0}개</span>
                </div>
                 <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">게임 포인트</span>
                  <span className="font-semibold">{currentUser.gamePoints ?? 0} 포인트</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
           {conqueredCountryNames.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold tracking-tight">정복 기록</h3>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {conqueredCountryNames.map(name => (
                      <Badge key={name} variant="destructive">
                        <Crown className="mr-1 h-3 w-3" />
                        {name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

           <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">외교</h3>
            <Card>
              <CardContent className="pt-6 space-y-2">
                {!currentUser.isCountryOwner ? (
                   <AlertDialog open={isIndependenceAlertOpen} onOpenChange={setIndependenceAlertOpen}>
                    <AlertDialogTrigger asChild>
                       <Button variant="outline" className="w-full">
                          <Flag className="mr-2 h-4 w-4" /> 독립 선언
                       </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>독립을 선언하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          현재 소속된 국가를 떠나 자신만의 새로운 국가를 건국합니다. 현재 보유한 모든 영토는 새로운 국가의 영토가 됩니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <Label htmlFor="new-country-name">새 국가 이름</Label>
                        <Input
                          id="new-country-name"
                          value={newCountryName}
                          onChange={(e) => setNewCountryName(e.target.value)}
                          placeholder="새로운 국가의 이름 (6자 이하)"
                          disabled={isProcessing}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessing}>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeclareIndependence} disabled={isProcessing}>
                          {isProcessing ? "처리 중..." : "독립 선언"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : countryMembers.length === 1 && (
                  <Popover open={isAllianceComboboxOpen} onOpenChange={setAllianceComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isAllianceComboboxOpen}
                        className="w-full justify-between"
                      >
                         <Handshake className="mr-2 h-4 w-4" /> 동맹 요청
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="국가 검색..." />
                        <CommandEmpty>동맹을 맺을 수 있는 인접 국가가 없습니다.</CommandEmpty>
                        <CommandGroup>
                          <CommandList>
                            {adjacentCountries.map((country) => (
                              <CommandItem
                                key={country.id}
                                value={country.name}
                                onSelect={() => handleJoinCountry(country.id)}
                              >
                                {country.name}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
                <p className="text-xs text-muted-foreground px-1">
                  {currentUser.isCountryOwner && countryMembers.length > 1 && "국가의 소유주는 다른 국가에 가입할 수 없습니다. (소속 인원: " + countryMembers.length + "명)"}
                   {currentUser.isCountryOwner && countryMembers.length === 1 && "국경이 맞닿은 다른 국가에 가입하여 동맹을 맺을 수 있습니다."}
                   {!currentUser.isCountryOwner && "현재 소속된 국가에서 나와 자신만의 국가를 세울 수 있습니다."}
                </p>
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
                  {unitStats.map(stat => stat.total > 0 && (
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
                  <Popover open={isWrongAnswerComboboxOpen} onOpenChange={setWrongAnswerComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isWrongAnswerComboboxOpen}
                        className="w-full justify-between"
                      >
                        다시 풀 문제 선택하기...
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="문제 유형 검색..." />
                        <CommandEmpty>틀린 문제가 없습니다.</CommandEmpty>
                        <CommandGroup>
                          <CommandList>
                            {wrongAnswers.map((wa) => (
                              <CommandItem
                                key={wa.id}
                                value={`${areaLabels[wa.problemData.subType] || '알 수 없는 유형'} - ${wa.id}`}
                                onSelect={() => handleReviewProblemClick(wa)}
                              >
                                {areaLabels[wa.problemData.subType] || '알 수 없는 유형'}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
        problem={null}
        reviewProblem={selectedReviewProblem?.problemData}
        isReview={true}
        onCorrectAnswer={handleCorrectReview}
        onWrongAnswer={handleWrongReview}
        userId={currentUser.id}
      />
      {userCountry && (
        <FlagEditor 
            country={userCountry}
            isOpen={isFlagEditorOpen}
            onOpenChange={setFlagEditorOpen}
        />
      )}
    </>
  );
}
