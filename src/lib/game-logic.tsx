'use client';
import type {
  MathProblem,
  Tile,
  User,
  ProblemSubType,
  StorableProblem,
} from './types';
import { isLand } from './world-map-shape';
import React, { ReactNode } from 'react';
import { cn } from './utils';

// --- Utility Functions ---
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const round = (num: number, places: number) => parseFloat(num.toFixed(places));

// --- React Component Utilities for Problems ---

// A placeholder component to be replaced by a real Input
export const AnswerInput = () => <div data-answer-input="true" style={{display: 'none'}} />;


interface FractionProps {
  numerator?: number | string | React.ReactNode;
  denominator?: number | string | React.ReactNode;
  className?: string;
}

const Fraction = ({
  numerator,
  denominator,
  className,
}: FractionProps) => {

  const numElement = <span className="text-xl leading-none">{numerator}</span>;
  const denElement = <span className="text-xl leading-none">{denominator}</span>;

  return (
    <span
      className={cn('inline-flex flex-col items-center align-middle mx-1', className)}
    >
      {numElement}
      <span className="w-full h-px bg-current"></span>
      {denElement}
    </span>
  );
};

interface MixedFractionProps extends FractionProps {
    integer?: number | string | React.ReactNode;
}

const MixedFraction = ({
  integer,
  numerator,
  denominator,
  className,
}: MixedFractionProps) => {
    const intElement = <span className="text-2xl mr-1">{integer}</span>;

    return (
        <span className={cn('inline-flex items-center align-middle', className)}>
            {intElement}
            <Fraction 
                numerator={numerator} 
                denominator={denominator}
            />
        </span>
    );
};


// 1. 직접 계산형 (단답형 입력)
const generateDirectCalculationProblem = (): MathProblem => {
  // 2.3 - 0.8
  const num1 = round(randomInt(11, 50) / 10, 1);
  const num2 = round(randomInt(1, Math.floor(num1 * 10) - 10) / 10, 1);
  return {
    problem: <span>{num1} - {num2} = <AnswerInput /></span>,
    answer: [String(round(num1 - num2, 2))],
    type: 'decimal',
    subType: 'decimal-subtract',
    storable: { type: 'decimal', subType: 'decimal-subtract', operands: [num1, num2], operator: 'subtract' },
  };
};

// 3. 개념 단위 변환형
const generateUnitConversionConceptProblem = (): MathProblem => {
    // 1.97은 0.01이 [197]개입니다.
    const num = randomInt(101, 399);
    const decimal = round(num / 100, 2);
    return {
      problem: <span>{decimal}은 0.01이 <AnswerInput />개입니다.</span>,
      answer: [String(num)],
      type: 'conversion',
      subType: 'decimal-to-fraction',
      storable: { type: 'conversion', subType: 'decimal-to-fraction', operands: [decimal], operator: 'convert' },
    };
};

// 4. 크기 비교형
const generateComparisonProblem = (): MathProblem => {
    // 3.45 O 3.5
    const num1 = round(randomInt(10, 500) / 100, 2);
    const num2 = round(randomInt(10, 500) / 100, 2);
    const correctSign = num1 > num2 ? '>' : num1 < num2 ? '<' : '=';
    return {
      problem: <span>{num1.toFixed(2)} <AnswerInput /> {num2.toFixed(2)}</span>,
      answer: [correctSign],
      type: 'decimal',
      subType: 'comparison',
      storable: { type: 'decimal', subType: 'comparison', operands: [num1, num2], operator: 'compare' },
    };
};

// 5. 문장제 문제
const generateWordProblem = (): MathProblem => {
    // "준호는 초콜릿 3.2kg..."
    const total = round(randomInt(200, 500) / 100, 2);
    const used = round(randomInt(100, (total * 100) - 50) / 100, 2);
    const answer = round(total - used, 2);

    return {
      problem: (
        <p className="text-base text-center leading-relaxed">
          준호는 초콜릿 {total}kg 중에서 친구들에게 {used}kg을 나누어주었습니다. <br />
          준호에게 남은 초콜릿의 무게는 몇 kg인가요? <AnswerInput /> kg
        </p>
      ),
      answer: [String(answer)],
      type: 'decimal',
      subType: 'word-problem',
      storable: { type: 'decimal', subType: 'word-problem', operands: [total, used], operator: 'subtract' },
    };
};

// 7. 조건 제시형
const generateConditionalProblem = (): MathProblem => {
  const isBigger = Math.random() > 0.5;
  const op_text = isBigger ? '더 큰' : '더 작은';

  let num1 = round(randomInt(100, 800) / 100, 2);
  let num2 = round(randomInt(10, (num1 * 100) - 50) / 100, 2);
  const answer = isBigger ? round(num1 + num2, 2) : round(num1 - num2, 2);

  return {
    problem: <span>{num1}보다 {num2}만큼 {op_text} 수는? <AnswerInput /></span>,
    answer: [String(answer)],
    type: 'decimal',
    subType: 'conditional',
    storable: { type: 'decimal', subType: 'conditional', operands: [num1, num2, isBigger ? 1 : 0], operator: 'calculate' },
  };
};

// 8. 목록 탐색형
const generateListNavigationProblem = (): MathProblem => {
  const isSum = Math.random() > 0.5;
  const op_text = isSum ? '합' : '차';

  // 소수점
  const nums = Array.from({ length: 4 }, () => round(randomInt(100, 999) / 100, 2));
  const sorted = [...nums].sort((a, b) => a - b);
  const smallest = sorted[0];
  const largest = sorted[sorted.length - 1];
  const answer = isSum ? round(smallest + largest, 2) : round(largest - smallest, 2);
  return {
    problem: (
      <div className="text-center">
        <p>다음 카드 중 가장 큰 수와 가장 작은 수의 {op_text}을 구하세요.</p>
        <div className="flex justify-center gap-2 my-2">
          {nums.map((n, index) => (
            <div key={`${n}-${index}`} className="p-3 border rounded bg-gray-100 font-mono">
              {n}
            </div>
          ))}
        </div>
        <p>답: <AnswerInput /></p>
      </div>
    ),
    answer: [String(answer)],
    type: 'decimal',
    subType: 'list-navigation',
    storable: { type: 'decimal', subType: 'list-navigation', operands: [...nums, isSum ? 1 : 0], operator: 'calculate' },
  };
};


export const generateProblemFromData = (data: StorableProblem): MathProblem => {
  // This function would ideally reconstruct the problem from stored data.
  // For now, it regenerates a similar problem type as a placeholder for review.
  const problemMap: Record<ProblemSubType, () => MathProblem> = {
    'decimal-add': generateDirectCalculationProblem,
    'decimal-subtract': generateDirectCalculationProblem,
    'fraction-add-same-den': generateDirectCalculationProblem,
    'fraction-subtract-same-den': generateDirectCalculationProblem,
    'fraction-add-mixed': generateDirectCalculationProblem,
    'fraction-subtract-mixed': generateDirectCalculationProblem,
    'fraction-subtract-from-int': generateDirectCalculationProblem,
    'fraction-word-problem': generateWordProblem,
    'fraction-comparison': generateComparisonProblem,
    'fraction-to-decimal': generateUnitConversionConceptProblem,
    'decimal-to-fraction': generateUnitConversionConceptProblem,
    'conditional': generateConditionalProblem,
    'list-navigation': generateListNavigationProblem,
    'word-problem': generateWordProblem,
    'comparison': generateComparisonProblem,
    // Add other mappings if necessary, falling back to a default.
    'direct-calculation': generateDirectCalculationProblem,
    'process-decomposition': generateDirectCalculationProblem,
    'unit-conversion-concept': generateUnitConversionConceptProblem,
    'vertical-calculation': generateDirectCalculationProblem, 
    'error-correction': generateDirectCalculationProblem, 
    'multi-step-word-problem': generateWordProblem, 
    'find-and-operate': generateListNavigationProblem, 
    'error-analysis': generateComparisonProblem, 
    'multiple-choice': generateComparisonProblem,
    'diagram': generateDirectCalculationProblem, 
    'conditional-operation': generateConditionalProblem,
    'fill-in-the-blanks-process': generateDirectCalculationProblem,
    'fill-in-the-blanks-concept': generateUnitConversionConceptProblem
  };

  const generator = problemMap[data.subType] || generateDirectCalculationProblem;
  return generator();
};



export const problemNodeToString = (node: React.ReactNode): string => {
  if (typeof node === 'string') {
    return node;
  }
  if (typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(child => problemNodeToString(child)).join('');
  }
  if (React.isValidElement(node)) {
      if (node.type === AnswerInput) {
        return '[?]';
      }
      if (node.props.children) {
        return React.Children.toArray(node.props.children)
            .map(child => problemNodeToString(child))
            .join('');
      }
  }
  return '';
};

// --- Main Problem Generation Function ---
const problemGenerators = [
  generateDirectCalculationProblem,
  generateUnitConversionConceptProblem,
  generateComparisonProblem,
  generateWordProblem,
  generateConditionalProblem,
  generateListNavigationProblem,
];

export const generateMathProblem = (): MathProblem => {
  const generator =
    problemGenerators[randomInt(0, problemGenerators.length - 1)];
  return generator();
};

// --- Game Logic Functions ---
export const isAdjacent = (tileX: number, tileY: number, userTiles: Tile[]) => {
  return userTiles.some(
    userTile =>
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
      t => t.ownerId === null && isLand(t.x, t.y)
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

  const aiTileSet = new Set(aiTiles.map(t => `${t.x},${t.y}`));

  for (const aiTile of aiTiles) {
    for (const offset of neighborOffsets) {
      const neighborX = aiTile.x + offset.dx;
      const neighborY = aiTile.y + offset.dy;

      if (aiTileSet.has(`${neighborX},${neighborY}`)) continue;

      const neighborTile = allTiles.find(
        t => t.x === neighborX && t.y === neighborY
      );

      const targetTile = neighborTile ?? {
        id: `${neighborX}-${neighborY}`,
        x: neighborX,
        y: neighborY,
        ownerId: null,
      };

      if (isLand(neighborX, neighborY) && targetTile.ownerId !== ai.id) {
        conquerableTiles.push(targetTile);
      }
    }
  }

  if (conquerableTiles.length > 0) {
    // Deduplicate conquerable tiles
    const uniqueConquerable = Array.from(
      new Map(conquerableTiles.map(t => [t.id, t])).values()
    );

    const enemyTiles = uniqueConquerable.filter(
      t => t.ownerId !== null && t.ownerId !== ai.id
    );
    if (enemyTiles.length > 0) {
      // Prioritize tiles owned by users with the most land
      const ownerTileCounts = allUsers.reduce(
        (acc, user) => {
          acc[user.id] = allTiles.filter(t => t.ownerId === user.id).length;
          return acc;
        },
        {} as Record<string, number>
      );

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
