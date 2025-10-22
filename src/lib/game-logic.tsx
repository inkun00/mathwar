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
  numerator?: number | string | ReactNode;
  denominator?: number | string | ReactNode;
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
    integer?: number | string | ReactNode;
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

// --- Problem Generators by Difficulty ---

// --- EASY PROBLEMS ---

const generateDirectCalculationProblem = (): MathProblem => {
    const problemType = randomInt(1, 4);
    let num1, num2, operator, answer, subType, storable: StorableProblem;

    switch(problemType) {
        case 1: // Addition
            num1 = round(randomInt(11, 999) / 100, 2);
            num2 = round(randomInt(1, Math.floor(num1 * 100) - 1) / 100, 2);
            operator = '+';
            answer = round(num1 + num2, 2);
            subType = 'decimal-add';
            storable = { type: 'decimal', subType: 'decimal-add', operands: [num1, num2], operator: 'add' };
            break;
        case 2: // Subtraction
            num1 = round(randomInt(11, 999) / 100, 2);
            num2 = round(randomInt(1, Math.floor(num1 * 100) - 1) / 100, 2);
            operator = '-';
            answer = round(num1 - num2, 2);
            subType = 'decimal-subtract';
            storable = { type: 'decimal', subType: 'decimal-subtract', operands: [num1, num2], operator: 'subtract' };
            break;
        case 3: // Multiplication
            num1 = round(randomInt(2, 50) / 10, 1);
            num2 = randomInt(2, 9);
            operator = 'x';
            answer = round(num1 * num2, 2);
            subType = 'direct-calculation';
            storable = { type: 'decimal', subType: 'direct-calculation', operands: [num1, num2], operator: 'multiply' };
            break;
        case 4: // Division
            answer = round(randomInt(2, 50) / 10, 1);
            num2 = randomInt(2, 9);
            num1 = round(answer * num2, 2);
            operator = '÷';
            subType = 'direct-calculation';
            storable = { type: 'decimal', subType: 'direct-calculation', operands: [num1, num2], operator: 'divide' };
            break;
        default: // Fallback to addition
            num1 = round(randomInt(11, 999) / 100, 2);
            num2 = round(randomInt(1, Math.floor(num1 * 100) - 1) / 100, 2);
            operator = '+';
            answer = round(num1 + num2, 2);
            subType = 'decimal-add';
            storable = { type: 'decimal', subType: 'decimal-add', operands: [num1, num2], operator: 'add' };
    }

    return {
        problem: <span>{num1} {operator} {num2} = <AnswerInput /></span>,
        answer: [String(answer)],
        type: 'decimal',
        subType: subType as ProblemSubType,
        storable,
    };
};

const generateUnitConversionConceptProblem = (): MathProblem => {
    const num = randomInt(101, 999);
    const decimal = round(num / 100, 2);
    return {
      problem: <span>{decimal}은 0.01이 <AnswerInput />개입니다.</span>,
      answer: [String(num)],
      type: 'conversion',
      subType: 'decimal-to-fraction',
      storable: { type: 'conversion', subType: 'decimal-to-fraction', operands: [decimal], operator: 'convert' },
    };
};

// --- MEDIUM PROBLEMS ---

const generateComparisonProblem = (): MathProblem => {
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

const generateWordProblem = (): MathProblem => {
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

const generateVerticalCalculationProblem = (): MathProblem => {
  const num1 = round(randomInt(100, 999) / 10, 2);
  const num2 = round(randomInt(10, (num1 * 100) - 1) / 10, 2);
  const isAddition = Math.random() > 0.5;
  const operator = isAddition ? '+' : '-';
  const answer = isAddition ? round(num1 + num2, 2) : round(num1 - num2, 2);

  return {
    problem: (
      <div className="font-mono text-xl inline-block text-right leading-tight">
        <p className="pr-8">{num1.toFixed(2)}</p>
        <p>
          <span className="mr-2">{operator}</span>
          <span className="pr-8">{num2.toFixed(2)}</span>
        </p>
        <hr className="border-foreground my-1" />
        <AnswerInput />
      </div>
    ),
    answer: [String(answer)],
    type: 'decimal',
    subType: 'vertical-calculation',
    storable: { type: 'decimal', subType: 'vertical-calculation', operands: [num1, num2, isAddition ? 1 : 0], operator: 'calculate' },
  };
};

// --- HARD PROBLEMS ---

const generateListNavigationProblem = (): MathProblem => {
  const isSum = Math.random() > 0.5;
  const op_text = isSum ? '합' : '차';
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

const generateMultiStepWordProblem = (): MathProblem => {
  const item1 = round(randomInt(100, 300) / 100, 2); // e.g., 1.5 kg
  const item2 = round(randomInt(100, 300) / 100, 2); // e.g., 2.1 kg
  const container = round(randomInt(50, 90) / 100, 2); // e.g., 0.7 kg
  const answer = round(item1 + item2 + container, 2);

  return {
    problem: (
      <p className="text-base text-center leading-relaxed">
        바구니의 무게는 {container}kg 입니다. <br />
        이 바구니에 {item1}kg짜리 사과와 {item2}kg짜리 오렌지를 담았습니다. <br />
        과일이 담긴 바구니의 총 무게는 얼마인가요? <AnswerInput /> kg
      </p>
    ),
    answer: [String(answer)],
    type: 'decimal',
    subType: 'multi-step-word-problem',
    storable: { type: 'decimal', subType: 'multi-step-word-problem', operands: [item1, item2, container], operator: 'multi-step' },
  };
};

const generateErrorCorrectionProblem = (): MathProblem => {
    const num1 = round(randomInt(10, 50) / 10, 1);
    const num2 = randomInt(2, 5);
    const correctAnswer = round(num1 * num2, 1);
    
    // Create a plausible error
    const errorType = randomInt(1,2);
    let wrongAnswer;
    let wrongStepNum;
    if (errorType === 1 && num1 > 1) { // Error in multiplication
        wrongStepNum = num2;
        wrongAnswer = String(round((num1-1) * num2, 1));
    } else { // Error in decimal placement
        wrongStepNum = num1 * 10;
        wrongAnswer = String(correctAnswer * 10);
    }

    return {
        problem: (
            <div className="text-center text-base">
                <p>계산이 잘못된 곳을 찾아 이유를 쓰고, 바르게 계산하시오.</p>
                <div className="font-mono bg-muted p-4 my-2 rounded-md inline-block">
                    <p className="text-right">{num1}</p>
                    <p className="text-right">x  {num2}</p>
                    <hr className="border-foreground my-1" />
                    <p className="text-right text-destructive">{wrongAnswer}</p>
                </div>
                <div className="text-left mt-2 space-y-2">
                    <p>이유: <AnswerInput /></p>
                    <p>바른 계산: <AnswerInput /></p>
                </div>
            </div>
        ),
        answer: [`${wrongStepNum}`, `${correctAnswer}`], // Expected answers: reason and correct result
        type: 'decimal',
        subType: 'error-correction',
        storable: { type: 'decimal', subType: 'error-correction', operands: [num1, num2], operator: 'calculate' },
    };
};

const generateFillInTheBlanksProcessProblem = (): MathProblem => {
    const num1Int = randomInt(2, 9);
    const num2Int = randomInt(11, 29);
    const num1 = num1Int;
    const num2 = round(num2Int / 10, 1);

    return {
        problem: (
            <div className="text-base text-center">
                <p>빈칸에 알맞은 수를 써넣으세요.</p>
                <div className="mt-2 font-mono flex flex-col items-center">
                    <span>{num1} x {num2}</span>
                    <span>= {num1} x ({num2Int} / 10)</span>
                    <span>= ({num1} x {num2Int}) / 10</span>
                    <span>= {num1 * num2Int} / <AnswerInput /></span>
                    <span>= <AnswerInput /></span>
                </div>
            </div>
        ),
        answer: ["10", String(round((num1 * num2Int) / 10, 1))],
        type: 'decimal',
        subType: 'fill-in-the-blanks-process',
        storable: { type: 'decimal', subType: 'fill-in-the-blanks-process', operands: [num1, num2], operator: 'calculate' }
    };
};



export const generateProblemFromData = (data: StorableProblem): MathProblem => {
  const problemMap: Record<string, () => MathProblem> = {
    'decimal-add': generateDirectCalculationProblem,
    'decimal-subtract': generateDirectCalculationProblem,
    'comparison': generateComparisonProblem,
    'word-problem': generateWordProblem,
    'conditional': generateConditionalProblem,
    'list-navigation': generateListNavigationProblem,
    'multi-step-word-problem': generateMultiStepWordProblem,
    'decimal-to-fraction': generateUnitConversionConceptProblem,
    'vertical-calculation': generateVerticalCalculationProblem,
    'error-correction': generateErrorCorrectionProblem,
    'fill-in-the-blanks-process': generateFillInTheBlanksProcessProblem,
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

const easyProblems = [generateDirectCalculationProblem, generateUnitConversionConceptProblem];
const mediumProblems = [generateComparisonProblem, generateWordProblem, generateConditionalProblem, generateVerticalCalculationProblem];
const hardProblems = [generateListNavigationProblem, generateMultiStepWordProblem, generateErrorCorrectionProblem, generateFillInTheBlanksProcessProblem];

export const generateMathProblem = (): MathProblem => {
  const chance = Math.random() * 10; // 0 to 10
  
  let generator: () => MathProblem;

  if (chance < 3) { // 30% chance for an easy problem
    generator = easyProblems[randomInt(0, easyProblems.length - 1)];
  } else if (chance < 8) { // 50% chance for a medium problem (3 to 8)
    generator = mediumProblems[randomInt(0, mediumProblems.length - 1)];
  } else { // 20% chance for a hard problem (8 to 10)
    generator = hardProblems[randomInt(0, hardProblems.length - 1)];
  }

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
