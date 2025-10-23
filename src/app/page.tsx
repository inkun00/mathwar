'use client';

import { useEffect } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, updateDoc, increment, writeBatch } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as GameUser, Country, Tile, ProblemAttempt, WrongAnswer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, "users", authUser.uid);
  }, [firestore, authUser]);
  
  const countriesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'countries');
  }, [firestore, authUser]);

  const landTilesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'land_tiles');
  }, [firestore, authUser]);
  
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users');
  }, [firestore, authUser]);

  const problemAttemptsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'problem_attempts', authUser.uid, 'attempts');
  }, [firestore, authUser]);

  const wrongAnswersQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'wrong_answers');
  }, [firestore, authUser]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<GameUser>(userDocRef);
  const { data: countries, isLoading: areCountriesLoading } = useCollection<Country>(countriesQuery);
  const { data: landTiles, isLoading: areLandTilesLoading } = useCollection<Tile>(landTilesQuery);
  const { data: users, isLoading: areUsersLoading } = useCollection<GameUser>(usersQuery);
  const { data: problemAttempts, isLoading: areAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  const { data: wrongAnswers, isLoading: areWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);
  
  const isLoading = isAuthUserLoading || (authUser && (isProfileLoading || areCountriesLoading || areLandTilesLoading || areUsersLoading || areAttemptsLoading || areWrongAnswersLoading));

  useEffect(() => {
    if (userProfile && landTiles && firestore && authUser) {
      const today = new Date().toISOString().slice(0, 10);
      const lastDistribution = userProfile.lastPointDistribution;

      if (lastDistribution !== today) {
        const userTilesCount = landTiles.filter(tile => tile.ownerId === authUser.uid).length;
        if (userTilesCount > 0) {
          const userRef = doc(firestore, "users", authUser.uid);
          updateDoc(userRef, {
            gamePoints: increment(userTilesCount),
            lastPointDistribution: today,
          }).catch(console.error);
        } else {
            // if user has no land, just update the date to prevent checks until tomorrow
            const userRef = doc(firestore, "users", authUser.uid);
            updateDoc(userRef, {
              lastPointDistribution: today,
            }).catch(console.error);
        }
      }
    }
  }, [userProfile, landTiles, firestore, authUser]);

  useEffect(() => {
    if (firestore && authUser && landTiles && userProfile && !sessionStorage.getItem(`territory_check_${authUser.uid}`)) {
        const userTiles = landTiles.filter(tile => tile.ownerId === authUser.uid);
        const MAX_TILES = 10;

        if (userTiles.length > MAX_TILES) {
            const tilesToConfiscate = userTiles.slice(MAX_TILES);
            const batch = writeBatch(firestore);

            tilesToConfiscate.forEach(tile => {
                const tileRef = doc(firestore, "land_tiles", tile.id);
                batch.update(tileRef, { ownerId: null });
            });

            batch.commit()
                .then(() => {
                    toast({
                        variant: "destructive",
                        title: "비정상 영토 점유 수정",
                        description: `보유 한도(${MAX_TILES}개)를 초과한 영토 ${tilesToConfiscate.length}개가 반납되었습니다.`,
                        duration: 5000,
                    });
                    sessionStorage.setItem(`territory_check_${authUser.uid}`, 'true');
                })
                .catch(error => {
                    console.error("영토 회수 실패:", error);
                });
        } else {
           // If user has less than or equal to MAX_TILES, just set the flag to not check again in this session.
           sessionStorage.setItem(`territory_check_${authUser.uid}`, 'true');
        }
    }
}, [firestore, authUser, landTiles, userProfile, toast]);


  if (isLoading) {
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

  // If user is authenticated but doesn't have a profile document yet
  if (authUser && !userProfile) {
    return <SignUpDetails />;
  }

  if (authUser && userProfile && countries && landTiles && users && problemAttempts && wrongAnswers) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          users={users}
          countries={countries}
          landTiles={landTiles}
          currentUserProfile={userProfile}
          problemAttempts={problemAttempts}
          wrongAnswers={wrongAnswers}
        />
      </div>
    );
  }

  // Fallback, should not be reached
  return <Login />;
}
