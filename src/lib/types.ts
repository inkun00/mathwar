import type { ReactNode } from "react";

export interface User {
  id: string; // Firebase UID for human, or some unique ID for AI
  uid: string;
  nickname: string;
  email: string;
  countryId: string;
  color: string;
  tokens: number;
  isAI?: boolean;
}

export interface Country {
  id: string;
  name: string;
  createdBy: string;
}

export interface Tile {
  id: string;
  x: number;
  y: number;
  ownerId: string | null;
}

export type MapData = Tile[][];

export type ProblemType = 'decimal' | 'fraction';

export interface MathProblem {
  problem: ReactNode;
  answer: number; // All answers are handled as numbers, fractions will be converted.
  type: ProblemType;
}
