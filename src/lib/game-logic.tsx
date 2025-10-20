'use client';
import type { MathProblem, Tile, User, ProblemSubType, StorableProblem } from './types';
import { isLand } from './world-map-shape';
import React from 'react';

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
  const operations: ( 'add' | 'subtract' | 'multiply' | 'divide' )[] = ['add', 'subtract', 'multiply', 'divide'];
  const operation = operations[randomInt(0,3)];
  let num1 = round(Math.random() * (isAdvanced ? 50 : 20), isAdvanced ? 2 : 1);
  let num2 = round(Math.random() * (isAdvanced ? (operation === 'multiply' || operation === 'divide' ? 10 : 50) : (operation === 'multiply' || operation === 'divide' ? 5 : 20) ), isAdvanced ? 2 : 1);
  let subType: ProblemSubType;
  let answer: number;
  let problemText = '';

  switch(operation) {
    case 'add':
        subType = 'decimal-add';
        answer = round(num1 + num2, 4);
        problemText = `${num1} + ${num2}`;
        break;
    case 'subtract':
        if (num1 < num2) [num1, num2] = [num2, num1];
        subType = 'decimal-subtract';
        answer = round(num1 - num2, 4);
        problemText = `${num1} - ${num2}`;
        break;
    case 'multiply':
        num1 = round(Math.random() * 9 + 1, 1); // Keep numbers smaller for multiplication
        num2 = round(Math.random() * 9 + 1, 1);
        subType = 'decimal-multiply';
        answer = round(num1 * num2, 4);
        problemText = `${num1} × ${num2}`;
        break;
    case 'divide':
        num1 = round( (Math.random() * 9 + 1) * (randomInt(2,5)) , 2); // Make num1 a multiple of a small int
        num2 = round(num1 / (randomInt(2,5)), 2);
        if (num1 < num2) [num1, num2] = [num2, num1];
        if (num2 === 0) num2 = 0.5; // Avoid division by zero
        subType = 'decimal-divide';
        answer = round(num1 / num2, 4);
        problemText = `${num1} ÷ ${num2}`;
        break;
  }

  const problem: MathProblem = {
    problem: <span>{`${problemText} 의 값은?`}</span>,
    answer: answer,
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
    const type = randomInt(1, 6);
    switch (type) {
        case 1: // 진분수 덧셈/뺄셈 (동일 분모)
            return simpleFractionCalc();
        case 2: // 대분수 덧셈/뺄셈
            return mixedFractionCalc();
        case 3: // 자연수 - 분수
            return integerFractionCalc();
        case 4: // 분수 곱셈
            return fractionMultiplication();
        case 5: // 분수 나눗셈
            return fractionDivision();
        case 6: // 문장제
        default:
            return fractionWordProblem();
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

const fractionMultiplication = (): MathProblem => {
    const den1 = randomInt(2, 10);
    const num1 = randomInt(1, den1);
    const den2 = randomInt(2, 10);
    const num2 = randomInt(1, den2);
    const subType: ProblemSubType = 'fraction-multiply';

    return {
      problem: (
        <span className="flex items-center justify-center">
            <Fraction numerator={num1} denominator={den1} />
            <span className="mx-2 text-2xl">×</span>
            <Fraction numerator={num2} denominator={den2} />
            <span className="ml-3 text-2xl">의 값은?</span>
        </span>
      ),
      answer: round((num1/den1) * (num2/den2), 4),
      type: 'fraction',
      subType,
      storable: {
        type: 'fraction',
        subType,
        operands: [num1, den1, num2, den2],
        operator: 'multiply',
      }
    }
}

const fractionDivision = (): MathProblem => {
    const den1 = randomInt(2, 10);
    const num1 = randomInt(1, den1);
    const den2 = randomInt(2, 10);
    const num2 = randomInt(1, den2);
    const subType: ProblemSubType = 'fraction-divide';

    return {
        problem: (
            <span className="flex items-center justify-center">
                <Fraction numerator={num1} denominator={den1} />
                <span className="mx-2 text-2xl">÷</span>
                <Fraction numerator={num2} denominator={den2} />
                <span className="ml-3 text-2xl">의 값은?</span>
            </span>
        ),
        answer: round((num1 / den1) / (num2 / den2), 4),
        type: 'fraction',
        subType,
        storable: {
            type: 'fraction',
            subType,
            operands: [num1, den1, num2, den2],
            operator: 'divide',
        }
    }
}

const fractionWordProblem = (): MathProblem => {
    const den = randomInt(5, 15);
    let num1 = randomInt(1, den - 1);
    let num2 = randomInt(1, den - 1);
    const op = Math.random() > 0.5 ? 'add' : 'subtract';
    
    if (op === 'subtract' && num1 < num2) {
        [num1, num2] = [num2, num1];
    }
    
    const items = [
        { name1: '돼지고기', name2: '소고기', unit: 'kg' },
        { name1: '빨간색 리본', name2: '파란색 리본', unit: 'm' },
        { name1: '물', name2: '주스', unit: 'L' },
        { name1: '설탕', name2: '밀가루', unit: 'kg' },
    ];
    const item = items[randomInt(0, items.length - 1)];

    let problemText: React.ReactNode;
    let storableOperands: (string | number)[] = [num1, den, num2, den, item.name1, item.name2, item.unit];

    if (op === 'add') {
         problemText = (
            <span>
                마트에서 {item.name1} <Fraction numerator={num1} denominator={den} />{item.unit}, {item.name2} <Fraction numerator={num2} denominator={den} />{item.unit}을 샀습니다. 총 몇 {item.unit}일까요?
            </span>
        );
    } else {
        problemText = (
            <span>
                길이가 <Fraction numerator={num1} denominator={den} />{item.unit}인 {item.name1}이 있습니다. 그중에서 <Fraction numerator={num2} denominator={den} />{item.unit}를 사용했다면 남은 것은 몇 {item.unit}일까요?
            </span>
        );
    }

    const answer = op === 'add' ? (num1 + num2) / den : (num1 - num2) / den;

    return {
        problem: problemText,
        answer: round(answer, 4),
        type: 'fraction',
        subType: 'fraction-word-problem',
        storable: {
            type: 'fraction',
            subType: 'fraction-word-problem',
            operands: storableOperands,
            operator: op,
        }
    };
}

const fractionComparisonProblem = (): MathProblem => {
    const den = randomInt(5, 20);
    const numbers = [randomInt(1, den-1), randomInt(1, den-1), randomInt(1, den-1), randomInt(1, den-1)];
    const uniqueNumbers = [...new Set(numbers)];
    while (uniqueNumbers.length < 4) {
        uniqueNumbers.push(randomInt(1, den-1));
    }
    shuffle(uniqueNumbers);

    const type = randomInt(0,1); // 0 for largest/smallest, 1 for 'bigger than'

    if (type === 0) {
        const sorted = [...uniqueNumbers].sort((a,b) => a - b);
        const smallest = sorted[0];
        const largest = sorted[sorted.length-1];
        const op = Math.random() > 0.5 ? 'add' : 'subtract';

        return {
            problem: (
                 <div className="flex flex-col items-center">
                    <span>다음 수 중에서 가장 큰 수와 가장 작은 수의 {op === 'add' ? '합' : '차'}를 구하세요.</span>
                    <div className="flex gap-4 mt-2">
                        {uniqueNumbers.map(n => <Fraction key={n} numerator={n} denominator={den} />)}
                    </div>
                </div>
            ),
            answer: round(op === 'add' ? (largest + smallest) / den : (largest - smallest) / den, 4),
            type: 'fraction',
            subType: 'fraction-comparison',
            storable: {
                type: 'fraction',
                subType: 'fraction-comparison',
                operands: [den, ...uniqueNumbers],
                operator: op,
            }
        }

    } else {
        const num1 = randomInt(1, den - 2);
        const num2 = randomInt(1, den - num1); // Ensure sum is not > 1
        const op = Math.random() > 0.5 ? 'add' : 'subtract';
        
        return {
            problem: (
                 <span className="flex items-center justify-center">
                    <Fraction numerator={num1} denominator={den} />
                    <span className="mx-1">보다</span>
                    <Fraction numerator={num2} denominator={den} />
                    <span className="mx-1">만큼 더 {op === 'add' ? '큰' : '작은'} 수는?</span>
                </span>
            ),
            answer: round(op === 'add' ? (num1 + num2) / den : (num1 - num2) / den, 4),
            type: 'fraction',
            subType: 'fraction-comparison',
            storable: {
                type: 'fraction',
                subType: 'fraction-comparison',
                operands: [num1, den, num2, den],
                operator: op,
            }
        }
    }
}

const generateFractionToDecimalProblem = (): MathProblem => {
    const isMixed = Math.random() > 0.5;
    const den = Math.random() > 0.5 ? 100 : 10;
    const num = randomInt(1, den-1);

    if (isMixed) {
        const int = randomInt(1, 9);
        return {
            problem: (
                <span className="flex items-center justify-center">
                    <span className="mr-2">다음 분수를 소수로 나타내 보세요:</span>
                    <MixedFraction integer={int} numerator={num} denominator={den} />
                </span>
            ),
            answer: round(int + num / den, 2),
            type: 'conversion',
            subType: 'fraction-to-decimal',
            storable: {
                type: 'conversion',
                subType: 'fraction-to-decimal',
                operands: [int, num, den],
                operator: 'convert'
            }
        }
    } else {
        return {
            problem: (
                <span className="flex items-center justify-center">
                    <span className="mr-2">다음 분수를 소수로 나타내 보세요:</span>
                    <Fraction numerator={num} denominator={den} />
                </span>
            ),
            answer: round(num / den, 2),
            type: 'conversion',
            subType: 'fraction-to-decimal',
            storable: {
                type: 'conversion',
                subType: 'fraction-to-decimal',
                operands: [num, den],
                operator: 'convert'
            }
        }
    }
};

const generateDecimalToFractionProblem = (): MathProblem => {
    const places = Math.random() > 0.5 ? 2 : 1;
    const num = round(Math.random() * 5, places);

    let [intPart, decPart] = String(num).split('.');
    if (!decPart) decPart = '0';
    
    const numerator = parseInt(decPart, 10);
    const denominator = Math.pow(10, decPart.length);
    const commonDivisor = gcd(numerator, denominator);
    
    // The answer is the decimal value, but the user must input a fraction.
    // The modal will need to be adapted to accept fraction inputs.
    return {
        problem: (
            <span className="flex items-center justify-center">
                <span className="mr-2">다음 소수를 분수로 나타내 보세요:</span>
                <span className="text-2xl">{num}</span>
            </span>
        ),
        answer: num,
        type: 'conversion',
        subType: 'decimal-to-fraction',
        storable: {
            type: 'conversion',
            subType: 'decimal-to-fraction',
            operands: [num],
            operator: 'convert'
        }
    }
};


export const generateProblemFromData = (data: StorableProblem): MathProblem => {
    const { type, subType, operands, operator } = data;
    const opSymbol = operator === 'add' ? '+' : operator === 'subtract' ? '-' : operator === 'multiply' ? '×' : '÷';

    switch (subType) {
        // --- DECIMAL ---
        case 'decimal-add':
        case 'decimal-subtract':
        case 'decimal-multiply':
        case 'decimal-divide':
            const [d_num1, d_num2] = operands as number[];
            let d_answer: number;
            if (operator === 'add') d_answer = d_num1 + d_num2;
            else if (operator === 'subtract') d_answer = d_num1 - d_num2;
            else if (operator === 'multiply') d_answer = d_num1 * d_num2;
            else d_answer = d_num1 / d_num2;

            return {
                problem: <span>{`${d_num1} ${opSymbol} ${d_num2} 의 값은?`}</span>,
                answer: round(d_answer, 4),
                type: 'decimal', subType, storable: data
            };
        
        // --- FRACTION ---
        case 'fraction-add-same-den':
        case 'fraction-subtract-same-den':
            const [fs_num1, fs_den, fs_num2] = operands as number[];
            return {
                problem: (
                    <span className="flex items-center justify-center">
                        <Fraction numerator={fs_num1} denominator={fs_den} />
                        <span className="mx-2 text-2xl">{opSymbol}</span>
                        <Fraction numerator={fs_num2} denominator={fs_den} />
                        <span className="ml-3 text-2xl">의 값은?</span>
                    </span>
                ),
                answer: round((operator === 'add' ? fs_num1 + fs_num2 : fs_num1 - fs_num2) / fs_den, 4),
                type: 'fraction', subType, storable: data
            };
        case 'fraction-add-mixed':
        case 'fraction-subtract-mixed':
             const [fm_int1, fm_num1, fm_den1, fm_int2, fm_num2, fm_den2] = operands as number[];
             const val1 = fm_int1 + fm_num1 / fm_den1;
             const val2 = fm_int2 + fm_num2 / fm_den2;
            return {
                problem: (
                     <span className="flex items-center justify-center">
                        <MixedFraction integer={fm_int1} numerator={fm_num1} denominator={fm_den1} />
                        <span className="mx-2 text-2xl">{opSymbol}</span>
                        <MixedFraction integer={fm_int2} numerator={fm_num2} denominator={fm_den2} />
                        <span className="ml-3 text-2xl">의 값은?</span>
                    </span>
                ),
                answer: round(operator === 'add' ? val1 + val2 : val1 - val2, 4),
                type: 'fraction', subType, storable: data
            };
        case 'fraction-subtract-from-int':
            const [fi_int, fi_num, fi_den] = operands as number[];
            return {
                 problem: (
                    <span className="flex items-center justify-center">
                        <span className="text-2xl">{fi_int}</span>
                        <span className="mx-2 text-2xl">-</span>
                        <Fraction numerator={fi_num} denominator={fi_den} />
                        <span className="ml-3 text-2xl">의 값은?</span>
                    </span>
                ),
                answer: round(fi_int - (fi_num/fi_den), 4),
                type: 'fraction', subType, storable: data
            };
        case 'fraction-multiply':
        case 'fraction-divide':
            const [fmd_num1, fmd_den1, fmd_num2, fmd_den2] = operands as number[];
            const fmd_answer = operator === 'multiply' ? (fmd_num1 / fmd_den1) * (fmd_num2 / fmd_den2) : (fmd_num1 / fmd_den1) / (fmd_num2 / fmd_den2);
             return {
                problem: (
                    <span className="flex items-center justify-center">
                        <Fraction numerator={fmd_num1} denominator={fmd_den1} />
                        <span className="mx-2 text-2xl">{opSymbol}</span>
                        <Fraction numerator={fmd_num2} denominator={fmd_den2} />
                        <span className="ml-3 text-2xl">의 값은?</span>
                    </span>
                ),
                answer: round(fmd_answer, 4),
                type: 'fraction', subType, storable: data
            };
        case 'fraction-word-problem':
            const [fw_num1, fw_den, fw_num2, _fw_den2, fw_item1, fw_item2, fw_unit] = operands as [number, number, number, number, string, string, string];
            const fw_answer = operator === 'add' ? (fw_num1 + fw_num2) / fw_den : (fw_num1 - fw_num2) / fw_den;
            return {
                problem: operator === 'add' ? (
                    <span>
                        마트에서 {fw_item1} <Fraction numerator={fw_num1} denominator={fw_den} />{fw_unit}, {fw_item2} <Fraction numerator={fw_num2} denominator={fw_den} />{fw_unit}을 샀습니다. 총 몇 {fw_unit}일까요?
                    </span>
                ) : (
                    <span>
                        길이가 <Fraction numerator={fw_num1} denominator={fw_den} />{fw_unit}인 {fw_item1}이 있습니다. 그중에서 <Fraction numerator={fw_num2} denominator={fw_den} />{fw_unit}를 사용했다면 남은 것은 몇 {fw_unit}일까요?
                    </span>
                ),
                answer: round(fw_answer, 4),
                type: 'fraction', subType, storable: data
            };
        case 'fraction-comparison':
            const [fc_den, ...fc_nums] = operands as number[];
            if (operands.length > 5) { // Largest/smallest problem
                 const sorted = [...fc_nums].sort((a,b) => a-b);
                 const smallest = sorted[0];
                 const largest = sorted[sorted.length-1];
                 const fc_answer = operator === 'add' ? (largest + smallest) / fc_den : (largest - smallest) / fc_den;
                 return {
                    problem: (
                        <div className="flex flex-col items-center">
                            <span>다음 수 중에서 가장 큰 수와 가장 작은 수의 {operator === 'add' ? '합' : '차'}를 구하세요.</span>
                            <div className="flex gap-4 mt-2">
                                {fc_nums.map(n => <Fraction key={n} numerator={n} denominator={fc_den} />)}
                            </div>
                        </div>
                    ),
                    answer: round(fc_answer, 4),
                    type: 'fraction', subType, storable: data
                 }
            } else { // "Bigger than" problem
                const [fc_num1, _fc_den1, fc_num2] = operands as number[];
                const fc_answer = operator === 'add' ? (fc_num1 + fc_num2) / fc_den : (fc_num1 - fc_num2) / fc_den;
                return {
                     problem: (
                        <span className="flex items-center justify-center">
                            <Fraction numerator={fc_num1} denominator={fc_den} />
                            <span className="mx-1">보다</span>
                            <Fraction numerator={fc_num2} denominator={fc_den} />
                            <span className="mx-1">만큼 더 {operator === 'add' ? '큰' : '작은'} 수는?</span>
                        </span>
                    ),
                    answer: round(fc_answer, 4),
                    type: 'fraction', subType, storable: data
                }
            }
        case 'fraction-to-decimal':
            const ftd_operands = operands as number[];
            if (ftd_operands.length === 3) { // Mixed
                const [int, num, den] = ftd_operands;
                return {
                    problem: (
                        <span className="flex items-center justify-center">
                            <span className="mr-2">다음 분수를 소수로 나타내 보세요:</span>
                            <MixedFraction integer={int} numerator={num} denominator={den} />
                        </span>
                    ),
                    answer: round(int + num / den, 2),
                    type: 'conversion', subType, storable: data
                }
            } else { // Proper
                const [num, den] = ftd_operands;
                return {
                     problem: (
                        <span className="flex items-center justify-center">
                            <span className="mr-2">다음 분수를 소수로 나타내 보세요:</span>
                            <Fraction numerator={num} denominator={den} />
                        </span>
                    ),
                    answer: round(num / den, 2),
                    type: 'conversion', subType, storable: data
                }
            }
        case 'decimal-to-fraction':
            const [dtf_num] = operands as number[];
            return {
                problem: (
                    <span className="flex items-center justify-center">
                        <span className="mr-2">다음 소수를 분수로 나타내 보세요:</span>
                        <span className="text-2xl">{dtf_num}</span>
                    </span>
                ),
                answer: dtf_num,
                type: 'conversion', subType, storable: data
            }
        default:
            // Fallback for any unhandled subtype
            return generateDecimalProblem();
    }
};

export const problemNodeToString = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (node instanceof Array) return node.map(child => problemNodeToString(child)).join('');
    if (React.isValidElement(node) && node.props.children) {
        return React.Children.toArray(node.props.children).map(child => problemNodeToString(child)).join('');
    }
    return '';
};


// --- Main Problem Generation Function ---
export const generateMathProblem = (): MathProblem => {
  const problemType = Math.random(); // 0 to 1
  if (problemType < 0.7) { // 70% chance for decimal calculation
    return generateDecimalProblem();
  } else { // 30% chance for fraction/conversion
    const subType = randomInt(1, 10);
    switch(subType) {
        case 1:
        case 2:
            return simpleFractionCalc();
        case 3:
            return mixedFractionCalc();
        case 4:
            return integerFractionCalc();
        case 5:
            return fractionMultiplication();
        case 6:
            return fractionDivision();
        case 7:
            return fractionWordProblem();
        case 8:
            return fractionComparisonProblem();
        case 9:
            return generateFractionToDecimalProblem();
        case 10:
        default:
            return generateDecimalToFractionProblem();
    }
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
