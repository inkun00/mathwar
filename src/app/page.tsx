'use client';

import { useEffect, useState, useMemo } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useFirestore, useMemoFirebase } from "@/firebase";
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
  
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [areCoreDataLoading, setAreCoreDataLoading] = useState(true);
  const [areUserSpecificDataLoading, setAreUserSpecificDataLoading] = useState(true);

  // Effect for fetching the user profile specifically
  useEffect(() => {
    if (!authUser || !firestore) {
      if (!isAuthUserLoading) {
        setIsProfileLoading(false);
      }
      return;
    }
    
    setIsProfileLoading(true);
    const userDocRef = doc(firestore, "users", authUser.uid);
    getDocs(collection(firestore, "users"))
        .then(snapshot => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setAllUsers(usersData);
            const currentUserProfile = usersData.find(u => u.id === authUser.uid);
            setUserProfile(currentUserProfile || null);
        })
        .catch(console.error)
        .finally(() => setIsProfileLoading(false));

  }, [authUser, firestore, isAuthUserLoading]);

  // Effect for fetching core game data (countries, tiles) once
  useEffect(() => {
    if (!firestore) return;
    
    setAreCoreDataLoading(true);
    const fetchCoreData = async () => {
        try {
            const countriesSnapshot = await getDocs(collection(firestore, 'countries'));
            setCountries(countriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Country)));

            const tilesSnapshot = await getDocs(collection(firestore, 'land_tiles'));
            setInitialLandTiles(tilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tile)));
        } catch (error) {
            console.error("Error fetching core game data:", error);
        } finally {
            setAreCoreDataLoading(false);
        }
    };
    fetchCoreData();
  }, [firestore]);
  
  // Effect for fetching user-specific data (attempts, wrong answers)
  useEffect(() => {
    if (!authUser || !firestore) return;

    setAreUserSpecificDataLoading(true);
    const fetchUserData = async () => {
        try {
            const attemptsSnapshot = await getDocs(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'));
            setProblemAttempts(attemptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProblemAttempt)));

            const wrongAnswersSnapshot = await getDocs(collection(firestore, 'users', authUser.uid, 'wrong_answers'));
            setWrongAnswers(wrongAnswersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WrongAnswer)));

        } catch (error) {
            console.error("Error fetching user-specific data:", error);
        } finally {
            setAreUserSpecificDataLoading(false);
        }
    };
    fetchUserData();
  }, [authUser, firestore]);

  const isLoading = isAuthUserLoading || isProfileLoading || areCoreDataLoading || areUserSpecificDataLoading;

  useEffect(() => {
    if (userProfile && initialLandTiles && firestore && authUser) {
      const today = new Date().toISOString().slice(0, 10);
      const lastDistribution = userProfile.lastPointDistribution;

      if (lastDistribution !== today) {
        const userTilesCount = initialLandTiles.filter(tile => tile.ownerId === authUser.uid).length;
        const userRef = doc(firestore, "users", authUser.uid);
        
        if (userTilesCount > 0) {
          updateDoc(userRef, {
            gamePoints: increment(userTilesCount),
            lastPointDistribution: today,
          }).catch(console.error);
        } else if (lastDistribution) {
            updateDoc(userRef, {
              lastPointDistribution: today,
            }).catch(console.error);
        }
      }
    }
  }, [userProfile, initialLandTiles, firestore, authUser]);

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
        />
      </div>
    );
  }

  return <Login />;
}
