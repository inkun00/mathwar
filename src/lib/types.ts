export interface User {
  id: string; // Firebase UID for human, or some unique ID for AI
  uid: string;
  name: string;
  color: string;
  tokens: number;
}

export interface Tile {
  x: number;
  y: number;
  ownerId: string | null;
}

export type MapData = Tile[][];

export interface GameData {
  users: User[];
  mapData: MapData;
  // The player playing the game.
  currentPlayerId: string;
}

export interface DecimalProblem {
  problem: string;
  answer: number;
}
