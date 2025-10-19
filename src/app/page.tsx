'use client';

import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import { getGameData } from "@/lib/data";
import { useUser } from "@/firebase/auth/use-user";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const initialData = getGameData(user);
  
  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-96 w-96" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
      <GameBoard initialData={initialData} />
    </div>
  );
}
