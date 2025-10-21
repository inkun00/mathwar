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
  conqueredCountries?: string[]; // Array of conquered country IDs
}

export interface Country {
  id: string;
  name: string;
  createdBy: string;
  color: string;
  demised?: boolean; // True if the country has fallen
}

export interface Tile {
  id: string;
  x: number;
  y: number;
  ownerId: string | null;
}

export type MapData = Tile[][];

export type ProblemType = 'decimal' | 'fraction' | 'conversion';
export type ProblemSubType = 
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
  answer: number; // All answers are handled as numbers, fractions will be converted.
  type: ProblemType;
  subType: ProblemSubType;
  storable: StorableProblem;
}

export interface StorableProblem {
  type: ProblemType;
  subType: ProblemSubType;
  operands: (number | string)[];
  operator: 'add' | 'subtract' | 'compare' | 'convert';
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
