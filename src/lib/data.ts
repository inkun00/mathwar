import type { GameData, User, MapData, Tile } from "./types";

const MAP_WIDTH = 40;
const MAP_HEIGHT = 22;

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
    let validPosition = false;
    while (!validPosition) {
      const x = Math.floor(Math.random() * MAP_WIDTH);
      const y = Math.floor(Math.random() * MAP_HEIGHT);

      const tooClose = assignedCoordinates.some(coord => {
        const dist = Math.sqrt(Math.pow(coord.x - x, 2) + Math.pow(coord.y - y, 2));
        return dist < minDistance;
      });

      if (!tooClose) {
        map[y][x].ownerId = user.id;
        assignedCoordinates.push({ x, y });
        validPosition = true;
      }
    }
  });

  return map;
};


let mapData: MapData = generateInitialMap();

let gameData: GameData = {
  users,
  mapData,
  currentPlayerId: "player1",
};

// Simulate API calls
export const getGameData = (): GameData => {
  // In a real app, this would be an API call to fetch data from Firestore.
  // We return a deep copy to prevent direct mutation of the server state.
  return JSON.parse(JSON.stringify(gameData));
};

export const awardToken = (userId: string): GameData => {
  const user = gameData.users.find(u => u.id === userId);
  if (user) {
    user.tokens += 1;
  }
  return getGameData();
}

export const conquerTile = (userId: string, x: number, y: number): GameData => {
  const user = gameData.users.find(u => u.id === userId);
  if (!user || user.tokens <= 0) {
    // Should not happen if UI is correct
    return getGameData();
  }

  if (mapData[y] && mapData[y][x]) {
    user.tokens -= 1;
    mapData[y][x].ownerId = userId;
  }
  
  return getGameData();
}

export const restartPlayer = (userId: string): GameData => {
  const user = gameData.users.find(u => u.id === userId);
  if (!user) return getGameData();

  user.tokens = 1;

  let validPosition = false;
  while (!validPosition) {
    const x = Math.floor(Math.random() * MAP_WIDTH);
    const y = Math.floor(Math.random() * MAP_HEIGHT);

    if (!mapData[y][x].ownerId) {
      mapData[y][x].ownerId = userId;
      validPosition = true;
    }
  }

  return getGameData();
}
