'use client';

import React from "react";
import type { User, Country, ProblemAttempt, ProblemSubType, WrongAnswer, StorableProblem, Tile, RankedUser, RankedCountry, JoinRequest, AllianceRequest } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, ChevronsUpDown, Check, Crown, Handshake, Flag, Swords, Pencil, UserPlus, ShieldCheck, X } from "lucide-react";
import { useAuth, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import ProblemModal from "./problem-modal";
import { deleteWrongAnswer } from "@/firebase/firestore/data";
import { doc, updateDoc, increment, collection, addDoc, writeBatch, serverTimestamp, deleteDoc, query, where, getDocs } from "firebase/firestore";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { generateProblemFromData } from "@/lib/game-logic";

interface ProfileSheetProps {
  currentUser: User;
  userCountry?: Country;
  problemAttempts: ProblemAttempt[];
  wrongAnswers: WrongAnswer[];
  landTiles: Tile[];
  users: User[];
  countries: Country[];
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
  'tenths-decomposition': '소수 자릿수 분해',
  'vertical-calculation': '세로셈',
  'error-correction': '오류 수정',
  'multi-step-word-problem': '복합 문장제',
  'unit-conversion-concept': '단위 변환',
  'finer-unit-conversion-concept': '미세 단위 변환',
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

export default function ProfileSheet({ currentUser, userCountry, problemAttempts, wrongAnswers, landTiles, users, countries }: ProfileSheetProps) {
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

  // Note: These queries are disabled for now to prevent permission errors.
  // They will be re-enabled once the backend rules are updated.
  const joinRequestsQuery = null; // useMemoFirebase(...)
  const allianceRequestsQuery = null; // useMemoFirebase(...)

  const { data: joinRequests } = useCollection<JoinRequest>(joinRequestsQuery);
  const { data: allianceRequests } = useCollection<AllianceRequest>(allianceRequestsQuery);


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

  const { userRankings, countryRankings } = useMemo(() => {
    const userTileCount = users.reduce((acc, user) => {
      acc[user.id] = landTiles.filter(tile => tile.ownerId === user.id).length;
      return acc;
    }, {} as Record<string, number>);

    const sortedUsers: RankedUser[] = Object.entries(userTileCount)
      .map(([id, count]) => {
        const user = users.find(u => u.id === id);
        return {
          id,
          nickname: user?.nickname || '알 수 없는 플레이어',
          tileCount: count,
        };
      })
      .sort((a, b) => b.tileCount - a.tileCount)
      .map((p, index) => ({ ...p, rank: index + 1 }));

    const countryTileCount = countries.reduce((acc, country) => {
      const members = users.filter(u => u.countryId === country.id);
      const count = members.reduce((sum, member) => sum + (userTileCount[member.id] || 0), 0);
      acc[country.id] = count;
      return acc;
    }, {} as Record<string, number>);
    
    const sortedCountries: RankedCountry[] = Object.entries(countryTileCount)
      .map(([id, count]) => {
        const country = countries.find(co => co.id === id);
        return {
          id,
          name: country?.name || '알 수 없는 국가',
          color: country?.color || '#888',
          tileCount: count,
        };
      })
      .sort((a, b) => b.tileCount - a.tileCount)
      .map((c, index) => ({ ...c, rank: index + 1 }));

    return { userRankings: sortedUsers, countryRankings: sortedCountries };
  }, [users, countries, landTiles]);
  
  const myRank = userRankings.find(u => u.id === currentUser.id);
  const myCountryRank = countryRankings.find(c => c.id === currentUser.countryId);


  const { unitStats, areaStats } = useMemo(() => {
    const stats = {
      unit: {
        decimal: { total: 0, correct: 0 },
        fraction: { total: 0, correct: 0 },
        conversion: { total: 0, correct: 0 },
      },
      area: {} as Record<string, { total: number, correct: number, subType: ProblemSubType }>
    };

    problemAttempts.forEach(attempt => {
      if (!stats.unit[attempt.unit]) {
         stats.unit[attempt.unit] = { total: 0, correct: 0 };
      }
      stats.unit[attempt.unit].total++;
      if (attempt.correct) {
        stats.unit[attempt.unit].correct++;
      }

      if (attempt.area) {
        if (!stats.area[attempt.area]) {
          stats.area[attempt.area] = { total: 0, correct: 0, subType: attempt.area as ProblemSubType };
        }
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

    const areaStats = Object.values(stats.area).map((data) => ({
      name: areaLabels[data.subType] || data.subType,
      subType: data.subType,
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

  const handleRequestAlliance = async (targetCountryId: string) => {
    if (!firestore || !currentUser || !userCountry) return;
    setIsProcessing(true);

    try {
      const existingRequestQuery = query(
        collection(firestore, "alliance_requests"),
        where("requestingCountryId", "==", userCountry.id),
        where("targetCountryId", "==", targetCountryId),
        where("status", "==", "pending")
      );
      const existingRequests = await getDocs(existingRequestQuery);
      if (!existingRequests.empty) {
        toast({
          variant: "default",
          title: "요청 중복",
          description: "이미 해당 국가에 동맹을 요청했습니다.",
        });
        return;
      }
      
      await addDoc(collection(firestore, 'alliance_requests'), {
        requestingCountryId: userCountry.id,
        requestingCountryName: userCountry.name,
        targetCountryId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      toast({
        title: "동맹 요청 완료!",
        description: `동맹 요청을 보냈습니다. 상대방의 수락을 기다려주세요.`,
      });
      setAllianceComboboxOpen(false);
    } catch (error) {
      console.error("동맹 요청 오류:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "동맹 요청 중 오류가 발생했습니다.",
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
        setIsProcessing(false);
        return;
      }

      const countryRef = await addDoc(collection(firestore, 'countries'), {
        name: newCountryName,
        createdBy: currentUser.id,
        color: `hsl(${Math.random() * 360}, 60%, 70%)`,
        demised: false,
        flag: Array(32 * 20).fill("#ffffff"),
      });

      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { countryId: countryRef.id, isCountryOwner: true });

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
  
  const handleJoinRequestResponse = async (request: JoinRequest, action: 'approve' | 'reject') => {
      if (!firestore) return;
      setIsProcessing(true);
      const requestRef = doc(firestore, "join_requests", request.id);
      try {
          if (action === 'approve') {
              const userRef = doc(firestore, "users", request.requesterId);
              await writeBatch(firestore)
                  .update(requestRef, { status: "approved" })
                  .update(userRef, { countryId: request.targetCountryId })
                  .commit();
              toast({ title: "가입 수락", description: `${request.requesterNickname}님이 국가에 가입했습니다.` });
          } else { // reject
              await updateDoc(requestRef, { status: "rejected" });
              toast({ title: "가입 거절", description: `${request.requesterNickname}님의 가입 요청을 거절했습니다.` });
          }
      } catch (error) {
          console.error("가입 요청 처리 오류:", error);
          toast({ variant: "destructive", title: "오류", description: "요청을 처리하는 중 오류가 발생했습니다." });
      } finally {
          setIsProcessing(false);
      }
  };

  const handleAllianceRequestResponse = async (request: AllianceRequest, action: 'approve' | 'reject') => {
      if (!firestore || !userCountry) return;
      setIsProcessing(true);
      const requestRef = doc(firestore, "alliance_requests", request.id);
      try {
          if (action === 'approve') {
              const ownCountryRef = doc(firestore, "countries", userCountry.id);
              
              // Find all members of the requesting country
              const q = query(collection(firestore, "users"), where("countryId", "==", request.requestingCountryId));
              const membersSnapshot = await getDocs(q);

              const batch = writeBatch(firestore);
              batch.update(requestRef, { status: "approved" });
              // Merge all members into the target country
              membersSnapshot.forEach(memberDoc => {
                  batch.update(memberDoc.ref, { countryId: request.targetCountryId });
              });
              // Mark the old country as demised
              batch.update(doc(firestore, "countries", request.requestingCountryId), { demised: true });
              
              await batch.commit();

              toast({ title: "동맹 체결", description: `${request.requestingCountryName} 국가와 동맹을 맺었습니다.` });
          } else { // reject
              await updateDoc(requestRef, { status: "rejected" });
              toast({ title: "동맹 거절", description: `${request.requestingCountryName} 국가의 동맹 요청을 거절했습니다.` });
          }
      } catch (error) {
          console.error("동맹 요청 처리 오류:", error);
          toast({ variant: "destructive", title: "오류", description: "요청을 처리하는 중 오류가 발생했습니다." });
      } finally {
          setIsProcessing(false);
      }
  };

  const renderProblemForTooltip = (subType: ProblemSubType) => {
    // A simple, non-interactive way to display the problem structure.
    const problemData: StorableProblem = { subType, type: 'decimal', operands: [], operator: 'calculate' };
    const problem = generateProblemFromData(problemData);

    const renderNode = (node: React.ReactNode): React.ReactNode => {
      if (!React.isValidElement(node)) {
        return node;
      }
      if (node.props.children) {
        // We replace AnswerInput with a simple "[?]" string.
        if (node.type.name === 'AnswerInput') {
          return '[?]';
        }
        return React.Children.map(node.props.children, child => renderNode(child));
      }
      return node;
    };
    
    // We remove the outer form/interactive elements for the tooltip
    return (
      <div className="text-base font-semibold font-code tracking-wider bg-muted p-4 rounded-md min-h-[60px] flex items-center justify-center leading-relaxed">
         {renderNode(problem.problem)}
      </div>
    );
  }


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
                     {userCountry ? (
                       <button
                         onClick={() => setFlagEditorOpen(true)}
                         className="relative group cursor-pointer hover:opacity-80 transition-opacity"
                       >
                         <FlagDisplay flagData={userCountry.flag} width={40} />
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
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">개인 순위</span>
                  <span className="font-semibold">
                    {myRank ? `전체 ${userRankings.length}명 중 ${myRank.rank}위` : '순위 없음'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">국가 순위</span>
                  <span className="font-semibold">
                    {myCountryRank ? `전체 ${countryRankings.length}개국 중 ${myCountryRank.rank}위` : '순위 없음'}
                  </span>
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
                ) : (
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
                                onSelect={() => handleRequestAlliance(country.id)}
                                disabled={isProcessing}
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
                   {currentUser.isCountryOwner ? "국경이 맞닿은 다른 국가에 가입을 요청하여 동맹을 맺을 수 있습니다." : "현재 소속된 국가에서 나와 자신만의 국가를 세울 수 있습니다."}
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
                   <TooltipProvider>
                    {areaStats.length > 0 ? (
                        areaStats.map(stat => (
                          <Tooltip key={stat.subType} delayDuration={100}>
                            <TooltipTrigger asChild>
                                <div className="flex justify-between cursor-help p-1 rounded-md hover:bg-muted">
                                  <span>{stat.name}</span>
                                  <span className="font-medium">{stat.correct}/{stat.total} ({Math.round(stat.accuracy)}%)</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="z-50">
                              <p className="font-semibold mb-2">대표 문제</p>
                              {renderProblemForTooltip(stat.subType)}
                            </TooltipContent>
                          </Tooltip>
                        ))
                    ) : (
                        <p className="text-muted-foreground">아직 푼 문제가 없습니다.</p>
                    )}
                   </TooltipProvider>
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
