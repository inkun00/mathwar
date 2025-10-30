'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, orderBy, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapEvent } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  // --- Real-time Data Fetching ---
  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'countries') : null, [firestore]);
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const landTilesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'land_tiles') : null, [firestore]);
  const wrongAnswersQuery = useMemoFirebase(() => (firestore && authUser) ? collection(firestore, 'users', authUser.uid, 'wrong_answers') : null, [firestore, authUser]);
  const problemAttemptsQuery = useMemoFirebase(() => (firestore && authUser) ? query(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'), orderBy('timestamp', 'desc')) : null, [firestore, authUser]);
  const mapEventsQuery = useMemoFirebase(() => (firestore && authUser) ? query(collection(firestore, 'map_events'), orderBy('timestamp', 'desc'), limit(100)) : null, [firestore, authUser]);

  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);
  const { data: countries, isLoading: isCountriesLoading } = useCollection<Country>(countriesQuery);
  const { data: allUsers, isLoading: isAllUsersLoading } = useCollection<User>(usersQuery);
  const { data: landTiles, isLoading: isLandTilesLoading } = useCollection<ClientTile>(landTilesQuery);
  const { data: wrongAnswers, isLoading: isWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);
  const { data: problemAttempts, isLoading: isProblemAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  const { data: mapEvents, isLoading: isMapEventsLoading } = useCollection<MapEvent>(mapEventsQuery);

  const [enrichedTiles, setEnrichedTiles] = useState<ClientTile[]>([]);

  useEffect(() => {
    if (!landTiles || !allUsers || !countries) {
      setEnrichedTiles([]);
      return;
    }

    const userMap = new Map(allUsers.map(user => [user.id, user]));
    const countryMap = new Map(countries.map(country => [country.id, country]));

    const newEnrichedTiles = landTiles.map(tile => {
      const owner = tile.ownerId ? userMap.get(tile.ownerId) : null;
      const country = owner?.countryId ? countryMap.get(owner.countryId) : null;
      return {
        ...tile,
        ownerNickname: owner?.nickname || null,
        countryId: owner?.countryId || null,
        countryName: country?.name || null,
        countryColor: country?.color || null,
      };
    });

    setEnrichedTiles(newEnrichedTiles);

  }, [landTiles, allUsers, countries]);


  const isCoreDataLoading = isUserProfileLoading || isCountriesLoading || isAllUsersLoading || isLandTilesLoading || isProblemAttemptsLoading || isWrongAnswersLoading;

  if (isAuthUserLoading) {
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

  if (authUser && !userProfile && !isUserProfileLoading && !isCoreDataLoading) {
    return <SignUpDetails />;
  }
  
  if (isCoreDataLoading || isMapEventsLoading) {
      return (
      <div className="flex h-screen w_full items-center justify-center bg-background">
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
