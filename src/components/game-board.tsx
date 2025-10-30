'use client';

import { useState, useMemo, useEffect } from "react";
import type { ClientTile, MathProblem, Country, User, ProblemAttempt, InvasionTarget, WrongAnswer, MapAggregate } from "@/lib/types";
import { generateMathProblem, isAdjacent, canConquer as canConquerLogic } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, updateDoc, writeBatch, increment, collection, arrayUnion, runTransaction, getDocs, addDoc, query, where, documentId, getDoc } from "firebase/firestore";
import { addWrongAnswer } from "@/firebase/firestore/data";

import Header from "./header";
import WorldMap from "./world-map";
import ProblemModal from "./problem-modal";
import DemiseScreen from "./demise-screen";
import { Skeleton } from "./ui/skeleton";
import { MAP_WIDTH, MAP_HEIGHT } from "@/lib/world-map-shape";
import { functions } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";


const UID_LENGTH = 32;
const EMPTY_TILE_UID = '_'.repeat(UID_LENGTH);

const constructMapFromAggregate = (gameMap: MapAggregate): ClientTile[][] => {
    const map: ClientTile[][] = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(null));
    const mapData = gameMap.mapData || '';

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const i = y * MAP_WIDTH + x;
            const start = i * UID_LENGTH;
            const end = start + UID_LENGTH;
            let ownerId: string | null = mapData.substring(start, end);

            if (ownerId === EMPTY_TILE_UID || ownerId.trim() === '') {
                ownerId = null;
            }
            
            // For now, walls are not in the aggregate, so we default to false.
            // This would need to be added to the aggregate model if walls are persisted.
            map[y][x] = { x, y, ownerId, hasWall: false };
        }
    }
    return map;
};

interface GameBoardProps {
  currentUser: User;
  initialCountries: Country[];
  initialAllUsers: User[];
  initialGameMap: MapAggregate;
  initialProblemAttempts: ProblemAttempt[];
  initialWrongAnswers: WrongAnswer[];
}

export default function GameBoard({ 
  currentUser, 
  initialCountries, 
  initialAllUsers, 
  initialGameMap,
  initialProblemAttempts,
  initialWrongAnswers,
}: GameBoardProps) {
  const firestore = useFirestore();
  const functions = getFunctions();
  const { user: authUser } = useUser();
  const { toast } = useToast();
  
  // --- Component State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [invasionTarget, setInvasionTarget] = useState<InvasionTarget>(null);
  const [invasionWallBreaks, setInvasionWallBreaks] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [isBuildingWall, setIsBuildingWall] = useState(false);

  // --- Memoized Derived State ---
  // The map data is now derived from the single aggregate document.
  const displayMapData = useMemo(() => constructMapFromAggregate(initialGameMap), [initialGameMap]);
  const flatLandTiles = useMemo(() => displayMapData.flat(), [displayMapData]);

  const liveCurrentUser = useMemo(() => initialAllUsers.find(u => u.id === currentUser.id) || currentUser, [initialAllUsers, currentUser]);
  const currentUserCountry = useMemo(() => initialCountries.find(c => c.id === liveCurrentUser?.countryId), [initialCountries, liveCurrentUser]);
  
  const userCountryTiles = useMemo(() => {
    if (!liveCurrentUser || !initialAllUsers) return [];
    const countryMembers = initialAllUsers.filter(u => u.countryId === liveCurrentUser.countryId);
    const memberIds = new Set(countryMembers.map(u => u.id));
    return flatLandTiles.filter(tile => tile.ownerId && memberIds.has(tile.ownerId));
  }, [flatLandTiles, initialAllUsers, liveCurrentUser]);
  
  const isDemise = useMemo(() => {
    if (!liveCurrentUser) return false;
    const hasLand = flatLandTiles.some(tile => tile.ownerId === liveCurrentUser.id);
    return !hasLand && (liveCurrentUser.tokens ?? 0) <= 0;
  }, [flatLandTiles, liveCurrentUser]);


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
    // This function needs to be adapted to the new aggregate model.
    // For now, we will disable its more complex parts as they rely on individual tile documents.
    // The core logic of checking for demise can remain.
    if (!firestore || !liveCurrentUser || !initialAllUsers) return;

    // Check if the original owner has any tiles left
    const remainingTiles = flatLandTiles.filter(tile => tile.ownerId === originalOwnerId).length;

    if (remainingTiles === 0 && conquerorId) {
      const originalOwnerUser = initialAllUsers.find(u => u.id === originalOwnerId);
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
  };


  const handleInvasionSuccess = async () => {
    if (!liveCurrentUser || !firestore || !invasionTarget || !authUser) return;
    
    // Instead of updating the tile doc, we call a Cloud Function
    const updateTileOwner = httpsCallable(functions, 'updateTileOwner');

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
        await updateTileOwner({ 
            x: invasionTarget.x, 
            y: invasionTarget.y, 
            newOwnerId: liveCurrentUser.id 
        });

        if (originalOwnerId) {
            // After a successful invasion, we might need to re-evaluate territories.
            // For now, we'll keep this simple. A full implementation might need a cloud function
            // to recalculate separated territories.
            await handleTerritoryCut(originalOwnerId, liveCurrentUser.id);
        }
        
    } catch (error) {
        console.error("침략 업데이트 실패:", error);
        toast({ variant: "destructive", title: "오류", description: "영토를 점령하는 중 오류가 발생했습니다."});
    } finally {
        setInvasionTarget(null);
    }
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!liveCurrentUser || !firestore || isProcessingClick || !initialAllUsers || !authUser) return;
    const userRef = doc(firestore, 'users', authUser.uid);
    setIsProcessingClick(true);
  
    const clickedTile = flatLandTiles.find(t => t.x === x && t.y === y);
    const updateTileOwner = httpsCallable(functions, 'updateTileOwner');
  
    try {
      if (isBuildingWall) {
        // Wall building logic would also need a cloud function to update the wall state,
        // which is not part of the current aggregate model. Disabling for now.
        toast({
          variant: "destructive",
          title: "건설 불가",
          description: "성벽 건설 기능은 현재 지원되지 않습니다.",
        });
        setIsBuildingWall(false);
        setIsProcessingClick(false);
        return;
      }
  
      if ((liveCurrentUser.tokens ?? 0) <= 0) {
        toast({
          variant: "destructive",
          title: "토큰이 없습니다!",
          description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
        });
        setIsProcessingClick(false);
        return;
      }
      
      if (clickedTile && clickedTile.ownerId) {
        // Invade another player's tile or do nothing if it's ours
        if (clickedTile.ownerId !== liveCurrentUser.id) {
          const owner = initialAllUsers.find(u => u.id === clickedTile.ownerId);
          if (owner && owner.countryId === liveCurrentUser.countryId) {
            toast({
              title: "공격 불가",
              description: "같은 국가 소속의 플레이어는 공격할 수 없습니다.",
            });
          } else {
            // This is an invasion
            await updateDoc(userRef, { tokens: increment(-1) });
            setInvasionTarget({ x, y, id: clickedTile.id, originalOwnerId: clickedTile.ownerId, hasWall: clickedTile.hasWall });
            setInvasionWallBreaks(0);
setCurrentProblem(generateMathProblem());
            setIsModalOpen(true);
          }
        }
        // If tile owner is current user, do nothing.
      } else {
        // Conquer empty tile
        await runTransaction(firestore, async (transaction) => {
          transaction.update(userRef, { tokens: increment(-1) });
        });
        
        await updateTileOwner({ x, y, newOwnerId: liveCurrentUser.id });
  
        toast({ title: "영토 확장!", description: "새로운 땅을 정복했습니다." });
      }
    } catch (error) {
      console.error("타일 클릭 트랜잭션 실패:", error);
      toast({ variant: "destructive", title: "오류", description: "작업을 처리하는 중 오류가 발생했습니다."});
      if (invasionTarget) {
        updateDoc(userRef, { tokens: increment(1) });
        setInvasionTarget(null);
      }
    } finally {
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
    if (!liveCurrentUser || !initialAllUsers || (liveCurrentUser.tokens ?? 0) <= 0 || isProcessingClick || isBuildingWall) {
      return false;
    }
    // With the aggregate model, we use the derived `userCountryTiles` and `flatLandTiles`.
    return canConquerLogic(tile, liveCurrentUser, initialAllUsers, userCountryTiles, flatLandTiles);
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


  return (
    <div className="flex w-full flex-grow flex-col gap-6">
      <Header 
        currentUser={liveCurrentUser} 
        onSolveProblemClick={handleSolveProblemForToken} 
        countries={initialCountries}
        problemAttempts={initialProblemAttempts}
        users={initialAllUsers}
        wrongAnswers={initialWrongAnswers}
        isBuildingWall={isBuildingWall}
        onToggleWallBuilding={handleToggleWallBuilding}
        landTiles={flatLandTiles}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap 
            displayMapData={displayMapData} 
            users={initialAllUsers} 
            countries={initialCountries} 
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
