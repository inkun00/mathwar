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
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};


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
    const isAddition = Math.random() > 0.5;
    let num1_raw = round(randomInt(11, 999) / 100, 2);
    let num2_raw = round(randomInt(11, 999) / 100, 2);

    let num1 = num1_raw;
    let num2 = num2_raw;
    let operator, answer, subType, storable: StorableProblem;
    let problemNode: React.ReactNode;

    if (isAddition) {
        operator = '+';
        answer = round(num1 + num2, 2);
        subType = 'decimal-add';
        storable = { type: 'decimal', subType: 'decimal-add', operands: [num1, num2], operator: 'add' };
    } else { // Subtraction
        num1 = Math.max(num1_raw, num2_raw);
        num2 = Math.min(num1_raw, num2_raw);
        operator = '-';
        answer = round(num1 - num2, 2);
        subType = 'decimal-subtract';
        storable = { type: 'decimal', subType: 'decimal-subtract', operands: [num1, num2], operator: 'subtract' };
    }
    
    problemNode = <span>{num1.toFixed(2)} {operator} {num2.toFixed(2)} = <AnswerInput /></span>;

    return {
        problem: problemNode,
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

const generatePlaceValueProblem = (): MathProblem => {
    const baseNum = round(randomInt(10, 999) / 100, 2); // e.g., 4.35
    const multiplier = Math.random() > 0.5 ? 10 : 100;
    const isMultiply = Math.random() > 0.5;

    let questionText, answer;

    if (isMultiply) {
        questionText = `${baseNum}의 ${multiplier}배`;
        answer = round(baseNum * multiplier, 2);
    } else {
        questionText = `${baseNum * multiplier}의 1/${multiplier}`;
        answer = baseNum;
    }

    return {
        problem: <span>{questionText}인 수는? <AnswerInput /></span>,
        answer: [String(answer)],
        type: 'decimal',
        subType: 'conditional-operation',
        storable: { type: 'decimal', subType: 'conditional-operation', operands: [baseNum, multiplier, isMultiply ? 1 : 0], operator: 'calculate' },
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

  let num1_raw = round(randomInt(100, 800) / 100, 2);
  let num2_raw = round(randomInt(10, 500) / 100, 2);
  
  let num1 = num1_raw;
  let num2 = num2_raw;
  
  const answer = isBigger ? round(num1 + num2, 2) : round(Math.max(num1, num2) - Math.min(num1, num2), 2);
  if (!isBigger) {
      num1 = Math.max(num1_raw, num2_raw);
      num2 = Math.min(num1_raw, num2_raw);
  }


  return {
    problem: <span>{num1}보다 {num2}만큼 {op_text} 수는? <AnswerInput /></span>,
    answer: [String(answer)],
    type: 'decimal',
    subType: 'conditional',
    storable: { type: 'decimal', subType: 'conditional', operands: [num1, num2, isBigger ? 1 : 0], operator: 'calculate' },
  };
};

const generateVerticalCalculationProblem = (): MathProblem => {
  const isAddition = Math.random() > 0.5;
  let num1_raw = round(randomInt(100, 999) / 10, 2);
  let num2_raw = round(randomInt(100, 999) / 10, 2);

  const num1 = isAddition ? num1_raw : Math.max(num1_raw, num2_raw);
  const num2 = isAddition ? num2_raw : Math.min(num1_raw, num2_raw);
  
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

const generateDiagramProblem = (): MathProblem => {
    const startNum = round(randomInt(200, 500) / 100, 2);
    const subtractNum = round(randomInt(10, 150) / 100, 2);
    const answer = round(startNum - subtractNum, 2);
    
    return {
        problem: (
            <div className="flex justify-center items-center gap-2">
                <span className="border rounded-md p-4 bg-muted">{startNum.toFixed(2)}</span>
                <div className="flex flex-col items-center">
                    <span className="text-sm px-2 py-1 rounded-full bg-green-200 text-green-800">-{subtractNum.toFixed(2)}</span>
                    <span className="text-2xl font-bold text-green-600">→</span>
                </div>
                <div className="border rounded-md p-2 bg-background">
                    <AnswerInput />
                </div>
            </div>
        ),
        answer: [String(answer)],
        type: 'decimal',
        subType: 'diagram',
        storable: { type: 'decimal', subType: 'diagram', operands: [startNum, subtractNum], operator: 'subtract' },
    }
}

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
              {n.toFixed(2)}
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
        바구니의 무게는 {container.toFixed(2)}kg 입니다. <br />
        이 바구니에 {item1.toFixed(2)}kg짜리 사과와 {item2.toFixed(2)}kg짜리 오렌지를 담았습니다. <br />
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
    const isAddition = Math.random() > 0.5;
    let num1_raw = round(randomInt(100, 800) / 100, 2);
    let num2_raw = round(randomInt(100, 800) / 100, 2);

    const num1 = isAddition ? num1_raw : Math.max(num1_raw, num2_raw);
    const num2 = isAddition ? num2_raw : Math.min(num1_raw, num2_raw);

    const correctAnswer = isAddition ? round(num1 + num2, 2) : round(num1 - num2, 2);

    // Create a plausible error by misaligning decimals
    const errorType = randomInt(1, 2);
    let wrongAnswer;
    let explanation = "소수점 위치를 잘못 맞추었습니다.";
    
    if (errorType === 1) { // Decimal alignment error
        wrongAnswer = isAddition ? round(num1*10 + num2, 2) : round(num1*10 - num2, 2);
    } else { // Calculation error in one digit
        let errorDigit = randomInt(1, 9) / 100;
        wrongAnswer = round(correctAnswer + (Math.random() > 0.5 ? errorDigit : -errorDigit), 2);
        if(wrongAnswer < 0) wrongAnswer = round(correctAnswer + errorDigit, 2);
        explanation = "계산 실수가 있습니다.";
    }

    return {
        problem: (
            <div className="text-center text-base">
                <p>계산이 잘못된 곳을 찾아 이유를 쓰고, 바르게 계산하시오.</p>
                <div className="font-mono bg-muted p-4 my-2 rounded-md inline-block">
                     <div className="text-right">
                        <p>{num1.toFixed(2)}</p>
                        <p>{isAddition ? '+' : '-'} {num2.toFixed(2)}</p>
                        <hr className="border-foreground my-1" />
                        <p className="text-destructive">{wrongAnswer.toFixed(2)}</p>
                    </div>
                </div>
                <div className="text-left mt-2 space-y-2">
                    <p>이유: <AnswerInput /></p>
                    <p>바른 계산: <AnswerInput /></p>
                </div>
            </div>
        ),
        answer: [explanation, String(correctAnswer)],
        type: 'decimal',
        subType: 'error-correction',
        storable: { type: 'decimal', subType: 'error-correction', operands: [num1, num2, isAddition? 1: 0], operator: 'calculate' },
    };
};

const generateDecompositionProblem = (): MathProblem => {
    const num1 = round(randomInt(101, 199) / 100, 2); // 1.xx
    const num2 = round(randomInt(1, 99) / 100, 2);   // 0.xx
    const num1_in_0_01 = Math.round(num1 * 100);
    const num2_in_0_01 = Math.round(num2 * 100);
    const sum_in_0_01 = num1_in_0_01 + num2_in_0_01;
    const sum = round(num1 + num2, 2);

    return {
        problem: (
            <div className="text-base text-center leading-relaxed">
                <p>{num1}은 0.01이 <AnswerInput />개이고, {num2}는 0.01이 <AnswerInput />개입니다.</p>
                <p className="mt-2">{num1}+{num2}는 0.01이 모두 <AnswerInput />개이므로 <AnswerInput />입니다.</p>
            </div>
        ),
        answer: [String(num1_in_0_01), String(num2_in_0_01), String(sum_in_0_01), String(sum)],
        type: 'decimal',
        subType: 'process-decomposition',
        storable: { type: 'decimal', subType: 'process-decomposition', operands: [num1, num2], operator: 'calculate' }
    };
}


const generateMultiComparisonProblem = (): MathProblem => {
    const problems = [
        { key: '㉠', num1: round(randomInt(100, 400) / 100, 2), num2: round(randomInt(100, 400) / 100, 2) },
        { key: '㉡', num1: round(randomInt(100, 400) / 100, 2), num2: round(randomInt(100, 400) / 100, 2) },
        { key: '㉢', num1: round(randomInt(100, 400) / 100, 2), num2: round(randomInt(100, 400) / 100, 2) },
    ];
    
    const results = problems.map(p => ({
        key: p.key,
        value: round(p.num1 + p.num2, 2),
    }));

    results.sort((a, b) => b.value - a.value);
    const answer = results.map(r => r.key).join(',');

    return {
        problem: (
            <div className="space-y-2 text-base">
                <p>계산 결과가 큰 것부터 차례로 기호를 써 보세요.</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                   {shuffleArray(problems).map(p => (
                       <div key={p.key} className="p-2 border rounded-md bg-muted">
                           {p.key} {p.num1.toFixed(2)} + {p.num2.toFixed(2)}
                       </div>
                   ))}
                </div>
                <div className="pt-2">
                    답: <AnswerInput />
                </div>
            </div>
        ),
        answer: [answer],
        type: 'decimal',
        subType: 'list-navigation',
        storable: { type: 'decimal', subType: 'list-navigation', operands: problems.flatMap(p => [p.num1, p.num2]), operator: 'calculate' },
    }
}


export const generateProblemFromData = (data: StorableProblem): MathProblem => {
  // This function might need more specific logic if we want to perfectly recreate
  // a problem from stored data. For now, we regenerate a similar type.
  const problemMap: Record<string, () => MathProblem> = {
    'decimal-add': generateDirectCalculationProblem,
    'decimal-subtract': generateDirectCalculationProblem,
    'comparison': generateComparisonProblem,
    'word-problem': generateWordProblem,
    'conditional': generateConditionalProblem,
    'list-navigation': generateMultiComparisonProblem,
    'multi-step-word-problem': generateMultiStepWordProblem,
    'decimal-to-fraction': generateUnitConversionConceptProblem, // This is a bit of a misnomer now
    'vertical-calculation': generateVerticalCalculationProblem,
    'error-correction': generateErrorCorrectionProblem,
    'process-decomposition': generateDecompositionProblem,
    'conditional-operation': generatePlaceValueProblem,
    'diagram': generateDiagramProblem
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

const easyProblems = [generateDirectCalculationProblem, generateUnitConversionConceptProblem, generatePlaceValueProblem];
const mediumProblems = [generateComparisonProblem, generateWordProblem, generateConditionalProblem, generateVerticalCalculationProblem, generateDiagramProblem];
const hardProblems = [generateListNavigationProblem, generateMultiStepWordProblem, generateErrorCorrectionProblem, generateDecompositionProblem, generateMultiComparisonProblem];

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

    