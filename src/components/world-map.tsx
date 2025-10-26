
'use client';
import type { MapData, User, Tile, Country } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isLand } from "@/lib/world-map-shape";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React from "react";
import { useMemo } from 'react';
import FlagDisplay from "./flag-display";

interface WorldMapProps {
  displayMapData: MapData;
  users: User[];
  countries: Country[];
  onTileClick: (x: number, y: number) => void;
  canConquer: (tile: Tile) => boolean;
  canBuildWall: (tile: Tile) => boolean;
  zoomLevel: number;
}

const TileComponent = React.memo(({ 
  tile, 
  ownerColor, 
  onClick,
  isConquerable,
  isWallBuildable,
  tooltipContent
}: {
  tile: Tile;
  ownerColor: string | null;
  onClick: () => void;
  isConquerable: boolean;
  isWallBuildable: boolean;
  tooltipContent: React.ReactNode;
}) => {
  const isLandTile = isLand(tile.x, tile.y);

  const tileClasses = cn(
    "relative aspect-square transition-all duration-300 ease-in-out border border-border/10",
    {
      // Land
      'bg-[#f0e6d2]': isLandTile && !ownerColor,
      'hover:bg-[#e6dac8]': isLandTile && !ownerColor && isConquerable,
      // Water
      'bg-[#aadaff]': !isLandTile, // Water is always the same color
    },
    { 'shadow-inner': ownerColor },
    isConquerable && "cursor-pointer ring-2 ring-offset-1 ring-offset-background ring-primary/70 z-10 hover:brightness-110",
    isWallBuildable && "cursor-pointer ring-2 ring-offset-1 ring-offset-background ring-yellow-500 z-10 hover:brightness-110",
    tile.hasWall && "border-2 border-slate-700 dark:border-slate-300 z-5"
  );

  const tileElement = (
     <div
      className={tileClasses}
      style={{ backgroundColor: ownerColor ?? undefined }}
      onClick={(isConquerable || isWallBuildable) ? onClick : undefined}
      aria-label={`타일 ${tile.x}, ${tile.y}. ${ownerColor ? `플레이어 소유.` : '주인 없음.'} ${isConquerable ? '정복하려면 클릭하세요.' : ''}`}
    >
    </div>
  )

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {tileElement}
        </TooltipTrigger>
        {tooltipContent && (
          <TooltipContent>
            {tooltipContent}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
});
TileComponent.displayName = "TileComponent";


export default function WorldMap({ displayMapData, users, countries, onTileClick, canConquer, canBuildWall, zoomLevel }: WorldMapProps) {
  const countryColorMap = useMemo(() => new Map(countries.map(c => [c.id, c.color])), [countries]);
  const userCountryMap = useMemo(() => new Map(users.map(u => [u.id, u.countryId])), [users]);
  
  const getTileOwnerColor = (ownerId: string | null): string | null => {
    if (!ownerId) return null;
    const countryId = userCountryMap.get(ownerId);
    if (countryId) {
      return countryColorMap.get(countryId) || null;
    }
    return null;
  };

  const getTooltipContent = (tile: Tile): React.ReactNode => {
    if (!isLand(tile.x, tile.y)) return null;
    if (!tile.ownerId) return <p>미개척지</p>;
    const owner = users.find(u => u.id === tile.ownerId);
    if (!owner) return <p>알 수 없는 플레이어</p>;
    const country = countries.find(c => c.id === owner.countryId);
    
    let content = `${country?.name || '소속 없음'} (${owner.nickname})`;
    if (tile.hasWall) {
      content += ' - 성벽';
    }

    return (
        <div className="flex items-center gap-2">
            {country && <FlagDisplay flagData={country.flag} width={32} />}
            <p>{content}</p>
        </div>
    );
  };
  
  return (
    <div className="relative h-full w-full max-w-7xl overflow-auto rounded-lg border bg-card/80 p-2 shadow-inner backdrop-blur-sm md:p-4">
      <div 
        className="grid touch-none select-none gap-0 transition-transform duration-300 ease-in-out"
        style={{
          gridTemplateColumns: `repeat(${displayMapData[0].length}, minmax(0, 1fr))`,
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
        }}
      >
        {displayMapData.flat().map((tile) => (
          <TileComponent
            key={`${tile.x}-${tile.y}`}
            tile={tile}
            ownerColor={getTileOwnerColor(tile.ownerId)}
            onClick={() => onTileClick(tile.x, tile.y)}
            isConquerable={canConquer(tile)}
            isWallBuildable={canBuildWall(tile)}
            tooltipContent={getTooltipContent(tile)}
          />
        ))}
      </div>
    </div>
  );
}
