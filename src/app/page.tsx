'use client';

import { useEffect, useState, useCallback } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import { doc, collection, updateDoc, increment, writeBatch, getDocs } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Tile, Country, ProblemAttempt, WrongAnswer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { isLand } from "@/lib/world-map-shape";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [initialLandTiles, setInitialLandTiles] = useState<Tile[] | null>(null);
  const [allUsers, setAllUsers] = useState<User[] | null>(null);
  const [problemAttempts, setProblemAttempts] = useState<ProblemAttempt[] | null>(null);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[] | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);

  const loadInitialData = useCallback(async () => {
    if (!firestore || !authUser) return;

    setIsLoading(true);
    try {
      // Fetch all core data in parallel
      const [usersSnapshot, countriesSnapshot, tilesSnapshot, attemptsSnapshot, wrongAnswersSnapshot] = await Promise.all([
        getDocs(collection(firestore, 'users')),
        getDocs(collection(firestore, 'countries')),
        getDocs(collection(firestore, 'land_tiles')),
        getDocs(collection(firestore, 'problem_attempts', authUser.uid, 'attempts')),
        getDocs(collection(firestore, 'users', authUser.uid, 'wrong_answers'))
      ]);

      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersData);

      const currentUserProfile = usersData.find(u => u.id === authUser.uid);
      setUserProfile(currentUserProfile || null);

      setCountries(countriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Country)));
      
      const tilesData = tilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tile));
      setInitialLandTiles(tilesData);

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

      // Point distribution logic moved here to ensure it runs after data is loaded
      if (currentUserProfile) {
        const today = new Date().toISOString().slice(0, 10);
        if (currentUserProfile.lastPointDistribution !== today) {
          const userTilesCount = tilesData.filter(tile => tile.ownerId === authUser.uid).length;
          const userRef = doc(firestore, "users", authUser.uid);
          
          if (userTilesCount > 0) {
            await updateDoc(userRef, {
              gamePoints: increment(userTilesCount),
              lastPointDistribution: today,
            });
          } else {
              await updateDoc(userRef, {
                lastPointDistribution: today,
              });
          }
        }
      }


    } catch (error) {
      console.error("Error loading initial game data:", error);
      toast({
        variant: "destructive",
        title: "데이터 로딩 오류",
        description: "게임 데이터를 불러오는 데 실패했습니다. 페이지를 새로고침해주세요.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, authUser, toast]);

  // Load initial data only once when the user is authenticated.
  useEffect(() => {
    if (authUser && firestore) {
      loadInitialData();
    } else if (!isAuthUserLoading) {
      // If auth is not loading and there's no user, stop loading.
      setIsLoading(false);
    }
  }, [authUser, firestore, isAuthUserLoading, loadInitialData]);
  
  // This effect remains for the special territory check
  useEffect(() => {
      if (
          firestore && 
          authUser && 
          initialLandTiles && 
          userProfile && 
          userProfile.nickname === '지냥김밥' &&
          !sessionStorage.getItem(`territory_check_special_${authUser.uid}`)
      ) {
          const userTiles = initialLandTiles.filter(tile => tile.ownerId === authUser.uid);
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
  }, [firestore, authUser, initialLandTiles, userProfile, toast]);

  // This effect remains for the water tile check
  useEffect(() => {
      if (
          firestore &&
          authUser &&
          initialLandTiles &&
          !sessionStorage.getItem(`water_tile_check_${authUser.uid}`)
      ) {
          const userTiles = initialLandTiles.filter(t => t.ownerId === authUser.uid);
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
  }, [firestore, authUser, initialLandTiles, toast]);

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

  if (authUser && !userProfile) {
    return <SignUpDetails />;
  }
  
  if (authUser && userProfile && initialLandTiles && allUsers && countries && problemAttempts && wrongAnswers) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard
            currentUserProfile={userProfile}
            initialLandTiles={initialLandTiles}
            allUsers={allUsers}
            countries={countries}
            problemAttempts={problemAttempts}
            wrongAnswers={wrongAnswers}
            onFullRefresh={loadInitialData}
        />
      </div>
    );
  }

  // Fallback for when data is not fully loaded but loading is false
  // This can happen if the user profile doesn't exist yet after login.
  if (authUser && !isLoading) {
      return <SignUpDetails />;
  }

  return <Login />;
}
