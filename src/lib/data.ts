import type { GameData, User, MapData, Tile } from "./types";

const MAP_WIDTH = 36;
const MAP_HEIGHT = 30;

const userColors = [
  "hsl(148, 64%, 58%)", // primary
  "hsl(200, 80%, 60%)",
  "hsl(340, 80%, 60%)",
  "hsl(40, 80%, 60%)",
  "hsl(280, 80%, 60%)",
];

let users: User[] = [
  { id: "player1", name: "나", color: userColors[0], tokens: 1 },
  { id: "player2", name: "AI 플레이어 A", color: userColors[1], tokens: 1 },
  { id: "player3", name: "AI 플레이어 B", color: userColors[2], tokens: 1 },
];

const generateInitialMap = (): MapData => {
  const map: MapData = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (__, x) => ({
      x,
      y,
      ownerId: null,
    }))
  );

  // Assign initial tiles ensuring they are spaced out
  const assignedCoordinates: { x: number; y: number }[] = [];
  const minDistance = 10;

  users.forEach(user => {
    // Human player starts by choosing a tile
    if (user.id === 'player1') return;

    let validPosition = false;
    let x = 0, y = 0;
    while (!validPosition) {
      x = Math.floor(Math.random() * MAP_WIDTH);
      y = Math.floor(Math.random() * MAP_HEIGHT);

      if (assignedCoordinates.length === 0) {
        validPosition = true;
      } else {
        const tooClose = assignedCoordinates.some(coord => {
          const dist = Math.sqrt(Math.pow(coord.x - x, 2) + Math.pow(coord.y - y, 2));
          return dist < minDistance;
        });
        if (!tooClose) {
          validPosition = true;
        }
      }
    }
    map[y][x].ownerId = user.id;
    assignedCoordinates.push({ x, y });
  });

  return map;
};


let mapData: MapData = generateInitialMap();

let gameData: GameData = {
  users,
  mapData,
  currentPlayerId: "player1",
};

// This is a simple in-memory store.
// A real app would use a database like Firestore.
const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const getGameData = (): GameData => {
  return deepCopy(gameData);
};

export const awardToken = (userId: string): GameData => {
  const user = gameData.users.find(u => u.id === userId);
  if (user) {
    user.tokens += 1;
  }
  return deepCopy(gameData);
}

export const conquerTile = (userId: string, x: number, y: number): GameData => {
  const user = gameData.users.find(u => u.id === userId);
  // This function is called for both player and AI, so tokens can be 0 for AI
  if (!user || (user.id === "player1" && user.tokens <= 0)) {
    return deepCopy(gameData);
  }

  if (mapData[y] && mapData[y][x]) {
    user.tokens -= 1;
    mapData[y][x].ownerId = userId;
  }
  
  return deepCopy(gameData);
}

export const restartPlayer = (userId: string): GameData => {
  const user = gameData.users.find(u => u.id === userId);
  if (!user) return deepCopy(gameData);

  // Remove all existing tiles for this user
  mapData.forEach(row => {
    row.forEach(tile => {
      if (tile.ownerId === userId) {
        tile.ownerId = null;
      }
    });
  });

  user.tokens = 1;

  // Don't assign a tile, let the user choose
  
  return deepCopy(gameData);
}
