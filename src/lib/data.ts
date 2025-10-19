import type { GameData, User, MapData } from "./types";
import { isLand, MAP_WIDTH, MAP_HEIGHT } from "./world-map-shape";
import type { User as FirebaseUser } from 'firebase/auth';

const userColors = [
  "hsl(148, 64%, 58%)", // primary
  "hsl(200, 80%, 60%)",
  "hsl(340, 80%, 60%)",
  "hsl(40, 80%, 60%)",
  "hsl(280, 80%, 60%)",
];

const aiUsers: Omit<User, 'uid' | 'countryId' | 'email'>[] = [
  { id: "player2", nickname: "AI 플레이어 A", color: userColors[1], tokens: 1 },
  { id: "player3", nickname: "AI 플레이어 B", color: userColors[2], tokens: 1 },
];

let mapData: MapData | null = null;
let gameData: GameData | null = null;

const generateInitialMap = (allUsers: User[]): MapData => {
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

  allUsers.forEach(user => {
    // Human player starts by choosing a tile
    if (user.id === user.uid) return;

    let validPosition = false;
    let x = 0, y = 0;
    let attempts = 0;
    while (!validPosition && attempts < 100) {
      x = Math.floor(Math.random() * MAP_WIDTH);
      y = Math.floor(Math.random() * MAP_HEIGHT);
      attempts++;

      if (!isLand(x, y)) continue;

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
    if(validPosition) {
      map[y][x].ownerId = user.id;
      assignedCoordinates.push({ x, y });
    }
  });

  return map;
};

const createNewGameData = (firebaseUser: FirebaseUser, userProfile: User): GameData => {
  const humanPlayer: User = {
    ...userProfile,
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    color: userColors[0],
    tokens: 1
  };
  
  const allUsers: User[] = [
    humanPlayer, 
    ...aiUsers.map((ai, i) => ({ 
      ...ai, 
      uid: ai.id, 
      id: ai.id, 
      email: '', 
      countryId: `ai-country-${i}` 
    }))
  ];
  const newMapData = generateInitialMap(allUsers);
  
  return {
    users: allUsers,
    mapData: newMapData,
    currentPlayerId: firebaseUser.uid,
  };
}


// This is a simple in-memory store.
// A real app would use a database like Firestore.
const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const getGameData = (firebaseUser: FirebaseUser | null, userProfile: User | null): GameData => {
  if (!firebaseUser || !userProfile) {
    // Should not happen if UI is controlled properly, but as a fallback
    return { users: [], mapData: [], currentPlayerId: '' };
  }
  if (!gameData || gameData.currentPlayerId !== firebaseUser.uid) {
    // Create new game data if it doesn't exist or if the user is different
    gameData = createNewGameData(firebaseUser, userProfile);
    mapData = gameData.mapData;
  }
  return deepCopy(gameData);
};

export const awardToken = (userId: string): GameData => {
  if (!gameData) return getGameData(null, null);
  const user = gameData.users.find(u => u.id === userId);
  if (user) {
    user.tokens += 1;
  }
  const copiedState = deepCopy(gameData);
  // Return a new state object to trigger re-render
  return {
    ...copiedState,
    users: [...copiedState.users]
  };
}

export const conquerTile = (userId: string, x: number, y: number): GameData => {
  if (!gameData || !mapData) return getGameData(null, null);
  const user = gameData.users.find(u => u.id === userId);
  // This function is called for both player and AI, so tokens can be 0 for AI
  if (!user || user.tokens <= 0) {
    return deepCopy(gameData);
  }

  if (mapData[y] && mapData[y][x]) {
    user.tokens -= 1;
    mapData[y][x].ownerId = userId;
  }
  
  return deepCopy(gameData);
}

export const restartPlayer = (userId: string): GameData => {
  if (!gameData || !mapData) return getGameData(null, null);
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
