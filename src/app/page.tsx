'use client';

import { useEffect, useState, useMemo } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, orderBy, limit, runTransaction, increment } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapEvent } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  // --- Real-time Data using useCollection and useDoc ---
  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);

  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'countries') : null, [firestore]);
  const { data: countries, isLoading: areCountriesLoading } = useCollection<Country>(countriesQuery);

  const allUsersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: allUsers, isLoading: areAllUsersLoading } = useCollection<User>(allUsersQuery);

  const landTilesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'land_tiles') : null, [firestore]);
  const { data: landTiles, isLoading: areLandTilesLoading } = useCollection<ClientTile>(landTilesQuery);
  
  const wrongAnswersQuery = useMemoFirebase(() => (firestore && authUser) ? collection(firestore, 'users', authUser.uid, 'wrong_answers') : null, [firestore, authUser]);
  const { data: wrongAnswers, isLoading: areWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);

  const mapEventsQuery = useMemoFirebase(() => (firestore && authUser) ? query(collection(firestore, 'map_events'), orderBy('timestamp', 'desc'), limit(100)) : null, [firestore, authUser]);
  const { data: mapEvents, isLoading: isMapEventsLoading } = useCollection<MapEvent>(mapEventsQuery);

  const problemAttemptsQuery = useMemoFirebase(() => (firestore && authUser) ? query(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'), orderBy('timestamp', 'desc')) : null, [firestore, authUser]);
  const { data: problemAttempts, isLoading: isProblemAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  
  // Point distribution logic effect
  useEffect(() => {
    const handlePointDistribution = async () => {
      if (!firestore || !userProfile || !landTiles) return;
  
      const today = new Date().toISOString().slice(0, 10);
  
      if (userProfile.lastPointDistribution !== today) {
        const userRef = doc(firestore, 'users', userProfile.id);
        try {
          await runTransaction(firestore, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
              throw "User document does not exist!";
            }
            const currentData = userDoc.data();
            if (currentData.lastPointDistribution === today) {
              return;
            }
  
            const userOwnedTileCount = landTiles.filter(tile => tile.ownerId === userProfile.id).length;
            
            if (userOwnedTileCount > 0) {
              transaction.update(userRef, {
                gamePoints: increment(userOwnedTileCount),
                lastPointDistribution: today
              });
            } else {
              transaction.update(userRef, { lastPointDistribution: today });
            }
          });
          console.log(`Distributed points for ${userProfile.nickname}`);
        } catch (e) {
          console.error("Point distribution transaction failed: ", e);
        }
      }
    };
  
    handlePointDistribution();
  }, [firestore, userProfile?.id]); // Depend on user ID to run once per user session.
  
  const enrichedTiles = useMemo(() => {
    if (!landTiles || !allUsers || !countries) {
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
  
  const isGameDataLoading = areCountriesLoading || areAllUsersLoading || areLandTilesLoading || areWrongAnswersLoading || isMapEventsLoading || isProblemAttemptsLoading;

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
  
  if (userProfile && enrichedTiles && problemAttempts && countries && allUsers && wrongAnswers && mapEvents) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          countries={countries}
          landTiles={enrichedTiles}
          problemAttempts={problemAttempts}
          wrongAnswers={wrongAnswers}
          allUsers={allUsers}
          mapEvents={mapEvents || []}
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
