'use client';

import { useEffect, useState, useCallback } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, GameMap } from "@/lib/types";

const MAP_DOC_ID = "world_1";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  // --- All core data is now fetched at the top level ---
  const userDocRef = useMemoFirebase(() => authUser ? doc(firestore, 'users', authUser.uid) : null, [authUser, firestore]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);

  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, "countries") : null, [firestore]);
  const { data: countries, isLoading: isCountriesLoading } = useCollection<Country>(countriesQuery);
  
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, "users") : null, [firestore]);
  const { data: allUsers, isLoading: isAllUsersLoading } = useCollection<User>(usersQuery);

  const mapDocRef = useMemoFirebase(() => firestore ? doc(firestore, "maps", MAP_DOC_ID) : null, [firestore]);
  const { data: gameMap, isLoading: isMapLoading } = useDoc<GameMap>(mapDocRef);
  
  const isLoading = isAuthUserLoading || isUserProfileLoading || isCountriesLoading || isAllUsersLoading || isMapLoading;

  if (isLoading) {
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

  // If the user is authenticated but has no profile, show the sign-up details form.
  if (authUser && userProfile === null) {
    return <SignUpDetails />;
  }
  
  // If the user profile and all other essential data exists, render the game board.
  if (userProfile && countries && allUsers && gameMap) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          initialCountries={countries}
          initialAllUsers={allUsers}
          initialGameMap={gameMap}
        />
      </div>
    );
  }

  // Fallback loading state or initial state before user profile is determined
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-96 w-[80vw] max-w-4xl" />
        </div>
    </div>
  );
}
