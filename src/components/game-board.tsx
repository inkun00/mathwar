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
}

export default function GameBoard({ 
  currentUser: liveCurrentUser, 
  initialCountries, 
  initialLandTiles,
  initialProblemAttempts,
  initialWrongAnswers,
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
  
  const [currentUser, setCurrentUser] = useState(liveCurrentUser);
  const [problemAttempts, setProblemAttempts] = useState(initialProblemAttempts);
  
  useEffect(() => {
    setCurrentUser(liveCurrentUser);
  }, [liveCurrentUser]);

  useEffect(() => {
    setProblemAttempts(initialProblemAttempts);
  }, [initialProblemAttempts]);

  const allUsersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: allUsers, isLoading: isAllUsersLoading } = useCollection<User>(allUsersQuery);

  const flatLandTiles = initialLandTiles;

  const currentUserCountry = useMemo(() => initialCountries.find(c => c.id === currentUser?.countryId), [initialCountries, currentUser]);
  
  const userCountryTiles = useMemo(() => {
    if (!currentUser || !allUsers) return [];
    const countryMembers = allUsers.filter(u => u.countryId === currentUser.countryId);
    const memberIds = new Set(countryMembers.map(u => u.id));
    return flatLandTiles.filter(tile => tile.ownerId && memberIds.has(tile.ownerId));
  }, [flatLandTiles, allUsers, currentUser]);

  const isDemise = useMemo(() => {
    if (!currentUser) return false;
    const hasLand = flatLandTiles.some(tile => tile.ownerId === currentUser.id);
    return !hasLand && (currentUser.tokens ?? 0) <= 0;
  }, [flatLandTiles, currentUser]);


  useEffect(() => {
    const handleTokenPenalty = async () => {
      if (!firestore || !currentUser || !currentUser.tokens || currentUser.tokens >= 0) return;

      const penalty = Math.abs(currentUser.tokens);
      toast({
          variant: "destructive",
          title: `영토 회수 페널티! (x${penalty})`,
          description: `부적절한 방법으로 확장한 영토 ${penalty}개가 회수되고 토큰이 0으로 조정됩니다.`,
      });

      const userTiles = flatLandTiles.filter(t => t.ownerId === currentUser.id);
      const tilesToRemove = userTiles.sort(() => 0.5 - Math.random()).slice(0, penalty);
      
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
  }, [currentUser?.tokens, firestore, currentUser, flatLandTiles, toast]);

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
        setProblemAttempts(prev => [...prev, {
            id: Math.random().toString(),
            userId: authUser.uid,
            unit: 'decimal',
            area: 'decimal-add',
            correct: true,
            timestamp: new Date().toISOString(),
            isReview: false,
            problem: 'optimistic-update'
        }]);
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
    if (!firestore || !currentUser || !allUsers) return;

    // Check if the original owner has any tiles left
    const remainingTiles = flatLandTiles.filter(tile => tile.ownerId === originalOwnerId).length;

    if (remainingTiles === 1 && conquerorId) { // The last tile was just conquered
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
  };


  const handleInvasionSuccess = async () => {
    if (!currentUser || !firestore || !invasionTarget || !authUser) return;
  
    setIsProcessingClick(true);
    
    // TODO: Cloud Function을 호출하여 타일 소유자를 변경해야 합니다.
    // 클라이언트에서 직접 문서를 업데이트하는 것은 보안 규칙에 의해 차단됩니다.
    
    // 예시: 
    // const conquerTile = httpsCallable(functions, 'conquerTile');
    // await conquerTile({ tileId: invasionTarget.id, breaksWall: invasionWallBreaks > 0 });

    toast({
        title: "기능 비활성화됨",
        description: "Cloud Function으로의 마이그레이션이 필요합니다.",
        variant: "destructive"
    });

    setInvasionTarget(null);
    setIsProcessingClick(false);
  };

  const handleTileClick = async (x: number, y: number) => {
    if (!currentUser || !firestore || isProcessingClick || !allUsers || !authUser) return;
    const userRef = doc(firestore, 'users', authUser.uid);
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
      
      // TODO: Cloud Function을 호출하여 성벽을 건설해야 합니다.
      toast({
          title: "기능 비활성화됨",
          description: "Cloud Function으로의 마이그레이션이 필요합니다.",
          variant: "destructive"
      });
      setIsBuildingWall(false);
      setIsProcessingClick(false);
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
    
    if (clickedTile) { // Conquering an existing tile
      if (clickedTile.ownerId !== currentUser.id) {
        const owner = allUsers.find(u => u.id === clickedTile.ownerId);
        if (owner && owner.countryId === currentUser.countryId) {
          toast({
            title: "공격 불가",
            description: "같은 국가 소속의 플레이어는 공격할 수 없습니다.",
          });
          setIsProcessingClick(false);
        } else {
          // This is an invasion
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
        }
      } else {
          setIsProcessingClick(false); // clicked own tile
      }
    } else { // Conquering an empty tile
      const canPlace = canConquerLogic(
          { x, y, ownerId: null, hasWall: false },
          currentUser,
          allUsers,
          userCountryTiles,
          flatLandTiles
      );
      if (!canPlace) {
           toast({ variant: "destructive", title: "확장 불가", description: "국가 영토에 인접한 타일만 확장할 수 있습니다." });
           setIsProcessingClick(false);
           return;
      }

      // TODO: Cloud Function을 호출하여 타일을 생성하고 토큰을 차감해야 합니다.
      // 클라이언트에서 직접 트랜잭션을 실행하는 것은 보안 규칙에 의해 차단됩니다.

      // 예시: 
      // const expandTerritory = httpsCallable(functions, 'expandTerritory');
      // await expandTerritory({ x, y });

      toast({
          title: "기능 비활성화됨",
          description: "Cloud Function으로의 마이그레이션이 필요합니다.",
          variant: "destructive"
      });

      setIsProcessingClick(false);
    }
  };
  
  const handleRestart = () => {
    if (!currentUser || !firestore || !authUser) return;
    const userRef = doc(firestore, 'users', authUser.uid);
  
    const updateData = { tokens: 1 };
  
    updateDoc(userRef, updateData)
      .then(() => {
        setCurrentUser(prev => ({ ...prev!, tokens: 1 }));
      })
      .catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: updateData }));
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
    if (!currentUser || !allUsers || (currentUser.tokens ?? 0) <= 0 || isProcessingClick || isBuildingWall) {
      return false;
    }
    return canConquerLogic(tile, currentUser, allUsers, userCountryTiles, flatLandTiles);
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

  if (!currentUser || isAllUsersLoading) {
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
        users={allUsers ?? []}
        wrongAnswers={initialWrongAnswers}
        isBuildingWall={isBuildingWall}
        onToggleWallBuilding={handleToggleWallBuilding}
        landTiles={flatLandTiles}
      />
      <div className="relative h-full w-full max-w-7xl flex-grow">
        <WorldMap 
            displayMapData={flatLandTiles}
            users={allUsers ?? []} 
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
