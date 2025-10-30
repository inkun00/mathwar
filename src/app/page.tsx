'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, getDocs, query, orderBy, limit, startAfter, Timestamp } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapEvent } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  // Data fetching hooks
  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'countries') : null, [firestore]);
  const problemAttemptsQuery = useMemoFirebase(() => (firestore && authUser) ? collection(firestore, 'problem_attempts', authUser.uid, 'attempts') : null, [firestore, authUser]);
  const wrongAnswersQuery = useMemoFirebase(() => (firestore && authUser) ? collection(firestore, 'users', authUser.uid, 'wrong_answers') : null, [firestore, authUser]);
  const allUsersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);

  const [initialLandTiles, setInitialLandTiles] = useState<ClientTile[]>([]);
  const [isLandTilesLoading, setIsLandTilesLoading] = useState(true);

  // Fetch all land_tiles once on initial load
  useEffect(() => {
    const fetchTiles = async () => {
      if (!firestore) return;
      try {
        setIsLandTilesLoading(true);
        const querySnapshot = await getDocs(collection(firestore, "land_tiles"));
        const tiles = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ClientTile[];
        setInitialLandTiles(tiles);
      } catch (error) {
        console.error("Error fetching initial land tiles: ", error);
      } finally {
        setIsLandTilesLoading(false);
      }
    };
    fetchTiles();
  }, [firestore]);
  
  // Real-time listeners for everything else
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);
  const { data: countries, isLoading: isCountriesLoading } = useCollection<Country>(countriesQuery);
  const { data: problemAttempts, isLoading: isAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  const { data: wrongAnswers, isLoading: isWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);
  const { data: allUsers, isLoading: isAllUsersLoading } = useCollection<User>(allUsersQuery);
  
  // Listen for real-time map events
  const mapEventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Only listen for events that happened in the last minute to avoid loading a huge history
    const oneMinuteAgo = Timestamp.fromMillis(Date.now() - 60000);
    return query(collection(firestore, 'map_events'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore]);
  const { data: mapEvents, isLoading: isMapEventsLoading } = useCollection<MapEvent>(mapEventsQuery);


  // Derived loading state
  const isCoreDataLoading = isUserProfileLoading || isCountriesLoading || isLandTilesLoading || isAttemptsLoading || isWrongAnswersLoading || isAllUsersLoading || isMapEventsLoading;

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

  // user is logged in, but has not completed signup
  if (authUser && !userProfile && !isUserProfileLoading) {
    return <SignUpDetails />;
  }
  
  if (isCoreDataLoading) {
      return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold">게임 데이터를 불러오는 중...</h2>
            <p className="text-muted-foreground">잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  // user is logged in, has a profile, and all data is loaded
  if (userProfile && countries && initialLandTiles && allUsers && problemAttempts !== undefined && wrongAnswers !== undefined && mapEvents !== undefined) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          initialCountries={countries}
          initialLandTiles={initialLandTiles}
          initialProblemAttempts={problemAttempts || []}
          initialWrongAnswers={wrongAnswers || []}
          initialAllUsers={allUsers || []}
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
