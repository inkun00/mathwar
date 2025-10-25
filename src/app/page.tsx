'use client';

import { useEffect } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, updateDoc, increment, writeBatch, arrayRemove } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as GameUser, Country, Tile, ProblemAttempt, WrongAnswer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { isLand } from "@/lib/world-map-shape";

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
    if (
        firestore && 
        authUser && 
        landTiles && 
        userProfile && 
        userProfile.nickname === '지냥김밥' &&
        !sessionStorage.getItem(`territory_check_special_${authUser.uid}`)
    ) {
        const userTiles = landTiles.filter(tile => tile.ownerId === authUser.uid);
        const EXCESS_THRESHOLD = 30;
        const TILES_TO_REMOVE = 10;

        if (userTiles.length > EXCESS_THRESHOLD) {
            const tilesToConfiscate = userTiles.slice(0, TILES_TO_REMOVE);
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
                        description: `보유 한도를 초과한 영토 ${tilesToConfiscate.length}개가 반납되었습니다.`,
                        duration: 5000,
                    });
                    sessionStorage.setItem(`territory_check_special_${authUser.uid}`, 'true');
                })
                .catch(error => {
                    console.error("영토 회수 실패(특별):", error);
                });
        } else {
           sessionStorage.setItem(`territory_check_special_${authUser.uid}`, 'true');
        }
    }
}, [firestore, authUser, landTiles, userProfile, toast]);


useEffect(() => {
    if (
        firestore &&
        authUser &&
        landTiles &&
        !sessionStorage.getItem(`water_tile_check_${authUser.uid}`)
    ) {
        const userTiles = landTiles.filter(t => t.ownerId === authUser.uid);
        const waterTiles = userTiles.filter(t => !isLand(t.x, t.y));

        if (waterTiles.length > 0) {
            const batch = writeBatch(firestore);
            
            waterTiles.forEach(tile => {
                const tileRef = doc(firestore, "land_tiles", tile.id);
                batch.update(tileRef, { ownerId: null });
            });

            const userRef = doc(firestore, "users", authUser.uid);
            batch.update(userRef, { tokens: increment(waterTiles.length) });

            batch.commit()
                .then(() => {
                    toast({
                        title: "영토 조정",
                        description: `물 위에 건설된 영토 ${waterTiles.length}개가 회수되고, 동일한 수량의 토큰이 반환되었습니다.`,
                    });
                })
                .catch(error => {
                    console.error("물 타일 회수 실패:", error);
                });
        }
        
        sessionStorage.setItem(`water_tile_check_${authUser.uid}`, 'true');
    }
}, [firestore, authUser, landTiles, toast]);



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
