'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, getDocs, query } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [landTiles, setLandTiles] = useState<ClientTile[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  
  const attemptsQuery = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return collection(firestore, 'problem_attempts', authUser.uid, 'attempts');
  }, [authUser, firestore]);

  const { data: problemAttempts, isLoading: attemptsLoading } = useCollection<ProblemAttempt>(attemptsQuery);


  useEffect(() => {
    if (isAuthUserLoading || !firestore) return;
    
    // Defer data fetching until auth state is resolved.
    if (!authUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const fetchData = async () => {
      try {
        const userDocRef = doc(firestore, 'users', authUser.uid);
        const countriesQuery = collection(firestore, "countries");
        const usersQuery = collection(firestore, "users");
        const landTilesQuery = collection(firestore, "land_tiles");
        const wrongAnswersQuery = collection(firestore, 'users', authUser.uid, 'wrong_answers');

        const [userDocSnap, countriesSnap, usersSnap, landTilesSnap, wrongAnswersSnap] = await Promise.all([
          getDoc(userDocRef),
          getDocs(countriesQuery),
          getDocs(usersQuery),
          getDocs(landTilesQuery),
          getDocs(wrongAnswersQuery),
        ]);

        if (userDocSnap.exists()) {
          setUserProfile({ ...userDocSnap.data(), id: userDocSnap.id } as User);
        } else {
          setUserProfile(null);
        }
        
        setCountries(countriesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Country)));
        setAllUsers(usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
        setLandTiles(landTilesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClientTile)));
        setWrongAnswers(wrongAnswersSnap.docs.map(d => ({...d.data(), id: d.id} as WrongAnswer)));

      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

  }, [authUser, firestore, isAuthUserLoading]);

  // Combined loading state
  const isCoreDataLoading = isAuthUserLoading || isLoading || attemptsLoading;

  if (isCoreDataLoading && authUser) { // Only show skeleton if logged in and loading
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

  if (authUser && !userProfile) {
    return <SignUpDetails />;
  }
  
  if (userProfile && problemAttempts) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          initialCountries={countries}
          initialAllUsers={allUsers}
          initialLandTiles={landTiles}
          initialProblemAttempts={problemAttempts}
          initialWrongAnswers={wrongAnswers}
        />
      </div>
    );
  }

  // Fallback for any other state, including initial load before authUser is known
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">데이터를 준비하는 중입니다...</h2>
          <p className="text-muted-foreground">잠시 후 새로고침 해주세요.</p>
        </div>
    </div>
  );
}
