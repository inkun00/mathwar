'use client';
import type { MathProblem, Tile, User, ProblemSubType, StorableProblem } from './types';
import { isLand } from './world-map-shape';
import React from 'react';

// --- Utility Functions ---
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const round = (num: number, places: number) => parseFloat(num.toFixed(places));

// --- Fraction Component ---
const Fraction = ({ numerator, denominator }: { numerator: number, denominator: number }) => (
    <span className="inline-flex flex-col items-center align-middle mx-1">
        <span className="text-xl leading-none">{numerator}</span>
        <span className="w-full h-px bg-current"></span>
        <span className="text-xl leading-none">{denominator}</span>
    </span>
);

const MixedFraction = ({ integer, numerator, denominator }: { integer: number, numerator: number, denominator: number }) => (
     <span className="inline-flex items-center align-middle">
        <span className="text-2xl mr-1">{integer}</span>
        <Fraction numerator={numerator} denominator={denominator} />
    </span>
);


// --- Decimal Problem Generation ---
const generateDecimalProblem = (): MathProblem => {
  const isAdvanced = Math.random() > 0.5;
  const operation = Math.random() > 0.5 ? 'add' : 'subtract';
  let num1 = round(Math.random() * (isAdvanced ? 50 : 20), isAdvanced ? 2 : 1);
  let num2 = round(Math.random() * (isAdvanced ? 50 : 20), isAdvanced ? 2 : 1);
  let subType: ProblemSubType = operation === 'add' ? 'decimal-add' : 'decimal-subtract';

  if (operation === 'subtract' && num1 < num2) {
    [num1, num2] = [num2, num1]; // Ensure positive result
  }

  const problem: MathProblem = {
    problem: <span>{`${num1} ${operation === 'add' ? '+' : '-'} ${num2} 의 값은?`}</span>,
    answer: round(operation === 'add' ? num1 + num2 : num1 - num2, 2),
    type: 'decimal',
    subType: subType,
    storable: {
      type: 'decimal',
      subType: subType,
      operands: [num1, num2],
      operator: operation
    }
  };

  return problem;
};

// --- Fraction Problem Generation ---
const generateFractionProblem = (): MathProblem => {
    const type = randomInt(1, 3);
    switch (type) {
        case 1: // 진분수 덧셈/뺄셈 (동일 분모)
            return simpleFractionCalc();
        case 2: // 대분수 덧셈/뺄셈
            return mixedFractionCalc();
        case 3: // 자연수 - 분수
        default:
            return integerFractionCalc();
    }
}

const simpleFractionCalc = (): MathProblem => {
    const den = randomInt(5, 15);
    let num1 = randomInt(1, den - 1);
    let num2 = randomInt(1, den - 1);
    const op = Math.random() > 0.5 ? 'add' : 'subtract';
    const subType: ProblemSubType = op === 'add' ? 'fraction-add-same-den' : 'fraction-subtract-same-den';


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
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
      ),
      answer: round(answerNum / den, 4),
      type: 'fraction',
      subType,
      storable: {
        type: 'fraction',
        subType,
        operands: [num1, den, num2, den],
        operator: op,
      }
    };
}

const mixedFractionCalc = (): MathProblem => {
    const op = Math.random() > 0.5 ? 'add' : 'subtract';
    const subType: ProblemSubType = op === 'add' ? 'fraction-add-mixed' : 'fraction-subtract-mixed';
    const den = randomInt(5, 12);

    let int1 = randomInt(1, 5);
    let num1 = randomInt(1, den - 1);
    let int2 = randomInt(1, 5);
    let num2 = randomInt(1, den - 1);
    
    let val1 = int1 + num1 / den;
    let val2 = int2 + num2 / den;

    if (op === 'subtract' && val1 < val2) {
        [int1, num1, int2, num2] = [int2, num2, int1, num1];
        [val1, val2] = [val2, val1];
    }

    const answerVal = op === 'add' ? val1 + val2 : val1 - val2;

    return {
      problem: (
        <span className="flex items-center justify-center">
            <MixedFraction integer={int1} numerator={num1} denominator={den} />
            <span className="mx-2 text-2xl">{op === 'add' ? '+' : '-'}</span>
            <MixedFraction integer={int2} numerator={num2} denominator={den} />
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
      ),
      answer: round(answerVal, 4),
      type: 'fraction',
      subType,
      storable: {
        type: 'fraction',
        subType,
        operands: [int1, num1, den, int2, num2, den],
        operator: op,
      }
    };
}

const integerFractionCalc = (): MathProblem => {
    const int = randomInt(2, 10);
    const den = randomInt(3, 12);
    const num = randomInt(1, den - 1);
    const subType: ProblemSubType = 'fraction-subtract-from-int';

    return {
      problem: (
        <span className="flex items-center justify-center">
            <span className="text-2xl">{int}</span>
            <span className="mx-2 text-2xl">-</span>
            <Fraction numerator={num} denominator={den} />
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
      ),
      answer: round(int - (num/den), 4),
      type: 'fraction',
      subType,
      storable: {
        type: 'fraction',
        subType,
        operands: [int, num, den],
        operator: 'subtract',
      }
    };
}

export const generateProblemFromData = (data: StorableProblem): MathProblem => {
    const { type, subType, operands, operator } = data;
    const opSymbol = operator === 'add' ? '+' : '-';

    switch (subType) {
        case 'decimal-add':
        case 'decimal-subtract':
            return {
                problem: <span>{`${operands[0]} ${opSymbol} ${operands[1]} 의 값은?`}</span>,
                answer: round(operator === 'add' ? operands[0] + operands[1] : operands[0] - operands[1], 2),
                type: 'decimal',
                subType,
                storable: data
            };
        case 'fraction-add-same-den':
        case 'fraction-subtract-same-den':
            return {
                problem: (
                    <span className="flex items-center justify-center">
                        <Fraction numerator={operands[0]} denominator={operands[1]} />
                        <span className="mx-2 text-2xl">{opSymbol}</span>
                        <Fraction numerator={operands[2]} denominator={operands[3]} />
                        <span className="ml-3 text-2xl">의 값은?</span>
                    </span>
                ),
                answer: round((operator === 'add' ? operands[0] + operands[2] : operands[0] - operands[2]) / operands[1], 4),
                type: 'fraction', subType, storable: data
            };
        case 'fraction-add-mixed':
        case 'fraction-subtract-mixed':
             const val1 = operands[0] + operands[1] / operands[2];
             const val2 = operands[3] + operands[4] / operands[5];
            return {
                problem: (
                     <span className="flex items-center justify-center">
                        <MixedFraction integer={operands[0]} numerator={operands[1]} denominator={operands[2]} />
                        <span className="mx-2 text-2xl">{opSymbol}</span>
                        <MixedFraction integer={operands[3]} numerator={operands[4]} denominator={operands[5]} />
                        <span className="ml-3 text-2xl">의 값은?</span>
                    </span>
                ),
                answer: round(operator === 'add' ? val1 + val2 : val1 - val2, 4),
                type: 'fraction', subType, storable: data
            };
        case 'fraction-subtract-from-int':
            return {
                 problem: (
                    <span className="flex items-center justify-center">
                        <span className="text-2xl">{operands[0]}</span>
                        <span className="mx-2 text-2xl">-</span>
                        <Fraction numerator={operands[1]} denominator={operands[2]} />
                        <span className="ml-3 text-2xl">의 값은?</span>
                    </span>
                ),
                answer: round(operands[0] - (operands[1]/operands[2]), 4),
                type: 'fraction', subType, storable: data
            };
        default:
            // Fallback for any unhandled subtype
            return generateDecimalProblem();
    }
};

export const problemNodeToString = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (React.isValidElement(node) && node.props.children) {
        const children = React.Children.toArray(node.props.children);
        return children.map(child => problemNodeToString(child)).join('');
    }
    return '';
};


// --- Main Problem Generation Function ---
export const generateMathProblem = (): MathProblem => {
  const problemType = Math.random() > 0.5 ? 'decimal' : 'fraction';
  if (problemType === 'decimal') {
    return generateDecimalProblem();
  } else {
    return generateFractionProblem();
  }
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
  if (ai.tokens <= 0) return null;

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

      if (
        neighborTile &&
        isLand(neighborX, neighborY) &&
        neighborTile.ownerId !== ai.id
      ) {
        conquerableTiles.push(neighborTile);
      }
    }
  }

  if (conquerableTiles.length > 0) {
    const enemyTiles = conquerableTiles.filter(
      (t) => t.ownerId !== null && t.ownerId !== ai.id
    );
    if (enemyTiles.length > 0) {
      // Prioritize tiles owned by users with the most land
      const ownerTileCounts = allUsers.reduce((acc, user) => {
        acc[user.id] = allTiles.filter((t) => t.ownerId === user.id).length;
        return acc;
      }, {} as Record<string, number>);

      enemyTiles.sort((a, b) => {
        const countA = a.ownerId ? ownerTileCounts[a.ownerId] : 0;
        const countB = b.ownerId ? ownerTileCounts[b.ownerId] : 0;
        return countB - countA; // Attack user with more tiles
      });

      return enemyTiles[0];
    }

    // Expand into empty territory
    const randomIndex = Math.floor(Math.random() * conquerableTiles.length);
    return conquerableTiles[randomIndex];
  }

  return null;
};
