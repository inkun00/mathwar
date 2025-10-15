import type { DecimalProblem, Tile } from './types';

// Generates a number with one decimal place.
const randomDecimal = (max: number) => {
  return parseFloat((Math.random() * max).toFixed(1));
};

export const generateDecimalProblem = (): DecimalProblem => {
  const operation = Math.random() > 0.5 ? 'add' : 'subtract';
  let num1 = randomDecimal(20);
  let num2 = randomDecimal(20);

  if (operation === 'subtract' && num1 < num2) {
    [num1, num2] = [num2, num1]; // Ensure the result is not negative
  }

  const problem = operation === 'add' ? `${num1} + ${num2}` : `${num1} - ${num2}`;
  const answer = operation === 'add' ? num1 + num2 : num1 - num2;

  // Round to handle potential floating point inaccuracies
  const roundedAnswer = parseFloat(answer.toFixed(2));

  return {
    problem: `What is ${problem}?`,
    answer: roundedAnswer,
  };
};

export const isAdjacent = (tileX: number, tileY: number, userTiles: Tile[]) => {
    return userTiles.some(userTile => 
        (Math.abs(userTile.x - tileX) === 1 && userTile.y === tileY) ||
        (Math.abs(userTile.y - tileY) === 1 && userTile.x === tileX)
    );
};
