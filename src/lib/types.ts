'use client';
import type { ReactNode } from "react";

export interface User {
  id: string; // Firebase UID for human, or some unique ID for AI
  uid: string;
  nickname: string;
  email: string;
  countryId: string;
  tokens: number;
  walls?: number; // Number of walls the user owns
  isAI?: boolean;
  conqueredCountries?: string[]; // Array of conquered country IDs
  gamePoints?: number;
  lastPointDistribution?: string; // YYYY-MM-DD
  isCountryOwner?: boolean;
}

export interface Country {
  id: string;
  name: string;
  createdBy: string;
  color: string;
  demised?: boolean; // True if the country has fallen
  flag?: string[]; // 10x10 grid of colors
}

export interface Tile {
  id: string;
  x: number;
  y: number;
  ownerId: string | null;
  hasWall?: boolean; // True if the tile has a wall
}

export type MapData = Tile[][];

export type ProblemType = 'decimal' | 'fraction' | 'conversion' | 'mixed';
export type ProblemSubType = 
  | 'direct-calculation'
  | 'process-decomposition'
  | 'vertical-calculation'
  | 'multi-step-word-problem'
  | 'unit-conversion-concept'
  | 'finer-unit-conversion-concept'
  | 'conditional-operation'
  | 'find-and-operate'
  | 'fill-in-the-blanks-process'
  | 'fill-in-the-blanks-concept'
  // Legacy types
  | 'comparison'
  | 'word-problem'
  | 'error-analysis'
  | 'conditional'
  | 'list-navigation'
  | 'multiple-choice'
  | 'diagram'
  | 'decimal-add' 
  | 'decimal-subtract'
  | 'fraction-add-same-den'
  | 'fraction-subtract-same-den'
  | 'fraction-add-mixed'
  | 'fraction-subtract-mixed'
  | 'fraction-subtract-from-int'
  | 'fraction-word-problem'
  | 'fraction-comparison'
  | 'fraction-to-decimal'
  | 'decimal-to-fraction';

export interface MathProblem {
  problem: ReactNode;
  answer: string[]; // All answers are handled as arrays of strings.
  type: ProblemType;
  subType: ProblemSubType;
  storable: StorableProblem;
}

export interface StorableProblem {
  type: ProblemType;
  subType: ProblemSubType;
  operands: (number | string)[];
  operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'compare' | 'convert' | 'calculate' | 'multi-step';
}


export interface ProblemAttempt {
    id: string;
    userId: string;
    unit: ProblemType;
    area: ProblemSubType;
    correct: boolean;
    timestamp: any; // Firestore ServerTimestamp
    isReview: boolean;
    problem: string;
}

export interface WrongAnswer {
  id: string;
  userId: string;
  problemData: StorableProblem;
  problemString: string;
  createdAt: any; // Firestore ServerTimestamp
}


export type InvasionTarget = {
    x: number;
    y: number;
    originalOwnerId: string | null;
    hasWall?: boolean;
} | null;


export interface RankedUser {
  rank: number;
  id: string;
  nickname: string;
  tileCount: number;
}

export interface RankedCountry {
  rank: number;
  id: string;
  name: string;
  color: string;
  tileCount: number;
}
