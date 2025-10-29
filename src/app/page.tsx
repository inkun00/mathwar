'use client';

import { useEffect, useState, useCallback } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, writeBatch } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Tile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // We only fetch the user document here. The rest of the data is fetched inside GameBoard.
  const userDocRef = useMemoFirebase(() => authUser ? doc(firestore, 'users', authUser.uid) : null, [authUser, firestore]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<User>(userDocRef);

  useEffect(() => {
    if (!isAuthUserLoading && !isUserProfileLoading) {
      setIsProfileLoading(false);
    }
  }, [isAuthUserLoading, isUserProfileLoading]);
  
  useEffect(() => {
    const applyOneTimeFix = async () => {
      if (userProfile && firestore && userProfile.tokens < 0) {
        const fixAppliedKey = `fix_negative_tokens_${userProfile.id}`;
        if (sessionStorage.getItem(fixAppliedKey)) {
          return;
        }

        sessionStorage.setItem(fixAppliedKey, 'true');

        const tokensToReclaim = Math.abs(userProfile.tokens);
        toast({
          title: "비정상 토큰 상태 수정",
          description: `비정상적인 토큰(${userProfile.tokens})이 감지되어, ${tokensToReclaim}개의 영토를 회수하고 토큰을 0으로 조정합니다.`,
          variant: "destructive",
        });

        try {
          const tilesQuery = query(collection(firestore, 'land_tiles'), where('ownerId', '==', userProfile.id));
          const userTilesSnapshot = await getDocs(tilesQuery);
          const tilesToUpdate = userTilesSnapshot.docs.slice(0, tokensToReclaim);

          const batch = writeBatch(firestore);
          tilesToUpdate.forEach(tileDoc => {
            batch.update(tileDoc.ref, { ownerId: null });
          });

          const userRef = doc(firestore, 'users', userProfile.id);
          batch.update(userRef, { tokens: 0 });

          await batch.commit();

          toast({
            title: "수정 완료",
            description: "계정이 정상 상태로 복구되었습니다.",
          });
        } catch (error) {
          console.error("Error applying one-time fix:", error);
        }
      }
    };

    if (userProfile) {
      applyOneTimeFix();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, firestore]);

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
