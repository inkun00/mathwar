'use client';

import { useState, useMemo, useEffect } from "react";
import type { GameData, Tile, DecimalProblem, User } from "@/lib/types";
import { awardToken, conquerTile, restartPlayer } from "@/lib/data";
import { generateDecimalProblem, isAdjacent, getAIMove } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";

import Header from "./header";
import WorldMap from "./world-map";
import ProblemModal from "./problem-modal";
import DemiseScreen from "./demise-screen";

interface GameBoardProps {
  initialData: GameData;
}

export default function GameBoard({ initialData }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameData>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<DecimalProblem | null>(null);
  const { toast } = useToast();
  const [zoomLevel, setZoomLevel] = useState(1);

  const { users, mapData, currentPlayerId } = gameState;
  const currentUser = useMemo(() => users.find(u => u.id === currentPlayerId)!, [users, currentPlayerId]);

  const userTiles = useMemo(() => 
    mapData.flat().filter(tile => tile.ownerId === currentUser.id),
    [mapData, currentUser.id]
  );
  
  const isDemise = userTiles.length === 0 && users.some(u => u.id === currentUser.id);

  useEffect(() => {
    const gameLoop = setInterval(() => {
      // AI players' turn
      const aiUsers = users.filter(u => u.id !== currentUser.id);
      aiUsers.forEach(ai => {
        const allAiTiles = mapData.flat().filter(t => t.ownerId === ai.id);
        if (allAiTiles.length === 0) return; // Skip if AI has no tiles

        const move = getAIMove(ai, mapData);
        if (move) {
          // AI conquers a tile
          const newState = conquerTile(ai.id, move.x, move.y);
          
          // Simple AI logic: also award tokens periodically to keep them competitive
          if (Math.random() < 0.1) {
            awardToken(ai.id);
          }
          
          setGameState(newState);
        }
      });
    }, 2000); // AI acts every 2 seconds

    return () => clearInterval(gameLoop);
  }, [users, mapData, currentUser.id]);


  const handleSolveProblemClick = () => {
    setCurrentProblem(generateDecimalProblem());
    setIsModalOpen(true);
  };

  const handleCorrectAnswer = () => {
    const newState = awardToken(currentUser.id);
    setGameState(newState);
  };

  const handleTileClick = (x: number, y: number) => {
    if (currentUser.tokens <= 0) {
      toast({
        variant: "destructive",
        title: "토큰이 없습니다!",
        description: "문제를 풀어 더 많은 확장 토큰을 획득하세요.",
      });
      return;
    }
    const newState = conquerTile(currentUser.id, x, y);
    setGameState(newState);
  };
  
  const handleRestart = () => {
    const newState = restartPlayer(currentUser.id);
    setGameState(newState);
    toast({
        title: "새로운 시작!",
        description: "정복이 다시 시작됩니다.",
      });
  }

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));

  const canConquer = (tile: Tile) => {
    if (tile.ownerId === currentUser.id || currentUser.tokens <= 0) {
      return false;
    }
    const playerTiles = mapData.flat().filter(t => t.ownerId === currentUser.id);
    if (playerTiles.length === 0) return false;
    return isAdjacent(tile.x, tile.y, playerTiles);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Header currentUser={currentUser} onSolveProblemClick={handleSolveProblemClick} />
      <div className="relative w-full max-w-7xl">
        <WorldMap mapData={mapData} users={users} onTileClick={handleTileClick} canConquer={canConquer} zoomLevel={zoomLevel} />
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
      />
      {isDemise && <DemiseScreen onRestart={handleRestart} />}
    </div>
  );
}
