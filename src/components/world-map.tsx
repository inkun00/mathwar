'use client';
import type { ClientTile, User } from "@/lib/types";
import { isLand, getTerrainType, CONTINENTS_INFO, TerrainType } from "@/lib/world-map-shape";
import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import FlagDisplay from "./flag-display";

interface WorldMapProps {
  landTiles: ClientTile[];
  onTileClick: (x: number, y: number) => void;
  canConquer: (tile: ClientTile) => boolean;
  canBuildWall: (tile: ClientTile) => boolean;
  zoomLevel: number;
  currentUser: User;
  mapWidth: number;
  mapHeight: number;
  continentId?: number;
}

const BASE_TILE_SIZE = 14; // Base pixel size per tile at scale = 1

export default function WorldMap({
  landTiles,
  onTileClick,
  canConquer,
  canBuildWall,
  zoomLevel,
  currentUser,
  mapWidth,
  mapHeight,
  continentId = 1,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentContinentInfo = useMemo(() => {
    return CONTINENTS_INFO.find((c) => c.id === continentId) || CONTINENTS_INFO[0];
  }, [continentId]);

  // Viewport camera state (pan and zoom)
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: zoomLevel || 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  // Hovered tile state for tooltips and hover effect
  const [hoveredTile, setHoveredTile] = useState<{
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    tile: ClientTile | null;
    terrain: TerrainType;
    isLandTile: boolean;
  } | null>(null);

  // Map lookup for fast tile querying: key = "x,y"
  const tilesMap = useMemo(() => {
    const map = new Map<string, ClientTile>();
    landTiles.forEach((tile) => {
      // Strictly isolate tiles by continent (legacy tiles with no continentId belong to continent 1)
      const tileContinent = tile.continentId ?? 1;
      if (tileContinent === continentId) {
        map.set(`${tile.x},${tile.y}`, tile);
      }
    });
    return map;
  }, [landTiles, continentId]);

  // Sync external zoomLevel with camera scale if it changes
  useEffect(() => {
    if (zoomLevel && zoomLevel !== camera.scale) {
      setCamera((prev) => ({
        ...prev,
        scale: zoomLevel,
      }));
    }
  }, [zoomLevel]);

  // Center camera initially or when continent changes
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const initialTileSize = BASE_TILE_SIZE * camera.scale;
      const totalWidth = mapWidth * initialTileSize;
      const totalHeight = mapHeight * initialTileSize;
      const startX = (container.clientWidth - totalWidth) / 2;
      const startY = (container.clientHeight - totalHeight) / 2;
      setCamera((prev) => ({
        ...prev,
        x: startX,
        y: startY,
      }));
    }
  }, [mapWidth, mapHeight, continentId]);

  // Get or construct a tile object
  const getTile = useCallback(
    (x: number, y: number): ClientTile => {
      const existing = tilesMap.get(`${x},${y}`);
      if (existing) return existing;
      return {
        id: `${continentId}_${x}_${y}`,
        x,
        y,
        continentId,
        ownerId: null,
        hasWall: false,
        ownerNickname: null,
        countryId: null,
        countryName: null,
        countryColor: null,
      };
    },
    [tilesMap, continentId]
  );

  // Canvas drawing loop with Viewport Culling and Ultra-Fast Tile Rendering
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { x: camX, y: camY, scale } = camera;
    const tileSize = BASE_TILE_SIZE * scale;

    // Clear background (Ocean / Water color for the active continent)
    ctx.fillStyle = currentContinentInfo.waterColor;
    ctx.fillRect(0, 0, width, height);

    if (tileSize <= 0) return;

    // Viewport Culling: calculate visible tile coordinate boundaries
    const minTileX = Math.max(0, Math.floor(-camX / tileSize));
    const maxTileX = Math.min(mapWidth - 1, Math.ceil((width - camX) / tileSize));
    const minTileY = Math.max(0, Math.floor(-camY / tileSize));
    const maxTileY = Math.min(mapHeight - 1, Math.ceil((height - camY) / tileSize));
    const drawTileSize = Math.ceil(tileSize);
    const showDetails = tileSize >= 10;
    const showFlags = tileSize >= 24;

    // Draw visible tiles (Land and Lakes)
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const screenTileY = Math.floor(camY + ty * tileSize);
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const terrain = getTerrainType(tx, ty, continentId);
        
        // Ocean tiles are already filled with background color
        if (terrain === 'water') continue;

        const screenTileX = Math.floor(camX + tx * tileSize);

        if (terrain === 'lake') {
          // Render inland lake
          ctx.fillStyle = currentContinentInfo.lakeColor;
          ctx.fillRect(screenTileX, screenTileY, drawTileSize, drawTileSize);
          continue;
        }

        // --- Land Tile Rendering ---
        const ownedTile = tilesMap.get(`${tx},${ty}`);

        // Land fill color (Country color or unclaimed continent land color)
        if (ownedTile?.countryColor) {
          ctx.fillStyle = ownedTile.countryColor;
        } else {
          ctx.fillStyle = currentContinentInfo.landColor;
        }
        ctx.fillRect(screenTileX, screenTileY, drawTileSize, drawTileSize);

        // Wall indicator
        if (ownedTile?.hasWall) {
          ctx.strokeStyle = "#1e293b"; // Slate-800
          ctx.lineWidth = Math.max(2, Math.floor(tileSize * 0.18));
          ctx.strokeRect(
            screenTileX + 1,
            screenTileY + 1,
            drawTileSize - 2,
            drawTileSize - 2
          );

          if (tileSize >= 16) {
            ctx.fillStyle = "#334155";
            const innerMargin = Math.floor(tileSize * 0.25);
            ctx.fillRect(
              screenTileX + innerMargin,
              screenTileY + innerMargin,
              drawTileSize - innerMargin * 2,
              drawTileSize - innerMargin * 2
            );
          }
        }

        // Draw country flag icon on tile if owned and zoomed in
        if (showFlags && ownedTile?.countryFlag && ownedTile.countryFlag.length === 100) {
          const flagPixelSize = (tileSize * 0.6) / 10;
          const flagStartX = screenTileX + (tileSize - flagPixelSize * 10) / 2;
          const flagStartY = screenTileY + (tileSize - flagPixelSize * 10) / 2;

          for (let fy = 0; fy < 10; fy++) {
            for (let fx = 0; fx < 10; fx++) {
              const color = ownedTile.countryFlag[fy * 10 + fx];
              if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(
                  flagStartX + fx * flagPixelSize,
                  flagStartY + fy * flagPixelSize,
                  Math.ceil(flagPixelSize),
                  Math.ceil(flagPixelSize)
                );
              }
            }
          }
        }
      }
    }

    // Draw grid lines when zoomed in enough (single batch stroke for high FPS)
    if (tileSize >= 8) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let tx = minTileX; tx <= maxTileX + 1; tx++) {
        const sx = Math.floor(camX + tx * tileSize);
        ctx.moveTo(sx, Math.floor(camY + minTileY * tileSize));
        ctx.lineTo(sx, Math.floor(camY + (maxTileY + 1) * tileSize));
      }
      for (let ty = minTileY; ty <= maxTileY + 1; ty++) {
        const sy = Math.floor(camY + ty * tileSize);
        ctx.moveTo(Math.floor(camX + minTileX * tileSize), sy);
        ctx.lineTo(Math.floor(camX + (maxTileX + 1) * tileSize), sy);
      }
      ctx.stroke();
    }

    // Draw hover indicator and action highlight for the hovered tile
    if (hoveredTile && hoveredTile.isLandTile) {
      const hoverScreenX = Math.floor(camX + hoveredTile.x * tileSize);
      const hoverScreenY = Math.floor(camY + hoveredTile.y * tileSize);

      const targetTile = getTile(hoveredTile.x, hoveredTile.y);
      const conquerable = canConquer(targetTile);
      const wallBuildable = canBuildWall(targetTile);

      if (conquerable) {
        ctx.strokeStyle = "#10b981"; // Emerald green
        ctx.lineWidth = 3;
      } else if (wallBuildable) {
        ctx.strokeStyle = "#eab308"; // Yellow
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
      }

      ctx.strokeRect(
        hoverScreenX,
        hoverScreenY,
        drawTileSize,
        drawTileSize
      );

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(hoverScreenX, hoverScreenY, drawTileSize, drawTileSize);
    }
  }, [camera, mapWidth, mapHeight, getTile, canConquer, canBuildWall, hoveredTile, continentId, currentContinentInfo, tilesMap]);

  // Re-render canvas when camera, tilesMap, or hover state updates
  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      renderCanvas();
    };
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [renderCanvas]);

  // Resize canvas when container size changes
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        renderCanvas();
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  // Screen coordinates to Tile grid coordinates
  const screenToTile = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const tileSize = BASE_TILE_SIZE * camera.scale;
      const tileX = Math.floor((screenX - camera.x) / tileSize);
      const tileY = Math.floor((screenY - camera.y) / tileSize);

      if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight) {
        const terrain = getTerrainType(tileX, tileY, continentId);
        return {
          tileX,
          tileY,
          screenX,
          screenY,
          terrain,
          isLandTile: terrain === 'land',
        };
      }
      return null;
    },
    [camera, mapWidth, mapHeight, continentId]
  );

  // Mouse / Touch Event Handlers for Drag (Pan) & Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left-click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
    setHasDragged(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      if (Math.abs(newX - camera.x) > 3 || Math.abs(newY - camera.y) > 3) {
        setHasDragged(true);
      }
      setCamera((prev) => ({ ...prev, x: newX, y: newY }));
    }

    // Update hover tile
    const pos = screenToTile(e.clientX, e.clientY);
    if (pos) {
      const tile = getTile(pos.tileX, pos.tileY);
      setHoveredTile({
        x: pos.tileX,
        y: pos.tileY,
        screenX: pos.screenX,
        screenY: pos.screenY,
        tile: pos.isLandTile ? tile : null,
        terrain: pos.terrain,
        isLandTile: pos.isLandTile,
      });
    } else {
      setHoveredTile(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!hasDragged) {
      // It was a click, not a pan drag
      const pos = screenToTile(e.clientX, e.clientY);
      if (pos && pos.isLandTile) {
        const tile = getTile(pos.tileX, pos.tileY);
        const conquerable = canConquer(tile);
        const wallBuildable = canBuildWall(tile);
        if (conquerable || wallBuildable) {
          onTileClick(pos.tileX, pos.tileY);
        }
      }
    }
    setIsDragging(false);
    setHasDragged(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.min(Math.max(0.3, camera.scale * zoomFactor), 4.0);

    // Zoom centered around mouse pointer
    const currentTileSize = BASE_TILE_SIZE * camera.scale;
    const newTileSize = BASE_TILE_SIZE * newScale;

    const mouseTileX = (mouseX - camera.x) / currentTileSize;
    const mouseTileY = (mouseY - camera.y) / currentTileSize;

    const newX = mouseX - mouseTileX * newTileSize;
    const newY = mouseY - mouseTileY * newTileSize;

    setCamera({
      x: newX,
      y: newY,
      scale: newScale,
    });
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredTile(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full max-w-7xl overflow-hidden rounded-xl border bg-slate-900 shadow-2xl backdrop-blur-sm select-none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Hover Tooltip HUD */}
      {hoveredTile && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border bg-popover/95 px-3 py-2 text-popover-foreground shadow-lg backdrop-blur-md transition-all duration-75 text-sm"
          style={{
            left: Math.min(
              Math.max(12, hoveredTile.screenX + 16),
              (containerRef.current?.clientWidth || 300) - 220
            ),
            top: Math.min(
              Math.max(12, hoveredTile.screenY + 16),
              (containerRef.current?.clientHeight || 200) - 100
            ),
          }}
        >
          {hoveredTile.terrain === 'water' ? (
            <div className="flex items-center gap-2 text-sky-400 font-medium">
              <span>🌊</span>
              <span>대양/바다 ({hoveredTile.x}, {hoveredTile.y})</span>
            </div>
          ) : hoveredTile.terrain === 'lake' ? (
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <span>🏞️</span>
              <span>내륙 호수 ({hoveredTile.x}, {hoveredTile.y})</span>
            </div>
          ) : !hoveredTile.tile?.ownerId ? (
            <div>
              <p className="font-semibold text-emerald-500">🌾 미개척지 ({currentContinentInfo.subtitle})</p>
              <p className="text-xs text-muted-foreground">좌표: ({hoveredTile.x}, {hoveredTile.y})</p>
              {hoveredTile.tile && canConquer(hoveredTile.tile) && (
                <p className="mt-1 text-xs text-emerald-400 font-medium animate-pulse">
                  ✨ 클릭하여 영토 점령 가능
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {hoveredTile.tile.countryFlag && (
                  <FlagDisplay flagData={hoveredTile.tile.countryFlag} width={28} />
                )}
                <div>
                  <p className="font-bold leading-tight">
                    {hoveredTile.tile.countryName || "무명 국가"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    소유자: {hoveredTile.tile.ownerNickname || "알 수 없음"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>좌표: ({hoveredTile.x}, {hoveredTile.y})</span>
                {hoveredTile.tile.hasWall && (
                  <span className="font-semibold text-amber-400">🛡️ 성벽 방어중</span>
                )}
              </div>
              {hoveredTile.tile && canConquer(hoveredTile.tile) && (
                <p className="text-xs text-rose-400 font-medium">
                  ⚔️ 클릭하여 침공 시작
                </p>
              )}
              {hoveredTile.tile && canBuildWall(hoveredTile.tile) && (
                <p className="text-xs text-yellow-400 font-medium">
                  🧱 클릭하여 성벽 건설
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mini Controls & Continent Indicator */}
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm border shadow-sm flex items-center gap-3">
        <span className="font-semibold text-primary">
          🗺️ {currentContinentInfo.name}: {currentContinentInfo.subtitle}
        </span>
        <span>•</span>
        <span>🖱️ 휠: 줌</span>
        <span>•</span>
        <span>드래그: 맵 이동</span>
      </div>
    </div>
  );
}

