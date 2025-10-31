'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapEvent } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  // --- State for data ---
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [landTiles, setLandTiles] = useState<ClientTile[]>([]);
  const [problemAttempts, setProblemAttempts] = useState<ProblemAttempt[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Real-time Data for events only ---
  const mapEventsQuery = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'map_events'), orderBy('timestamp', 'desc'), limit(100)) : null, [firestore]);
  const { data: mapEvents, isLoading: isMapEventsLoading } = useCollection<MapEvent>(mapEventsQuery);

  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const { data: liveUserProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);

  useEffect(() => {
    setUserProfile(liveUserProfile);
  }, [liveUserProfile]);

  useEffect(() => {
    if (!firestore || !authUser) {
      if (!isAuthUserLoading) setIsLoading(false);
      return;
    };
    
    let isMounted = true;

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [countriesSnapshot, usersSnapshot, landTilesSnapshot, wrongAnswersSnapshot, problemAttemptsSnapshot] = await Promise.all([
          getDocs(collection(firestore, 'countries')),
          getDocs(collection(firestore, 'users')),
          getDocs(collection(firestore, 'land_tiles')),
          getDocs(collection(firestore, 'users', authUser.uid, 'wrong_answers')),
          getDocs(query(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'), orderBy('timestamp', 'desc')))
        ]);

        if (isMounted) {
          setCountries(countriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Country[]);
          setAllUsers(usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as User[]);
          setLandTiles(landTilesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ClientTile[]);
          setWrongAnswers(wrongAnswersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as WrongAnswer[]);
          setProblemAttempts(problemAttemptsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ProblemAttempt[]);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchInitialData();
    
    return () => {
      isMounted = false;
    }

  }, [firestore, authUser, isAuthUserLoading]);
  
  const [enrichedTiles, setEnrichedTiles] = useState<ClientTile[]>([]);

  useEffect(() => {
    if (landTiles.length === 0 || allUsers.length === 0 || countries.length === 0) {
        if (landTiles.length > 0) { // If tiles are loaded but users/countries are not, show un-owned tiles
            setEnrichedTiles(landTiles);
        }
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
        countryFlag: country?.flag,
      };
    });

    setEnrichedTiles(newEnrichedTiles);

  }, [landTiles, allUsers, countries]);


  const isCoreDataLoading = isAuthUserLoading || isLoading || isUserProfileLoading;

  if (isCoreDataLoading && !userProfile) { // Show loading skeleton only on initial app load
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
  
  if (isLoading || isMapEventsLoading) {
      return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold">게임 데이터를 불러오는 중...</h2>
            <p className="text-muted-foreground">잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }
  
  if (userProfile && enrichedTiles.length > 0 && problemAttempts && countries && allUsers && wrongAnswers) {
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
