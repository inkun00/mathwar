'use client';

import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { getGameData } from "@/lib/data";
import { useUser } from "@/firebase/auth/use-user";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as GameUser, Country } from "@/lib/types";

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

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<GameUser>(userDocRef);
  const { data: countries, isLoading: areCountriesLoading } = useCollection<Country>(countriesQuery);
  
  const isLoading = isAuthUserLoading || isProfileLoading || areCountriesLoading;

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

  // If we have an authenticated user and their profile
  if (authUser && userProfile && countries) {
    const initialData = getGameData(authUser, userProfile, countries);
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard initialData={initialData} />
      </div>
    );
  }

  // Fallback, should not be reached
  return <Login />;
}
