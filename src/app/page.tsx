
'use client';

import { useEffect, useState, useMemo } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, orderBy, getDocs, runTransaction, updateDoc, writeBatch } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapEvent } from "@/lib/types";
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { isLand } from "@/lib/world-map-shape";
import { MAP_WIDTH, MAP_HEIGHT } from "@/lib/world-map-shape";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [areStaticDataLoading, setAreStaticDataLoading] = useState(true);

  // --- Real-time Data using useCollection and useDoc ---
  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);

  const landTilesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'land_tiles') : null, [firestore]);
  const { data: landTiles, isLoading: areLandTilesLoading } = useCollection<ClientTile>(landTilesQuery);
  
  const wrongAnswersQuery = useMemoFirebase(() => (firestore && authUser) ? collection(firestore, 'users', authUser.uid, 'wrong_answers') : null, [firestore, authUser]);
  const { data: wrongAnswers, isLoading: areWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);

  const problemAttemptsQuery = useMemoFirebase(() => (firestore && authUser) ? query(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'), orderBy('timestamp', 'desc')) : null, [firestore, authUser]);
  const { data: problemAttempts, isLoading: isProblemAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  
  // Initialize map data if it doesn't exist
  useEffect(() => {
    const initializeMap = async () => {
      if (!firestore) return;

      const landTilesCollection = collection(firestore, 'land_tiles');
      const snapshot = await getDocs(query(landTilesCollection));

      if (snapshot.empty) {
        console.log("No land tiles found, initializing map...");
        const batch = writeBatch(firestore);
        let tileCount = 0;

        for (let y = 0; y < MAP_HEIGHT; y++) {
          for (let x = 0; x < MAP_WIDTH; x++) {
            if (isLand(x, y)) {
              const tileRef = doc(landTilesCollection);
              batch.set(tileRef, {
                x,
                y,
                ownerId: null,
                hasWall: false,
                ownerNickname: null,
                countryId: null,
                countryName: null,
                countryColor: null,
              });
              tileCount++;
              if (tileCount % 499 === 0) { // Batches can handle up to 500 writes
                await batch.commit();
                // batch = writeBatch(firestore); // re-initialize batch
              }
            }
          }
        }
        if (tileCount % 499 !== 0) {
            await batch.commit(); // commit the remaining writes
        }
        console.log(`Initialized ${tileCount} land tiles.`);
      }
    };

    initializeMap();
  }, [firestore]);


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
  
  // Daily point distribution logic - runs only ONCE when user profile and tiles are loaded.
  useEffect(() => {
    if (!firestore || !userProfile || !landTiles) {
      return;
    }
  
    const handlePointDistribution = async () => {
      const today = new Date();
      const lastDistributionDateStr = userProfile.lastPointDistribution;
      const userRef = doc(firestore, "users", userProfile.id);
  
      // If there's no distribution date, this is the first login. Set the date and exit.
      if (!lastDistributionDateStr) {
        try {
            await updateDoc(userRef, { lastPointDistribution: today.toISOString().split('T')[0] });
            console.log("First login: Last point distribution date set for today.");
        } catch (e) {
            console.error("Error setting initial distribution date:", e);
        }
        return;
      }
  
      const lastDistributionDate = parseISO(lastDistributionDateStr);
      const daysMissed = differenceInCalendarDays(today, lastDistributionDate);
  
      if (daysMissed > 0) {
        const userTiles = landTiles.filter(tile => tile.ownerId === userProfile.id);
        const pointsToAdd = userTiles.length * daysMissed;
        
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

          if (pointsToAdd > 0) {
            console.log(`Awarded ${pointsToAdd} points for ${daysMissed} missed day(s).`);
          } else {
             console.log("Point distribution date updated, but no tiles to award points for.");
          }
        } catch (error) {
          console.error("Point distribution transaction failed: ", error);
          // Let it retry on the next app load/refresh, not in the same session.
        }
      } else {
          console.log("Point distribution is up to date for today.");
      }
    };
  
    handlePointDistribution();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, userProfile?.id, userProfile?.lastPointDistribution, landTiles]); // Depends on stable values


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
