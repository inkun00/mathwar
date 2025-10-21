'use client';
import type {
  MathProblem,
  Tile,
  User,
  ProblemSubType,
  StorableProblem,
} from './types';
import { isLand } from './world-map-shape';
import React, { ReactNode, useMemo } from 'react';
import { cn } from './utils';

// --- Utility Functions ---
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const round = (num: number, places: number) => parseFloat(num.toFixed(places));
const shuffle = <T>(array: T[]): T[] => {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
};
// Greatest Common Divisor
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// --- React Component Utilities for Problems ---
const Fraction = ({
  numerator,
  denominator,
  className,
}: {
  numerator: number | string | ReactNode;
  denominator: number | string | ReactNode;
  className?: string;
}) => (
  <span
    className={cn('inline-flex flex-col items-center align-middle mx-1', className)}
  >
    <span className="text-xl leading-none">{numerator}</span>
    <span className="w-full h-px bg-current"></span>
    <span className="text-xl leading-none">{denominator}</span>
  </span>
);

const MixedFraction = ({
  integer,
  numerator,
  denominator,
  className,
}: {
  integer: number | string | ReactNode;
  numerator: number | string | ReactNode;
  denominator: number | string | ReactNode;
  className?: string;
}) => (
  <span className={cn('inline-flex items-center align-middle', className)}>
    <span className="text-2xl mr-1">{integer}</span>
    <Fraction numerator={numerator} denominator={denominator} />
  </span>
);

export const AnswerInput = ({ index }: { index: number }) => (
  <span className="inline-block" data-answer-input={index}></span>
);

// --- Problem Generation Functions ---

// 1. 직접 계산형 (단답형 입력)
const generateDirectCalculationProblem = (): MathProblem => {
  const isFraction = Math.random() > 0.5;
  if (isFraction) {
    // 예시: 3 1/8 - 6/8 또는 5 - 2 1/7
    if (Math.random() > 0.5) {
      // 5 - 2 1/7
      const int1 = randomInt(3, 8);
      const int2 = randomInt(1, int1 - 1);
      const den = randomInt(7, 13);
      const num2 = randomInt(1, den - 1);

      const result = int1 - (int2 + num2 / den);
      const resultInt = Math.floor(result);
      const resultNum = Math.round((result - resultInt) * den);
      const commonDivisor = gcd(resultNum, den);

      return {
        problem: (
          <span>
            {int1} - <MixedFraction integer={int2} numerator={num2} denominator={den} />{' '}
            ={' '}
            <MixedFraction 
              integer={<AnswerInput index={0} />} 
              numerator={<AnswerInput index={1} />} 
              denominator={<AnswerInput index={2} />} 
            />
          </span>
        ),
        answer: [String(resultInt), String(resultNum / commonDivisor), String(den / commonDivisor)],
        type: 'fraction',
        subType: 'fraction-subtract-from-int',
        storable: {
          type: 'fraction',
          subType: 'fraction-subtract-from-int',
          operands: [int1, int2, num2, den],
          operator: 'subtract',
        },
      };
    } else {
      // 3 1/8 - 6/8
      const den = randomInt(7, 13);
      const int1 = randomInt(1, 5);
      let num1 = randomInt(1, den - 1);
      let num2 = randomInt(num1 + 1, den * 2); // num2 can be larger than den
      
      const totalNum1 = int1 * den + num1;
      const resultNum = totalNum1 - num2;

      const resultInt = Math.floor(resultNum / den);
      const resultRem = resultNum % den;
      
      const commonDivisor = gcd(resultRem, den);
      
      const num2Int = Math.floor(num2/den);
      const num2Rem = num2 % den;

      const problemRhs = num2Rem === 0 
        ? <span>{num2Int}</span> 
        : <Fraction numerator={num2} denominator={den} />;
      
      if (resultRem === 0) {
         return {
          problem: (
            <span>
              <MixedFraction integer={int1} numerator={num1} denominator={den} /> -{' '}
              {problemRhs} = <AnswerInput index={0} />
            </span>
          ),
          answer: [String(resultInt)],
          type: 'fraction',
          subType: 'fraction-subtract-mixed',
          storable: {
            type: 'fraction',
            subType: 'fraction-subtract-mixed',
            operands: [int1, num1, den, num2],
            operator: 'subtract',
          },
        };
      }

      return {
        problem: (
          <span>
            <MixedFraction integer={int1} numerator={num1} denominator={den} /> -{' '}
            {problemRhs} ={' '}
            <MixedFraction 
              integer={<AnswerInput index={0} />} 
              numerator={<AnswerInput index={1} />} 
              denominator={<AnswerInput index={2} />} 
            />
          </span>
        ),
        answer: [String(resultInt), String(resultRem / commonDivisor), String(den / commonDivisor)],
        type: 'fraction',
        subType: 'fraction-subtract-mixed',
        storable: {
          type: 'fraction',
          subType: 'fraction-subtract-mixed',
          operands: [int1, num1, den, num2],
          operator: 'subtract',
        },
      };
    }
  } else {
    // 2.3 - 0.8
    const num1 = round(randomInt(11, 50) / 10, 1);
    const num2 = round(randomInt(1, Math.floor(num1 * 10) - 10) / 10, 1);
    return {
      problem: (
        <span>
          {num1} - {num2} = <AnswerInput index={0} />
        </span>
      ),
      answer: [String(round(num1 - num2, 2))],
      type: 'decimal',
      subType: 'decimal-subtract',
      storable: {
        type: 'decimal',
        subType: 'decimal-subtract',
        operands: [num1, num2],
        operator: 'subtract',
      },
    };
  }
};

// 2. 연산 과정 분해형
const generateProcessDecompositionProblem = (): MathProblem => {
  const type = randomInt(1, 3);
  if (type === 1) {
    // 예시 (받아내림): 5 - 2 4/5 = 4 [ ? ]/5 - 2 4/5 = [ ? ] [ ? ]/5
    const den = randomInt(5, 9);
    const int1 = randomInt(3, 5);
    const int2 = randomInt(1, int1 - 1);
    const num2 = randomInt(1, den - 1);
    const resultInt = int1 - 1 - int2;
    const resultNum = den - num2;
    const commonDivisor = gcd(resultNum, den);

    return {
      problem: (
        <span className="flex flex-wrap items-center justify-center gap-x-2">
          {int1} - <MixedFraction integer={int2} numerator={num2} denominator={den} />
          =
          <MixedFraction integer={int1 - 1} numerator={<AnswerInput index={0} />} denominator={den} />
          -
          <MixedFraction integer={int2} numerator={num2} denominator={den} /> =
          <MixedFraction
            integer={<AnswerInput index={1} />}
            numerator={<AnswerInput index={2} />}
            denominator={den / commonDivisor}
          />
        </span>
      ),
      answer: [String(den), String(resultInt), String(resultNum / commonDivisor)],
      type: 'fraction',
      subType: 'fraction-subtract-from-int',
      storable: {
        type: 'fraction',
        subType: 'fraction-subtract-from-int',
        operands: [int1, int2, num2, den],
        operator: 'subtract',
      },
    };
  } else if (type === 2) {
    // 예시 (가분수 변환): 1 1/5 - 4/5 = [ ? ]/5 - 4/5 = [ ? ]/5
    const den = randomInt(5, 12);
    const int1 = randomInt(1, 3);
    const num1 = randomInt(1, den - 2);
    const num2 = randomInt(num1 + 1, den - 1); // Make sure we need to borrow
    const gavunsu_num1 = int1 * den + num1;
    const result_num = gavunsu_num1 - num2;
    return {
      problem: (
        <span>
          <MixedFraction integer={int1} numerator={num1} denominator={den} /> -{' '}
          <Fraction numerator={num2} denominator={den} /> ={' '}
          <Fraction numerator={<AnswerInput index={0} />} denominator={den} /> -{' '}
          <Fraction numerator={num2} denominator={den} /> ={' '}
          <Fraction numerator={<AnswerInput index={1} />} denominator={den} />
        </span>
      ),
      answer: [String(gavunsu_num1), String(result_num)],
      type: 'fraction',
      subType: 'fraction-subtract-mixed',
      storable: {
        type: 'fraction',
        subType: 'fraction-subtract-mixed',
        operands: [int1, num1, num2, den],
        operator: 'subtract',
      },
    };
  } else {
    // 예시 (연산 분리): 4 3/7 + 3 2/7 = (4 + [ ? ]) + ([ ? ]/7 + 2/7) = [ ? ] + [ ? ]/7 = [ ? ] [ ? ]/7
    const den = randomInt(5, 9);
    const int1 = randomInt(1, 5);
    const num1 = randomInt(1, Math.floor(den / 2) - 1);
    const int2 = randomInt(1, 5);
    const num2 = randomInt(1, Math.floor(den / 2) - 1);
    const simplifiedNum = (num1 + num2) / gcd(num1 + num2, den);
    const simplifiedDen = den / gcd(num1 + num2, den);

    return {
      problem: (
        <span className="flex flex-wrap items-center justify-center gap-x-2">
          <MixedFraction integer={int1} numerator={num1} denominator={den} />
          <span>+</span>
          <MixedFraction integer={int2} numerator={num2} denominator={den} />
          <span>=</span>
          <span>
            ({int1} + <AnswerInput index={0} />) + (
            <Fraction numerator={num1} denominator={den} /> +{' '}
            <Fraction numerator={<AnswerInput index={1} />} denominator={den} />
            )
          </span>
          <span>=</span>
          <span>
            <AnswerInput index={2} /> +{' '}
            <Fraction numerator={<AnswerInput index={3} />} denominator={den} />
          </span>
          <span>=</span>
          <MixedFraction
            integer={<AnswerInput index={4} />}
            numerator={<AnswerInput index={5} />}
            denominator={simplifiedDen}
          />
        </span>
      ),
      answer: [
        String(int2),
        String(num2),
        String(int1 + int2),
        String(num1 + num2),
        String(int1 + int2),
        String(simplifiedNum),
      ],
      type: 'fraction',
      subType: 'fraction-add-mixed',
      storable: {
        type: 'fraction',
        subType: 'fraction-add-mixed',
        operands: [int1, num1, int2, num2, den],
        operator: 'add',
      },
    };
  }
};

// 3. 개념 단위 변환형
const generateUnitConversionConceptProblem = (): MathProblem => {
  if (Math.random() > 0.5) {
    // 1.97은 0.01이 [197]개입니다.
    const num = randomInt(101, 399);
    const decimal = round(num / 100, 2);
    return {
      problem: (
        <span>
          {decimal}은 0.01이 <AnswerInput index={0} />
          개입니다.
        </span>
      ),
      answer: [String(num)],
      type: 'conversion',
      subType: 'decimal-to-fraction',
      storable: {
        type: 'conversion',
        subType: 'decimal-to-fraction',
        operands: [decimal],
        operator: 'convert',
      },
    };
  } else {
    // 4/8는 1/8이 [4]개입니다.
    const den = randomInt(5, 12);
    const num = randomInt(2, den - 1);
    return {
      problem: (
        <span>
          <Fraction numerator={num} denominator={den} />
          는 <Fraction numerator={1} denominator={den} />이 <AnswerInput index={0} />
          개입니다.
        </span>
      ),
      answer: [String(num)],
      type: 'conversion',
      subType: 'fraction-to-decimal',
      storable: {
        type: 'conversion',
        subType: 'fraction-to-decimal',
        operands: [num, den],
        operator: 'convert',
      },
    };
  }
};

// 4. 크기 비교형
const generateComparisonProblem = (): MathProblem => {
  const isFraction = Math.random() > 0.5;
  if (isFraction) {
    // 5 4/7 O 2 3/7
    const den = randomInt(5, 15);
    const int1 = randomInt(1, 9);
    const num1 = randomInt(1, den - 1);
    const int2 = randomInt(1, 9);
    const num2 = randomInt(1, den - 1);
    const val1 = int1 + num1 / den;
    const val2 = int2 + num2 / den;
    const correctSign = val1 > val2 ? '>' : val1 < val2 ? '<' : '=';

    return {
      problem: (
        <span>
          <MixedFraction integer={int1} numerator={num1} denominator={den} />{' '}
          <AnswerInput index={0} />{' '}
          <MixedFraction integer={int2} numerator={num2} denominator={den} />
        </span>
      ),
      answer: [correctSign],
      type: 'fraction',
      subType: 'fraction-comparison',
      storable: {
        type: 'fraction',
        subType: 'fraction-comparison',
        operands: [int1, num1, int2, num2, den],
        operator: 'compare',
      },
    };
  } else {
    // 3.45 O 3.5
    const num1 = round(randomInt(10, 500) / 100, 2);
    const num2 = round(randomInt(10, 500) / 100, 2);
    const correctSign = num1 > num2 ? '>' : num1 < num2 ? '<' : '=';
    return {
      problem: (
        <span>
          {num1.toFixed(2)} <AnswerInput index={0} /> {num2.toFixed(2)}
        </span>
      ),
      answer: [correctSign],
      type: 'decimal',
      subType: 'comparison',
      storable: {
        type: 'decimal',
        subType: 'comparison',
        operands: [num1, num2],
        operator: 'compare',
      },
    };
  }
};

// 5. 문장제 문제
const generateWordProblem = (): MathProblem => {
  if (Math.random() > 0.5) {
    // "준호는 초콜릿 3.2kg 중에서 친구들에게 1.8kg을 나누어주었습니다. 준호에게 남은 초콜릿의 무게를 구하세요."
    const total = round(randomInt(200, 500) / 100, 2);
    const used = round(randomInt(100, total * 100 - 50) / 100, 2);
    const answer = round(total - used, 2);

    return {
      problem: (
        <p className="text-base text-center leading-relaxed">
          준호는 초콜릿 {total}kg 중에서 친구들에게 {used}kg을 나누어주었습니다.{' '}
          <br />
          준호에게 남은 초콜릿의 무게는 몇 kg인가요? <AnswerInput index={0} /> kg
        </p>
      ),
      answer: [String(answer)],
      type: 'decimal',
      subType: 'word-problem',
      storable: {
        type: 'decimal',
        subType: 'word-problem',
        operands: [total, used],
        operator: 'subtract',
      },
    };
  } else {
    // "지효는 마트에서 돼지고기 4/6kg, 소고기 5/6kg을 샀습니다. 고기는 모두 몇 kg인지 구하세요."
    const den = randomInt(5, 12);
    const num1 = randomInt(1, den - 1);
    const num2 = randomInt(1, den - num1);
    const totalNum = num1 + num2;
    const commonDivisor = gcd(totalNum, den);

    return {
      problem: (
        <p className="text-base text-center leading-relaxed">
          지효는 마트에서 돼지고기 {num1}/{den}kg, 소고기 {num2}/{den}kg을
          샀습니다. <br />
          고기는 모두 몇 kg인가요?{' '}
          <Fraction numerator={<AnswerInput index={0} />} denominator={<AnswerInput index={1} />} /> kg
        </p>
      ),
      answer: [String(totalNum / commonDivisor), String(den / commonDivisor)],
      type: 'fraction',
      subType: 'fraction-word-problem',
      storable: {
        type: 'fraction',
        subType: 'fraction-word-problem',
        operands: [num1, num2, den],
        operator: 'add',
      },
    };
  }
};

// 7. 조건 제시형
const generateConditionalProblem = (): MathProblem => {
  // "9/13보다 8/13만큼 더 큰 수 구하기"
  const isFraction = Math.random() > 0.5;
  const isBigger = Math.random() > 0.5;
  const op_text = isBigger ? '더 큰' : '더 작은';

  if (isFraction) {
    const den = randomInt(10, 20);
    let num1 = randomInt(2, den - 1);
    let num2 = randomInt(1, den - 1);

    if (!isBigger && num1 < num2) {
      // ensure positive result for 'smaller'
      [num1, num2] = [num2, num1];
    }

    const answerFraction = isBigger ? num1 + num2 : num1 - num2;
    const commonDivisor = gcd(answerFraction, den);
    const simplifiedNum = answerFraction / commonDivisor;
    const simplifiedDen = den / commonDivisor;


    if (simplifiedDen === 1) {
       return {
        problem: (
          <span>
            <Fraction numerator={num1} denominator={den} />
            보다 <Fraction numerator={num2} denominator={den} />
            만큼 {op_text} 수는? <AnswerInput index={0} />
          </span>
        ),
        answer: [String(simplifiedNum)],
        type: 'fraction',
        subType: 'conditional',
        storable: {
          type: 'fraction',
          subType: 'conditional',
          operands: [num1, num2, den, isBigger ? 1 : 0],
          operator: 'calculate',
        },
      };
    }

    return {
      problem: (
        <span>
          <Fraction numerator={num1} denominator={den} />
          보다 <Fraction numerator={num2} denominator={den} />
          만큼 {op_text} 수는?{' '}
          <Fraction numerator={<AnswerInput index={0} />} denominator={<AnswerInput index={1} />} />
        </span>
      ),
      answer: [String(simplifiedNum), String(simplifiedDen)],
      type: 'fraction',
      subType: 'conditional',
      storable: {
        type: 'fraction',
        subType: 'conditional',
        operands: [num1, num2, den, isBigger ? 1 : 0],
        operator: 'calculate',
      },
    };
  } else {
    let num1 = round(randomInt(100, 800) / 100, 2);
    let num2 = round(randomInt(10, num1 * 100 - 50) / 100, 2);

    const answer = isBigger ? round(num1 + num2, 2) : round(num1 - num2, 2);

    return {
      problem: (
        <span>
          {num1}보다 {num2}만큼 {op_text} 수는? <AnswerInput index={0} />
        </span>
      ),
      answer: [String(answer)],
      type: 'decimal',
      subType: 'conditional',
      storable: {
        type: 'decimal',
        subType: 'conditional',
        operands: [num1, num2, isBigger ? 1 : 0],
        operator: 'calculate',
      },
    };
  }
};

// 8. 목록 탐색형
const generateListNavigationProblem = (): MathProblem => {
  // "[3/12, 6/12, 8/12, 11/12] 중에서 가장 큰 수와 가장 작은 수의 합 구하기"
  const isFraction = Math.random() > 0.5;
  const isSum = Math.random() > 0.5;
  const op_text = isSum ? '합' : '차';

  if (isFraction) {
    const den = randomInt(15, 30);
    const nums = shuffle(
      Array.from({ length: 4 }, (_, i) => randomInt(1, den - 1))
    ).slice(0, 4);
    const sorted = [...nums].sort((a, b) => a - b);
    const smallest = sorted[0];
    const largest = sorted[sorted.length - 1];
    const resultNum = isSum ? smallest + largest : largest - smallest;
    const commonDivisor = gcd(resultNum, den);
    const simplifiedNum = resultNum / commonDivisor;
    const simplifiedDen = den / commonDivisor;
    
    if (simplifiedDen === 1) {
        return {
        problem: (
          <div className="text-center">
            <p>다음 카드 중 가장 큰 수와 가장 작은 수의 {op_text}을 구하세요.</p>
            <div className="flex justify-center gap-2 my-2">
              {nums.map(n => (
                <div key={n} className="p-2 border rounded bg-gray-100">
                  <Fraction numerator={n} denominator={den} />
                </div>
              ))}
            </div>
            <p>
              <AnswerInput index={0} />
            </p>
          </div>
        ),
        answer: [String(simplifiedNum)],
        type: 'fraction',
        subType: 'list-navigation',
        storable: {
          type: 'fraction',
          subType: 'list-navigation',
          operands: [...nums, den, isSum ? 1 : 0],
          operator: 'calculate',
        },
      };
    }

    return {
      problem: (
        <div className="text-center">
          <p>다음 카드 중 가장 큰 수와 가장 작은 수의 {op_text}을 구하세요.</p>
          <div className="flex justify-center gap-2 my-2">
            {nums.map(n => (
              <div key={n} className="p-2 border rounded bg-gray-100">
                <Fraction numerator={n} denominator={den} />
              </div>
            ))}
          </div>
          <p>
            <Fraction numerator={<AnswerInput index={0} />} denominator={<AnswerInput index={1} />} />
          </p>
        </div>
      ),
      answer: [
        String(simplifiedNum), String(simplifiedDen)
      ],
      type: 'fraction',
      subType: 'list-navigation',
      storable: {
        type: 'fraction',
        subType: 'list-navigation',
        operands: [...nums, den, isSum ? 1 : 0],
        operator: 'calculate',
      },
    };
  } else {
    const nums = Array.from({ length: 4 }, () =>
      round(randomInt(100, 999) / 100, 2)
    );
    const sorted = [...nums].sort((a, b) => a - b);
    const smallest = sorted[0];
    const largest = sorted[sorted.length - 1];
    const answer = isSum
      ? round(smallest + largest, 2)
      : round(largest - smallest, 2);
    return {
      problem: (
        <div className="text-center">
          <p>다음 카드 중 가장 큰 수와 가장 작은 수의 {op_text}을 구하세요.</p>
          <div className="flex justify-center gap-2 my-2">
            {nums.map(n => (
              <div key={n} className="p-3 border rounded bg-gray-100 font-mono">
                {n}
              </div>
            ))}
          </div>
          <p>
            <AnswerInput index={0} />
          </p>
        </div>
      ),
      answer: [String(answer)],
      type: 'decimal',
      subType: 'list-navigation',
      storable: {
        type: 'decimal',
        subType: 'list-navigation',
        operands: [...nums, isSum ? 1 : 0],
        operator: 'calculate',
      },
    };
  }
};


export const generateProblemFromData = (data: StorableProblem): MathProblem => {
  // This is a placeholder for re-generating problems from stored data.
  // For now, it's safer to generate a new problem of a similar type.
  const problemMap: Record<ProblemSubType, () => MathProblem> = {
    'direct-calculation': generateDirectCalculationProblem,
    'process-decomposition': generateProcessDecompositionProblem,
    'unit-conversion-concept': generateUnitConversionConceptProblem,
    comparison: generateComparisonProblem,
    'word-problem': generateWordProblem,
    conditional: generateConditionalProblem,
    'list-navigation': generateListNavigationProblem,
    // Add other types here as they are implemented
    'vertical-calculation': generateDirectCalculationProblem, // Fallback
    'error-correction': generateDirectCalculationProblem, // Fallback
    'multi-step-word-problem': generateWordProblem, // Fallback
    'find-and-operate': generateListNavigationProblem, // Fallback
    'error-analysis': generateComparisonProblem, // Fallback
    'multiple-choice': generateComparisonProblem, // Fallback
    diagram: generateDirectCalculationProblem, // Fallback
    'decimal-add': generateDirectCalculationProblem,
    'decimal-subtract': generateDirectCalculationProblem,
    'fraction-add-same-den': generateDirectCalculationProblem,
    'fraction-subtract-same-den': generateDirectCalculationProblem,
    'fraction-add-mixed': generateProcessDecompositionProblem,
    'fraction-subtract-mixed': generateDirectCalculationProblem,
    'fraction-subtract-from-int': generateProcessDecompositionProblem,
    'fraction-word-problem': generateWordProblem,
    'fraction-comparison': generateComparisonProblem,
    'fraction-to-decimal': generateUnitConversionConceptProblem,
    'decimal-to-fraction': generateUnitConversionConceptProblem,
    'conditional-operation': generateConditionalProblem,
  };

  const generator = problemMap[data.subType] || generateDirectCalculationProblem;
  return generator();
};


export const problemNodeToString = (node: React.ReactNode): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node))
    return node.map(child => problemNodeToString(child)).join('');
  if (React.isValidElement(node) && node.props.children) {
    if (node.type === AnswerInput) return `[답${node.props.index}]`;
    if (node.type === Fraction)
      return `${problemNodeToString(node.props.numerator)}/${problemNodeToString(node.props.denominator)}`;
    if (node.type === MixedFraction)
      return `${problemNodeToString(node.props.integer)} ${problemNodeToString(node.props.numerator)}/${problemNodeToString(node.props.denominator)}`;
    return React.Children.toArray(node.props.children)
      .map(child => problemNodeToString(child))
      .join('');
  }
  return '';
};

// --- Main Problem Generation Function ---
const problemGenerators = [
  generateDirectCalculationProblem,
  generateProcessDecompositionProblem,
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
