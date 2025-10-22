'use client';

import { useEffect } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, updateDoc, increment } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as GameUser, Country, Tile, ProblemAttempt, WrongAnswer } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, "users", authUser.uid);
  }, [firestore, authUser]);
  
  const countriesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'countries');
  }, [firestore, authUser]);

  const landTilesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'land_tiles');
  }, [firestore, authUser]);
  
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users');
  }, [firestore, authUser]);

  const problemAttemptsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'problem_attempts', authUser.uid, 'attempts');
  }, [firestore, authUser]);

  const wrongAnswersQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'wrong_answers');
  }, [firestore, authUser]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<GameUser>(userDocRef);
  const { data: countries, isLoading: areCountriesLoading } = useCollection<Country>(countriesQuery);
  const { data: landTiles, isLoading: areLandTilesLoading } = useCollection<Tile>(landTilesQuery);
  const { data: users, isLoading: areUsersLoading } = useCollection<GameUser>(usersQuery);
  const { data: problemAttempts, isLoading: areAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  const { data: wrongAnswers, isLoading: areWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);
  
  const isLoading = isAuthUserLoading || (authUser && (isProfileLoading || areCountriesLoading || areLandTilesLoading || areUsersLoading || areAttemptsLoading || areWrongAnswersLoading));

  useEffect(() => {
    if (userProfile && landTiles && firestore && authUser) {
      const today = new Date().toISOString().slice(0, 10);
      const lastDistribution = userProfile.lastPointDistribution;

      if (lastDistribution !== today) {
        const userTilesCount = landTiles.filter(tile => tile.ownerId === authUser.uid).length;
        if (userTilesCount > 0) {
          const userRef = doc(firestore, "users", authUser.uid);
          updateDoc(userRef, {
            gamePoints: increment(userTilesCount),
            lastPointDistribution: today,
          }).catch(console.error);
        } else {
            // if user has no land, just update the date to prevent checks until tomorrow
            const userRef = doc(firestore, "users", authUser.uid);
            updateDoc(userRef, {
              lastPointDistribution: today,
            }).catch(console.error);
        }
      }
    }
  }, [userProfile, landTiles, firestore, authUser]);


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

  // If user is authenticated but doesn't have a profile document yet
  if (authUser && !userProfile) {
    return <SignUpDetails />;
  }

  if (authUser && userProfile && countries && landTiles && users && problemAttempts && wrongAnswers) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          users={users}
          countries={countries}
          landTiles={landTiles}
          currentUserProfile={userProfile}
          problemAttempts={problemAttempts}
          wrongAnswers={wrongAnswers}
        />
      </div>
    );
  }

  // Fallback, should not be reached
  return <Login />;
}
