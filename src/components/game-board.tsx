'use client';

import { useState, useMemo, useEffect } from "react";
import type { ClientTile, MathProblem, Country, User, ProblemAttempt, InvasionTarget, WrongAnswer, MapData, GameMap } from "@/lib/types";
import { generateMathProblem, isAdjacent, canConquer as canConquerLogic } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, updateDoc, writeBatch, increment, collection, arrayUnion, query, runTransaction, serverTimestamp } from "firebase/firestore";
import { addWrongAnswer } from "@/firebase/firestore/data";

import Header from "./header";
import WorldMap from "./world-map";
import ProblemModal from "./problem-modal";
import DemiseScreen from "./demise-screen";
import { Skeleton } from "./ui/skeleton";
import { MAP_WIDTH, MAP_HEIGHT } from "@/lib/world-map-shape";

const MAP_DOC_ID = "world_1";

// Helper to construct the client-side 2D map array from the single map document
const constructMapFromDoc = (gameMap: GameMap | null): MapData => {
  const map: MapData = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (__, x) => ({
      x, y, ownerId: null, hasWall: false,
    }))
  );

  if (!gameMap || !gameMap.tileOwners) return map;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (gameMap.tileOwners?.[y]?.[x]) {
        map[y][x].ownerId = gameMap.tileOwners[y][x];
      }
      if (gameMap.walls?.[y]?.[x]) {
        map[y][x].hasWall = gameMap.walls[y][x];
      }
    }
  }
  return map;
};

interface GameBoardProps {
  currentUser: User;
  initialCountries: Country[];
  initialAllUsers: User[];
  initialGameMap: GameMap;
}

export default function GameBoard({ currentUser, initialCountries, initialAllUsers, initialGameMap }: GameBoardProps) {
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const { toast } = useToast();
  
  // --- Data coming from props is now the source of truth for real-time updates ---
  const userRef = useMemoFirebase(() => authUser ? doc(firestore, "users", authUser.uid) : null, [authUser, firestore]);
  // We use the currentUser from props for most things, but listen to live updates for things like tokens
  const { data: liveCurrentUser } = useDoc<User>(userRef);

  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, "countries") : null, [firestore]);
  const { data: liveCountries } = useCollection<Country>(countriesQuery);
  
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, "users") : null, [firestore]);
  const { data: liveAllUsers } = useCollection<User>(usersQuery);

  const mapDocRef = useMemoFirebase(() => firestore ? doc(firestore, "maps", MAP_DOC_ID) : null, [firestore]);
  const { data: liveGameMap } = useDoc<GameMap>(mapDocRef);

  // --- Use live data if available, otherwise fallback to initial props ---
  const finalCurrentUser = liveCurrentUser ?? currentUser;
  const finalCountries = liveCountries ?? initialCountries;
  const finalAllUsers = liveAllUsers ?? initialAllUsers;
  const finalGameMap = liveGameMap ?? initialGameMap;

  // --- Data Fetching for secondary data ---
  const problemAttemptsQuery = useMemoFirebase(() => authUser && firestore ? collection(firestore, 'problem_attempts', authUser.uid, 'attempts') : null, [authUser, firestore]);
  const { data: problemAttempts } = useCollection<ProblemAttempt>(problemAttemptsQuery);

  const wrongAnswersQuery = useMemoFirebase(() => authUser && firestore ? collection(firestore, 'users', authUser.uid, 'wrong_answers') : null, [authUser, firestore]);
  const { data: wrongAnswers } = useCollection<WrongAnswer>(wrongAnswersQuery);
  
  // --- Component State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [invasionTarget, setInvasionTarget] = useState<InvasionTarget>(null);
  const [invasionWallBreaks, setInvasionWallBreaks] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [isBuildingWall, setIsBuildingWall] = useState(false);

  // --- Memoized Derived State ---
  const displayMapData = useMemo(() => constructMapFromDoc(finalGameMap), [finalGameMap]);
  const currentUserCountry = useMemo(() => finalCountries?.find(c => c.id === finalCurrentUser?.countryId), [finalCountries, finalCurrentUser]);
  
  const userCountryTiles = useMemo(() => {
    if (!finalCurrentUser || !finalAllUsers || !displayMapData) return [];
    const countryMembers = finalAllUsers.filter(u => u.countryId === finalCurrentUser.countryId);
    const memberIds = new Set(countryMembers.map(u => u.id));
    return displayMapData.flat().filter(tile => tile.ownerId && memberIds.has(tile.ownerId));
  }, [displayMapData, finalAllUsers, finalCurrentUser]);
  
  const isDemise = useMemo(() => {
    if (!finalCurrentUser || !displayMapData || displayMapData.length === 0) return false;
    const hasLand = displayMapData.flat().some(tile => tile.ownerId === finalCurrentUser.id);
    return !hasLand && (finalCurrentUser.tokens ?? 0) <= 0;
  }, [displayMapData, finalCurrentUser]);

  // --- Event Handlers & Logic ---
  const handleSolveProblemForToken = () => {
    setIsBuildingWall(false);
    setInvasionTarget(null);
    setCurrentProblem(generateMathProblem());
    setIsModalOpen(true);
  };
  
  const handleGainToken = () => {
    if (!finalCurrentUser || !firestore || !userRef) return;
    const updateData = { tokens: increment(1) };
    updateDoc(userRef, updateData).catch(error => {
        console.error("토큰 획득 실패:", error);
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleTerritoryCut = async (originalOwnerId: string, conquerorId: string | null, mapDoc: GameMap) => {
    if (!firestore || !finalCurrentUser || !finalAllUsers) return;
  
    try {
        const ownedTiles: ClientTile[] = [];
        for(let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (mapDoc.tileOwners[y][x] === originalOwnerId) {
                    ownedTiles.push({x, y, ownerId: originalOwnerId, hasWall: mapDoc.walls[y][x]});
                }
            }
        }
  
      if (ownedTiles.length === 0) {
        if (conquerorId) {
          const originalOwnerUser = finalAllUsers.find(u => u.id === originalOwnerId);
          if (originalOwnerUser && originalOwnerUser.countryId) {
            const conquerorRef = doc(firestore, "users", conquerorId);
            const countryRef = doc(firestore, "countries", originalOwnerUser.countryId);
            const batch = writeBatch(firestore);
            batch.update(conquerorRef, { conqueredCountries: arrayUnion(originalOwnerUser.countryId) });
            batch.update(countryRef, { demised: true });
  
            await batch.commit().catch(error => {
              console.error("정복/멸망 처리 실패:", error);
              errorEmitter.emit('permission-error', new FirestorePermissionError({ path: conquerorRef.path, operation: 'update'}));
            });
          }
        }
        return null; // No tiles to neutralize
      }
  
      const visited = new Set<string>();
      const territories: ClientTile[][] = [];
  
      for (const tile of ownedTiles) {
        const tileId = `${tile.x},${tile.y}`;
        if (!visited.has(tileId)) {
          const newTerritory: ClientTile[] = [];
          const queue: ClientTile[] = [tile];
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
          const ownerIsCurrentUser = originalOwnerId === finalCurrentUser.id;
          const originalOwner = finalAllUsers.find(u => u.id === originalOwnerId);
          const ownerName = originalOwner?.nickname || '상대방';
  
          toast({
            variant: ownerIsCurrentUser ? "destructive" : "default",
            title: ownerIsCurrentUser ? "영토 분단!" : `공격 성공! (${ownerName})`,
            description: `영토가 분단되어 타일 ${tilesToNeutralize.length}개를 잃었습니다.`,
          });

          return tilesToNeutralize;
        }
      }
      return null; // No tiles to neutralize
    } catch(error) {
      console.error("An error occurred in handleTerritoryCut:", error);
      return null;
    }
  };


  const handleInvasionSuccess = async () => {
    if (!finalCurrentUser || !firestore || !invasionTarget || !userRef || !mapDocRef) return;

    if (invasionTarget.hasWall && invasionWallBreaks < 1) {
      setInvasionWallBreaks(1);
      toast({
        title: "성벽 돌파!",
        description: "성벽을 파괴했습니다! 한 문제만 더 맞히면 점령할 수 있습니다.",
      });
      setCurrentProblem(generateMathProblem());
      setIsModalOpen(true);
      return;
    }
    
    setInvasionWallBreaks(0);

    const originalOwnerId = invasionTarget.originalOwnerId;
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const mapSnapshot = await transaction.get(mapDocRef);
            if (!mapSnapshot.exists()) {
                throw new Error("Map document does not exist!");
            }

            const currentMapData = mapSnapshot.data() as GameMap;
            
            // Modify map data in memory
            currentMapData.tileOwners[invasionTarget.y][invasionTarget.x] = finalCurrentUser.id;
            currentMapData.walls[invasionTarget.y][invasionTarget.x] = false;

            if (originalOwnerId) {
                const neutralizedTiles = await handleTerritoryCut(originalOwnerId, finalCurrentUser.id, currentMapData);
                if (neutralizedTiles) {
                    neutralizedTiles.forEach(tile => {
                        currentMapData.tileOwners[tile.y][tile.x] = null;
                    });
                }
            }

            // Write the entire updated map back in the transaction
            transaction.update(mapDocRef, {
                tileOwners: currentMapData.tileOwners,
                walls: currentMapData.walls,
                lastUpdated: serverTimestamp()
            });
        });
    } catch (error) {
        console.error("침략 트랜잭션 실패:", error);
        toast({ variant: "destructive", title: "오류", description: "영토를 점령하는 중 오류가 발생했습니다."});
    } finally {
        setInvasionTarget(null);
    }
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!finalCurrentUser || !firestore || isProcessingClick || !finalAllUsers || !userRef || !mapDocRef) return;

    setIsProcessingClick(true);
    const clickedTile = displayMapData[y][x];

    try {
      if (isBuildingWall) {
        if (clickedTile.ownerId === finalCurrentUser.id && !clickedTile.hasWall) {
          await runTransaction(firestore, async (transaction) => {
            const mapSnapshot = await transaction.get(mapDocRef);
            if (!mapSnapshot.exists()) throw new Error("Map does not exist!");
            
            const newWalls = mapSnapshot.data().walls;
            newWalls[y][x] = true;

            transaction.update(mapDocRef, { walls: newWalls, lastUpdated: serverTimestamp() });
            transaction.update(userRef, { walls: increment(-1) });
          });

          toast({ title: "성벽 건설!", description: "영토에 성벽을 성공적으로 건설했습니다." });
          setIsBuildingWall(false);

        } else {
          toast({
              variant: "destructive",
              title: "건설 불가",
              description: clickedTile.ownerId !== finalCurrentUser.id 
                  ? "자신의 영토에만 성벽을 건설할 수 있습니다." 
                  : "이미 성벽이 건설된 곳입니다.",
          });
        }
        return; // Exit after handling wall building
      }

      // Not building a wall, proceed with conquest
      if ((finalCurrentUser.tokens ?? 0) <= 0) {
        toast({
          variant: "destructive",
          title: "토큰이 없습니다!",
          description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
        });
        return;
      }
      
      const originalOwnerId = clickedTile.ownerId;

      if (originalOwnerId === null) {
          // Conquer empty tile
          await runTransaction(firestore, async (transaction) => {
            const mapSnapshot = await transaction.get(mapDocRef);
            if (!mapSnapshot.exists()) throw new Error("Map does not exist!");

            const newTileOwners = mapSnapshot.data().tileOwners;
            newTileOwners[y][x] = finalCurrentUser.id;

            transaction.update(mapDocRef, { tileOwners: newTileOwners, lastUpdated: serverTimestamp() });
            transaction.update(userRef, { tokens: increment(-1) });
          });
          toast({ title: "영토 확장!", description: "새로운 땅을 정복했습니다." });

      } else if (originalOwnerId !== finalCurrentUser.id) {
          // Invade another player's tile
          const owner = finalAllUsers.find(u => u.id === originalOwnerId);
          if (owner && owner.countryId === finalCurrentUser.countryId) {
              toast({
                  variant: "default",
                  title: "공격 불가",
                  description: "같은 국가 소속의 플레이어는 공격할 수 없습니다.",
              });
              return;
          }

          // Decrease token first, then open modal
          await updateDoc(userRef, { tokens: increment(-1) });
          setInvasionTarget({ x, y, originalOwnerId: originalOwnerId!, hasWall: clickedTile.hasWall });
          setInvasionWallBreaks(0);
          setCurrentProblem(generateMathProblem());
          setIsModalOpen(true);
      }
    } catch (error) {
        console.error("타일 클릭 트랜잭션 실패:", error);
        toast({ variant: "destructive", title: "오류", description: "작업을 처리하는 중 오류가 발생했습니다."});
        // If token was spent for invasion, refund it on transaction failure
        if (invasionTarget) {
            updateDoc(userRef, { tokens: increment(1) });
            setInvasionTarget(null);
        }
    } finally {
        setIsProcessingClick(false);
    }
  };
  
  const handleRestart = () => {
    if (!finalCurrentUser || !firestore || !userRef) return;
  
    const updateData = { tokens: 1 };
  
    updateDoc(userRef, updateData)
      .then(() => {
        toast({
          title: "새로운 시작!",
          description: "정복이 다시 시작됩니다.",
        });
      })
      .catch(error => {
        console.error("재시작 실패:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: updateData }));
      });
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  
  const handleToggleWallBuilding = () => {
    if (!isBuildingWall && (finalCurrentUser.walls ?? 0) <= 0) {
      toast({
        variant: "destructive",
        title: "성벽 없음",
        description: "마켓에서 성벽을 먼저 구매해주세요.",
      });
      return;
    }
    setIsBuildingWall(prev => !prev);
  }

  const canConquer = (tile: ClientTile) => {
    if (!finalCurrentUser || !finalAllUsers || (finalCurrentUser.tokens ?? 0) <= 0 || isProcessingClick || isBuildingWall || !displayMapData) {
      return false;
    }
    const flatTiles = displayMapData.flat();
    return canConquerLogic(tile, finalCurrentUser, finalAllUsers, userCountryTiles, flatTiles);
  };
  
  const canBuildWall = (tile: ClientTile) => {
      if (!finalCurrentUser || isProcessingClick || !isBuildingWall) return false;
      return tile.ownerId === finalCurrentUser.id && !tile.hasWall;
  }

  const handleProblemModalClose = (open: boolean) => {
    if (!open) {
      setIsProcessingClick(false); // Make sure this is reset
      if (invasionTarget) {
        // If invasion was cancelled, refund the token
        if (userRef) updateDoc(userRef, { tokens: increment(1) });
        setInvasionTarget(null);
        setInvasionWallBreaks(0);
        toast({ title: "침략 취소", description: "사용한 토큰이 반환되었습니다.", variant: "default" });
      }
    }
    setIsModalOpen(open);
  }


  const handleWrongAnswer = (problem: MathProblem) => {
    if (!authUser || !firestore) return;

    if (invasionTarget) {
      toast({
        variant: 'destructive',
        title: '침략 실패!',
        description: '문제를 틀려 영토 획득에 실패했습니다.',
      });
    } else {
      addWrongAnswer(firestore, authUser.uid, problem);
    }
  };
  
  // This component will now only be rendered when all data is available, so no need for a big loading skeleton.
  if (!problemAttempts || !wrongAnswers) {
     return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Skeleton className="h-[80vh] w-[90vw] max-w-7xl" />
      </div>
    );
  }


  return (
    <div className="flex w-full flex-grow flex-col gap-6">
      <Header 
        currentUser={finalCurrentUser} 
        onSolveProblemClick={handleSolveProblemForToken} 
        countries={finalCountries}
        problemAttempts={problemAttempts}
        users={finalAllUsers}
        wrongAnswers={wrongAnswers}
        isBuildingWall={isBuildingWall}
        onToggleWallBuilding={handleToggleWallBuilding}
        landTiles={displayMapData.flat()}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap 
            displayMapData={displayMapData} 
            users={finalAllUsers} 
            countries={finalCountries} 
            onTileClick={handleTileClick} 
            canConquer={canConquer}
            canBuildWall={canBuildWall}
            zoomLevel={zoomLevel} 
        />
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
        invasionWallBreaks={invasionWallBreaks}
        hasWall={invasionTarget?.hasWall}
      />
      {isDemise && <DemiseScreen onRestart={handleRestart} />}
    </div>
  );
}
