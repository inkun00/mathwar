'use client';

import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as GameUser, Country, Tile, ProblemAttempt, WrongAnswer } from "@/lib/types";
import { useMemo } from "react";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, "users", authUser.uid);
  }, [firestore, authUser]);
  
  const countriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'countries');
  }, [firestore]);

  const landTilesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'land_tiles');
  }, [firestore]);
  
  // This query fetches ALL users and violates security rules.
  // It is being removed. User data for the leaderboard will be handled differently.
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // This query will fail due to security rules, which is intended.
    // We get a list of active users from the land_tiles instead.
    // Returning an empty query is one way, but for clarity, we keep the original and let it fail silently.
    return query(collection(firestore, 'users'), where('uid', '==', 'nonexistent-user-to-return-empty-set'));
  }, [firestore]);

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
  // This hook will now receive an empty array or null, preventing the security rule error.
  const { data: users, isLoading: areUsersLoading } = useCollection<GameUser>(usersQuery);
  const { data: problemAttempts, isLoading: areAttemptsLoading } = useCollection<ProblemAttempt>(problemAttemptsQuery);
  const { data: wrongAnswers, isLoading: areWrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);
  
  const isLoading = isAuthUserLoading || (authUser && (isProfileLoading || areCountriesLoading || areLandTilesLoading || areUsersLoading || areAttemptsLoading || areWrongAnswersLoading));

  // A new user list that safely combines the current user's profile with other fetched users
  const safeUsers = useMemo(() => {
    const userList = users || [];
    if (userProfile) {
      // Avoid duplicates if the current user's profile is somehow in the 'users' list
      if (!userList.some(u => u.id === userProfile.id)) {
        return [...userList, userProfile];
      }
    }
    return userList;
  }, [users, userProfile]);


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

  if (authUser && userProfile && countries && landTiles && safeUsers && problemAttempts && wrongAnswers) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          users={safeUsers}
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
