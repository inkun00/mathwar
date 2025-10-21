'use client';

import { useState, useMemo, useEffect } from "react";
import type { Tile, MathProblem, Country, User, ProblemAttempt, InvasionTarget, WrongAnswer } from "@/lib/types";
import { generateMathProblem, isAdjacent, getAIMove } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { doc, setDoc, updateDoc, writeBatch, increment, collection } from "firebase/firestore";
import { addWrongAnswer } from "@/firebase/firestore/data";

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
  wrongAnswers: WrongAnswer[];
}

const aiUsers: (Omit<User, 'uid' | 'email'> & {country: Omit<Country, 'id' | 'createdBy'>})[] = [
    { id: "player2", nickname: "AI 플레이어 A", tokens: 1, countryId: 'ai-country-a', country: { name: 'AI 제국 A', color: "hsl(200, 80%, 60%)"} },
    { id: "player3", nickname: "AI 플레이어 B", tokens: 1, countryId: 'ai-country-b', country: { name: 'AI 제국 B', color: "hsl(340, 80%, 60%)"} },
];

export default function GameBoard({ users, countries, landTiles, currentUserProfile, problemAttempts, wrongAnswers }: GameBoardProps) {
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [invasionTarget, setInvasionTarget] = useState<InvasionTarget>(null);
  const { toast } = useToast();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isProcessingClick, setIsProcessingClick] = useState(false);


  const currentUser = users.find(u => u.id === currentUserProfile.id);
  
  const allUsers = useMemo(() => {
    const firestoreUsers = users.map(u => ({...u, isAI: false}));
    const aiWithDefaults = aiUsers.map(ai => {
      const existingAI = firestoreUsers.find(u => u.id === ai.id);
      return existingAI ? {...ai, ...existingAI, isAI: true} : {...ai, email: '', uid: ai.id, isAI: true};
    });
    return [...firestoreUsers.filter(u => !aiUsers.some(ai => ai.id === u.id)), ...aiWithDefaults];
  }, [users]);
  
  const allCountries = useMemo(() => {
    const aiApiCountries = aiUsers.map(ai => ({...ai.country, id: ai.countryId, createdBy: 'ai', color: ai.country.color}));
    const humanCountries = countries.map(c => {
      const countryUser = users.find(u => u.countryId === c.id);
      return {...c, color: countryUser?.color || "hsl(0, 0%, 50%)"}
    })
    return [...humanCountries, ...aiApiCountries];
  }, [countries, users]);

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
      const hasLand = landTiles.some(tile => tile.ownerId === currentUser.id);
      return !hasLand && currentUser.tokens === 0;
  }, [landTiles, currentUser]);


  useEffect(() => {
    const gameLoop = setInterval(async () => {
      if (!firestore) return;

      const activeAIs = allUsers.filter(u => u.isAI);

      for (const ai of activeAIs) {
        // Find the AI's current data from the live user list
        const currentAiData = allUsers.find(u => u.id === ai.id);
        if (!currentAiData || currentAiData.tokens <= 0) continue;

        const allAiTiles = landTiles.filter(t => t.ownerId === ai.id);
        const move = getAIMove(ai, allAiTiles, landTiles, allUsers);
        
        if (move) {
          try {
             // 70% chance to succeed without a problem
            const successfulInvasion = move.ownerId === null || Math.random() < 0.7;

            const tileRef = doc(firestore, 'land_tiles', move.id || `${move.x}-${move.y}`);
            const aiUserRef = doc(firestore, 'users', ai.id);
            const batch = writeBatch(firestore);

            batch.update(aiUserRef, { tokens: increment(-1) });

            if (successfulInvasion) {
                batch.set(tileRef, { x: move.x, y: move.y, ownerId: ai.id }, { merge: true });
                // Randomly award token
                if (Math.random() < 0.1) {
                    batch.update(aiUserRef, { tokens: increment(1) });
                }
            }
            
            await batch.commit();

            if (successfulInvasion && move.ownerId && move.ownerId !== ai.id) {
               await handleTerritoryCut(move.ownerId);
            }

          } catch (error) {
            console.error("AI 이동 실패:", error);
          }
        }
      }
    }, 3000); // AI acts every 3 seconds

    return () => clearInterval(gameLoop);
  }, [allUsers, landTiles, firestore]);

  const handleSolveProblemForToken = () => {
    setInvasionTarget(null);
    setCurrentProblem(generateMathProblem());
    setIsModalOpen(true);
  };
  
  const handleGainToken = async () => {
    if (!currentUser || !firestore) return;
    const userRef = doc(firestore, "users", currentUser.id);
    await updateDoc(userRef, {
      tokens: increment(1),
    });
  };

  const handleTerritoryCut = async (originalOwnerId: string) => {
    if (!firestore) return;

    // Get a fresh snapshot of land tiles
    const tilesCollectionRef = collection(firestore, "land_tiles");
    const landTilesSnapshot = await require('firebase/firestore').getDocs(tilesCollectionRef);
    const currentLandTiles = landTilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tile));

    const ownedTiles = currentLandTiles.filter(t => t.ownerId === originalOwnerId);
    if (ownedTiles.length === 0) return;

    const visited = new Set<string>();
    const territories: Tile[][] = [];

    // Find all contiguous territories
    for (const tile of ownedTiles) {
        const tileId = `${tile.x},${tile.y}`;
        if (!visited.has(tileId)) {
            const newTerritory: Tile[] = [];
            const queue: Tile[] = [tile];
            visited.add(tileId);

            while (queue.length > 0) {
                const current = queue.shift()!;
                newTerritory.push(current);

                const neighbors = [
                    { x: current.x, y: current.y - 1 }, { x: current.x, y: current.y + 1 },
                    { x: current.x - 1, y: current.y }, { x: current.x + 1, y: current.y }
                ];

                for (const n of neighbors) {
                    const neighborId = `${n.x},${n.y}`;
                    if (!visited.has(neighborId)) {
                        const neighborTile = ownedTiles.find(t => t.x === n.x && t.y === n.y);
                        if (neighborTile) {
                            visited.add(neighborId);
                            queue.push(neighborTile);
                        }
                    }
                }
            }
            territories.push(newTerritory);
        }
    }

    if (territories.length > 1) {
        territories.sort((a, b) => b.length - a.length);

        const tilesToNeutralize = territories.slice(1).flat();
        
        if (tilesToNeutralize.length > 0) {
            const batch = writeBatch(firestore);
            tilesToNeutralize.forEach(tile => {
                const tileRef = doc(firestore, "land_tiles", tile.id);
                batch.update(tileRef, { ownerId: null });
            });

            // Add token compensation
            const tokensToCompensate = Math.round(tilesToNeutralize.length / 2);
            if (tokensToCompensate > 0) {
              const originalOwnerRef = doc(firestore, "users", originalOwnerId);
              batch.update(originalOwnerRef, { tokens: increment(tokensToCompensate) });
            }

            await batch.commit();

            const ownerIsCurrentUser = originalOwnerId === currentUser?.id;
            const toastTitle = ownerIsCurrentUser ? "영토 분단!" : "공격 성공!";
            let toastDescription = `상대방의 영토가 분단되어 일부가 미개척지가 되었습니다.`;
            if(ownerIsCurrentUser) {
              toastDescription = `영토가 분단되어 타일 ${tilesToNeutralize.length}개를 잃고 토큰 ${tokensToCompensate}개를 얻었습니다.`
            } else if (tokensToCompensate > 0) {
              const originalOwner = allUsers.find(u => u.id === originalOwnerId);
              const ownerName = originalOwner?.nickname || '상대방';
              toastDescription = `${ownerName}에게 ${tokensToCompensate}개의 보상 토큰이 지급되었습니다.`
            }

            toast({
                variant: ownerIsCurrentUser ? "destructive" : "default",
                title: toastTitle,
                description: toastDescription,
            });
        }
    }
  };


  const handleInvasionSuccess = async () => {
    if (!currentUser || !firestore || !invasionTarget) return;

    try {
        const batch = writeBatch(firestore);

        // Conquer the tile
        const tileId = `${invasionTarget.x}-${invasionTarget.y}`;
        const tileRef = doc(firestore, "land_tiles", tileId);
        batch.set(tileRef, { x: invasionTarget.x, y: invasionTarget.y, ownerId: currentUser.id }, { merge: true });

        // Decrement token
        const userRef = doc(firestore, "users", currentUser.id);
        batch.update(userRef, { tokens: increment(-1) });

        await batch.commit();
        
        // After commit, check for territory cuts
        if (invasionTarget.originalOwnerId) {
            await handleTerritoryCut(invasionTarget.originalOwnerId);
        }
    } catch (error) {
        console.error("침략 실패:", error);
    } finally {
        setInvasionTarget(null);
    }
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!currentUser || !firestore || isProcessingClick) {
      return;
    }
    if (currentUser.tokens <= 0) {
      toast({
        variant: "destructive",
        title: "토큰이 없습니다!",
        description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
      });
      return;
    }
    
    setIsProcessingClick(true);
    const clickedTile = mapData[y][x];
    const originalOwnerId = clickedTile.ownerId;

    try {
        // Case 1: Conquering unowned land
        if (originalOwnerId === null) {
            const tileId = `${x}-${y}`;
            const tileRef = doc(firestore, "land_tiles", tileId);
            await setDoc(tileRef, { x, y, ownerId: currentUser.id }, { merge: true });

            const userRef = doc(firestore, "users", currentUser.id);
            await updateDoc(userRef, {
            tokens: increment(-1),
            });
            toast({ title: "영토 확장!", description: "새로운 땅을 정복했습니다." });
        }
        // Case 2: Attacking an enemy tile
        else if (originalOwnerId !== currentUser.id) {
            setInvasionTarget({ x, y, originalOwnerId: originalOwnerId! });
            setCurrentProblem(generateMathProblem());
            setIsModalOpen(true);
        }
    } catch (error) {
        console.error("타일 클릭 작업 실패:", error);
        toast({ variant: "destructive", title: "오류", description: "작업 처리 중 오류가 발생했습니다." });
    } finally {
        // For non-invasion clicks, stop processing here.
        // For invasions, the modal's onOpenChange will handle it.
        if (originalOwnerId === null || originalOwnerId === currentUser.id) {
            setIsProcessingClick(false);
        }
    }
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
    if (!currentUser || currentUser.tokens <= 0 || isProcessingClick) {
      return false;
    }

    if (tile.ownerId === currentUser.id) return false;

    // If user has no tiles, they can only take unowned land
    if (userTiles.length === 0) {
      return tile.ownerId === null && isLand(tile.x, tile.y);
    }

    return isAdjacent(tile.x, tile.y, userTiles);
  };
  
  const handleProblemModalClose = (open: boolean) => {
    if (!open) {
      // This is called when the modal is closed, either by solving, failing, or clicking away.
      // This is the right place to unlock clicking.
      setIsProcessingClick(false);
      setInvasionTarget(null); // Always reset invasion target on close
    }
    setIsModalOpen(open);
  }

  const handleWrongAnswer = async (problem: MathProblem) => {
    if (!authUser || !firestore) return;
    
    if (invasionTarget) {
      // Decrement token on wrong answer during an invasion
      const userRef = doc(firestore, "users", authUser.uid);
      await updateDoc(userRef, { tokens: increment(-1) });
    } else {
      // Not an invasion, so add to wrong answer notes
      await addWrongAnswer(firestore, authUser.uid, problem);
    }
    // No need to reset invasion target here, onOpenChange handles it.
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
        onSolveProblemClick={handleSolveProblemForToken} 
        countries={allCountries}
        problemAttempts={problemAttempts}
        landTiles={landTiles}
        users={allUsers}
        wrongAnswers={wrongAnswers}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap mapData={mapData} users={allUsers} countries={allCountries} onTileClick={handleTileClick} canConquer={canConquer} zoomLevel={zoomLevel} />
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
        onOpenChange={handleProblemModalClose}
        problem={currentProblem}
        onCorrectAnswer={invasionTarget ? handleInvasionSuccess : handleGainToken}
        onWrongAnswer={handleWrongAnswer}
        userId={authUser?.uid}
        isInvasion={!!invasionTarget}
      />
      {isDemise && <DemiseScreen onRestart={handleRestart} />}
    </div>
  );
}

    