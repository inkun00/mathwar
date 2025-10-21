'use client';
import type { MapData, User, Tile, Country } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isLand } from "@/lib/world-map-shape";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React from "react";
import { useMemo } from 'react';

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
      'bg-[#aadaff]': !isLandTile, // Water is always the same color
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
  const countryColorMap = useMemo(() => new Map(countries.map(c => [c.id, c.color])), [countries]);
  const userCountryMap = useMemo(() => new Map(users.map(u => [u.id, u.countryId])), [users]);
  const userColorMap = useMemo(() => new Map(users.map(u => [u.id, u.color])), [users]);
  const countryNameMap = useMemo(() => new Map(countries.map(c => [c.id, c.name])), [countries]);

  const getTileOwnerColor = (ownerId: string | null): string | null => {
    if (!ownerId) return null;
    const countryId = userCountryMap.get(ownerId);
    if (countryId) {
      // Prefer country color if it exists
      const countryColor = countryColorMap.get(countryId);
      if (countryColor) return countryColor;
    }
    // Fallback to the user's individual color if country color is missing
    return userColorMap.get(ownerId) || null;
  }

  const getTooltipContent = (tile: Tile): React.ReactNode => {
    if (!tile.ownerId) return '미개척지';
    const owner = users.find(u => u.id === tile.ownerId);
    if (!owner) return "알 수 없는 플레이어";
    const countryId = owner.countryId;
    const countryName = countryNameMap.get(countryId);
    return `${countryName || '소속 없음'} (${owner.nickname})`;
  }
  
  return (
    <div className="relative h-full w-full max-w-7xl overflow-auto rounded-lg border bg-card/80 p-2 shadow-inner backdrop-blur-sm md:p-4">
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
            ownerColor={getTileOwnerColor(tile.ownerId)}
            onClick={() => onTileClick(tile.x, tile.y)}
            isConquerable={canConquer(tile)}
            tooltipContent={getTooltipContent(tile)}
          />
        ))}
      </div>
    </div>
  );
}
