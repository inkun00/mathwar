'use client';
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
export type ProblemSubType = 
  | 'decimal-add' 
  | 'decimal-subtract'
  | 'fraction-add-same-den'
  | 'fraction-subtract-same-den'
  | 'fraction-add-mixed'
  | 'fraction-subtract-mixed'
  | 'fraction-subtract-from-int';


export interface MathProblem {
  problem: ReactNode;
  answer: number; // All answers are handled as numbers, fractions will be converted.
  type: ProblemType;
  subType: ProblemSubType;
}

export interface ProblemAttempt {
    id: string;
    userId: string;
    unit: ProblemType;
    area: ProblemSubType;
    correct: boolean;
    timestamp: any; // Firestore ServerTimestamp
}

export type InvasionTarget = {
    x: number;
    y: number;
    originalOwnerId: string;
} | null;
