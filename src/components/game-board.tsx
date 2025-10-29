'use client';

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Tile, MathProblem, Country, User, ProblemAttempt, InvasionTarget, WrongAnswer, MapData, MapAggregate } from "@/lib/types";
import { generateMathProblem, isAdjacent, canConquer as canConquerLogic } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, setDoc, updateDoc, writeBatch, increment, collection, arrayUnion, query, where, getDocs } from "firebase/firestore";
import { addWrongAnswer } from "@/firebase/firestore/data";

import Header from "./header";
import WorldMap from "./world-map";
import ProblemModal from "./problem-modal";
import DemiseScreen from "./demise-screen";
import { Skeleton } from "./ui/skeleton";
import { MAP_WIDTH, MAP_HEIGHT } from "@/lib/world-map-shape";

const createEmptyMap = (): MapData => 
  Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (__, x) => ({
      id: `${x}-${y}`, x, y, ownerId: null,
    }))
  );

const constructMapFromAggregate = (aggregate: MapAggregate | null): MapData => {
  const emptyMap = createEmptyMap();
  // Firestore bytes type can be received as a Uint8Array.
  if (!aggregate || !(aggregate.mapData instanceof Uint8Array)) return emptyMap;

  try {
    // The Uint8Array needs to be decoded into a string first.
    const decoder = new TextDecoder('utf-8');
    const decodedString = decoder.decode(aggregate.mapData);

    const ownerIds: (string | null)[] = [];
    const idByteLength = 32;

    for (let i = 0; i < decodedString.length; i += idByteLength) {
      const idBytes = decodedString.substring(i, i + idByteLength);
      // Firestore's null bytes are actual \x00 characters.
      // We trim them off before checking if the ID is empty.
      const ownerId = idBytes.replace(/\x00/g, '');
      ownerIds.push(ownerId.length > 0 ? ownerId : null);
    }
    
    return emptyMap.map((row, y) => 
      row.map((tile, x) => {
        const index = y * MAP_WIDTH + x;
        const ownerId = ownerIds[index] || null;
        return { ...tile, ownerId };
      })
    );
  } catch (e) {
    console.error("Failed to decode or parse map data:", e);
    return emptyMap; // Return empty map on error
  }
};


export default function GameBoard() {
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const { toast } = useToast();
  
  // --- Data Fetching ---
  const userRef = useMemoFirebase(() => authUser ? doc(firestore, "users", authUser.uid) : null, [authUser, firestore]);
  const { data: currentUser, isLoading: isUserLoading } = useDoc<User>(userRef);
  
  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, "countries") : null, [firestore]);
  const { data: countries, isLoading: isCountriesLoading } = useCollection<Country>(countriesQuery);
  
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, "users") : null, [firestore]);
  const { data: allUsers, isLoading: isAllUsersLoading } = useCollection<User>(usersQuery);

  const mapAggregateQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "map_aggregates"), where("id", "==", "latest")) : null, [firestore]);
  const { data: mapAggregate, isLoading: isMapLoading } = useCollection<MapAggregate>(mapAggregateQuery);

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
  const displayMapData = useMemo(() => constructMapFromAggregate(mapAggregate?.[0] ?? null), [mapAggregate]);

  const currentUserCountry = useMemo(() => countries?.find(c => c.id === currentUser?.countryId), [countries, currentUser]);
  
  const userCountryTiles = useMemo(() => {
    if (!currentUser || !allUsers || !displayMapData) return [];
    const countryMembers = allUsers.filter(u => u.countryId === currentUser.countryId);
    const memberIds = new Set(countryMembers.map(u => u.id));
    return displayMapData.flat().filter(tile => tile.ownerId && memberIds.has(tile.ownerId));
  }, [displayMapData, allUsers, currentUser]);
  
  const isDemise = useMemo(() => {
    if (!currentUser || isMapLoading || !displayMapData || displayMapData.length === 0) return false;
    const hasLand = displayMapData.flat().some(tile => tile.ownerId === currentUser.id);
    return !hasLand && (currentUser.tokens ?? 0) <= 0;
  }, [displayMapData, currentUser, isMapLoading]);

  // --- Event Handlers & Logic ---
  const handleSolveProblemForToken = () => {
    setIsBuildingWall(false);
    setInvasionTarget(null);
    setCurrentProblem(generateMathProblem());
    setIsModalOpen(true);
  };
  
  const handleGainToken = () => {
    if (!currentUser || !firestore || !userRef) return;
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

  const handleTerritoryCut = async (originalOwnerId: string, conquerorId: string | null) => {
    if (!firestore || !currentUser || !allUsers || !displayMapData) return;
  
    try {
      // Use the real-time map data from state instead of fetching
      const ownedTiles = displayMapData.flat().filter(tile => tile.ownerId === originalOwnerId);
  
      if (ownedTiles.length === 0) {
        if (conquerorId) {
          const originalOwnerUser = allUsers.find(u => u.id === originalOwnerId);
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
        return;
      }
  
      const visited = new Set<string>();
      const territories: Tile[][] = [];
  
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
                // Find the neighbor from the ownedTiles list, not the entire map
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
        // The largest territory remains, the rest are neutralized
        territories.sort((a, b) => b.length - a.length);
        const tilesToNeutralize = territories.slice(1).flat();
        
        if (tilesToNeutralize.length > 0) {
          const batch = writeBatch(firestore);
          tilesToNeutralize.forEach(tile => {
            const tileRef = doc(firestore, "land_tiles", `${tile.x}-${tile.y}`);
            batch.update(tileRef, { ownerId: null });
          });
          
          await batch.commit().catch(error => {
            console.error("영토 분단 처리 실패:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'land_tiles', operation: 'update'}));
          });
  
          const ownerIsCurrentUser = originalOwnerId === currentUser.id;
          const originalOwner = allUsers.find(u => u.id === originalOwnerId);
          const ownerName = originalOwner?.nickname || '상대방';
  
          toast({
            variant: ownerIsCurrentUser ? "destructive" : "default",
            title: ownerIsCurrentUser ? "영토 분단!" : `공격 성공! (${ownerName})`,
            description: `영토가 분단되어 타일 ${tilesToNeutralize.length}개를 잃었습니다.`,
          });
        }
      }
    } catch(error) {
      console.error("An error occurred in handleTerritoryCut:", error);
    }
  };


  const handleInvasionSuccess = async () => {
    if (!currentUser || !firestore || !invasionTarget || !userRef) return;

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
    const tileId = `${invasionTarget.x}-${invasionTarget.y}`;
    const tileRef = doc(firestore, "land_tiles", tileId);
    const tileData = { x: invasionTarget.x, y: invasionTarget.y, ownerId: currentUser.id, hasWall: false };

    try {
      await setDoc(tileRef, tileData, { merge: true });
      if (originalOwnerId) {
        await handleTerritoryCut(originalOwnerId, currentUser.id);
      }
    } catch (error) {
        console.error("침략 실패:", error);
        const permissionError = new FirestorePermissionError({
            path: tileRef.path,
            operation: 'write',
            requestResourceData: tileData,
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setInvasionTarget(null);
    }
  };

  const handleTileClick = (x: number, y: number) => {
    if (!currentUser || !firestore || isProcessingClick || !allUsers || !userRef) return;

    setIsProcessingClick(true);
    const clickedTile = displayMapData[y][x];

    if (isBuildingWall) {
      if (clickedTile.ownerId === currentUser.id && !clickedTile.hasWall) {
        const tileRef = doc(firestore, "land_tiles", clickedTile.id);
        
        const batch = writeBatch(firestore);
        batch.update(tileRef, { hasWall: true });
        batch.update(userRef, { walls: increment(-1) });

        batch.commit()
          .then(() => {
            toast({ title: "성벽 건설!", description: "영토에 성벽을 성공적으로 건설했습니다." });
            setIsBuildingWall(false);
          })
          .catch(error => {
            console.error("성벽 건설 실패:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: tileRef.path, operation: 'update', requestResourceData: { hasWall: true } }));
          })
          .finally(() => setIsProcessingClick(false));
      } else {
        toast({
            variant: "destructive",
            title: "건설 불가",
            description: clickedTile.ownerId !== currentUser.id 
                ? "자신의 영토에만 성벽을 건설할 수 있습니다." 
                : "이미 성벽이 건설된 곳입니다.",
        });
        setIsProcessingClick(false);
      }
      return;
    }

    if ((currentUser.tokens ?? 0) <= 0) {
      toast({
        variant: "destructive",
        title: "토큰이 없습니다!",
        description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
      });
      setIsProcessingClick(false);
      return;
    }
    
    const originalOwnerId = clickedTile.ownerId;

    if (originalOwnerId === null) {
        const tileId = `${x}-${y}`;
        const tileRef = doc(firestore, "land_tiles", tileId);
        const tileData = { x, y, ownerId: currentUser.id, hasWall: false };
        
        const batch = writeBatch(firestore);
        batch.set(tileRef, tileData, { merge: true });
        batch.update(userRef, { tokens: increment(-1) });

        batch.commit()
            .then(() => {
                toast({ title: "영토 확장!", description: "새로운 땅을 정복했습니다." });
            })
            .catch(error => {
                console.error("타일 클릭 작업 실패:", error);
                const permissionError = new FirestorePermissionError({
                    path: tileRef.path,
                    operation: 'write',
                    requestResourceData: tileData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsProcessingClick(false);
            });
    }
    else if (originalOwnerId !== currentUser.id) {
        const owner = allUsers.find(u => u.id === originalOwnerId);
        if (owner && owner.countryId === currentUser.countryId) {
             toast({
                variant: "default",
                title: "공격 불가",
                description: "같은 국가 소속의 플레이어는 공격할 수 없습니다.",
            });
            setIsProcessingClick(false);
            return;
        }

        updateDoc(userRef, { tokens: increment(-1) })
            .then(() => {
                setInvasionTarget({ x, y, originalOwnerId: originalOwnerId!, hasWall: clickedTile.hasWall });
                setInvasionWallBreaks(0);
                setCurrentProblem(generateMathProblem());
                setIsModalOpen(true);
            })
            .catch(error => {
                console.error("토큰 감소 실패:", error);
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: { tokens: increment(-1) } }));
                setIsProcessingClick(false);
            });
    } else {
        setIsProcessingClick(false);
    }
  };
  
  const handleRestart = () => {
    if (!currentUser || !firestore || !userRef) return;
  
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
    setIsBuildingWall(prev => !prev);
  }

  const canConquer = (tile: Tile) => {
    if (!currentUser || !allUsers || (currentUser.tokens ?? 0) <= 0 || isProcessingClick || isBuildingWall) {
      return false;
    }
    return canConquerLogic(tile, currentUser, allUsers, userCountryTiles, displayMapData.flat());
  };
  
  const canBuildWall = (tile: Tile) => {
      if (!currentUser || isProcessingClick || !isBuildingWall) return false;
      return tile.ownerId === currentUser.id && !tile.hasWall;
  }

  const handleProblemModalClose = (open: boolean) => {
    if (!open) {
      setIsProcessingClick(false);
      setInvasionTarget(null);
      setInvasionWallBreaks(0);
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
  
  const isLoading = isUserLoading || isCountriesLoading || isAllUsersLoading || isMapLoading;
  
  if (isLoading || !currentUser || !countries || !allUsers || !problemAttempts || !wrongAnswers) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Skeleton className="h-[80vh] w-[90vw] max-w-7xl" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-grow flex-col gap-6">
      <Header 
        currentUser={currentUser} 
        onSolveProblemClick={handleSolveProblemForToken} 
        countries={countries}
        problemAttempts={problemAttempts}
        users={allUsers}
        wrongAnswers={wrongAnswers}
        isBuildingWall={isBuildingWall}
        onToggleWallBuilding={handleToggleWallBuilding}
        landTiles={displayMapData.flat()}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap 
            displayMapData={displayMapData} 
            users={allUsers} 
            countries={countries} 
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
