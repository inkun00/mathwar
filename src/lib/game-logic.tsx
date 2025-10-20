'use client';
import type { MathProblem, Tile, User, ProblemSubType } from './types';
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

  const problem = <span>{`${num1} ${operation === 'add' ? '+' : '-'} ${num2} 의 값은?`}</span>;
  const answer = operation === 'add' ? num1 + num2 : num1 - num2;

  return {
    problem,
    answer: round(answer, 2),
    type: 'decimal',
    subType: subType,
  };
};

// --- Fraction Problem Generation ---
const generateFractionProblem = (): MathProblem => {
    const type = randomInt(1, 4);
    switch (type) {
        case 1: // 진분수 덧셈/뺄셈 (동일 분모)
            return simpleFractionCalc();
        case 2: // 대분수 덧셈/뺄셈
            return mixedFractionCalc();
        case 3: // 자연수 - 분수
            return integerFractionCalc();
        case 4: // 다른 분모를 가진 분수의 덧셈/뺄셈
        default:
            return commonDenominatorFractionCalc();
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

    const problem = (
        <span className="flex items-center justify-center">
            <Fraction numerator={num1} denominator={den} />
            <span className="mx-2 text-2xl">{op === 'add' ? '+' : '-'}</span>
            <Fraction numerator={num2} denominator={den} />
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
    );
    const answerNum = op === 'add' ? num1 + num2 : num1 - num2;
    return { problem, answer: round(answerNum / den, 4), type: 'fraction', subType };
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

    const problem = (
        <span className="flex items-center justify-center">
            <MixedFraction integer={int1} numerator={num1} denominator={den} />
            <span className="mx-2 text-2xl">{op === 'add' ? '+' : '-'}</span>
            <MixedFraction integer={int2} numerator={num2} denominator={den} />
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
    );
    const answerVal = op === 'add' ? val1 + val2 : val1 - val2;

    return { problem, answer: round(answerVal, 4), type: 'fraction', subType };
}

const integerFractionCalc = (): MathProblem => {
    const int = randomInt(2, 10);
    const den = randomInt(3, 12);
    const num = randomInt(1, den - 1);

    const problem = (
        <span className="flex items-center justify-center">
            <span className="text-2xl">{int}</span>
            <span className="mx-2 text-2xl">-</span>
            <Fraction numerator={num} denominator={den} />
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
    );
    const answer = int - (num/den);
    return { problem, answer: round(answer, 4), type: 'fraction', subType: 'fraction-subtract-from-int' };
}

const commonDenominatorFractionCalc = (): MathProblem => {
    let den1 = randomInt(2, 7);
    let den2 = randomInt(den1 + 1, 10); // Ensure different denominators
    let num1 = randomInt(1, den1 - 1);
    if (num1 === 0) num1 = 1;
    let num2 = randomInt(1, den2 - 1);
    if (num2 === 0) num2 = 1;
    const op = Math.random() > 0.5 ? 'add' : 'subtract';
    const subType: ProblemSubType = op === 'add' ? 'fraction-add-diff-den' : 'fraction-subtract-diff-den';


    let val1 = num1/den1;
    let val2 = num2/den2;

    if (op === 'subtract' && val1 < val2) {
        [num1, den1, num2, den2] = [num2, den2, num1, den1];
        [val1, val2] = [val2, val1];
    }

    const problem = (
         <span className="flex items-center justify-center">
            <Fraction numerator={num1} denominator={den1} />
            <span className="mx-2 text-2xl">{op === 'add' ? '+' : '-'}</span>
            <Fraction numerator={num2} denominator={den2} />
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
    );
    const answer = op === 'add' ? val1 + val2 : val1 - val2;

    return { problem, answer: round(answer, 4), type: 'fraction', subType };
}


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
