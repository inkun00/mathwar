'use client';

import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { User, Country, ProblemAttempt } from "@/lib/types";
import { UserCircle, HelpCircle, User as UserIcon, Trophy, Store, Shield, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ProfileSheet from "./profile-sheet";
import LeaderboardSheet from "./leaderboard-sheet";
import MarketSheet from "./market-sheet";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "./ui/alert";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";

interface HeaderProps {
  currentUser: User;
  onSolveProblemClick: () => void;
  problemAttempts: ProblemAttempt[];
  isBuildingWall: boolean;
  onToggleWallBuilding: () => void;
  allUsers: User[];
  countries: Country[];
}

export default function Header({ 
  currentUser, 
  onSolveProblemClick, 
  problemAttempts, 
  isBuildingWall,
  onToggleWallBuilding,
  allUsers,
  countries
}: HeaderProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // --- Real-time data for sheets ---
  const landTilesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'land_tiles') : null, [firestore]);
  const wrongAnswersQuery = useMemoFirebase(() => (firestore && currentUser) ? collection(firestore, 'users', currentUser.id, 'wrong_answers') : null, [firestore, currentUser]);

  const { data: landTiles, isLoading: isLandTilesLoading } = useCollection(landTilesQuery);
  const { data: wrongAnswers, isLoading: isWrongAnswersLoading } = useCollection(wrongAnswersQuery);
  
  const remainingProblems = useMemo(() => {
    if (!problemAttempts) return 10;
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentAttempts = problemAttempts.filter(
      (attempt) =>
        attempt.timestamp &&
        typeof attempt.timestamp.toDate === 'function' && // Ensure it's a Firestore Timestamp
        attempt.timestamp.toDate().getTime() > twentyFourHoursAgo &&
        !attempt.isReview
    );
    return 10 - recentAttempts.length;
  }, [problemAttempts]);

  const handleSolveClick = () => {
    if (remainingProblems <= 0) {
      toast({
        variant: "destructive",
        title: "일일 한도 초과",
        description: "오늘의 문제 풀이 횟수를 모두 사용했습니다. 24시간 후에 다시 시도해 주세요.",
      });
    } else {
      onSolveProblemClick();
    }
  };
  
  const handleWallBuildClick = () => {
    onToggleWallBuilding();
  }

  const continents = ["대륙 1", "대륙 2", "대륙 3", "대륙 4", "대륙 5"];
  const isSheetDataLoading = isLandTilesLoading || isWrongAnswersLoading;

  return (
    <header className="w-full max-w-full rounded-lg border bg-card/80 p-4 shadow-md backdrop-blur-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-primary" />
            <h1 className="font-headline text-xl font-bold tracking-tight sm:text-2xl">
              수학 전쟁
            </h1>
          </div>

          <div className="hidden md:flex gap-2 rounded-lg bg-background/50 p-1 backdrop-blur-sm">
            {continents.map((name, index) => {
              const isActive = index === 0;
              const button = (
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "disabled:opacity-50",
                    isActive && "shadow-sm"
                  )}
                  disabled={!isActive}
                  aria-label={name}
                >
                  {name}
                </Button>
              );

              return (
                <TooltipProvider key={name} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {isActive ? button : <span tabIndex={0}>{button}</span>}
                    </TooltipTrigger>
                    {!isActive && (
                      <TooltipContent>
                        <p>추후 오픈 예정입니다.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-3 sm:flex">
              <UserCircle className="h-6 w-6 text-muted-foreground" />
              <div className="text-right">
                <p className="font-semibold">{currentUser.nickname || '게이머'}</p>
                <p className="text-sm text-muted-foreground">
                  토큰: {currentUser.tokens}개 / 포인트: {currentUser.gamePoints ?? 0}
                </p>
              </div>
            </div>
            
            <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isSheetDataLoading}>
                  <UserIcon className="h-5 w-5" />
                  <span className="sr-only">프로필 보기</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>내 프로필</SheetTitle>
                </SheetHeader>
                {!isSheetDataLoading && landTiles && wrongAnswers && (
                  <ProfileSheet 
                      currentUser={currentUser}
                      allUsers={allUsers}
                      allCountries={countries}
                      landTiles={landTiles}
                      problemAttempts={problemAttempts}
                      wrongAnswers={wrongAnswers}
                      onOpenChange={setIsProfileOpen}
                  />
                )}
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Store className="h-5 w-5" />
                  <span className="sr-only">마켓 보기</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>마켓</SheetTitle>
                </SheetHeader>
                <MarketSheet currentUser={currentUser} />
              </SheetContent>
            </Sheet>

            <Sheet open={isLeaderboardOpen} onOpenChange={setIsLeaderboardOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trophy className="h-5 w-5" />
                  <span className="sr-only">리더보드 보기</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>리더보드</SheetTitle>
                </SheetHeader>
                <LeaderboardSheet />
              </SheetContent>
            </Sheet>

            <Separator orientation="vertical" className="h-10" />
            
            <div className="flex flex-col items-end gap-1">
               <div className="flex gap-2">
                  <Button onClick={handleWallBuildClick} variant={isBuildingWall ? "secondary" : "default"}>
                      <Shield className="mr-2 h-4 w-4" />
                      성벽 건설 ({currentUser.walls ?? 0})
                  </Button>
                  <Button onClick={handleSolveClick}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    문제 풀기
                  </Button>
               </div>
               <Badge variant={remainingProblems > 0 ? "secondary" : "destructive"}>
                오늘 풀 수 있는 문제: {remainingProblems < 0 ? 0 : remainingProblems}/10
              </Badge>
            </div>
          </div>
        </div>
        <Alert variant="destructive" className="mt-2 text-center text-xs p-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              부적절한 방법으로 영토를 확장하는 경우, 경고 없이 계정이 삭제될 수 있습니다.
            </AlertDescription>
        </Alert>
      </div>
    </header>
  );
}
