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
  
  // Overall loading state: true if auth is loading OR if any of the dependent data is still loading
  const isLoading = isAuthUserLoading || (authUser && (isUserProfileLoading || isCountriesLoading || isAllUsersLoading || isMapLoading));

  // Base loading skeleton for initial auth check
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

  // User is not authenticated, show login page.
  if (!authUser) {
    return <Login />;
  }

  // User is authenticated, but we are waiting for their profile to load (or determine non-existence)
  if (isUserProfileLoading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
           <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-16 w-64" />
              <Skeleton className="h-96 w-[80vw] max-w-4xl" />
            </div>
        </div>
      );
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

  // Fallback loading state for when user is authenticated and profile exists, but other data is still loading
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-96 w-[80vw] max-w-4xl" />
        </div>
    </div>
  );
}
