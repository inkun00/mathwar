'use client';
import type { MathProblem, Tile, User, ProblemSubType, StorableProblem } from './types';
import { isLand } from './world-map-shape';
import React from 'react';
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
const Fraction = ({ numerator, denominator, className }: { numerator: number | string, denominator: number | string, className?: string }) => (
    <span className={cn("inline-flex flex-col items-center align-middle mx-1", className)}>
        <span className="text-xl leading-none">{numerator}</span>
        <span className="w-full h-px bg-current"></span>
        <span className="text-xl leading-none">{denominator}</span>
    </span>
);

const MixedFraction = ({ integer, numerator, denominator, className }: { integer: number | string, numerator: number | string, denominator: number | string, className?: string }) => (
     <span className={cn("inline-flex items-center align-middle", className)}>
        <span className="text-2xl mr-1">{integer}</span>
        <Fraction numerator={numerator} denominator={denominator} />
    </span>
);

const AnswerInput = ({ index }: { index: number }) => (
    <span className="inline-block" data-answer-input={index}></span>
);

// --- Problem Generation Functions ---

// 1. 직접 계산형
const generateDirectCalculationProblem = (): MathProblem => {
  const isFraction = Math.random() > 0.5;
  if (isFraction) {
      const den = randomInt(7, 13);
      let num1 = randomInt(1, den - 1);
      let num2 = randomInt(1, den-1);
      const int1 = randomInt(3, 8);
      if (Math.random() > 0.5) { // 5 - 2 1/7
          const int2 = randomInt(1, int1 -1);
          return {
              problem: <span>{int1} - <MixedFraction integer={int2} numerator={num2} denominator={den} /> = <AnswerInput index={0} /></span>,
              answer: [String(round(int1 - (int2 + num2/den), 4))],
              type: 'fraction', subType: 'direct-calculation',
              storable: { type: 'fraction', subType: 'direct-calculation', operands: [int1, int2, num2, den], operator: 'subtract' }
          };
      } else { // 3 1/8 - 1/8
          if (num1 < num2) [num1, num2] = [num2, num1];
          return {
              problem: <span><MixedFraction integer={int1} numerator={num1} denominator={den} /> - <Fraction numerator={num2} denominator={den} /> = <AnswerInput index={0} /></span>,
              answer: [String(round(int1 + num1/den - num2/den, 4))],
              type: 'fraction', subType: 'direct-calculation',
              storable: { type: 'fraction', subType: 'direct-calculation', operands: [int1, num1, den, num2], operator: 'subtract' }
          };
      }
  } else { // 2.3 - 0.8
      const num1 = round(randomInt(11, 50) / 10, 1);
      const num2 = round(randomInt(1, Math.floor(num1*10) - 10) / 10, 1);
      return {
          problem: <span>{num1} - {num2} = <AnswerInput index={0} /></span>,
          answer: [String(round(num1 - num2, 2))],
          type: 'decimal', subType: 'direct-calculation',
          storable: { type: 'decimal', subType: 'direct-calculation', operands: [num1, num2], operator: 'subtract' }
      };
  }
};

// 2. 연산 과정 분해형
const generateProcessDecompositionProblem = (): MathProblem => {
    const den = randomInt(5, 9);
    const int1 = randomInt(3, 5);
    const num1 = randomInt(1, den-1);
    const int2 = randomInt(1, int1-1);
    const num2 = randomInt(1, den-1);
    
    // 5 - 2 4/5 = 4 [?] / 5 - 2 4/5 = [?] [?]/5
    return {
        problem: (
            <span>
                {int1} - <MixedFraction integer={int2} numerator={num2} denominator={den} /> = 
                <MixedFraction integer={int1-1} numerator={<AnswerInput index={0}/>} denominator={den} /> - <MixedFraction integer={int2} numerator={num2} denominator={den} /> = 
                <MixedFraction integer={<AnswerInput index={1}/>} numerator={<AnswerInput index={2}/>} denominator={den} />
            </span>
        ),
        answer: [String(den), String(int1 - 1 - int2), String(den - num2)],
        type: 'fraction',
        subType: 'process-decomposition',
        storable: { type: 'fraction', subType: 'process-decomposition', operands: [int1, int2, num2, den], operator: 'subtract' }
    }
};

// 3. 수직 계산대형 - 주관식으로 단순화
const generateVerticalCalculationProblem = (): MathProblem => {
    const num1 = round(randomInt(200, 500) / 100, 2);
    const num2 = round(randomInt(1, 150) / 100, 2);
    const answer = round(num1 + num2, 2);
    const [intPart, decPart] = String(answer).split('.');
    
    return {
        problem: (
            <div className="text-right font-mono pr-4">
                <div>{num1.toFixed(2)}</div>
                <div>+ {num2.toFixed(2)}</div>
                <div className="border-t border-current mt-1 pt-1">
                  <AnswerInput index={0} />.<AnswerInput index={1} />
                </div>
            </div>
        ),
        answer: [intPart, decPart.padEnd(2, '0')],
        type: 'decimal', subType: 'vertical-calculation',
        storable: {type: 'decimal', subType: 'vertical-calculation', operands: [num1, num2], operator: 'add' }
    }
};

// 4. 다단계 문장제
const generateMultiStepWordProblem = (): MathProblem => {
    const minhoTotal = round(randomInt(300, 500) / 100, 2);
    const minhoDrank = round(randomInt(1, 150) / 100, 2);
    const jisuTotal = round(randomInt(300, 500) / 100, 2);
    const jisuDrank = round(randomInt(1, 150) / 100, 2);

    const minhoLeft = round(minhoTotal - minhoDrank, 2);
    const jisuLeft = round(jisuTotal - jisuDrank, 2);
    const winner = minhoLeft > jisuLeft ? '민호' : '지수';

    return {
        problem: (
            <div>
                <p className="mb-4">민호는 물 {minhoTotal}L 중 {minhoDrank}L를 마셨고, 지수는 물 {jisuTotal}L 중 {jisuDrank}L를 마셨습니다. 남은 물의 양이 더 많은 사람은 누구인가요?</p>
                <div className="space-y-2 text-left">
                    <p>1단계: 민호가 남은 물의 양은? <AnswerInput index={0} /> L</p>
                    <p>2단계: 지수가 남은 물의 양은? <AnswerInput index={1} /> L</p>
                    <p>3단계: 남은 물이 더 많은 사람은? <AnswerInput index={2} /></p>
                </div>
            </div>
        ),
        answer: [String(minhoLeft), String(jisuLeft), winner],
        type: 'mixed', subType: 'multi-step-word-problem',
        storable: { type: 'mixed', subType: 'multi-step-word-problem', operands: [minhoTotal, minhoDrank, jisuTotal, jisuDrank], operator: 'multi-step'}
    }
};

// 5. 개념 단위 변환형
const generateUnitConversionConceptProblem = (): MathProblem => {
    const num = randomInt(101, 299);
    const decimal = round(num / 100, 2);
    return {
        problem: <span>{decimal}은 0.01이 <AnswerInput index={0} />개입니다.</span>,
        answer: [String(num)],
        type: 'decimal', subType: 'unit-conversion-concept',
        storable: { type: 'decimal', subType: 'unit-conversion-concept', operands: [decimal], operator: 'convert' }
    }
};

// 6. 조건부 연산형 (수식 완성)
const generateConditionalOperationProblem = (): MathProblem => {
    const decimals = shuffle(Array.from({ length: 4 }, () => round(randomInt(100, 999) / 100, 2)));
    const sorted = [...decimals].sort((a,b) => a-b);
    const smallest = sorted[0];
    const largest = sorted[sorted.length-1];
    const diff = round(largest - smallest, 2);

    return {
        problem: (
            <div className="text-center">
                <p>다음 카드 중 가장 큰 수와 가장 작은 수의 차를 구하세요.</p>
                <div className="flex justify-center gap-2 my-2">{decimals.map(n => <div key={n} className="p-3 border rounded bg-gray-100 font-mono">{n}</div>)}</div>
                <p className="font-mono">
                    <AnswerInput index={0} /> - <AnswerInput index={1} /> = <AnswerInput index={2} />
                </p>
            </div>
        ),
        answer: [String(largest), String(smallest), String(diff)],
        type: 'decimal', subType: 'conditional-operation',
        storable: { type: 'decimal', subType: 'conditional-operation', operands: decimals, operator: 'calculate' }
    }
}


export const generateProblemFromData = (data: StorableProblem): MathProblem => {
    // This is a placeholder. A full implementation would reconstruct the problem.
    // For now, we generate a new, simple problem of the same type.
    if(data.type === 'fraction') return generateDirectCalculationProblem();
    if(data.type === 'decimal') return generateUnitConversionConceptProblem();
    return generateDirectCalculationProblem(); // Fallback
};


export const problemNodeToString = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (node instanceof Array) return node.map(child => problemNodeToString(child)).join('');
    if (React.isValidElement(node) && node.props.children) {
        if (node.type === AnswerInput) return `[답${node.props.index}]`;
        if (node.type === Fraction) return `${node.props.numerator}/${node.props.denominator}`;
        if (node.type === MixedFraction) return `${node.props.integer} ${node.props.numerator}/${node.props.denominator}`;
        return React.Children.toArray(node.props.children).map(child => problemNodeToString(child)).join('');
    }
    return '';
};


// --- Main Problem Generation Function ---
// Note: UI-heavy types like drag-and-drop or highlight-and-correct are simplified to subjective input.
const problemGenerators = [
  generateDirectCalculationProblem,
  generateProcessDecompositionProblem,
  generateVerticalCalculationProblem,
  generateMultiStepWordProblem,
  generateUnitConversionConceptProblem,
  generateConditionalOperationProblem,
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
