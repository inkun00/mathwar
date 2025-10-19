'use client';

import { useState, useMemo, useEffect } from "react";
import type { Tile, MathProblem, Country, User, ProblemAttempt } from "@/lib/types";
import { generateMathProblem, isAdjacent, getAIMove } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";

import Header from "./header";
import WorldMap from "./world-map";
import ProblemModal from "./problem-modal";
import DemiseScreen from "./demise-screen";
import { isLand, MAP_WIDTH, MAP_HEIGHT } from "@/lib/world-map-shape";

interface GameBoardProps {
  users: User[];
  countries: Country[];
  landTiles: Tile[];
  currentUserProfile: User;
  problemAttempts: ProblemAttempt[];
}

const aiUsers: Omit<User, 'uid' | 'countryId' | 'email'>[] = [
  { id: "player2", nickname: "AI 플레이어 A", color: "hsl(200, 80%, 60%)", tokens: 1 },
  { id: "player3", nickname: "AI 플레이어 B", color: "hsl(340, 80%, 60%)", tokens: 1 },
];

export default function GameBoard({ users, countries, landTiles, currentUserProfile, problemAttempts }: GameBoardProps) {
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const { toast } = useToast();
  const [zoomLevel, setZoomLevel] = useState(1);

  const currentUser = users.find(u => u.id === currentUserProfile.id);

  // Combine static AI info with dynamic user data from Firestore
  const allUsers = useMemo(() => {
    const firestoreUsers = users.map(u => ({...u, isAI: false}));
    const aiWithDefaults = aiUsers.map(ai => {
      const existingAI = firestoreUsers.find(u => u.id === ai.id);
      return existingAI ? {...ai, ...existingAI, isAI: true} : {...ai, email: '', uid: ai.id, countryId: `ai-country-${ai.id}`, isAI: true};
    });
    return [...firestoreUsers.filter(u => !aiUsers.some(ai => ai.id === u.id)), ...aiWithDefaults];
  }, [users]);
  
  const mapData = useMemo(() => {
    const map: Tile[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
      Array.from({ length: MAP_WIDTH }, (__, x) => ({
        id: `${x}-${y}`,
        x,
        y,
        ownerId: null,
      }))
    );

    landTiles.forEach(tile => {
        if(map[tile.y] && map[tile.y][tile.x]) {
            map[tile.y][tile.x] = { ...map[tile.y][tile.x], ...tile };
        }
    });

    return map;
  }, [landTiles]);
  
  const userTiles = useMemo(() => 
    landTiles.filter(tile => tile.ownerId === currentUser?.id),
    [landTiles, currentUser?.id]
  );
  
  const isDemise = useMemo(() => {
      if (!currentUser) return false;
      return userTiles.length === 0 && currentUser.tokens === 0;
  }, [userTiles, currentUser]);


  useEffect(() => {
    const gameLoop = setInterval(async () => {
      if (!firestore) return;

      const activeAIs = allUsers.filter(u => u.isAI);

      for (const ai of activeAIs) {
        if (ai.tokens <= 0) continue;

        const allAiTiles = landTiles.filter(t => t.ownerId === ai.id);
        const move = getAIMove(ai, allAiTiles, landTiles, allUsers);
        
        if (move) {
          try {
            const tileRef = doc(firestore, 'land_tiles', move.id || `${move.x}-${move.y}`);
            await setDoc(tileRef, { x: move.x, y: move.y, ownerId: ai.id }, { merge: true });

            const aiUserRef = doc(firestore, 'users', ai.id);
            await updateDoc(aiUserRef, { tokens: ai.tokens - 1 });

            // Randomly award token
            if (Math.random() < 0.1) {
              await updateDoc(aiUserRef, { tokens: ai.tokens }); // (tokens-1)+1 = tokens
            }

          } catch (error) {
            console.error("AI move failed:", error);
          }
        }
      }
    }, 3000); // AI acts every 3 seconds

    return () => clearInterval(gameLoop);
  }, [allUsers, landTiles, firestore]);


  const handleSolveProblemClick = () => {
    setCurrentProblem(generateMathProblem());
    setIsModalOpen(true);
  };

  const handleCorrectAnswer = async () => {
    if (!currentUser) return;
    const userRef = doc(firestore, "users", currentUser.id);
    await updateDoc(userRef, {
      tokens: (currentUser.tokens || 0) + 1,
    });
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!currentUser || currentUser.tokens <= 0) {
      toast({
        variant: "destructive",
        title: "토큰이 없습니다!",
        description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
      });
      return;
    }
    
    const tileId = `${x}-${y}`;
    const tileRef = doc(firestore, "land_tiles", tileId);
    await setDoc(tileRef, { x, y, ownerId: currentUser.id }, { merge: true });

    const userRef = doc(firestore, "users", currentUser.id);
    await updateDoc(userRef, {
      tokens: currentUser.tokens - 1,
    });
  };
  
  const handleRestart = async () => {
    if (!currentUser || !firestore) return;
  
    const batch = writeBatch(firestore);
  
    // Reset user's tokens
    const userRef = doc(firestore, "users", currentUser.id);
    batch.update(userRef, { tokens: 1 });
  
    // Find and reset user's tiles
    const tilesToClear = landTiles.filter(tile => tile.ownerId === currentUser.id);
    tilesToClear.forEach(tile => {
      const tileRef = doc(firestore, "land_tiles", tile.id);
      batch.update(tileRef, { ownerId: null });
    });
  
    await batch.commit();
  
    toast({
      title: "새로운 시작!",
      description: "정복이 다시 시작됩니다.",
    });
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));

  const canConquer = (tile: Tile) => {
    if (!currentUser || tile.ownerId === currentUser.id || currentUser.tokens <= 0) {
      return false;
    }

    if (userTiles.length === 0) {
      return tile.ownerId === null && isLand(tile.x, tile.y);
    }

    return isAdjacent(tile.x, tile.y, userTiles);
  };

  if (!currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p>사용자를 불러오는 중...</p>
      </div>
    )
  }


  return (
    <div className="flex w-full flex-grow flex-col gap-6">
      <Header 
        currentUser={currentUser} 
        onSolveProblemClick={handleSolveProblemClick} 
        countries={countries}
        problemAttempts={problemAttempts}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap mapData={mapData} users={allUsers} countries={countries} onTileClick={handleTileClick} canConquer={canConquer} zoomLevel={zoomLevel} />
        <div className="absolute bottom-4 right-4 flex gap-2">
          <Button size="icon" onClick={handleZoomIn} aria-label="확대">
            <ZoomIn />
          </Button>
          <Button size="icon" onClick={handleZoomOut} aria-label="축소">
            <ZoomOut />
          </Button>
        </div>
      </div>
      <ProblemModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        problem={currentProblem}
        onCorrectAnswer={handleCorrectAnswer}
        userId={authUser?.uid}
      />
      {isDemise && <DemiseScreen onRestart={handleRestart} />}
    </div>
  );
}
