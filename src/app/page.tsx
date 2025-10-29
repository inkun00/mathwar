'use client';

import { useEffect, useState } from "react";
import GameBoard from "@/components/game-board";
import Login from "@/components/login";
import SignUpDetails from "@/components/signup-details";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, collection, getDocs, query } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Country, ClientTile } from "@/lib/types";

export default function Home() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [landTiles, setLandTiles] = useState<ClientTile[]>([]);

  useEffect(() => {
    if (isAuthUserLoading || !firestore) return;
    if (!authUser) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // All queries are prepared here
        const userDocRef = doc(firestore, 'users', authUser.uid);
        const countriesQuery = collection(firestore, "countries");
        const usersQuery = collection(firestore, "users");
        const landTilesQuery = collection(firestore, "land_tiles");

        // Execute all queries in parallel
        const [userDocSnap, countriesSnap, usersSnap, landTilesSnap] = await Promise.all([
          getDoc(userDocRef),
          getDocs(countriesQuery),
          getDocs(usersQuery),
          getDocs(landTilesQuery),
        ]);

        // Process user profile
        if (userDocSnap.exists()) {
          setUserProfile({ ...userDocSnap.data(), id: userDocSnap.id } as User);
        } else {
          setUserProfile(null); // Explicitly set to null if not found
        }
        
        // Process other collections
        setCountries(countriesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Country)));
        setAllUsers(usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
        setLandTiles(landTilesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClientTile)));

      } catch (error) {
        console.error("Error fetching initial data:", error);
        // Handle error appropriately, e.g., show an error message to the user
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

  if (authUser && !userProfile) {
    return <SignUpDetails />;
  }
  
  if (userProfile) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
        <GameBoard 
          currentUser={userProfile}
          initialCountries={countries}
          initialAllUsers={allUsers}
          initialLandTiles={landTiles}
        />
      </div>
    );
  }

  // Fallback for any other state
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">데이터를 준비하는 중입니다...</h2>
          <p className="text-muted-foreground">잠시 후 새로고침 해주세요.</p>
        </div>
    </div>
  );
}
