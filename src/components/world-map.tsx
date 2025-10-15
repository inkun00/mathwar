import type { MapData, User, Tile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isLand } from "@/lib/world-map-shape";

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
  const isLandTile = isLand(tile.x, tile.y);

  const tileClasses = cn(
    "aspect-square transition-all duration-300 ease-in-out border border-border/10",
    {
      // Land
      'bg-[#f0e6d2]': isLandTile && !ownerColor,
      'hover:bg-[#e6dac8]': isLandTile && !ownerColor && isConquerable,
      // Water
      'bg-[#aadaff]': !isLandTile && !ownerColor,
    },
    { 'shadow-inner': ownerColor },
    isConquerable && "cursor-pointer ring-2 ring-offset-1 ring-offset-background ring-primary/70 z-10 hover:brightness-110",
  );

  return (
    <div 
      className="relative flex items-center justify-center"
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
    <div className="h-full w-full max-w-7xl overflow-auto rounded-lg border bg-card/80 p-2 shadow-inner backdrop-blur-sm md:p-4">
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
