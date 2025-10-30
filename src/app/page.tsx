'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, getDocs, query } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile, ProblemAttempt, WrongAnswer, MapAggregate } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  // Data fetching hooks
  const userDocRef = useMemoFirebase(() => (firestore && authUser) ? doc(firestore, 'users', authUser.uid) : null, [firestore, authUser]);
  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'countries') : null, [firestore]);
  const allUsersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const mapDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'map_aggregates', 'latest') : null, [firestore]);
  const attemptsQuery = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return collection(firestore, 'problem_attempts', authUser.uid, 'attempts');
  }, [authUser, firestore]);
   const wrongAnswersQuery = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return collection(firestore, 'users', authUser.uid, 'wrong_answers');
  }, [authUser, firestore]);


  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);
  const { data: countries, isLoading: isCountriesLoading } = useCollection<Country>(countriesQuery);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<User>(allUsersQuery);
  const { data: gameMap, isLoading: isMapLoading } = useDoc<MapAggregate>(mapDocRef);
  const { data: problemAttempts, isLoading: isAttemptsLoading } = useCollection<ProblemAttempt>(attemptsQuery);
  const { data: wrongAnswers, isLoading: isWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);

  // Combined loading state
  const isLoading = isAuthUserLoading || isUserProfileLoading || isCountriesLoading || isUsersLoading || isMapLoading || isAttemptsLoading || isWrongAnswersLoading;
  
  if (isAuthUserLoading || (authUser && isLoading)) {
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

  // user is logged in, has a profile, and all data is loaded
  if (authUser && userProfile && countries && allUsers && gameMap && problemAttempts && wrongAnswers) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          initialCountries={countries}
          initialAllUsers={allUsers}
          initialGameMap={gameMap}
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
