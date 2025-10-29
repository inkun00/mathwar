'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, GameMap } from "@/lib/types";

const MAP_DOC_ID = "world_1";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [gameMap, setGameMap] = useState<GameMap | null>(null);

  useEffect(() => {
    if (isAuthUserLoading || !firestore) return;
    if (!authUser) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const userDocRef = doc(firestore, 'users', authUser.uid);
        const countriesQuery = collection(firestore, "countries");
        const usersQuery = collection(firestore, "users");
        const mapDocRef = doc(firestore, "maps", MAP_DOC_ID);

        const [userDocSnap, countriesSnap, usersSnap, mapDocSnap] = await Promise.all([
          getDoc(userDocRef),
          getDocs(countriesQuery),
          getDocs(usersQuery),
          getDoc(mapDocRef),
        ]);

        if (userDocSnap.exists()) {
          setUserProfile({ ...userDocSnap.data(), id: userDocSnap.id } as User);
        } else {
          setUserProfile(null);
        }

        setCountries(countriesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Country)));
        setAllUsers(usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
        
        if (mapDocSnap.exists()) {
          setGameMap({ ...mapDocSnap.data(), id: mapDocSnap.id } as GameMap);
        }

      } catch (error) {
        console.error("Error fetching initial data:", error);
        // Handle error appropriately
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

  }, [authUser, isAuthUserLoading, firestore]);

  if (isLoading || isAuthUserLoading) {
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

  if (authUser && userProfile === null) {
    return <SignUpDetails />;
  }
  
  if (userProfile && gameMap) {
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

  // Fallback for any other state, e.g. map not created yet for the first user
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">데이터를 준비하는 중입니다...</h2>
          <p className="text-muted-foreground">잠시 후 새로고침 해주세요.</p>
        </div>
    </div>
  );
}
