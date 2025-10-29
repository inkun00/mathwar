'use client';
import type {
  MathProblem,
  ClientTile,
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
const round = (num: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(num * factor) / factor;
}
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

    let num1, num2, operator, answer, subType, storable: StorableProblem;
    let problemNode: React.ReactNode;

    if (isAddition) {
        num1 = num1_raw;
        num2 = num2_raw;
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

const generateFinerUnitConversionConceptProblem = (): MathProblem => {
    const num = randomInt(1001, 9999);
    const decimal = round(num / 1000, 3);
    return {
      problem: <span>{parseFloat(decimal.toFixed(3))}은 0.001이 <AnswerInput />개입니다.</span>,
      answer: [String(num)],
      type: 'conversion',
      subType: 'finer-unit-conversion-concept',
      storable: { type: 'conversion', subType: 'finer-unit-conversion-concept', operands: [decimal], operator: 'convert' },
    };
}

const generatePlaceValueProblem = (): MathProblem => {
    const baseInt = randomInt(1, 9999);
    const exponents = [-3, -2, -1, 1, 2, 3]; // Exclude 0 to avoid num1 === num2
    let index1, index2;

    do {
      index1 = randomInt(0, exponents.length - 1);
      index2 = randomInt(0, exponents.length - 1);
    } while (index1 === index2);

    const num1 = round(baseInt * (10 ** exponents[index1]), 3);
    const num2 = round(baseInt * (10 ** exponents[index2]), 3);

    const [biggerNum, smallerNum] = num1 > num2 ? [num1, num2] : [num2, num1];
    
    // Format numbers to remove trailing zeros for display
    const formatNum = (num: number) => parseFloat(num.toFixed(3));
    
    let questionText, answer;
    const isQuestionFindingMultiplier = Math.random() < 0.33;
    const isFindingBigger = Math.random() < 0.5;

    if (isQuestionFindingMultiplier) {
        const actualMultiplier = round(biggerNum / smallerNum, 0);
        questionText = `${formatNum(biggerNum)}은(는) ${formatNum(smallerNum)}의 몇 배인가요?`;
        answer = actualMultiplier.toString();
    } else {
        if (isFindingBigger) {
            const multiplier = round(biggerNum/smallerNum, 0);
            questionText = `${formatNum(smallerNum)}의 ${multiplier}배인 수는?`;
            answer = biggerNum.toString();
        } else {
            const multiplier = round(biggerNum/smallerNum, 0);
            questionText = `${formatNum(biggerNum)}의 1/${multiplier}배인 수는?`;
            answer = smallerNum.toString();
        }
    }

    return {
        problem: <span>{questionText} <AnswerInput /></span>,
        answer: [answer],
        type: 'decimal',
        subType: 'conditional-operation',
        storable: { type: 'decimal', subType: 'conditional-operation', operands: [biggerNum, smallerNum], operator: 'calculate' },
    };
};



// --- MEDIUM PROBLEMS ---

const generatePlaceValueRelationshipProblem = (): MathProblem => {
    const scenarios = [
        { big: 0.1, small: 0.01, answer: 10 },
        { big: 0.01, small: 0.001, answer: 10 },
        { big: 1, small: 0.1, answer: 10 },
        { big: 1, small: 0.01, answer: 100 },
        { big: 1, small: 0.001, answer: 1000 },
    ];
    const scenario = scenarios[randomInt(0, scenarios.length - 1)];

    return {
        problem: <span>{scenario.big}은(는) {scenario.small}이/가 <AnswerInput />개 모인 수입니다.</span>,
        answer: [String(scenario.answer)],
        type: 'decimal',
        subType: 'unit-conversion-concept',
        storable: { type: 'decimal', subType: 'unit-conversion-concept', operands: [scenario.big, scenario.small], operator: 'calculate' },
    };
};

const generateComparisonProblem = (): MathProblem => {
    const num1_int = randomInt(100, 999); // e.g., 345
    const num1 = num1_int / 100; // e.g., 3.45

    const digitToChange = randomInt(0, 2); // 0: ones, 1: tenths, 2: hundredths
    const str_num1 = num1.toFixed(2); // "3.45"
    let chars = str_num1.split('');
    chars.splice(1, 1); // remove dot -> ['3', '4', '5']

    let originalDigit = parseInt(chars[digitToChange]);
    let newDigit;
    do {
      newDigit = randomInt(0, 9);
    } while (newDigit === originalDigit);
    
    chars[digitToChange] = newDigit.toString();
    const num2_int = parseInt(chars.join(''));
    const num2 = num2_int / 100;

    const correctSign = num1 > num2 ? '>' : '<';

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
  
  let num1, num2;
  
  if (isBigger) {
    num1 = num1_raw;
    num2 = num2_raw;
  } else {
    num1 = Math.max(num1_raw, num2_raw);
    num2 = Math.min(num1_raw, num2_raw);
  }

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

const generateTenthsDecompositionProblem = (): MathProblem => {
    const num1 = round(randomInt(1, 49) / 10, 1); // 0.1 ~ 4.9
    const num2 = round(randomInt(1, 49) / 10, 1); // 0.1 ~ 4.9
    const sum = round(num1 + num2, 1);

    const num1_in_0_1 = Math.round(num1 * 10);
    const num2_in_0_1 = Math.round(num2 * 10);
    const sum_in_0_1 = num1_in_0_1 + num2_in_0_1;

    return {
        problem: (
            <div className="text-base text-center leading-relaxed">
                <p>{num1}은 0.1이 <AnswerInput />개이고, {num2}는 0.1이 <AnswerInput />개입니다.</p>
                <p className="mt-2">{num1} + {num2}는 0.1이 모두 <AnswerInput />개이므로 <AnswerInput />입니다.</p>
            </div>
        ),
        answer: [String(num1_in_0_1), String(num2_in_0_1), String(sum_in_0_1), String(sum)],
        type: 'decimal',
        subType: 'tenths-decomposition',
        storable: { type: 'decimal', subType: 'tenths-decomposition', operands: [num1, num2], operator: 'calculate' }
    };
};

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


export const generateProblemFromData = (data: StorableProblem): MathProblem => {
  // This function might need more specific logic if we want to perfectly recreate
  // a problem from stored data. For now, we regenerate a similar type.
  const problemMap: Record<string, () => MathProblem> = {
    'decimal-add': generateDirectCalculationProblem,
    'decimal-subtract': generateDirectCalculationProblem,
    'comparison': generateComparisonProblem,
    'word-problem': generateWordProblem,
    'conditional': generateConditionalProblem,
    'list-navigation': generateListNavigationProblem,
    'multi-step-word-problem': generateMultiStepWordProblem,
    'decimal-to-fraction': generateUnitConversionConceptProblem, // This is a bit of a misnomer now
    'finer-unit-conversion-concept': generateFinerUnitConversionConceptProblem,
    'unit-conversion-concept': generatePlaceValueRelationshipProblem,
    'vertical-calculation': generateVerticalCalculationProblem,
    'process-decomposition': generateDecompositionProblem,
    'tenths-decomposition': generateTenthsDecompositionProblem,
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

const easyProblems = [generateDirectCalculationProblem, generateUnitConversionConceptProblem, generatePlaceValueProblem, generateFinerUnitConversionConceptProblem];
const mediumProblems = [generateComparisonProblem, generateWordProblem, generateConditionalProblem, generateVerticalCalculationProblem, generateDiagramProblem, generatePlaceValueRelationshipProblem];
const hardProblems = [generateListNavigationProblem, generateMultiStepWordProblem, generateDecompositionProblem, generateTenthsDecompositionProblem];

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

/**
 * Checks if the user's answers are correct, accounting for floating point inaccuracies
 * and different string representations of the same number (e.g., '1.4' vs '1.40').
 * @param userAnswers An array of strings submitted by the user.
 * @param correctAnswers An array of strings representing the correct answers.
 * @returns True if the answers are correct, false otherwise.
 */
export const isAnswerCorrect = (userAnswers: string[], correctAnswers: string[]): boolean => {
    if (userAnswers.length !== correctAnswers.length) {
        return false;
    }

    const tolerance = 1e-4; // A small tolerance for float comparison

    return userAnswers.every((userAns, i) => {
        const correctAns = correctAnswers[i];
        
        // Trim whitespace from both answers
        const processedUserAns = userAns.trim();
        const processedCorrectAns = correctAns.trim();
        
        // Try to parse both answers as numbers
        const userNum = parseFloat(processedUserAns);
        const correctNum = parseFloat(processedCorrectAns);
        
        // If both are valid numbers, compare them with tolerance
        if (!isNaN(userNum) && !isNaN(correctNum)) {
            return Math.abs(userNum - correctNum) < tolerance;
        }

        // If they are not numbers (e.g., '<', '>'), do a case-insensitive string comparison
        return processedUserAns.toLowerCase() === processedCorrectAns.toLowerCase();
    });
};


// --- Game Logic Functions ---
export const isAdjacent = (tileX: number, tileY: number, userTiles: ClientTile[]) => {
  return userTiles.some(
    userTile =>
      (Math.abs(userTile.x - tileX) === 1 && userTile.y === tileY) ||
      (Math.abs(userTile.y - tileY) === 1 && userTile.x === tileX)
  );
};


export const canConquer = (tile: ClientTile, currentUser: User, allUsers: User[], userCountryTiles: ClientTile[], landTiles: ClientTile[]) => {
    if (!currentUser || (currentUser.tokens ?? 0) <= 0) {
      return false;
    }
    
    // 타일 소유자가 같은 국가 소속인지 확인
    const owner = tile.ownerId ? allUsers.find(u => u.id === tile.ownerId) : null;
    if (owner && owner.countryId === currentUser.countryId) {
      return false; // Cannot conquer a tile owned by a countryman
    }
    
    if (!isLand(tile.x, tile.y)) {
        return false;
    }

    if (userCountryTiles.length === 0) {
      // Rule for the very first tile placement.
      if (tile.ownerId !== null) {
        return false;
      }
      
      // Check distance from all other players' tiles.
      const otherPlayersTiles = landTiles.filter(t => t.ownerId !== null && t.ownerId !== currentUser.id);
      if (otherPlayersTiles.length === 0) {
        return true; // No other players, can place anywhere.
      }

      for (const otherTile of otherPlayersTiles) {
        const distance = Math.abs(tile.x - otherTile.x) + Math.abs(tile.y - otherTile.y);
        if (distance < 5) {
          return false; // Too close to another player.
        }
      }
      
      return true; // Far enough from all other players.
    }
    
    // Check for adjacency with any tile from the same country
    return isAdjacent(tile.x, tile.y, userCountryTiles);
  };
