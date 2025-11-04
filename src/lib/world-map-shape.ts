
export const MAP_WIDTH = 144;
export const MAP_HEIGHT = 120;

/**
 * Checks if a given coordinate is land.
 * This is currently hardcoded to return true for all tiles.
 * @param x The x-coordinate.
 * @param y The y-coordinate.
 * @returns True, indicating the tile is land.
 */
export const isLand = (x: number, y: number): boolean => {
  // Always return true to make the entire map land
  return true;
};
