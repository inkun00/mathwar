'use client';
import type { ClientTile, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isLand, MAP_WIDTH, MAP_HEIGHT } from "@/lib/world-map-shape";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React from "react";
import { useMemo } from 'react';
import FlagDisplay from "./flag-display";

interface WorldMapProps {
  landTiles: ClientTile[];
  onTileClick: (x: number, y: number) => void;
  canConquer: (tile: ClientTile) => boolean;
  canBuildWall: (tile: ClientTile) => boolean;
  zoomLevel: number;
  currentUser: User;
}

const TileComponent = React.memo(({ 
  tile, 
  onClick,
  isConquerable,
  isWallBuildable,
  tooltipContent
}: {
  tile: ClientTile;
  onClick: () => void;
  isConquerable: boolean;
  isWallBuildable: boolean;
  tooltipContent: React.ReactNode;
}) => {
  const isLandTile = isLand(tile.x, tile.y);

  const tileClasses = cn(
    "relative aspect-square transition-all duration-300 ease-in-out border border-border/10",
    {
      'bg-[#f0e6d2]': isLandTile && !tile.countryColor,
      'hover:bg-[#e6dac8]': isLandTile && !tile.countryColor && isConquerable,
      'bg-[#aadaff]': !isLandTile, 
    },
    { 'shadow-inner': tile.countryColor },
    isConquerable && "cursor-pointer ring-2 ring-offset-1 ring-offset-background ring-primary/70 z-10 hover:brightness-110",
    isWallBuildable && "cursor-pointer ring-2 ring-offset-1 ring-offset-background ring-yellow-500 z-10 hover:brightness-110",
    tile.hasWall && "border-2 border-slate-700 dark:border-slate-300 z-5"
  );

  const tileElement = (
     <div
      className={tileClasses}
      style={{ backgroundColor: tile.countryColor ?? undefined }}
      onClick={(isConquerable || isWallBuildable) ? onClick : undefined}
      aria-label={`타일 ${tile.x}, ${tile.y}. ${tile.countryColor ? `플레이어 소유.` : '주인 없음.'} ${isConquerable ? '정복하려면 클릭하세요.' : ''}`}
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


export default function WorldMap({ landTiles, onTileClick, canConquer, canBuildWall, zoomLevel, currentUser }: WorldMapProps) {
  console.log('[WorldMap] Rendering with landTiles prop length:', landTiles.length);
  
  const getTooltipContent = (tile: ClientTile): React.ReactNode => {
    if (!isLand(tile.x, tile.y)) return null;
    if (!tile.ownerId) return <p className="text-lg">미개척지</p>;
    
    let content = tile.countryName ? `${tile.countryName} (${tile.ownerNickname})` : (tile.ownerNickname || '알 수 없는 소유자');

    if (tile.hasWall) {
      content += ' - 성벽';
    }

    // Since flag data is not on the tile, we can't display it here without prop-drilling or context.
    // For now, we will omit the flag from the tooltip.
    return (
        <div className="flex items-center gap-2">
            <p className="text-lg">{content}</p>
        </div>
    );
  };
  
  const mapGrid = useMemo(() => {
    const grid: (ClientTile | { x: number; y: number; id: string; ownerId: null; hasWall: boolean})[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
        Array.from({ length: MAP_WIDTH }, (_, x) => ({ x, y, id: `${x}-${y}`, ownerId: null, hasWall: false }))
    );
    landTiles.forEach(tile => {
        if (grid[tile.y] && grid[tile.y][tile.x]) {
            grid[tile.y][tile.x] = tile;
        }
    });
    return grid.flat();
  }, [landTiles]);

  return (
    <div className="relative h-full w-full max-w-7xl overflow-auto rounded-lg border bg-card/80 p-2 shadow-inner backdrop-blur-sm md:p-4">
      <div 
        className="grid touch-none select-none gap-0 transition-transform duration-300 ease-in-out"
        style={{
          gridTemplateColumns: `repeat(${MAP_WIDTH}, minmax(0, 1fr))`,
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
        }}
      >
        {mapGrid.map((tile) => (
          <TileComponent
            key={`${tile.x}-${tile.y}`}
            tile={tile}
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
