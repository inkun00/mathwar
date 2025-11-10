'use client';

import React from "react";
import type { User, Country, ProblemAttempt, ProblemSubType, WrongAnswer, StorableProblem, ClientTile, JoinRequest, AllianceRequest, Alliance } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, ChevronsUpDown, Check, Crown, Handshake, Flag, Swords, Pencil, ShieldCheck, X, Users } from "lucide-react";
import { useAuth, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { signOut } from "firebase/auth";
import ProblemModal from "./problem-modal";
import { deleteWrongAnswer } from "@/firebase/firestore/data";
import { doc, updateDoc, increment, collection, addDoc, writeBatch, serverTimestamp, deleteDoc, query, where, getDocs, runTransaction } from "firebase/firestore";
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
import { Skeleton } from "./ui/skeleton";

interface ProfileSheetProps {
  currentUser: User;
  allUsers: User[];
  allCountries: Country[];
  landTiles: ClientTile[];
  problemAttempts: ProblemAttempt[];
  wrongAnswers: WrongAnswer[];
  onOpenChange: (open: boolean) => void;
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

export default function ProfileSheet({ currentUser, allUsers, allCountries, landTiles, problemAttempts, wrongAnswers, onOpenChange }: ProfileSheetProps) {
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

  // --- Real-time data for requests and alliances ---
  const joinRequestsQuery = useMemoFirebase(() => (firestore && currentUser.isCountryOwner && currentUser.countryId) ? query(collection(firestore, "join_requests"), where("targetCountryId", "==", currentUser.countryId), where("status", "==", "pending")) : null, [firestore, currentUser.isCountryOwner, currentUser.countryId]);
  const { data: joinRequests, isLoading: isLoadingJoinRequests } = useCollection<JoinRequest>(joinRequestsQuery);

  const allianceRequestsQuery = useMemoFirebase(() => (firestore && currentUser.isCountryOwner && currentUser.countryId) ? query(collection(firestore, "alliance_requests"), where("targetCountryId", "==", currentUser.countryId), where("status", "==", "pending")) : null, [firestore, currentUser.isCountryOwner, currentUser.countryId]);
  const { data: allianceRequests, isLoading: isLoadingAllianceRequests } = useCollection<AllianceRequest>(allianceRequestsQuery);
  
  const alliancesQuery = useMemoFirebase(() => (firestore && currentUser.countryId) ? query(collection(firestore, 'alliances'), where('countryIds', 'array-contains', currentUser.countryId)) : null, [firestore, currentUser.countryId]);
  const { data: myAlliances, isLoading: isLoadingAlliances } = useCollection<Alliance>(alliancesQuery);


  const handleLogout = () => {
    signOut(auth);
  };

  const handleReviewProblemClick = (problem: WrongAnswer) => {
    setSelectedReviewProblem(problem);
    setReviewModalOpen(true);
    setWrongAnswerComboboxOpen(false); 
  };

  const handleCorrectReview = async () => {
    if (!selectedReviewProblem || !firestore || !currentUser) return;
    await deleteWrongAnswer(firestore, currentUser.id, selectedReviewProblem.id);
    const userRef = doc(firestore, "users", currentUser.id);
    await updateDoc(userRef, { tokens: increment(1) });
    setSelectedReviewProblem(null);
  };

  const handleWrongReview = async () => {
    if (!selectedReviewProblem || !firestore || !currentUser) return;
    await deleteWrongAnswer(firestore, currentUser.id, selectedReviewProblem.id);
    setSelectedReviewProblem(null);
  };

  const userCountry = useMemo(() => allCountries.find(c => c.id === currentUser.countryId), [allCountries, currentUser.countryId]);

  const { userRank, countryRank } = useMemo(() => {
    if (!allUsers || !allCountries || !landTiles) return { userRank: null, countryRank: null };

    const userTileCount = allUsers.reduce((acc, user) => ({ ...acc, [user.id]: 0 }), {} as Record<string, number>);
    landTiles.forEach(tile => { if (tile.ownerId && userTileCount[tile.ownerId] !== undefined) userTileCount[tile.ownerId]++; });
    const sortedUsers = Object.entries(userTileCount).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
    const userRankIndex = sortedUsers.findIndex(u => u.id === currentUser.id);

    const countryTileCount = allCountries.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {} as Record<string, number>);
    const userToCountryMap = new Map(allUsers.map(u => [u.id, u.countryId]));
    landTiles.forEach(tile => { if (tile.ownerId) { const countryId = userToCountryMap.get(tile.ownerId); if (countryId && countryTileCount[countryId] !== undefined) countryTileCount[countryId]++; } });
    const sortedCountries = Object.entries(countryTileCount).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
    const countryRankIndex = sortedCountries.findIndex(c => c.id === currentUser.countryId);

    const userRank = { rank: userRankIndex !== -1 ? userRankIndex + 1 : 0, id: currentUser.id, nickname: currentUser.nickname, tileCount: userTileCount[currentUser.id] || 0 };
    const countryRank = userCountry ? { rank: countryRankIndex !== -1 ? countryRankIndex + 1 : 0, id: currentUser.countryId, name: userCountry.name, color: '', tileCount: countryTileCount[currentUser.countryId] || 0} : null;

    return { userRank, countryRank };
  }, [allUsers, allCountries, landTiles, currentUser, userCountry]);

  
  const conqueredCountryNames = useMemo(() => {
    if (!currentUser?.conqueredCountries || !allCountries) return [];
    return currentUser.conqueredCountries.map(id => {
      const country = allCountries.find(c => c.id === id);
      return country ? country.name : null;
    }).filter(name => name !== null);
  }, [currentUser, allCountries]);

  const countryMembers = useMemo(() => {
    if (!userCountry || !allUsers) return [];
    return allUsers.filter(u => u.countryId === userCountry?.id);
  }, [userCountry, allUsers]);

  const alliedCountryIds = useMemo(() => {
      if (!myAlliances) return new Set<string>();
      const ids = new Set<string>();
      myAlliances.forEach(alliance => {
          alliance.countryIds.forEach(id => {
              if (id !== currentUser.countryId) {
                  ids.add(id);
              }
          });
      });
      return ids;
  }, [myAlliances, currentUser.countryId]);


  const adjacentCountriesForAlliance = useMemo(() => {
    if (!userCountry || !landTiles || !allCountries || !allUsers) return [];

    const myCountryMemberIds = new Set(allUsers
        .filter(u => u.countryId === userCountry.id)
        .map(u => u.id));

    const myCountryTiles = landTiles.filter(t => t.ownerId && myCountryMemberIds.has(t.ownerId));

    if (myCountryTiles.length === 0) return [];

    const adjacentCountryIds = new Set<string>();
    const landTilesMap = new Map(landTiles.map(t => [`${t.x},${t.y}`, t]));

    for (const tile of myCountryTiles) {
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
            const neighborKey = `${tile.x + dx},${tile.y + dy}`;
            const neighbor = landTilesMap.get(neighborKey);
            
            if (neighbor && neighbor.countryId && neighbor.countryId !== userCountry.id) {
                adjacentCountryIds.add(neighbor.countryId);
            }
        });
    }

    return allCountries.filter(c => 
        adjacentCountryIds.has(c.id) && 
        !alliedCountryIds.has(c.id) && 
        !c.demised
    );
}, [landTiles, allUsers, allCountries, userCountry, alliedCountryIds]);
  
  const handleRequestAlliance = async (targetCountryId: string) => {
    if (!firestore || !currentUser || !userCountry) return;
    setIsProcessing(true);
    try {
        const existingRequestQuery = query(collection(firestore, "alliance_requests"), where("requestingCountryId", "==", userCountry.id), where("targetCountryId", "==", targetCountryId), where("status", "==", "pending"));
        if (!(await getDocs(existingRequestQuery)).empty) {
            toast({ variant: "default", title: "요청 중복", description: "이미 해당 국가에 동맹을 요청했습니다." });
            return;
        }
        const requestData = { requestingCountryId: userCountry.id, requestingCountryName: userCountry.name, targetCountryId, status: 'pending', createdAt: serverTimestamp() };
        await addDoc(collection(firestore, 'alliance_requests'), requestData).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `alliance_requests/`, operation: 'create', requestResourceData: requestData }));
            throw err;
        });

        toast({ title: "동맹 요청 완료!", description: `동맹 요청을 보냈습니다.` });
        setAllianceComboboxOpen(false);
    } catch (e: any) { 
        toast({ variant: "destructive", title: "오류", description: e.message || '동맹 요청 중 오류가 발생했습니다.' }); 
    } finally { 
        setIsProcessing(false); 
    }
  };

  const handleDeclareIndependence = async () => {
    if (!firestore || !currentUser) return;
    if (!newCountryName || newCountryName.length === 0 || newCountryName.length > 6) {
        toast({ variant: 'destructive', title: '입력 오류', description: '국가 이름은 1~6자 사이여야 합니다.' }); return;
    }
    setIsProcessing(true);
    try {
        const nameModeration = await moderateText(newCountryName);
        if (!nameModeration.isAppropriate) {
            toast({ variant: 'destructive', title: '부적절한 국가 이름', description: nameModeration.reason || '사용할 수 없는 이름입니다.' }); 
            setIsProcessing(false);
            return;
        }
        
        await runTransaction(firestore, async (transaction) => {
            const newCountryRef = doc(collection(firestore, 'countries'));
            const userRef = doc(firestore, 'users', currentUser.id);

            transaction.set(newCountryRef, {
                name: newCountryName,
                createdBy: currentUser.id,
                color: `hsl(${Math.random() * 360}, 60%, 70%)`,
                demised: false,
                flag: Array(32 * 20).fill("#ffffff")
            });

            transaction.update(userRef, { countryId: newCountryRef.id, isCountryOwner: true });
        });

        toast({ title: "독립 선언!", description: `새로운 국가 '${newCountryName}'를 건국했습니다!` });
        setNewCountryName("");
        setIndependenceAlertOpen(false);
    } catch (e: any) {
        console.error("독립 선언 오류:", e);
        toast({ variant: "destructive", title: "오류", description: e.message || "독립을 선언하는 중 오류가 발생했습니다." }); 
    } finally { 
        setIsProcessing(false); 
    }
  };
  
  const handleRequestResponse = async (request: JoinRequest | AllianceRequest, type: 'join' | 'alliance', action: 'approve' | 'reject') => {
    if (!firestore || !userCountry || !currentUser) return;
    setIsProcessing(true);
  
    const requestRef = doc(firestore, `${type}_requests`, request.id);
  
    try {
      if (action === 'approve') {
        const batch = writeBatch(firestore);
        if (type === 'join') {
          const joinReq = request as JoinRequest;
          const memberUserRef = doc(firestore, 'users', joinReq.requesterId);
          const memberUpdateData = { countryId: joinReq.targetCountryId };
  
          // This is the operation that needs permission
          batch.update(memberUserRef, memberUpdateData);
          batch.delete(requestRef);
  
          // Commit the batch
          await batch.commit().catch(error => {
            // If the batch fails, emit a specific permission error for debugging
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: memberUserRef.path,
              operation: 'update',
              requestResourceData: memberUpdateData,
            }));
            throw error; // Re-throw the original error to be caught below
          });
  
          toast({ title: "가입 수락", description: `${joinReq.requesterNickname}님의 가입을 수락했습니다.` });
        } else { // 'alliance'
          const allianceReq = request as AllianceRequest;
          const newAllianceRef = doc(collection(firestore, 'alliances'));
          batch.set(newAllianceRef, {
            countryIds: [allianceReq.requestingCountryId, allianceReq.targetCountryId],
            createdAt: serverTimestamp(),
          });
          batch.update(requestRef, { status: 'approved' });
          await batch.commit(); // No special permissions needed here usually
          toast({ title: "동맹 체결!", description: `${allianceReq.requestingCountryName} 국가와 동맹을 맺었습니다.` });
        }
      } else { // 'reject'
        const updateData = { status: action };
        await updateDoc(requestRef, updateData).catch(err => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: requestRef.path,
            operation: 'update',
            requestResourceData: updateData
          }));
          throw err;
        });
        toast({ title: "요청 거절", description: `요청을 거절했습니다.` });
      }
    } catch (e: any) {
      // The error emitter will have already been called for permission errors.
      // This generic catch is for other potential issues or to inform the user.
      if (!(e instanceof FirestorePermissionError)) {
        console.error(`Error processing ${type} request:`, e);
      }
      toast({
        variant: "destructive",
        title: "처리 오류",
        description: e.message?.includes('permission') 
          ? "권한이 없습니다. 보안 규칙을 확인하세요."
          : (e.message || "요청을 처리하는 중 오류가 발생했습니다.")
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = isLoadingJoinRequests || isLoadingAllianceRequests || isLoadingAlliances;

  if (!currentUser) {
    return (
        <div className="mt-6 space-y-6">
            <Card><CardHeader><Skeleton className="h-24 w-full" /></CardHeader></Card>
            <Card><CardHeader><Skeleton className="h-32 w-full" /></CardHeader></Card>
            <Card><CardHeader><Skeleton className="h-20 w-full" /></CardHeader></Card>
        </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex h-[calc(100%-3rem)] flex-col justify-between">
        <div className="space-y-8 overflow-y-auto pr-4">
          <div>
            <Card>
              <CardHeader><CardTitle>기본 정보</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between"><span className="font-medium text-muted-foreground">닉네임</span><span className="font-semibold">{currentUser.nickname}</span></div>
                <div className="flex justify-between items-center">
                   <span className="font-medium text-muted-foreground">국가</span>
                   <div className="flex items-center gap-2">
                     {userCountry && (
                       <button onClick={() => setFlagEditorOpen(true)} className="relative group cursor-pointer hover:opacity-80 transition-opacity">
                         <FlagDisplay flagData={userCountry.flag} width={40} />
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="w-4 h-4 text-white" /></div>
                       </button>
                     )}
                     <Badge variant="secondary" style={{ backgroundColor: userCountry?.color }}>{userCountry?.name || '미지정'}</Badge>
                   </div>
                </div>
                 <div className="flex justify-between"><span className="font-medium text-muted-foreground">보유 토큰</span><span className="font-semibold">{currentUser.tokens}개</span></div>
                 <div className="flex justify-between"><span className="font-medium text-muted-foreground">보유 성벽</span><span className="font-semibold">{currentUser.walls ?? 0}개</span></div>
                 <div className="flex justify-between"><span className="font-medium text-muted-foreground">게임 포인트</span><span className="font-semibold">{currentUser.gamePoints ?? 0} 포인트</span></div>
                 <div className="flex justify-between"><span className="font-medium text-muted-foreground">개인 순위</span><span className="font-semibold">{userRank ? `${userRank.rank}위` : '순위 없음'}</span></div>
                 <div className="flex justify-between"><span className="font-medium text-muted-foreground">국가 순위</span><span className="font-semibold">{countryRank ? `${countryRank.rank}위` : '순위 없음'}</span></div>
              </CardContent>
            </Card>
          </div>
          
           {userCountry && (
             <div className="space-y-4">
                <h3 className="text-lg font-semibold tracking-tight">국가 구성원 ({countryMembers.length}명)</h3>
                <Card>
                    <CardContent className="pt-6 space-y-2">
                        {countryMembers.length > 0 ? (
                            countryMembers.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <span className="font-medium">{member.nickname}</span>
                                    {member.isCountryOwner && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Crown className="h-5 w-5 text-yellow-500" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>국가 주인</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center">구성원이 없습니다.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
           )}

           {conqueredCountryNames.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold tracking-tight">정복 기록</h3>
              <Card><CardContent className="pt-4 flex flex-wrap gap-2">{conqueredCountryNames.map(name => <Badge key={name} variant="destructive"><Swords className="mr-1 h-3 w-3" />{name}</Badge>)}</CardContent></Card>
            </div>
          )}

           <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">외교</h3>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {isLoading ? <Skeleton className="h-20 w-full" /> : 
                currentUser.isCountryOwner ? (
                    <div className="space-y-4">
                        {myAlliances && myAlliances.length > 0 && (
                           <div className="space-y-2">
                             <h4 className="font-semibold text-sm">현재 동맹</h4>
                             <div className="flex flex-wrap gap-2">
                               {myAlliances.map(alliance => {
                                 const otherCountryId = alliance.countryIds.find(id => id !== currentUser.countryId);
                                 const otherCountry = allCountries.find(c => c.id === otherCountryId);
                                 return otherCountry ? <Badge key={alliance.id} variant="secondary" style={{ backgroundColor: otherCountry.color }}>{otherCountry.name}</Badge> : null;
                               })}
                             </div>
                           </div>
                        )}
                        {(joinRequests && joinRequests.length > 0) || (allianceRequests && allianceRequests.length > 0) ? (
                            <>
                                {joinRequests && joinRequests.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-sm flex items-center gap-2"><Users className="h-4 w-4" /> 가입 요청</h4>
                                        {joinRequests.map(req => (
                                            <div key={req.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                                                <span>{req.requesterNickname}</span>
                                                <div className="space-x-1"><Button size="icon" variant="ghost" disabled={isProcessing} onClick={() => handleRequestResponse(req, 'join', 'approve')}><Check className="h-4 w-4 text-green-500"/></Button><Button size="icon" variant="ghost" disabled={isProcessing} onClick={() => handleRequestResponse(req, 'join', 'reject')}><X className="h-4 w-4 text-red-500"/></Button></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {allianceRequests && allianceRequests.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        <h4 className="font-semibold text-sm flex items-center gap-2"><Handshake className="h-4 w-4" /> 동맹 요청</h4>
                                        {allianceRequests.map(req => (
                                            <div key={req.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                                                <span>{req.requestingCountryName}</span>
                                                <div className="space-x-1"><Button size="icon" variant="ghost" disabled={isProcessing} onClick={() => handleRequestResponse(req, 'alliance', 'approve')}><Check className="h-4 w-4 text-green-500"/></Button><Button size="icon" variant="ghost" disabled={isProcessing} onClick={() => handleRequestResponse(req, 'alliance', 'reject')}><X className="h-4 w-4 text-red-500"/></Button></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                           <p className="text-sm text-muted-foreground text-center">받은 요청이 없습니다.</p>
                        )}
                         <Popover open={isAllianceComboboxOpen} onOpenChange={setAllianceComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between mt-4" disabled={isProcessing}><Handshake className="mr-2 h-4 w-4" /> 동맹 요청하기<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command><CommandInput placeholder="국가 검색..." /><CommandEmpty>동맹을 맺을 수 있는 인접 국가가 없습니다.</CommandEmpty><CommandGroup><CommandList>{adjacentCountriesForAlliance.map(c => <CommandItem key={c.id} value={c.name} onSelect={() => handleRequestAlliance(c.id)} disabled={isProcessing}>{c.name}</CommandItem>)}</CommandList></CommandGroup></Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                ) : userCountry ? (
                   <p className="text-sm text-muted-foreground text-center">국가 주인만 외교 활동을 할 수 있습니다.</p>
                ) : (
                   <AlertDialog open={isIndependenceAlertOpen} onOpenChange={setIndependenceAlertOpen}>
                    <AlertDialogTrigger asChild><Button variant="outline" className="w-full"><Flag className="mr-2 h-4 w-4" /> 독립 선언</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>독립을 선언하시겠습니까?</AlertDialogTitle><AlertDialogDescription>현재 소속된 국가를 떠나 자신만의 새로운 국가를 건국합니다. 현재 보유한 모든 영토는 새로운 국가의 영토가 됩니다.</AlertDialogDescription></AlertDialogHeader>
                      <div className="space-y-2"><Label htmlFor="new-country-name">새 국가 이름</Label><Input id="new-country-name" value={newCountryName} onChange={e => setNewCountryName(e.target.value)} placeholder="새로운 국가의 이름 (6자 이하)" disabled={isProcessing}/></div>
                      <AlertDialogFooter><AlertDialogCancel disabled={isProcessing}>취소</AlertDialogCancel><AlertDialogAction onClick={handleDeclareIndependence} disabled={isProcessing}>{isProcessing ? "처리 중..." : "독립 선언"}</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
           </div>
          
           <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">오답노트</h3>
            <Card>
              <CardContent className="pt-4">
                {wrongAnswers && wrongAnswers.length > 0 ? (
                  <Popover open={isWrongAnswerComboboxOpen} onOpenChange={setWrongAnswerComboboxOpen}>
                    <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">다시 풀 문제 선택하기...<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command><CommandInput placeholder="문제 유형 검색..." /><CommandEmpty>틀린 문제가 없습니다.</CommandEmpty><CommandGroup><CommandList>{wrongAnswers.map(wa => <CommandItem key={wa.id} value={`${areaLabels[wa.problemData.subType] || '알 수 없는 유형'} - ${wa.id}`} onSelect={() => handleReviewProblemClick(wa)}>{areaLabels[wa.problemData.subType] || '알 수 없는 유형'}</CommandItem>)}</CommandList></CommandGroup></Command>
                    </PopoverContent>
                  </Popover>
                ) : ( <p className="text-center text-muted-foreground">틀린 문제가 없습니다!</p> )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t"><Button variant="outline" className="w-full" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />로그아웃</Button></div>
      </div>
      <ProblemModal isOpen={isReviewModalOpen} onOpenChange={setReviewModalOpen} problem={null} reviewProblem={selectedReviewProblem?.problemData} isReview={true} onCorrectAnswer={handleCorrectReview} onWrongAnswer={handleWrongReview} userId={currentUser.id} />
      {userCountry && ( <FlagEditor country={userCountry} isOpen={isFlagEditorOpen} onOpenChange={setFlagEditorOpen} /> )}
    </>
  );
}
