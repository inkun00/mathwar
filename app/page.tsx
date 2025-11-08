
'use client';

import { useEffect, useState, useMemo } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, orderBy, getDocs, runTransaction, writeBatch, updateDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapEvent } from "@/lib/types";
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [areStaticDataLoading, setAreStaticDataLoading] = useState(true);
  const [hasRunPointDistribution, setHasRunPointDistribution] = useState(false);

  // --- Real-time Data using useCollection and useDoc ---
  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);

  const landTilesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'land_tiles') : null, [firestore]);
  const { data: landTiles, isLoading: areLandTilesLoading } = useCollection<ClientTile>(landTilesQuery);
  
  const wrongAnswersQuery = useMemoFirebase(() => (firestore && authUser) ? collection(firestore, 'users', authUser.uid, 'wrong_answers') : null, [firestore, authUser]);
  const { data: wrongAnswers, isLoading: areWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);

  const problemAttemptsQuery = useMemoFirebase(() => (firestore && authUser) ? query(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'), orderBy('timestamp', 'desc')) : null, [firestore, authUser]);
  const { data: problemAttempts, isLoading: isProblemAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  
  // Fetch static data (users and countries) only once
  useEffect(() => {
    if (!firestore) return;

    const fetchStaticData = async () => {
      setAreStaticDataLoading(true);
      try {
        const [countriesSnapshot, usersSnapshot] = await Promise.all([
          getDocs(collection(firestore, 'countries')),
          getDocs(collection(firestore, 'users'))
        ]);
        const countriesData = countriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Country[];
        const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as User[];
        setCountries(countriesData);
        setAllUsers(usersData);
      } catch (error) {
        console.error("Error fetching static data:", error);
      } finally {
        setAreStaticDataLoading(false);
      }
    };

    fetchStaticData();
  }, [firestore]);
  
  // Daily point distribution logic
  useEffect(() => {
    if (hasRunPointDistribution || !firestore || !userProfile || !landTiles) {
      return;
    }
  
    const handlePointDistribution = async () => {
      if (!userProfile) return; // Extra guard

      setHasRunPointDistribution(true); // Mark as running to prevent re-entry
  
      const today = new Date();
      const lastDistributionDateStr = userProfile.lastPointDistribution;
  
      if (!lastDistributionDateStr) {
        console.log("No last distribution date found, setting it for the first time.");
        const userRef = doc(firestore, "users", userProfile.id);
        try {
            await writeBatch(firestore).update(userRef, { lastPointDistribution: today.toISOString().split('T')[0] }).commit();
        } catch (e) {
            console.error("Error setting initial distribution date:", e);
            setHasRunPointDistribution(false); // Allow retry
        }
        return;
      }
  
      const lastDistributionDate = parseISO(lastDistributionDateStr);
      const daysMissed = differenceInCalendarDays(today, lastDistributionDate);
  
      if (daysMissed > 0) {
        const userTiles = landTiles.filter(tile => tile.ownerId === userProfile.id);
        const pointsToAdd = userTiles.length * daysMissed;
        if (pointsToAdd === 0) {
            console.log("No tiles owned, no points to add.");
            // Still update the date to prevent re-running this logic today
             const userRef = doc(firestore, "users", userProfile.id);
             try {
                await runTransaction(firestore, async (transaction) => {
                    transaction.update(userRef, {
                        lastPointDistribution: today.toISOString().split('T')[0]
                    });
                });
             } catch (error) {
                 console.error("Point distribution date update failed: ", error);
                 setHasRunPointDistribution(false);
             }
            return;
        };

        const userRef = doc(firestore, "users", userProfile.id);
  
        try {
          await runTransaction(firestore, async (transaction) => {
            const freshUserDoc = await transaction.get(userRef);
            if (!freshUserDoc.exists()) {
              throw "User document does not exist!";
            }
            
            const newPoints = (freshUserDoc.data().gamePoints || 0) + pointsToAdd;

            transaction.update(userRef, {
                gamePoints: newPoints,
                lastPointDistribution: today.toISOString().split('T')[0]
            });
          });
          console.log(`Awarded ${pointsToAdd} points for ${daysMissed} missed day(s).`);
        } catch (error) {
          console.error("Point distribution transaction failed: ", error);
          setHasRunPointDistribution(false);
        }
      } else {
          console.log("Point distribution is up to date.");
      }
    };
  
    handlePointDistribution();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, userProfile?.id, landTiles, hasRunPointDistribution]);

  // One-time point adjustment logic
  useEffect(() => {
    if (!firestore || !userProfile || userProfile.hasPointsAdjusted) {
      return;
    }

    const adjustPoints = async () => {
      const userRef = doc(firestore, 'users', userProfile.id);
      const updates: { hasPointsAdjusted: boolean; gamePoints?: number } = {
        hasPointsAdjusted: true,
      };
      
      let pointsAdjusted = false;
      if ((userProfile.gamePoints ?? 0) > 300) {
        updates.gamePoints = 300;
        pointsAdjusted = true;
      }

      try {
        await updateDoc(userRef, updates);
        if (pointsAdjusted) {
          toast({
            title: "포인트 조정 안내",
            description: "계정의 포인트가 300으로 조정되었습니다.",
          });
        }
        console.log(`User ${userProfile.id} points adjusted.`);
      } catch (error) {
        console.error("Error adjusting points:", error);
      }
    };

    adjustPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, userProfile?.id, userProfile?.hasPointsAdjusted, userProfile?.gamePoints]);


  const enrichedTiles = useMemo(() => {
    if (!landTiles || allUsers.length === 0 || countries.length === 0) {
        return landTiles || []; 
    }

    const userMap = new Map(allUsers.map(user => [user.id, user]));
    const countryMap = new Map(countries.map(country => [country.id, country]));

    return landTiles.map(tile => {
      const owner = tile.ownerId ? userMap.get(tile.ownerId) : null;
      const country = owner?.countryId ? countryMap.get(owner.countryId) : null;
      return {
        ...tile,
        ownerNickname: owner?.nickname || null,
        countryId: owner?.countryId || null,
        countryName: country?.name || null,
        countryColor: country?.color || null,
        countryFlag: country?.flag,
      };
    });
  }, [landTiles, allUsers, countries]);


  const isCoreDataLoading = isAuthUserLoading || isUserProfileLoading;

  if (isCoreDataLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-96 w-[80vw] max-w-4xl" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Login />;
  }

  if (authUser && !userProfile && !isUserProfileLoading) {
     return <SignUpDetails />;
  }
  
  const isGameDataLoading = areStaticDataLoading || areLandTilesLoading || areWrongAnswersLoading || isProblemAttemptsLoading;

  if (isGameDataLoading) {
      return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold">게임 데이터를 불러오는 중...</h2>
            <p className="text-muted-foreground">잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }
  
  if (userProfile && enrichedTiles && problemAttempts && countries && allUsers && wrongAnswers) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          countries={countries}
          landTiles={enrichedTiles}
          problemAttempts={problemAttempts}
          wrongAnswers={wrongAnswers}
          allUsers={allUsers}
          mapEvents={[]}
        />
      </div>
    );
  }

  // Fallback for any other state
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">데이터를 준비하는 중입니다...</h2>
          <p className="text-muted-foreground">잠시 후 새로고침 해주세요.</p>
        </div>
    </div>
  );
}
