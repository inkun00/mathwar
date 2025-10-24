'use client';

import { useState, useMemo, useEffect } from "react";
import type { Tile, MathProblem, Country, User, ProblemAttempt, InvasionTarget, WrongAnswer } from "@/lib/types";
import { generateMathProblem, isAdjacent } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { doc, setDoc, updateDoc, writeBatch, increment, collection, getDocs, arrayUnion } from "firebase/firestore";
import { addWrongAnswer } from "@/firebase/firestore/data";
import { errorEmitter, FirestorePermissionError } from '@/firebase';

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

export default function GameBoard({ users, countries, landTiles, currentUserProfile, problemAttempts, wrongAnswers }: GameBoardProps) {
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [invasionTarget, setInvasionTarget] = useState<InvasionTarget>(null);
  const [invasionWallBreaks, setInvasionWallBreaks] = useState(0);
  const { toast } = useToast();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [isBuildingWall, setIsBuildingWall] = useState(false);


  const currentUserCountry = useMemo(() => countries.find(c => c.id === currentUserProfile.countryId), [countries, currentUserProfile.countryId]);
  
  const isCountryOwner = useMemo(() => {
    if (!currentUserCountry || !authUser) return false;
    return currentUserCountry.createdBy === authUser.uid;
  }, [currentUserCountry, authUser]);

  const currentUser = useMemo(() => {
    const user = users.find(u => u.id === currentUserProfile.id);
    if (!user) return undefined;
    return { ...user, isCountryOwner };
  }, [users, currentUserProfile.id, isCountryOwner]);
  
  const allUsers = useMemo(() => {
    return users.map(u => ({...u, isAI: false}));
  }, [users]);
  
  const allCountries = useMemo(() => {
    return countries.map(c => ({...c}));
  }, [countries]);

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
  
  const userCountryTiles = useMemo(() => {
    if (!currentUser) return [];
    const countryMembers = allUsers.filter(u => u.countryId === currentUser.countryId);
    const memberIds = new Set(countryMembers.map(u => u.id));
    return landTiles.filter(tile => tile.ownerId && memberIds.has(tile.ownerId));
  }, [landTiles, allUsers, currentUser]);
  
  const isDemise = useMemo(() => {
      if (!currentUser) return false;
      const hasLand = landTiles.some(tile => tile.ownerId === currentUser.id);
      // You are in demise if you have no land AND no tokens to expand.
      return !hasLand && (currentUser.tokens ?? 0) === 0;
  }, [landTiles, currentUser]);


  const handleSolveProblemForToken = () => {
    setIsBuildingWall(false);
    setInvasionTarget(null);
    setCurrentProblem(generateMathProblem());
    setIsModalOpen(true);
  };
  
  const handleGainToken = () => {
    if (!currentUser || !firestore) return;
    const userRef = doc(firestore, "users", currentUser.id);
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
    if (!firestore || !currentUser) return;

    try {
        const tilesCollectionRef = collection(firestore, "land_tiles");
        const landTilesSnapshot = await getDocs(tilesCollectionRef);
        const currentLandTiles = landTilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tile));

        const ownedTiles = currentLandTiles.filter(t => t.ownerId === originalOwnerId);
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

                await batch.commit().catch(error => {
                    console.error("영토 분단 처리 실패:", error);
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'land_tiles or users', operation: 'update'}));
                });

                const ownerIsCurrentUser = originalOwnerId === currentUser.id;
                const originalOwner = allUsers.find(u => u.id === originalOwnerId);
                const ownerName = originalOwner?.nickname || '상대방';

                toast({
                    variant: ownerIsCurrentUser ? "destructive" : "default",
                    title: ownerIsCurrentUser ? "영토 분단!" : `공격 성공! (${ownerName})`,
                    description: ownerIsCurrentUser
                      ? `영토가 분단되어 타일 ${tilesToNeutralize.length}개를 잃었습니다.`
                      : `${ownerName}의 영토가 분단되어 타일 ${tilesToNeutralize.length}개를 잃었습니다.`,
                });
            }
        }
    } catch(error) {
         console.error("An error occurred in handleTerritoryCut:", error);
    }
  };


  const handleInvasionSuccess = () => {
    if (!currentUser || !firestore || !invasionTarget) return;

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

    setDoc(tileRef, tileData, { merge: true })
        .then(() => {
            if (originalOwnerId) {
                handleTerritoryCut(originalOwnerId, currentUser.id);
            }
        })
        .catch(error => {
            console.error("침략 실패:", error);
            const permissionError = new FirestorePermissionError({
                path: tileRef.path,
                operation: 'write',
                requestResourceData: tileData,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setInvasionTarget(null);
        });
  };

  const handleTileClick = (x: number, y: number) => {
    if (!currentUser || !firestore || isProcessingClick) return;

    setIsProcessingClick(true);
    const clickedTile = mapData[y][x];

    // --- Wall Building Logic ---
    if (isBuildingWall) {
      if (clickedTile.ownerId === currentUser.id && !clickedTile.hasWall) {
        const tileRef = doc(firestore, "land_tiles", clickedTile.id);
        const userRef = doc(firestore, "users", currentUser.id);
        
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


    // --- Expansion/Invasion Logic ---
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
    const userRef = doc(firestore, "users", currentUser.id);

    if (originalOwnerId === null) { // Unclaimed land
        const tileId = `${x}-${y}`;
        const tileRef = doc(firestore, "land_tiles", tileId);
        const tileData = { x, y, ownerId: currentUser.id };
        
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
    else if (originalOwnerId !== currentUser.id) { // Invasion
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

        // Decrement token immediately
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
                setIsProcessingClick(false); // Release lock if token decrement fails
            });
    } else {
        setIsProcessingClick(false); // Clicked on own tile
    }
  };
  
  const handleRestart = () => {
    if (!currentUser || !firestore) return;
  
    const userRef = doc(firestore, "users", currentUser.id);
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
    if (!currentUser || (currentUser.tokens ?? 0) <= 0 || isProcessingClick || isBuildingWall) {
      return false;
    }
    
    // 타일 소유자가 같은 국가 소속인지 확인
    const owner = tile.ownerId ? allUsers.find(u => u.id === tile.ownerId) : null;
    if (owner && owner.countryId === currentUser.countryId) {
      return false; // Cannot conquer a tile owned by a countryman
    }
    
    if (userCountryTiles.length === 0) {
      // Rule for the very first tile placement.
      if (tile.ownerId !== null || !isLand(tile.x, tile.y)) {
        return false;
      }
      
      // Check distance from all other players' tiles.
      const otherPlayersTiles = landTiles.filter(t => t.ownerId !== null && t.ownerId !== currentUser.id);
      if (otherPlayersTiles.length === 0) {
        return true; // No other players, can place anywhere.
      }

      for (const otherTile of otherPlayersTiles) {
        const distance = Math.abs(tile.x - otherTile.x) + Math.abs(tile.y - otherTile.y);
        if (distance < 5) {
          return false; // Too close to another player.
        }
      }
      
      return true; // Far enough from all other players.
    }
    
    // Check for adjacency with any tile from the same country
    return isAdjacent(tile.x, tile.y, userCountryTiles);
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
      // Invasion failed, token was already used. Just show a toast.
      toast({
        variant: 'destructive',
        title: '침략 실패!',
        description: '문제를 틀려 영토 획득에 실패했습니다.',
      });
    } else {
      // This is for getting a token, record it as wrong
      addWrongAnswer(firestore, authUser.uid, problem);
    }
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
        isBuildingWall={isBuildingWall}
        onToggleWallBuilding={handleToggleWallBuilding}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap 
            mapData={mapData} 
            users={allUsers} 
            countries={allCountries} 
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
