import GameBoard from "@/components/game-board";
import { getGameData } from "@/lib/data";

export default function Home() {
  const initialData = getGameData();
  
  return (
    <div className="relative flex h-screen w-full flex-col items-center bg-background p-4 sm:p-6 md:p-8">
      <GameBoard initialData={initialData} />
    </div>
  );
}
