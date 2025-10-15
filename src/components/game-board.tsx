'use client';

import { useState, useMemo } from "react";
import type { GameData, Tile, DecimalProblem } from "@/lib/types";
import { awardToken, conquerTile, restartPlayer } from "@/lib/data";
import { generateDecimalProblem, isAdjacent } from "@/lib/game-logic";
import { useToast } from "@/hooks/use-toast";

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

  const { users, mapData, currentPlayerId } = gameState;
  const currentUser = useMemo(() => users.find(u => u.id === currentPlayerId)!, [users, currentPlayerId]);

  const userTiles = useMemo(() => 
    mapData.flat().filter(tile => tile.ownerId === currentUser.id),
    [mapData, currentUser.id]
  );
  
  const isDemise = userTiles.length === 0;

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
        title: "No Tokens!",
        description: "Solve a problem to earn more expansion tokens.",
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
        title: "A Fresh Start!",
        description: "Your conquest begins again.",
      });
  }

  const canConquer = (tile: Tile) => {
    if (tile.ownerId === currentUser.id || currentUser.tokens <= 0) {
      return false;
    }
    return isAdjacent(tile.x, tile.y, userTiles);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Header currentUser={currentUser} onSolveProblemClick={handleSolveProblemClick} />
      <WorldMap mapData={mapData} users={users} onTileClick={handleTileClick} canConquer={canConquer} />
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
