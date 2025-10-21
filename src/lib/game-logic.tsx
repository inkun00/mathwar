'use client';
import type { MathProblem, Tile, User, ProblemSubType, StorableProblem } from './types';
import { isLand } from './world-map-shape';
import React, { useMemo } from 'react';
import { cn } from './utils';


// --- Utility Functions ---
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const round = (num: number, places: number) => parseFloat(num.toFixed(places));
const shuffle = <T,>(array: T[]): T[] => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}
// Greatest Common Divisor
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);


// --- React Component Utilities for Problems ---
const Fraction = ({ numerator, denominator, className }: { numerator: number, denominator: number, className?: string }) => (
    <span className={cn("inline-flex flex-col items-center align-middle mx-1", className)}>
        <span className="text-xl leading-none">{numerator}</span>
        <span className="w-full h-px bg-current"></span>
        <span className="text-xl leading-none">{denominator}</span>
    </span>
);

const MixedFraction = ({ integer, numerator, denominator, className }: { integer: number, numerator: number, denominator: number, className?: string }) => (
     <span className={cn("inline-flex items-center align-middle", className)}>
        <span className="text-2xl mr-1">{integer}</span>
        <Fraction numerator={numerator} denominator={denominator} />
    </span>
);

// --- Problem Generation Functions ---

// 1. Direct Calculation
const generateDirectCalculationProblem = (): MathProblem => {
  const isFraction = Math.random() > 0.5;
  if (isFraction) {
      const den = randomInt(7, 13);
      let num1 = randomInt(1, den - 1);
      let num2 = randomInt(1, den-1);
      const int1 = randomInt(1,5);

      if (Math.random() > 0.5) { // 3 1/8 - 1/8
          if (num1 < num2) [num1, num2] = [num2, num1];
          return {
              problem: <span><MixedFraction integer={int1} numerator={num1} denominator={den} /> - <Fraction numerator={num2} denominator={den} /></span>,
              answer: round(int1 + num1/den - num2/den, 4),
              type: 'fraction', subType: 'direct-calculation',
              storable: { type: 'fraction', subType: 'direct-calculation', operands: [int1, num1, den, num2], operator: 'subtract' }
          };
      } else { // 5 - 2 1/7
          const int2 = randomInt(1, int1 -1);
          return {
              problem: <span>{int1} - <MixedFraction integer={int2} numerator={num2} denominator={den} /></span>,
              answer: round(int1 - (int2 + num2/den), 4),
              type: 'fraction', subType: 'direct-calculation',
              storable: { type: 'fraction', subType: 'direct-calculation', operands: [int1, int2, num2, den], operator: 'subtract' }
          };
      }
  } else { // 2.3 - 0.8
      const num1 = round(randomInt(11, 50) / 10, 1);
      const num2 = round(randomInt(1, 9) / 10, 1);
      return {
          problem: <span>{num1} - {num2}</span>,
          answer: round(num1 - num2, 2),
          type: 'decimal', subType: 'direct-calculation',
          storable: { type: 'decimal', subType: 'direct-calculation', operands: [num1, num2], operator: 'subtract' }
      };
  }
};

// 5. Word Problems
const generateWordProblem = (): MathProblem => {
  const isFraction = Math.random() > 0.5;
  if (isFraction) { // 지효는 마트에서...
      const den = randomInt(5, 15);
      const num1 = randomInt(1, den - 1);
      const num2 = randomInt(1, den - 1);
      return {
          problem: <span>지효는 마트에서 돼지고기 <Fraction numerator={num1} denominator={den} />kg, 소고기 <Fraction numerator={num2} denominator={den} />kg을 샀습니다. 고기는 모두 몇 kg인지 구하세요.</span>,
          answer: round((num1 + num2) / den, 4),
          type: 'fraction', subType: 'word-problem',
          storable: { type: 'fraction', subType: 'word-problem', operands: [num1, den, num2], operator: 'add' }
      };
  } else { // 준호는 초콜릿...
      const num1 = round(randomInt(20, 50) / 10, 1);
      let num2 = round(randomInt(10, (num1*10)-1) / 10, 1);
      return {
          problem: <span>준호는 초콜릿 {num1}kg 중에서 친구들에게 {num2}kg을 나누어주었습니다. 준호에게 남은 초콜릿의 무게를 구하세요.</span>,
          answer: round(num1 - num2, 2),
          type: 'decimal', subType: 'word-problem',
          storable: { type: 'decimal', subType: 'word-problem', operands: [num1, num2], operator: 'subtract' }
      };
  }
};

// 7. Conditional Problem
const generateConditionalProblem = (): MathProblem => {
  const isFraction = Math.random() > 0.5;
  if (isFraction) { // 9/13보다 8/13만큼 더 큰 수
      const den = randomInt(10, 15);
      let num1 = randomInt(1, den - 1);
      let num2 = randomInt(1, den - 1);
      const isBigger = Math.random() > 0.5;
      
      if (!isBigger && num1 < num2) { // ensure positive result for 'smaller'
        [num1, num2] = [num2, num1];
      }

      const answer = isBigger ? (num1 + num2) / den : (num1 - num2) / den;

      return {
          problem: <span><Fraction numerator={num1} denominator={den} />보다 <Fraction numerator={num2} denominator={den} />만큼 더 {isBigger ? '큰' : '작은'} 수는?</span>,
          answer: round(answer, 4),
          type: 'fraction', subType: 'conditional',
          storable: { type: 'fraction', subType: 'conditional', operands: [num1, den, num2, isBigger ? 1 : 0], operator: 'add' }
      };
  } else { // 4보다 2.6만큼 더 작은 수 (natural number base)
      const int1 = randomInt(3, 9);
      const num2 = round(randomInt(10, (int1*10)-1) / 10, 1);
      return {
          problem: <span>{int1}보다 {num2}만큼 더 작은 수는?</span>,
          answer: round(int1 - num2, 2),
          type: 'decimal', subType: 'conditional',
          storable: { type: 'decimal', subType: 'conditional', operands: [int1, num2], operator: 'subtract' }
      };
  }
};

// 8. List Navigation
const generateListNavigationProblem = (): MathProblem => {
    const isFraction = Math.random() > 0.5;
    const isSum = Math.random() > 0.5;
    
    if (isFraction) {
        const den = randomInt(10, 20);
        const nums = Array.from({ length: 4 }, () => randomInt(1, den - 1));
        const uniqueNums = [...new Set(nums)];
        while (uniqueNums.length < 4) {
            uniqueNums.push(randomInt(1, den-1));
        }
        
        const sorted = [...uniqueNums].sort((a,b) => a-b);
        const smallest = sorted[0];
        const largest = sorted[sorted.length-1];
        const answer = isSum ? (largest + smallest) / den : (largest - smallest) / den;
        
        return {
            problem: (
                <div className="text-center">
                    <span>다음 카드 중 가장 큰 수와 가장 작은 수의 {isSum ? '합' : '차'}을/를 구하세요.</span>
                    <div className="flex justify-center gap-2 mt-2">{uniqueNums.map(n => <div key={n} className="p-2 border rounded bg-gray-100"><Fraction numerator={n} denominator={den} /></div>)}</div>
                </div>
            ),
            answer: round(answer, 4),
            type: 'fraction', subType: 'list-navigation',
            storable: { type: 'fraction', subType: 'list-navigation', operands: [den, ...uniqueNums, isSum ? 1:0], operator: 'calculate' }
        }
    } else { // decimal
        const decimals = Array.from({ length: 4 }, () => round(randomInt(100, 999) / 100, 2));
        const sorted = [...decimals].sort((a,b) => a-b);
        const smallest = sorted[0];
        const largest = sorted[sorted.length-1];
        const answer = isSum ? largest + smallest : largest - smallest;

        return {
             problem: (
                <div className="text-center">
                    <span>다음 카드 중 가장 큰 수와 가장 작은 수의 {isSum ? '합' : '차'}을/를 구하세요.</span>
                    <div className="flex justify-center gap-2 mt-2">{decimals.map(n => <div key={n} className="p-3 border rounded bg-gray-100 font-mono">{n}</div>)}</div>
                </div>
            ),
            answer: round(answer, 4),
            type: 'decimal', subType: 'list-navigation',
            storable: { type: 'decimal', subType: 'list-navigation', operands: [...decimals, isSum ? 1:0], operator: 'calculate' }
        }
    }
}

// Fallback for generating old problems if needed
const generateLegacyProblem = (): MathProblem => {
  const isFraction = Math.random() > 0.5;
  if(isFraction) {
    const den = randomInt(5, 15);
    let num1 = randomInt(1, den - 1);
    let num2 = randomInt(1, den - 1);
    const op = Math.random() > 0.5 ? 'add' : 'subtract';

    if (op === 'subtract' && num1 < num2) {
        [num1, num2] = [num2, num1];
    }
    const answerNum = op === 'add' ? num1 + num2 : num1 - num2;
    return {
      problem: (
        <span className="flex items-center justify-center">
            <Fraction numerator={num1} denominator={den} />
            <span className="mx-2 text-2xl">{op === 'add' ? '+' : '-'}</span>
            <Fraction numerator={num2} denominator={den} />
        </span>
      ),
      answer: round(answerNum / den, 4),
      type: 'fraction',
      subType: 'fraction-add-same-den',
      storable: { type: 'fraction', subType: 'fraction-add-same-den', operands: [num1, den, num2, den], operator: op }
    };
  } else {
    let num1 = round(Math.random() * 20, 1);
    let num2 = round(Math.random() * 20, 1);
    if (num1 < num2) [num1, num2] = [num2, num1];
    return {
      problem: <span>{num1} - {num2}</span>,
      answer: round(num1 - num2, 2),
      type: 'decimal',
      subType: 'decimal-subtract',
      storable: { type: 'decimal', subType: 'decimal-subtract', operands: [num1, num2], operator: 'subtract' }
    }
  }
}

export const generateProblemFromData = (data: StorableProblem): MathProblem => {
    // This function can be expanded to reconstruct all new problem types for the "Wrong Answers" feature.
    // For now, it will default to a simple problem if the subtype is new.
    const { subType } = data;
    switch(subType) {
        case 'direct-calculation':
        case 'word-problem':
        case 'conditional':
        case 'list-navigation':
            // Since these are complex, we'll just generate a new random one of the same type for review.
            // A full implementation would reconstruct the exact problem.
            if(data.type === 'decimal') return generateConditionalProblem();
            if(data.type === 'fraction') return generateDirectCalculationProblem();
            break;
        default:
            // Let's handle legacy problems
            const { operands } = data;
            if (data.type === 'fraction') {
                const [num1, den, num2] = operands as number[];
                const op = data.operator;
                const answerNum = op === 'add' ? num1 + num2 : num1 - num2;
                return {
                    problem: <span><Fraction numerator={num1} denominator={den} /> {op === 'add' ? '+': '-'} <Fraction numerator={num2} denominator={den} /></span>,
                    answer: round(answerNum / den, 4),
                    type: 'fraction', subType, storable: data
                }
            } else {
                 const [num1, num2] = operands as number[];
                 return {
                    problem: <span>{num1} - {num2}</span>,
                    answer: round(num1-num2, 2),
                    type: 'decimal', subType, storable: data
                 }
            }
    }
    return generateLegacyProblem();
};


export const problemNodeToString = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (node instanceof Array) return node.map(child => problemNodeToString(child)).join('');
    if (React.isValidElement(node) && node.props.children) {
        // A simple heuristic to flatten component to string for storage
        if (node.type === Fraction) return `${node.props.numerator}/${node.props.denominator}`;
        if (node.type === MixedFraction) return `${node.props.integer} ${node.props.numerator}/${node.props.denominator}`;
        return React.Children.toArray(node.props.children).map(child => problemNodeToString(child)).join('');
    }
    return '';
};


// --- Main Problem Generation Function ---
const problemGenerators = [
  generateDirectCalculationProblem,
  generateWordProblem,
  generateConditionalProblem,
  generateListNavigationProblem,
  // NOTE: More complex input types (Fill in the blank, multiple choice, etc.)
  // require significant UI changes in `problem-modal.tsx` and are excluded for now.
  // The 4 types above all use a single numeric answer.
];

export const generateMathProblem = (): MathProblem => {
  const generator = problemGenerators[randomInt(0, problemGenerators.length - 1)];
  return generator();
};


// --- Game Logic Functions ---
export const isAdjacent = (tileX: number, tileY: number, userTiles: Tile[]) => {
    return userTiles.some(userTile => 
        (Math.abs(userTile.x - tileX) === 1 && userTile.y === tileY) ||
        (Math.abs(userTile.y - tileY) === 1 && userTile.x === tileX)
    );
};

export const getAIMove = (
  ai: User,
  aiTiles: Tile[],
  allTiles: Tile[],
  allUsers: User[]
): Tile | null => {
  if ((ai.tokens ?? 0) <= 0) return null;

  if (aiTiles.length === 0) {
    const emptyLandTiles = allTiles.filter(
      (t) => t.ownerId === null && isLand(t.x, t.y)
    );
    if (emptyLandTiles.length > 0) {
      const randomIndex = Math.floor(Math.random() * emptyLandTiles.length);
      return emptyLandTiles[randomIndex];
    }
    return null;
  }

  const conquerableTiles: Tile[] = [];
  const neighborOffsets = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];

  const aiTileSet = new Set(aiTiles.map((t) => `${t.x},${t.y}`));

  for (const aiTile of aiTiles) {
    for (const offset of neighborOffsets) {
      const neighborX = aiTile.x + offset.dx;
      const neighborY = aiTile.y + offset.dy;

      if (aiTileSet.has(`${neighborX},${neighborY}`)) continue;

      const neighborTile = allTiles.find(
        (t) => t.x === neighborX && t.y === neighborY
      );
      
      const targetTile = neighborTile ?? { id: `${neighborX}-${neighborY}`, x: neighborX, y: neighborY, ownerId: null };

      if (
        isLand(neighborX, neighborY) &&
        targetTile.ownerId !== ai.id
      ) {
        conquerableTiles.push(targetTile);
      }
    }
  }

  if (conquerableTiles.length > 0) {
    // Deduplicate conquerable tiles
    const uniqueConquerable = Array.from(new Map(conquerableTiles.map(t => [t.id, t])).values());

    const enemyTiles = uniqueConquerable.filter(
      (t) => t.ownerId !== null && t.ownerId !== ai.id
    );
    if (enemyTiles.length > 0) {
      // Prioritize tiles owned by users with the most land
      const ownerTileCounts = allUsers.reduce((acc, user) => {
        acc[user.id] = allTiles.filter((t) => t.ownerId === user.id).length;
        return acc;
      }, {} as Record<string, number>);

      enemyTiles.sort((a, b) => {
        const countA = a.ownerId ? ownerTileCounts[a.ownerId] ?? 0 : 0;
        const countB = b.ownerId ? ownerTileCounts[b.ownerId] ?? 0 : 0;
        return countB - countA; // Attack user with more tiles
      });

      return enemyTiles[0];
    }

    // Expand into empty territory
    const emptyTiles = uniqueConquerable.filter(t => t.ownerId === null);
    if (emptyTiles.length > 0) {
      const randomIndex = Math.floor(Math.random() * emptyTiles.length);
      return emptyTiles[randomIndex];
    }
  }

  return null;
};
