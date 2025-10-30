'use client';

import { useState, useMemo, useEffect } from "react";
import type { ClientTile, MathProblem, Country, User, ProblemAttempt, InvasionTarget, WrongAnswer } from "@/lib/types";
import { generateMathProblem, isAdjacent, canConquer as canConquerLogic } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useFirestore, useUser, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase } from "@/firebase";
import { doc, updateDoc, writeBatch, increment, collection, arrayUnion, runTransaction, getDocs, addDoc, query, where, documentId, getDoc, serverTimestamp } from "firebase/firestore";
import { addWrongAnswer } from "@/firebase/firestore/data";

import Header from "./header";
import WorldMap from "./world-map";
import ProblemModal from "./problem-modal";
import DemiseScreen from "./demise-screen";


interface GameBoardProps {
  currentUser: User;
  initialCountries: Country[];
  initialLandTiles: ClientTile[];
  initialProblemAttempts: ProblemAttempt[];
  initialWrongAnswers: WrongAnswer[];
  initialAllUsers: User[];
}

export default function GameBoard({ 
  currentUser: liveCurrentUser, 
  initialCountries, 
  initialLandTiles,
  initialProblemAttempts,
  initialWrongAnswers,
  initialAllUsers
}: GameBoardProps) {
  const firestore = useFirestore();
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
  const [isRestarting, setIsRestarting] = useState(false);
  
  const [currentUser, setCurrentUser] = useState(liveCurrentUser);
  const [problemAttempts, setProblemAttempts] = useState(initialProblemAttempts);

  useEffect(() => {
    setCurrentUser(liveCurrentUser);
  }, [liveCurrentUser]);


  const flatLandTiles = initialLandTiles;

  const currentUserCountry = useMemo(() => initialCountries.find(c => c.id === currentUser?.countryId), [initialCountries, currentUser]);
  
  const userCountryTiles = useMemo(() => {
    if (!currentUserCountry) return [];
    const countryMemberIds = initialAllUsers.filter(u => u.countryId === currentUserCountry.id).map(u => u.id);
    return flatLandTiles.filter(tile => tile.ownerId && countryMemberIds.includes(tile.ownerId));
  }, [flatLandTiles, currentUserCountry, initialAllUsers]);

  const isDemise = useMemo(() => {
    if (!currentUser) return false;
    const hasLand = flatLandTiles.some(tile => tile.ownerId === currentUser.id);
    return !hasLand && (currentUser.tokens ?? 0) <= 0;
  }, [flatLandTiles, currentUser]);


  useEffect(() => {
    const handleTokenPenalty = async () => {
      // Do not run penalty logic if a restart is in progress.
      if (!firestore || !currentUser || isRestarting || !currentUser.tokens || currentUser.tokens >= 0) return;

      const penalty = Math.abs(currentUser.tokens);
      toast({
          variant: "destructive",
          title: `영토 회수 페널티! (x${penalty})`,
          description: `부적절한 방법으로 확장한 영토 ${penalty}개가 회수되고 토큰이 0으로 조정됩니다.`,
      });

      const userOwnedTiles = flatLandTiles.filter(t => t.ownerId === currentUser.id);
      const tilesToRemove = userOwnedTiles.sort(() => 0.5 - Math.random()).slice(0, penalty);
      
      const batch = writeBatch(firestore);

      // Reset tiles
      tilesToRemove.forEach(tile => {
        if (tile.id) {
          const tileRef = doc(firestore, 'land_tiles', tile.id);
          batch.update(tileRef, { ownerId: null });
        }
      });
      
      // Reset user tokens
      const userRef = doc(firestore, 'users', currentUser.id);
      batch.update(userRef, { tokens: 0 });

      try {
        await batch.commit();
      } catch (error) {
        console.error("페널티 적용 실패:", error);
      }
    };
    handleTokenPenalty();
  }, [currentUser?.tokens, firestore, currentUser, flatLandTiles, toast, isRestarting]);

  // --- Event Handlers & Logic ---
  const handleSolveProblemForToken = () => {
    setIsBuildingWall(false);
    setInvasionTarget(null);
    setCurrentProblem(generateMathProblem());
    setIsModalOpen(true);
  };
  
  const handleGainToken = () => {
    if (!currentUser || !firestore || !authUser) return;
    const userRef = doc(firestore, "users", authUser.uid);
    const updateData = { tokens: increment(1) };
    updateDoc(userRef, updateData)
     .then(() => {
        // Optimistically update local state
        setCurrentUser(prev => ({ ...prev!, tokens: (prev?.tokens ?? 0) + 1 }));
      })
      .catch(error => {
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

    // Check if the original owner has any tiles left
    const remainingTiles = flatLandTiles.filter(tile => tile.ownerId === originalOwnerId).length;

    if (remainingTiles === 1 && conquerorId) { // The last tile was just conquered
      const originalOwner = initialAllUsers.find(u => u.id === originalOwnerId);
      if (!originalOwner) return;

      const conqueror = initialAllUsers.find(u => u.id === conquerorId);
      if (!conqueror || !conqueror.countryId) return;

      const conquerorCountry = initialCountries.find(c => c.id === conqueror.countryId);
      if (!conquerorCountry) return;

      const countryRef = doc(firestore, "countries", originalOwner.countryId);
      const conquerorUserRef = doc(firestore, "users", conqueror.id);
      
      try {
        await runTransaction(firestore, async (transaction) => {
          transaction.update(countryRef, { demised: true });
          transaction.update(conquerorUserRef, { conqueredCountries: arrayUnion(originalOwner.countryId) });
        });
        toast({
            title: "국가 정복!",
            description: `상대 국가의 마지막 영토를 점령하여 정복했습니다!`,
            duration: 5000,
        });
      } catch (e) {
          console.error("국가 정복 트랜잭션 실패:", e);
      }
    }
  };


  const handleInvasionSuccess = async () => {
    if (!currentUser || !firestore || !invasionTarget || !authUser) return;
  
    setIsProcessingClick(true);
    
    if (invasionTarget.id) {
        const tileRef = doc(firestore, "land_tiles", invasionTarget.id);
        const hasWall = invasionTarget.hasWall ?? false;
        const shouldBreakWall = hasWall && invasionWallBreaks > 0;
        
        const updateData = { 
            ownerId: currentUser.id, 
            hasWall: shouldBreakWall ? false : hasWall,
        };
        
        updateDoc(tileRef, updateData)
            .then(() => {
                handleTerritoryCut(invasionTarget.originalOwnerId!, currentUser.id);
            })
            .catch(error => {
                 const permissionError = new FirestorePermissionError({
                    path: tileRef.path,
                    operation: 'update',
                    requestResourceData: updateData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setInvasionTarget(null);
                setInvasionWallBreaks(0);
                setIsProcessingClick(false);
            });

    } else {
        console.error("Invasion target ID is missing.");
        setIsProcessingClick(false);
    }
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!currentUser || !firestore || isProcessingClick || !authUser) return;
    
    if ((currentUser.tokens ?? 0) <= 0 && !isBuildingWall) {
      toast({
        variant: "destructive",
        title: "토큰이 없습니다!",
        description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
      });
      return;
    }
    setIsProcessingClick(true);
  
    const clickedTile = flatLandTiles.find(t => t.x === x && t.y === y);
  
    if (isBuildingWall) {
      if (!clickedTile || clickedTile.ownerId !== currentUser.id || clickedTile.hasWall || (currentUser.walls ?? 0) <= 0) {
          toast({
            variant: "destructive",
            title: "건설 불가",
            description: "자신의 영토에만 성벽을 건설할 수 있습니다. 성벽이 이미 있거나, 보유한 성벽이 없습니다.",
          });
          setIsBuildingWall(false);
          setIsProcessingClick(false);
          return;
      }
      const tileRef = doc(firestore, "land_tiles", clickedTile.id!);
      const userRef = doc(firestore, "users", currentUser.id);
      
      const batch = writeBatch(firestore);
      batch.update(tileRef, { hasWall: true });
      batch.update(userRef, { walls: increment(-1) });

      batch.commit().then(() => {
        toast({ title: "성벽 건설 완료!", description: "영토에 성벽이 건설되었습니다." });
        setIsBuildingWall(false);
      }).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: tileRef.path,
            operation: 'update',
            requestResourceData: { hasWall: true },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "오류", description: "성벽을 건설하는 중 오류가 발생했습니다."});
      }).finally(() => {
        setIsProcessingClick(false);
      });
      return;
    }
  
    if (clickedTile) { // Conquering an existing tile
      if (clickedTile.ownerId === currentUser.id) {
        setIsProcessingClick(false); // clicked own tile
        return;
      }
      
      const owner = initialAllUsers.find(u => u.id === clickedTile.ownerId);
      if (owner && owner.countryId === currentUser.countryId) {
        toast({ variant: "destructive", title: "공격 불가", description: "같은 국가의 영토는 공격할 수 없습니다." });
        setIsProcessingClick(false);
        return;
      }
      
      // This is an invasion
      const userRef = doc(firestore, 'users', authUser.uid);
      const tokenUpdateData = { tokens: increment(-1) };
      updateDoc(userRef, tokenUpdateData)
        .then(() => {
            setCurrentUser(prev => ({ ...prev!, tokens: (prev?.tokens ?? 0) - 1 }));
            setInvasionTarget({ x, y, id: clickedTile.id, originalOwnerId: clickedTile.ownerId, hasWall: clickedTile.hasWall });
            setInvasionWallBreaks(0);
            setCurrentProblem(generateMathProblem());
            setIsModalOpen(true);
        })
        .catch((error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: tokenUpdateData }));
            toast({ variant: "destructive", title: "오류", description: "작업을 처리하는 중 오류가 발생했습니다."});
            setIsProcessingClick(false);
        });

    } else { // Conquering an empty tile
      const canPlace = canConquerLogic(
          { x, y, id: '', ownerId: null, hasWall: false },
          currentUser,
          initialAllUsers, 
          userCountryTiles,
          flatLandTiles
      );
      if (!canPlace) {
           toast({ variant: "destructive", title: "확장 불가", description: "국가 영토에 인접한 타일만 확장할 수 있습니다." });
           setIsProcessingClick(false);
           return;
      }

      const tileData = { x, y, ownerId: currentUser.id, hasWall: false };
      const userRef = doc(firestore, 'users', currentUser.id);

      try {
        await runTransaction(firestore, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists() || (userDoc.data().tokens ?? 0) <= 0) {
                throw new Error("토큰이 부족합니다.");
            }
            const newTileRef = doc(collection(firestore, 'land_tiles'));
            transaction.set(newTileRef, tileData);
            transaction.update(userRef, { tokens: increment(-1) });
        });
        // Optimistically update the user's token count on the client
        setCurrentUser(prev => ({ ...prev!, tokens: (prev?.tokens ?? 0) - 1 }));
        // IMPORTANT: We do NOT optimistically update the tile state here.
        // We wait for the `useCollection` hook to bring in the new tile from the server.
        // This prevents the race condition.
      } catch (e: any) {
          console.error("타일 클릭 트랜잭션 실패:", e);
          const permissionError = new FirestorePermissionError({
            path: `land_tiles/`, // Path is dynamic, so we just indicate collection
            operation: 'create',
            requestResourceData: tileData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({ variant: "destructive", title: "확장 오류", description: e.message || "영토를 확장하는 중 오류가 발생했습니다." });
      } finally {
        setIsProcessingClick(false);
      }
    }
  };
  
  const handleRestart = async () => {
    if (!currentUser || !firestore || !authUser) return;
    setIsRestarting(true); // Signal that a restart is in progress
    const userRef = doc(firestore, 'users', authUser.uid);
  
    const updateData = { tokens: 1 };
  
    updateDoc(userRef, updateData)
      .then(() => {
        // Optimistically update the state
        setCurrentUser(prev => ({ ...prev!, tokens: 1 }));
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: updateData }));
      })
      .finally(() => {
        // Reset the flag after a short delay to allow state to propagate
        setTimeout(() => setIsRestarting(false), 500); 
      });
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  
  const handleToggleWallBuilding = () => {
    if (!isBuildingWall && (currentUser.walls ?? 0) <= 0) {
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
    if (!currentUser || (currentUser.tokens ?? 0) <= 0 || isProcessingClick || isBuildingWall) {
      return false;
    }
    return canConquerLogic(tile, currentUser, initialAllUsers, userCountryTiles, flatLandTiles);
  };
  
  const canBuildWall = (tile: ClientTile) => {
      if (!currentUser || isProcessingClick || !isBuildingWall) return false;
      return tile.ownerId === currentUser.id && !tile.hasWall;
  }

  const handleProblemModalClose = (open: boolean) => {
    if (!open) {
      setIsProcessingClick(false);
      if (invasionTarget) {
        // If invasion was cancelled, refund the token
        if (authUser && currentUser) {
            const userRef = doc(firestore, 'users', authUser.uid);
            const refundData = { tokens: increment(1) };
            updateDoc(userRef, refundData)
              .then(() => {
                setCurrentUser(prev => ({ ...prev!, tokens: (prev?.tokens ?? 0) + 1 }));
              })
              .catch(error => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: refundData }));
              });
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
  
  const addProblemAttempt = (newAttempt: Omit<ProblemAttempt, 'id'>) => {
     if (!firestore || !authUser) return;
    const attemptData = {
      ...newAttempt,
      timestamp: serverTimestamp(),
    };
     addDoc(collection(firestore, 'problem_attempts', authUser.uid, 'attempts'), attemptData).catch(
      (error) => {
        console.error('문제 풀이 기록 오류:', error);
      }
    );
     // Optimistically update local state
     setProblemAttempts(prev => [...prev, { ...newAttempt, id: Math.random().toString(), timestamp: new Date().toISOString() }]);
  }

  if (!currentUser) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold">사용자 정보를 불러오는 중...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-grow flex-col gap-6">
      <Header 
        currentUser={currentUser} 
        onSolveProblemClick={handleSolveProblemForToken} 
        countries={initialCountries}
        problemAttempts={problemAttempts}
        users={initialAllUsers}
        wrongAnswers={initialWrongAnswers}
        isBuildingWall={isBuildingWall}
        onToggleWallBuilding={handleToggleWallBuilding}
        landTiles={flatLandTiles}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap 
            displayMapData={flatLandTiles}
            countries={initialCountries} 
            users={initialAllUsers}
            onTileClick={handleTileClick} 
            canConquer={canConquer}
            canBuildWall={canBuildWall}
            zoomLevel={zoomLevel} 
            currentUser={currentUser}
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
        isReview={false}
        reviewProblem={null}
        hasWall={invasionTarget?.hasWall}
        invasionWallBreaks={invasionWallBreaks}
        onAttempt={addProblemAttempt}
      />
      {isDemise && <DemiseScreen onRestart={handleRestart} />}
    </div>
  );
}
