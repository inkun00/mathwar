'use client';

import { useEffect, useState, useCallback } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import { collection, writeBatch, getDocs, doc, increment } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tile, Country, User, ProblemAttempt, WrongAnswer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { isLand } from "@/lib/world-map-shape";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // SignUpDetails를 위한 userProfile 상태는 유지합니다.
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [countries, setCountries] = useState<Country[] | null>(null);
  const [allUsers, setAllUsers] = useState<User[] | null>(null);
  const [problemAttempts, setProblemAttempts] = useState<ProblemAttempt[] | null>(null);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[] | null>(null);
  
  const [isGameDataLoading, setIsGameDataLoading] = useState(true);

  const loadInitialData = useCallback(async () => {
    if (!firestore || !authUser) return;

    setIsGameDataLoading(true);
    try {
      // Fetch all core data in parallel, except for land_tiles
      const [usersSnapshot, countriesSnapshot, attemptsSnapshot, wrongAnswersSnapshot] = await Promise.all([
        getDocs(collection(firestore, 'users')),
        getDocs(collection(firestore, 'countries')),
        getDocs(collection(firestore, 'problem_attempts', authUser.uid, 'attempts')),
        getDocs(collection(firestore, 'users', authUser.uid, 'wrong_answers'))
      ]);

      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersData);
      
      const currentUserProfile = usersData.find(u => u.id === authUser.uid);
      setUserProfile(currentUserProfile || null);

      setCountries(countriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Country)));
      
      const attemptsData = attemptsSnapshot.docs.map(doc => {
          const data = doc.data();
          return { 
              id: doc.id, 
              ...data,
              timestamp: data.timestamp ? data.timestamp.toDate() : new Date() 
          } as ProblemAttempt;
      });
      setProblemAttempts(attemptsData);

      setWrongAnswers(wrongAnswersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WrongAnswer)));

    } catch (error) {
      console.error("Error loading initial game data:", error);
      toast({
        variant: "destructive",
        title: "데이터 로딩 오류",
        description: "게임 데이터를 불러오는 데 실패했습니다. 페이지를 새로고침해주세요.",
      });
    } finally {
      setIsGameDataLoading(false);
      setIsProfileLoading(false);
    }
  }, [firestore, authUser, toast]);

  useEffect(() => {
    if (authUser && firestore) {
      loadInitialData();
    } else if (!isAuthUserLoading) {
      setIsGameDataLoading(false);
      setIsProfileLoading(false);
    }
  }, [authUser, firestore, isAuthUserLoading, loadInitialData]);
  
  // These useEffects perform one-time checks/fixes and can remain.
  // They depend on allUsers, which is now loaded without tiles.
  // The logic inside might need adjustment if it relied on tile data not present anymore.
  // Let's check them.

  // Note: The following useEffects that operate on tiles will need the tiles data.
  // Since we are not passing all tiles anymore, these checks might need to be re-thought
  // or moved to a place where tiles are available (e.g., inside GameBoard or triggered by a cloud function).
  // For now, let's leave them, but acknowledge they won't work as before.
  // A better approach would be server-side scripts for this kind of maintenance.

  if (isAuthUserLoading || isProfileLoading || isGameDataLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-96 w-96" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Login />;
  }

  if (authUser && !userProfile) {
    return <SignUpDetails />;
  }
  
  // Pass empty initialLandTiles to GameBoard
  if (authUser && userProfile && allUsers && countries && problemAttempts && wrongAnswers) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard
            initialLandTiles={[]} 
            allUsers={allUsers}
            countries={countries}
            problemAttempts={problemAttempts}
            wrongAnswers={wrongAnswers}
        />
      </div>
    );
  }

  // Fallback for when data is not fully loaded but loading is false
  if (authUser && !isGameDataLoading) {
      return <SignUpDetails />;
  }

  return <Login />;
}
