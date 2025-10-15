import type { MapData, User, Tile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WorldMapProps {
  mapData: MapData;
  users: User[];
  onTileClick: (x: number, y: number) => void;
  canConquer: (tile: Tile) => boolean;
  zoomLevel: number;
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
    "aspect-square transition-all duration-300 ease-in-out",
    ownerColor ? "shadow-inner" : "bg-muted/50",
    isConquerable && "cursor-pointer ring-2 ring-offset-2 ring-offset-background ring-primary scale-110 z-10 hover:brightness-110",
    !ownerColor && isConquerable && "bg-primary/20",
  );

  return (
    <div 
      className="relative flex items-center justify-center p-px"
      onClick={isConquerable ? onClick : undefined}
      aria-label={`타일 ${tile.x}, ${tile.y}. ${ownerColor ? `플레이어 소유.` : '주인 없음.'} ${isConquerable ? '정복하려면 클릭하세요.' : ''}`}
    >
      <div
        className={tileClasses}
        style={{ backgroundColor: ownerColor ?? undefined }}
      />
    </div>
  );
};


export default function WorldMap({ mapData, users, onTileClick, canConquer, zoomLevel }: WorldMapProps) {
  const userColorMap = new Map(users.map(u => [u.id, u.color]));

  return (
    <div className="w-full max-w-7xl rounded-lg border bg-card/80 p-2 shadow-inner backdrop-blur-sm md:p-4 overflow-auto">
      <div 
        className="grid touch-none select-none gap-0 transition-transform duration-300 ease-in-out"
        style={{
          gridTemplateColumns: `repeat(${mapData[0].length}, minmax(0, 1fr))`,
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
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
