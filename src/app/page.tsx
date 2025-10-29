'use client';

import { useEffect, useState, useCallback } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useDoc } from "@/firebase/firestore/use-doc";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // We only fetch the user document here. The rest of the data is fetched inside GameBoard.
  const userDocRef = authUser ? doc(firestore, 'users', authUser.uid) : null;
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);

  useEffect(() => {
    if (!isAuthUserLoading && !isUserProfileLoading) {
      setIsProfileLoading(false);
    }
  }, [isAuthUserLoading, isUserProfileLoading]);
  
  if (isAuthUserLoading || isProfileLoading) {
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

  // If the user is authenticated but has no profile, show the sign-up details form.
  // The `userProfile` can be `null` if the document doesn't exist.
  if (authUser && userProfile === null && !isUserProfileLoading) {
    return <SignUpDetails />;
  }
  
  // If the user profile exists, render the game board.
  if (userProfile) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard />
      </div>
    );
  }

  // Fallback loading state or initial state before user profile is determined
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-96 w-96" />
      </div>
    </div>
  );
}
