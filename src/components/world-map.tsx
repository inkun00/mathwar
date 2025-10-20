'use client';
import type { MapData, User, Tile, Country } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isLand } from "@/lib/world-map-shape";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React from "react";

interface WorldMapProps {
  mapData: MapData;
  users: User[];
  countries: Country[];
  onTileClick: (x: number, y: number) => void;
  canConquer: (tile: Tile) => boolean;
  zoomLevel: number;
}

const TileComponent = React.memo(({ 
  tile, 
  ownerColor, 
  onClick,
  isConquerable,
  tooltipContent
}: {
  tile: Tile;
  ownerColor: string | null;
  onClick: () => void;
  isConquerable: boolean;
  tooltipContent: React.ReactNode;
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

  const tileElement = (
     <div
      className={tileClasses}
      style={{ backgroundColor: ownerColor ?? undefined }}
      onClick={isConquerable ? onClick : undefined}
      aria-label={`타일 ${tile.x}, ${tile.y}. ${ownerColor ? `플레이어 소유.` : '주인 없음.'} ${isConquerable ? '정복하려면 클릭하세요.' : ''}`}
    />
  )

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {tileElement}
        </TooltipTrigger>
        {tooltipContent && (
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
});
TileComponent.displayName = "TileComponent";


export default function WorldMap({ mapData, users, countries, onTileClick, canConquer, zoomLevel }: WorldMapProps) {
  const userColorMap = new Map(users.map(u => [u.id, u.color]));
  const userCountryMap = new Map(users.map(u => [u.id, u.countryId]));
  const countryNameMap = new Map(countries.map(c => [c.id, c.name]));

  const getTooltipContent = (tile: Tile): React.ReactNode => {
    if (!tile.ownerId) return null;
    const countryId = userCountryMap.get(tile.ownerId);
    if (!countryId) return null;
    return countryNameMap.get(countryId) || "알 수 없는 국가";
  }

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
            tooltipContent={getTooltipContent(tile)}
          />
        ))}
      </div>
    </div>
  );
}
