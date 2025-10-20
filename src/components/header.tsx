'use client';

import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { User, Tile } from "@/lib/types";
import { UserCircle, HelpCircle, User as UserIcon, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ProfileSheet from "./profile-sheet";
import LeaderboardSheet from "./leaderboard-sheet";
import type { Country, ProblemAttempt } from "@/lib/types";

interface HeaderProps {
  currentUser: User;
  onSolveProblemClick: () => void;
  countries: Country[];
  problemAttempts: ProblemAttempt[];
  landTiles: Tile[];
  users: User[];
}

export default function Header({ currentUser, onSolveProblemClick, countries, problemAttempts, landTiles, users }: HeaderProps) {
  const userCountry = countries.find(c => c.id === currentUser.countryId);

  return (
    <header className="w-full max-w-7xl rounded-lg border bg-card/80 p-4 shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-primary" />
          <h1 className="font-headline text-xl font-bold tracking-tight sm:text-2xl">
            소수 정복
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-3 sm:flex">
            <UserCircle className="h-6 w-6 text-muted-foreground" />
            <div className="text-right">
              <p className="font-semibold">{currentUser.nickname || '게이머'}</p>
              <p className="text-sm text-muted-foreground">
                확장 토큰 {currentUser.tokens}개
              </p>
            </div>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <UserIcon className="h-5 w-5" />
                <span className="sr-only">프로필 보기</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>내 프로필</SheetTitle>
              </SheetHeader>
              <ProfileSheet 
                currentUser={currentUser} 
                userCountry={userCountry}
                problemAttempts={problemAttempts}
              />
            </SheetContent>
          </Sheet>

          <Sheet>
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
              <LeaderboardSheet
                users={users}
                countries={countries}
                landTiles={landTiles}
              />
            </SheetContent>
          </Sheet>

          <Separator orientation="vertical" className="h-10" />
          <Button onClick={onSolveProblemClick}>
            <HelpCircle className="mr-2 h-4 w-4" />
            문제 풀기
          </Button>
        </div>
      </div>
    </header>
  );
}
