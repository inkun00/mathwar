
export const MAP_WIDTH = 144;
export const MAP_HEIGHT = 120;

export type TerrainType = 'land' | 'water' | 'lake';

export interface ContinentInfo {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  landColor: string;
  waterColor: string;
  lakeColor: string;
}

export const CONTINENTS_INFO: ContinentInfo[] = [
  {
    id: 1,
    name: "대륙 1",
    subtitle: "판게아 평원",
    description: "장애물이 없는 광활한 직사각형 평원 전장",
    landColor: "#fef3c7",
    waterColor: "#93c5fd",
    lakeColor: "#6ee7b7",
  },
  {
    id: 2,
    name: "대륙 2",
    subtitle: "세계 지도",
    description: "5대양 6대주 형태의 대륙과 바다가 어우러진 세계 전장",
    landColor: "#dcfce7",
    waterColor: "#60a5fa",
    lakeColor: "#34d399",
  },
  {
    id: 3,
    name: "대륙 3",
    subtitle: "지중해 & 군도",
    description: "거대한 내해와 반도, 흩어진 군도 섬들로 이루어진 해상 전장",
    landColor: "#fef9c3",
    waterColor: "#38bdf8",
    lakeColor: "#2dd4bf",
  },
  {
    id: 4,
    name: "대륙 4",
    subtitle: "거대 호수 분지",
    description: "4개의 거대 담수호와 물길이 대륙을 분할하는 전략적 요충지",
    landColor: "#fae8ff",
    waterColor: "#818cf8",
    lakeColor: "#a78bfa",
  },
  {
    id: 5,
    name: "대륙 5",
    subtitle: "환초 & 링 아톨",
    description: "중앙 원형 내해와 거대한 링 대륙, 외곽 환초 섬들의 요새 전장",
    landColor: "#ffedd5",
    waterColor: "#0284c7",
    lakeColor: "#06b6d4",
  },
];

// Helper: pseudo noise / distance functions
function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

function ellipseDist(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny;
}

// Distance from point to line segment
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = distSq(x1, y1, x2, y2);
  if (l2 === 0) return Math.sqrt(distSq(px, py, x1, y1));
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt(distSq(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1)));
}

// Terrain logic for Continent 2: World Continents (100% Connected via Land Bridges)
function getContinent2Terrain(x: number, y: number): TerrainType {
  // Lakes
  if (ellipseDist(x, y, 34, 38, 5, 4) <= 1) return 'lake'; // Great Lakes
  if (ellipseDist(x, y, 92, 38, 4, 3) <= 1) return 'lake'; // Caspian Sea
  if (ellipseDist(x, y, 84, 76, 3, 4) <= 1) return 'lake'; // Victoria Lake

  // --- Connecting Bridges (Land Bridges / Causeways) ---
  // Bering Strait Bridge (North America <-> Asia)
  if (distToSegment(x, y, 18, 20, 0, 18) <= 1.8 || distToSegment(x, y, 143, 18, 128, 20) <= 1.8) return 'land';
  // Panama Isthmus (North America <-> South America)
  if (distToSegment(x, y, 28, 48, 38, 68) <= 2.2) return 'land';
  // Sinai / Suez Bridge (Eurasia <-> Africa)
  if (distToSegment(x, y, 80, 48, 82, 60) <= 2.5) return 'land';
  // Indonesian Island Chain Bridge (Asia <-> Australia)
  if (distToSegment(x, y, 116, 52, 122, 82) <= 1.8) return 'land';
  // UK Dover Bridge
  if (distToSegment(x, y, 66, 24, 74, 26) <= 1.5) return 'land';
  // Japan Straits Bridge
  if (distToSegment(x, y, 126, 38, 134, 38) <= 1.5) return 'land';
  // Madagascar Mozambique Bridge
  if (distToSegment(x, y, 90, 84, 98, 86) <= 1.5) return 'land';
  // New Zealand Tasman Bridge
  if (distToSegment(x, y, 128, 92, 136, 98) <= 1.5) return 'land';

  // --- Major Continents ---
  // North America
  if (ellipseDist(x, y, 28, 36, 18, 16) <= 1 || ellipseDist(x, y, 22, 22, 10, 8) <= 1) return 'land';
  // South America
  if (ellipseDist(x, y, 42, 82, 14, 22) <= 1 && !(x < 33 && y > 92)) return 'land';
  // Europe
  if (ellipseDist(x, y, 78, 28, 12, 10) <= 1) return 'land';
  // Asia / Eurasia
  if (ellipseDist(x, y, 106, 34, 26, 18) <= 1 || ellipseDist(x, y, 124, 46, 12, 12) <= 1) return 'land';
  // Africa
  if (ellipseDist(x, y, 82, 74, 15, 20) <= 1 && !(x > 94 && y > 82)) return 'land';
  // Australia / Oceania
  if (ellipseDist(x, y, 122, 88, 14, 10) <= 1) return 'land';

  // Islands
  if (ellipseDist(x, y, 66, 24, 3, 5) <= 1) return 'land'; // UK
  if (ellipseDist(x, y, 134, 38, 3, 7) <= 1) return 'land'; // Japan
  if (ellipseDist(x, y, 98, 86, 3, 7) <= 1) return 'land'; // Madagascar
  if (ellipseDist(x, y, 136, 98, 4, 4) <= 1) return 'land'; // New Zealand

  return 'water';
}

// Terrain logic for Continent 3: Archipelago & Mediterranean (100% Connected)
function getContinent3Terrain(x: number, y: number): TerrainType {
  const cx = 72;
  const cy = 60;

  // Mountain Lakes
  if (ellipseDist(x, y, 32, 28, 4, 3) <= 1) return 'lake';
  if (ellipseDist(x, y, 114, 30, 4, 3) <= 1) return 'lake';
  if (ellipseDist(x, y, 72, 98, 5, 3) <= 1) return 'lake';

  // --- Connecting Bridges for Mediterranean & Islands ---
  // Gibraltar Western Bridge (Europe <-> Africa)
  if (distToSegment(x, y, 22, 46, 22, 76) <= 2.2) return 'land';
  // Levant Eastern Bridge (Europe <-> Africa)
  if (distToSegment(x, y, 122, 46, 122, 76) <= 2.2) return 'land';
  // Central Island Bridge Chain (Majorca <-> Corsica <-> Italy <-> Sicily <-> Africa)
  if (distToSegment(x, y, 50, 52, 58, 62) <= 1.5) return 'land'; // Iberia to Majorca
  if (distToSegment(x, y, 58, 62, 68, 56) <= 1.5) return 'land'; // Majorca to Corsica
  if (distToSegment(x, y, 68, 56, 73, 52) <= 1.5) return 'land'; // Corsica to Italy
  if (distToSegment(x, y, 73, 56, 76, 64) <= 1.5) return 'land'; // Italy to Sicily
  if (distToSegment(x, y, 76, 64, 76, 76) <= 1.5) return 'land'; // Sicily to North Africa
  // Aegean Bridge Chain (Greece <-> Crete <-> East Coast)
  if (distToSegment(x, y, 88, 54, 90, 64) <= 1.5) return 'land'; // Greece to Crete
  if (distToSegment(x, y, 90, 64, 118, 70) <= 1.5) return 'land'; // Crete to East
  // Outer island bridges
  if (distToSegment(x, y, 14, 80, 22, 80) <= 1.5) return 'land';
  if (distToSegment(x, y, 130, 80, 122, 80) <= 1.5) return 'land';
  if (distToSegment(x, y, 134, 18, 124, 24) <= 1.5) return 'land';

  // Central Mediterranean Inland Sea
  if (ellipseDist(x, y, cx, cy, 32, 16) <= 1) {
    // Islands inside Mediterranean Sea
    if (ellipseDist(x, y, 58, 62, 3, 2) <= 1) return 'land'; // Majorca
    if (ellipseDist(x, y, 68, 56, 2, 4) <= 1) return 'land'; // Corsica/Sardinia
    if (ellipseDist(x, y, 76, 64, 4, 3) <= 1) return 'land'; // Sicily
    if (ellipseDist(x, y, 90, 64, 4, 2) <= 1) return 'land'; // Crete
    if (ellipseDist(x, y, 73, 54, 3, 7) <= 1) return 'land'; // Italy peninsula tip
    return 'water';
  }

  // Surrounding Northern Land
  if (y <= 48 && (x >= 18 && x <= 126)) {
    if (x >= 44 && x <= 58 && y >= 40 && y <= 58) return 'land'; // Iberian peninsula
    if (x >= 70 && x <= 78 && y >= 40 && y <= 54) return 'land'; // Italy top
    if (x >= 84 && x <= 96 && y >= 40 && y <= 56) return 'land'; // Greece peninsula
    return 'land';
  }

  // Surrounding Southern Land
  if (y >= 74 && (x >= 22 && x <= 124)) {
    return 'land';
  }

  // Western & Eastern Straits and Coastlines
  if (x <= 20 || x >= 126) return 'land';

  // Outer islands
  if (ellipseDist(x, y, 14, 80, 5, 4) <= 1) return 'land';
  if (ellipseDist(x, y, 130, 80, 5, 4) <= 1) return 'land';
  if (ellipseDist(x, y, 134, 18, 4, 4) <= 1) return 'land';

  return 'water';
}

// Terrain logic for Continent 4: Great Lakes & Rift Basins (100% Connected)
function getContinent4Terrain(x: number, y: number): TerrainType {
  // 4 Great Lakes in the continent
  const isLake1 = ellipseDist(x, y, 46, 40, 16, 12) <= 1; // Northwest Lake
  const isLake2 = ellipseDist(x, y, 98, 42, 14, 14) <= 1; // Northeast Lake
  const isLake3 = ellipseDist(x, y, 48, 82, 15, 13) <= 1; // Southwest Lake
  const isLake4 = ellipseDist(x, y, 96, 84, 18, 14) <= 1; // Southeast Lake
  
  // River channels connecting lakes
  const isRiver1 = Math.abs(x - 72) <= 2 && y >= 28 && y <= 96; // Central vertical river
  const isRiver2 = Math.abs(y - 60) <= 2 && x >= 32 && x <= 112; // Central horizontal river

  // Island in Northeast Lake connected with bridge
  if (ellipseDist(x, y, 98, 42, 3, 3) <= 1) return 'land';
  if (distToSegment(x, y, 98, 42, 98, 26) <= 1.5) return 'land'; // Island bridge to North Land

  // Bridges across rivers and lakes
  if (Math.abs(x - 72) <= 4 && Math.abs(y - 60) <= 4) return 'land'; // Central Grand Crossroad
  if (Math.abs(x - 72) <= 3 && (y <= 30 || y >= 94)) return 'land'; // North/South River head bridges
  if (Math.abs(y - 60) <= 3 && (x <= 34 || x >= 110)) return 'land'; // West/East River mouth bridges

  if (isLake1 || isLake2 || isLake3 || isLake4) {
    return 'lake';
  }

  if (isRiver1 || isRiver2) {
    return 'lake';
  }

  // Outer border ocean margins
  if (x < 10 || x > 134 || y < 8 || y > 112) {
    return 'water';
  }

  return 'land';
}

// Terrain logic for Continent 5: Ring Atoll & Sea Crater (100% Connected)
function getContinent5Terrain(x: number, y: number): TerrainType {
  const cx = 72;
  const cy = 60;
  const d = Math.sqrt(distSq(x, y, cx, cy));

  // --- Spoke Bridges: Connecting Central Island <-> Ring Continent ---
  // North, South, East, West Spokes (width 3 tiles)
  if (d <= 36) {
    if (Math.abs(x - cx) <= 1.8 && y >= cy - 36 && y <= cy + 36) return 'land';
    if (Math.abs(y - cy) <= 1.8 && x >= cx - 36 && x <= cx + 36) return 'land';
  }

  // --- Ring Arches: Ensuring the Ring Continent is continuous (no water gaps) ---
  if (d >= 33 && d <= 39) {
    return 'land'; // Unbroken middle circular road
  }

  // --- Outer Causeways: Connecting 8 Satellite Atolls to the Main Ring ---
  const atollCenters = [
    { x: 18, y: 18 }, { x: 72, y: 10 }, { x: 126, y: 18 },
    { x: 134, y: 60 }, { x: 126, y: 102 }, { x: 72, y: 110 },
    { x: 18, y: 102 }, { x: 10, y: 60 },
  ];

  for (const atoll of atollCenters) {
    // Causeway from ring (d ~ 44) to atoll center
    if (distToSegment(x, y, cx, cy, atoll.x, atoll.y) <= 1.8 && d >= 40) {
      return 'land';
    }
    // Atoll island itself
    if (distSq(x, y, atoll.x, atoll.y) <= 36) {
      return 'land';
    }
  }

  // Central mystical island
  if (d <= 7) return 'land';

  // Inner Crater Sea (Lake)
  if (d > 7 && d <= 26) return 'lake';

  // Main Ring Continent
  if (d > 26 && d <= 46) {
    return 'land';
  }

  return 'water';
}

/**
 * Returns the terrain type of a tile at (x, y) for a given continent.
 * @param x The x-coordinate (0 ~ 143)
 * @param y The y-coordinate (0 ~ 119)
 * @param continentId Continent number (1 ~ 5, defaults to 1)
 */
export const getTerrainType = (x: number, y: number, continentId = 1): TerrainType => {
  switch (continentId) {
    case 1:
      return 'land'; // Classic rectangular Pangea
    case 2:
      return getContinent2Terrain(x, y);
    case 3:
      return getContinent3Terrain(x, y);
    case 4:
      return getContinent4Terrain(x, y);
    case 5:
      return getContinent5Terrain(x, y);
    default:
      return 'land';
  }
};

/**
 * Checks if a given coordinate is land (claimable/conquerable).
 * @param x The x-coordinate.
 * @param y The y-coordinate.
 * @param continentId Continent number (1 ~ 5).
 * @returns True if the tile is land.
 */
export const isLand = (x: number, y: number, continentId = 1): boolean => {
  return getTerrainType(x, y, continentId) === 'land';
};


