'use client';

import { useState, useMemo, useEffect } from "react";
import type { ClientTile, MathProblem, Country, User, ProblemAttempt, InvasionTarget, WrongAnswer } from "@/lib/types";
import { generateMathProblem, isAdjacent, canConquer as canConquerLogic } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase } from "@/firebase";
import { doc, updateDoc, writeBatch, increment, collection, arrayUnion, runTransaction, serverTimestamp, getDocs, addDoc, query, where, documentId, getDoc } from "firebase/firestore";
import { addWrongAnswer } from "@/firebase/firestore/data";

import Header from "./header";
import WorldMap from "./world-map";
import ProblemModal from "./problem-modal";
import DemiseScreen from "./demise-screen";
import { Skeleton } from "./ui/skeleton";
import { MAP_WIDTH, MAP_HEIGHT } from "@/lib/world-map-shape";


// Helper to construct the client-side 2D map array from the flat list of tile documents
const constructMapFromTiles = (tiles: ClientTile[]): ClientTile[][] => {
  const map: ClientTile[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (__, x) => ({
      x, y, ownerId: null, hasWall: false,
    }))
  );

  for (const tile of tiles) {
    if (tile.y >= 0 && tile.y < MAP_HEIGHT && tile.x >= 0 && tile.x < MAP_WIDTH) {
      map[tile.y][tile.x] = tile;
    }
  }
  return map;
};

interface GameBoardProps {
  currentUser: User;
  initialCountries: Country[];
  initialAllUsers: User[];
  initialLandTiles: ClientTile[];
  initialProblemAttempts: ProblemAttempt[];
  initialWrongAnswers: WrongAnswer[];
}

export default function GameBoard({ 
  currentUser, 
  initialCountries, 
  initialAllUsers, 
  initialLandTiles,
  initialProblemAttempts,
  initialWrongAnswers,
}: GameBoardProps) {
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const { toast } = useToast();
  
  // --- Real-time data hooks ---
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const countriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'countries') : null, [firestore]);
  const landTilesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'land_tiles') : null, [firestore]);
  const wrongAnswersQuery = useMemoFirebase(() => authUser ? collection(firestore, 'users', authUser.uid, 'wrong_answers') : null, [authUser, firestore]);
  const attemptsQuery = useMemoFirebase(() => authUser ? collection(firestore, 'problem_attempts', authUser.uid, 'attempts') : null, [authUser, firestore]);

  const { data: liveAllUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);
  const { data: liveCountries, isLoading: countriesLoading } = useCollection<Country>(countriesQuery);
  const { data: liveLandTiles, isLoading: landTilesLoading } = useCollection<ClientTile>(landTilesQuery);
  const { data: liveWrongAnswers, isLoading: wrongAnswersLoading } = useCollection<WrongAnswer>(wrongAnswersQuery);
  const { data: liveProblemAttempts, isLoading: attemptsLoading } = useCollection<ProblemAttempt>(attemptsQuery);


  const liveCurrentUser = useMemo(() => liveAllUsers?.find(u => u.id === currentUser.id) || currentUser, [liveAllUsers, currentUser]);

  const problemAttempts = useMemo(() => liveProblemAttempts ?? initialProblemAttempts, [liveProblemAttempts, initialProblemAttempts]);
  const wrongAnswers = useMemo(() => liveWrongAnswers ?? initialWrongAnswers, [liveWrongAnswers, initialWrongAnswers]);
  
  // --- Component State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [invasionTarget, setInvasionTarget] = useState<InvasionTarget>(null);
  const [invasionWallBreaks, setInvasionWallBreaks] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [isBuildingWall, setIsBuildingWall] = useState(false);

  // --- Memoized Derived State ---
  const displayMapData = useMemo(() => constructMapFromTiles(liveLandTiles ?? initialLandTiles), [liveLandTiles, initialLandTiles]);
  const currentUserCountry = useMemo(() => (liveCountries ?? initialCountries).find(c => c.id === liveCurrentUser?.countryId), [liveCountries, initialCountries, liveCurrentUser]);
  
  const allUsers = useMemo(() => liveAllUsers ?? initialAllUsers, [liveAllUsers, initialAllUsers]);

  const userCountryTiles = useMemo(() => {
    if (!liveCurrentUser || !allUsers) return [];
    const countryMembers = allUsers.filter(u => u.countryId === liveCurrentUser.countryId);
    const memberIds = new Set(countryMembers.map(u => u.id));
    return (liveLandTiles ?? initialLandTiles).filter(tile => tile.ownerId && memberIds.has(tile.ownerId));
  }, [liveLandTiles, initialLandTiles, allUsers, liveCurrentUser]);
  
  const isDemise = useMemo(() => {
    if (!liveCurrentUser) return false;
    const hasLand = (liveLandTiles ?? initialLandTiles).some(tile => tile.ownerId === liveCurrentUser.id);
    return !hasLand && (liveCurrentUser.tokens ?? 0) <= 0;
  }, [liveLandTiles, initialLandTiles, liveCurrentUser]);

  // --- Negative Token Penalty Logic ---
  useEffect(() => {
    if (!liveCurrentUser || !firestore || (liveCurrentUser.tokens ?? 0) >= 0) {
      return;
    }

    const handleNegativeTokens = async () => {
      const negativeTokens = Math.abs(liveCurrentUser.tokens);
      const userTiles = (liveLandTiles ?? initialLandTiles).filter(tile => tile.ownerId === liveCurrentUser.id);

      if (userTiles.length === 0) {
        // No tiles to remove, just reset tokens
        const userRef = doc(firestore, 'users', liveCurrentUser.id);
        await updateDoc(userRef, { tokens: 0 });
        return;
      }
      
      const tilesToRemoveCount = Math.min(negativeTokens, userTiles.length);
      if (tilesToRemoveCount === 0) return;

      // Select random tiles to remove
      const shuffledTiles = userTiles.sort(() => 0.5 - Math.random());
      const tilesToRemove = shuffledTiles.slice(0, tilesToRemoveCount);

      try {
        const batch = writeBatch(firestore);
        
        // Neutralize tiles
        tilesToRemove.forEach(tile => {
          const tileRef = doc(firestore, 'land_tiles', tile.id!);
          batch.update(tileRef, { ownerId: null, hasWall: false });
        });

        // Reset user tokens
        const userRef = doc(firestore, 'users', liveCurrentUser.id);
        batch.update(userRef, { tokens: 0 });

        await batch.commit();

        toast({
          variant: "destructive",
          title: "무리한 확장!",
          description: `토큰 부족으로 영토 ${tilesToRemoveCount}개를 잃었습니다.`,
        });

      } catch (error) {
        console.error("영토 페널티 처리 실패:", error);
        toast({
          variant: "destructive",
          title: "오류",
          description: "페널티를 처리하는 중 오류가 발생했습니다.",
        });
      }
    };

    handleNegativeTokens();

  }, [liveCurrentUser, firestore, liveLandTiles, initialLandTiles, toast]);


  // --- Event Handlers & Logic ---
  const handleSolveProblemForToken = () => {
    setIsBuildingWall(false);
    setInvasionTarget(null);
    setCurrentProblem(generateMathProblem());
    setIsModalOpen(true);
  };
  
  const handleGainToken = () => {
    if (!liveCurrentUser || !firestore || !authUser) return;
    const userRef = doc(firestore, "users", authUser.uid);
    const updateData = { tokens: increment(1) };
    updateDoc(userRef, updateData)
      .catch(error => {
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
    if (!firestore || !liveCurrentUser || !allUsers || !liveLandTiles) return;
  
    try {
        const ownedTiles = liveLandTiles.filter(tile => tile.ownerId === originalOwnerId);
  
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
        return; // No tiles to neutralize
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
          const batch = writeBatch(firestore);
          tilesToNeutralize.forEach(tile => {
            const tileRef = doc(firestore, 'land_tiles', tile.id!);
            batch.update(tileRef, { ownerId: null, hasWall: false });
          });
          await batch.commit();

          const ownerIsCurrentUser = originalOwnerId === liveCurrentUser.id;
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
    if (!liveCurrentUser || !firestore || !invasionTarget || !authUser) return;
    const userRef = doc(firestore, 'users', authUser.uid);
    const tileRef = doc(firestore, 'land_tiles', invasionTarget.id!);

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
        const updateData = {
          ownerId: liveCurrentUser.id,
          hasWall: false, // Wall is always destroyed on capture
        };
        await updateDoc(tileRef, updateData);

        if (originalOwnerId) {
            await handleTerritoryCut(originalOwnerId, liveCurrentUser.id);
        }
        
    } catch (error) {
        console.error("침략 업데이트 실패:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: tileRef.path, operation: 'update', requestResourceData: { ownerId: liveCurrentUser.id } }));
        toast({ variant: "destructive", title: "오류", description: "영토를 점령하는 중 오류가 발생했습니다."});
    } finally {
        setInvasionTarget(null);
    }
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!liveCurrentUser || !firestore || isProcessingClick || !allUsers || !authUser) return;
    const userRef = doc(firestore, 'users', authUser.uid);

    setIsProcessingClick(true);
    const clickedTile = (liveLandTiles ?? initialLandTiles).find(t => t.x === x && t.y === y);

    try {
      if (isBuildingWall) {
        if (clickedTile && clickedTile.ownerId === liveCurrentUser.id && !clickedTile.hasWall) {
          const tileRef = doc(firestore, 'land_tiles', clickedTile.id!);
          
          await runTransaction(firestore, async (transaction) => {
            transaction.update(tileRef, { hasWall: true });
            transaction.update(userRef, { walls: increment(-1) });
          });

          toast({ title: "성벽 건설!", description: "영토에 성벽을 성공적으로 건설했습니다." });
          setIsBuildingWall(false);

        } else {
          toast({
              variant: "destructive",
              title: "건설 불가",
              description: !clickedTile || clickedTile.ownerId !== liveCurrentUser.id 
                  ? "자신의 영토에만 성벽을 건설할 수 있습니다." 
                  : "이미 성벽이 건설된 곳입니다.",
          });
        }
        setIsProcessingClick(false);
        return; // Exit after handling wall building
      }

      // Not building a wall, proceed with conquest
      if ((liveCurrentUser.tokens ?? 0) <= 0) {
        toast({
          variant: "destructive",
          title: "토큰이 없습니다!",
          description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
        });
        setIsProcessingClick(false);
        return;
      }
      
      const originalOwnerId = clickedTile?.ownerId || null;

      if (!clickedTile) {
          // Conquer empty tile
          const tileData = { x, y, ownerId: liveCurrentUser.id, hasWall: false };

          await runTransaction(firestore, async (transaction) => {
             const newTileRef = doc(collection(firestore, "land_tiles"));
             transaction.set(newTileRef, tileData);
             transaction.update(userRef, { tokens: increment(-1) });
          });
          
          toast({ title: "영토 확장!", description: "새로운 땅을 정복했습니다." });

      } else if (originalOwnerId !== liveCurrentUser.id) {
          // Invade another player's tile
          const owner = allUsers.find(u => u.id === originalOwnerId);
          if (owner && owner.countryId === liveCurrentUser.countryId) {
              toast({
                  variant: "default",
                  title: "공격 불가",
                  description: "같은 국가 소속의 플레이어는 공격할 수 없습니다.",
              });
              setIsProcessingClick(false);
              return;
          }

          // Decrease token first, then open modal
          await updateDoc(userRef, { tokens: increment(-1) });
          setInvasionTarget({ x, y, id: clickedTile.id, originalOwnerId: originalOwnerId!, hasWall: clickedTile.hasWall });
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
        // isModalOpen will set this to false, otherwise if no modal, set it now.
        if (!isModalOpen) {
          setIsProcessingClick(false);
        }
    }
  };
  
  const handleRestart = () => {
    if (!liveCurrentUser || !firestore || !authUser) return;
    const userRef = doc(firestore, 'users', authUser.uid);
  
    const updateData = { tokens: 1 };
  
    updateDoc(userRef, updateData)
      .catch(error => {
        console.error("재시작 실패:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: updateData }));
      });
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  
  const handleToggleWallBuilding = () => {
    if (!isBuildingWall && (liveCurrentUser.walls ?? 0) <= 0) {
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
    if (!liveCurrentUser || !allUsers || (liveCurrentUser.tokens ?? 0) <= 0 || isProcessingClick || isBuildingWall) {
      return false;
    }
    return canConquerLogic(tile, liveCurrentUser, allUsers, userCountryTiles, (liveLandTiles ?? initialLandTiles));
  };
  
  const canBuildWall = (tile: ClientTile) => {
      if (!liveCurrentUser || isProcessingClick || !isBuildingWall) return false;
      return tile.ownerId === liveCurrentUser.id && !tile.hasWall;
  }

  const handleProblemModalClose = (open: boolean) => {
    if (!open) {
      setIsProcessingClick(false);
      if (invasionTarget) {
        // If invasion was cancelled, refund the token
        if (authUser) {
            const userRef = doc(firestore, 'users', authUser.uid);
            updateDoc(userRef, { tokens: increment(1) });
        }
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
  
  const isLoading = usersLoading || countriesLoading || landTilesLoading || wrongAnswersLoading || attemptsLoading;

  if (isLoading) {
     return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Skeleton className="h-[80vh] w-[90vw] max-w-7xl" />
      </div>
    );
  }


  return (
    <div className="flex w-full flex-grow flex-col gap-6">
      <Header 
        currentUser={liveCurrentUser} 
        onSolveProblemClick={handleSolveProblemForToken} 
        countries={liveCountries ?? initialCountries}
        problemAttempts={problemAttempts}
        users={allUsers}
        wrongAnswers={wrongAnswers}
        isBuildingWall={isBuildingWall}
        onToggleWallBuilding={handleToggleWallBuilding}
        landTiles={liveLandTiles ?? initialLandTiles}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap 
            displayMapData={displayMapData} 
            users={allUsers} 
            countries={liveCountries ?? initialCountries} 
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
