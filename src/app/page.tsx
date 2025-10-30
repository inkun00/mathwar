'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapEvent } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  // --- Data Fetching ---
  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const mapEventsQuery = useMemoFirebase(() => (firestore && authUser) ? query(collection(firestore, 'map_events'), orderBy('timestamp', 'desc'), limit(50)) : null, [firestore, authUser]);

  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);
  const { data: mapEvents, isLoading: isMapEventsLoading } = useCollection<MapEvent>(mapEventsQuery);

  const [initialLandTiles, setInitialLandTiles] = useState<ClientTile[]>([]);
  const [initialCountries, setInitialCountries] = useState<Country[]>([]);
  const [initialAllUsers, setInitialAllUsers] = useState<User[]>([]);
  const [problemAttempts, setProblemAttempts] = useState<ProblemAttempt[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!firestore || !authUser) return; // Wait for authentication and firestore

      try {
        setIsInitialDataLoading(true);
        
        // Fetch all necessary collections in parallel
        const [tilesSnapshot, countriesSnapshot, usersSnapshot, attemptsSnapshot, wrongsSnapshot] = await Promise.all([
          getDocs(collection(firestore, "land_tiles")),
          getDocs(collection(firestore, "countries")),
          getDocs(collection(firestore, "users")),
          getDocs(query(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'), orderBy('timestamp', 'desc'))),
          getDocs(collection(firestore, 'users', authUser.uid, 'wrong_answers'))
        ]);

        const tilesData = tilesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ClientTile[];
        console.log('[page.tsx] Fetched initial land tiles:', tilesData.length, 'tiles');
        setInitialLandTiles(tilesData);
        
        setInitialCountries(countriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Country[]);
        setInitialAllUsers(usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as User[]);
        setProblemAttempts(attemptsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ProblemAttempt[]);
        setWrongAnswers(wrongsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as WrongAnswer[]);

      } catch (error) {
        console.error("Error fetching initial game data: ", error);
        // Handle error state appropriately, maybe show a toast
      } finally {
        setIsInitialDataLoading(false);
      }
    };
    
    if (authUser && firestore) {
      fetchInitialData();
    }
  }, [firestore, authUser]);

  const isCoreDataLoading = isUserProfileLoading || isInitialDataLoading;

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

  if (authUser && !userProfile && !isUserProfileLoading && !isInitialDataLoading) {
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

  if (userProfile && initialLandTiles.length > 0) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          initialCountries={initialCountries}
          initialLandTiles={initialLandTiles}
          initialProblemAttempts={problemAttempts}
          initialWrongAnswers={initialWrongAnswers}
          initialAllUsers={initialAllUsers}
          mapEvents={mapEvents || []}
        />
      </div>
    );
  }

  // Fallback for any other state, including when initialLandTiles is empty after loading.
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">데이터를 준비하는 중입니다...</h2>
          <p className="text-muted-foreground">잠시 후 새로고침 해주세요.</p>
        </div>
    </div>
  );
}
