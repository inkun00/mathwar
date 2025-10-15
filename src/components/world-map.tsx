import type { MapData, User, Tile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WorldMapProps {
  mapData: MapData;
  users: User[];
  onTileClick: (x: number, y: number) => void;
  canConquer: (tile: Tile) => boolean;
}

const TileComponent = ({ 
  tile, 
  ownerColor, 
  onClick,
  isConquerable
}: {
  tile: Tile;
  ownerColor: string | null;
  onClick: () => void;
  isConquerable: boolean;
}) => {
  const tileClasses = cn(
    "aspect-square rounded-[2px] transition-all duration-300 ease-in-out",
    ownerColor ? "shadow-inner" : "bg-muted/50",
    isConquerable && "cursor-pointer ring-2 ring-offset-2 ring-offset-background ring-primary scale-110 z-10 hover:brightness-110",
    !ownerColor && isConquerable && "bg-primary/20",
  );

  return (
    <div 
      className="relative flex items-center justify-center"
      onClick={isConquerable ? onClick : undefined}
      aria-label={`Tile at ${tile.x}, ${tile.y}. ${ownerColor ? `Owned by a player.` : 'Unclaimed.'} ${isConquerable ? 'Click to conquer.' : ''}`}
    >
      <div
        className={tileClasses}
        style={{ backgroundColor: ownerColor ?? undefined }}
      />
    </div>
  );
};


export default function WorldMap({ mapData, users, onTileClick, canConquer }: WorldMapProps) {
  const userColorMap = new Map(users.map(u => [u.id, u.color]));

  return (
    <div className="w-full max-w-7xl rounded-lg border bg-card/80 p-2 shadow-inner backdrop-blur-sm md:p-4">
      <div 
        className="grid touch-none select-none gap-1"
        style={{
          gridTemplateColumns: `repeat(${mapData[0].length}, minmax(0, 1fr))`,
        }}
      >
        {mapData.flat().map((tile) => (
          <TileComponent
            key={`${tile.x}-${tile.y}`}
            tile={tile}
            ownerColor={tile.ownerId ? userColorMap.get(tile.ownerId) ?? null : null}
            onClick={() => onTileClick(tile.x, tile.y)}
            isConquerable={canConquer(tile)}
          />
        ))}
      </div>
    </div>
  );
}
