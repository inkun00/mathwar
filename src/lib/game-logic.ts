import type { DecimalProblem, Tile, MapData, User } from './types';

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
    problem: `${problem}의 값은?`,
    answer: roundedAnswer,
  };
};

export const isAdjacent = (tileX: number, tileY: number, userTiles: Tile[]) => {
    return userTiles.some(userTile => 
        (Math.abs(userTile.x - tileX) === 1 && userTile.y === tileY) ||
        (Math.abs(userTile.y - tileY) === 1 && userTile.x === tileX)
    );
};

export const getAIMove = (ai: User, mapData: MapData): Tile | null => {
    if (ai.tokens <= 0) return null;

    const aiTiles = mapData.flat().filter(t => t.ownerId === ai.id);
    if (aiTiles.length === 0) return null;
    
    const allTiles = mapData.flat();
    const conquerableTiles: Tile[] = [];

    for (const tile of allTiles) {
        if (tile.ownerId !== ai.id && isAdjacent(tile.x, tile.y, aiTiles)) {
            conquerableTiles.push(tile);
        }
    }

    if (conquerableTiles.length > 0) {
        const randomIndex = Math.floor(Math.random() * conquerableTiles.length);
        return conquerableTiles[randomIndex];
    }

    return null;
}
