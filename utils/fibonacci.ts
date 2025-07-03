// Fibonacci calculation utilities

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
}

/**
 * Calculate Fibonacci retracement levels
 * @param pointA - Starting price of the impulse
 * @param pointB - Ending price of the impulse  
 * @param levels - Array of Fibonacci ratios (default: [0.236, 0.382, 0.5, 0.618, 0.786])
 * @returns Array of retracement levels
 */
export const calculateFibonacciRetracements = (
  pointA: number,
  pointB: number,
  levels: number[] = [0.236, 0.382, 0.5, 0.618, 0.786]
): FibonacciLevel[] => {
  const range = pointB - pointA;
  
  return levels.map(level => ({
    level,
    price: pointB - (range * level),
    label: `Retracement ${(level * 100).toFixed(1)}%`
  }));
};

/**
 * Calculate Fibonacci extension levels
 * @param pointA - Starting price of the impulse
 * @param pointB - Ending price of the impulse
 * @param pointC - End of retracement from B
 * @param levels - Array of Fibonacci extension ratios (default: [1.272, 1.414, 1.618, 2.618])
 * @returns Array of extension levels
 */
export const calculateFibonacciExtensions = (
  pointA: number,
  pointB: number,
  pointC: number,
  levels: number[] = [1.272, 1.414, 1.618, 2.618]
): FibonacciLevel[] => {
  const impulseRange = pointB - pointA;
  
  return levels.map(level => {
    // Extension calculation: C + (impulse * extension_ratio)
    const extensionPrice = pointC + (impulseRange * level);
    
    return {
      level,
      price: extensionPrice,
      label: `Extension ${(level * 100).toFixed(1)}%`
    };
  });
};

/**
 * Calculate alternative Fibonacci extensions (AB=CD pattern)
 * @param pointA - Starting price of the impulse
 * @param pointB - Ending price of the impulse
 * @param _pointC - End of retracement from B (unused in this calculation)
 * @param levels - Array of Fibonacci ratios (default: [-0.272, -0.618, -1.272])
 * @returns Array of extension levels
 */
export const calculateFibonacciExtensionsAlternative = (
  pointA: number,
  pointB: number,
  _pointC: number,
  levels: number[] = [-0.272, -0.618, -1.272]
): FibonacciLevel[] => {
  const impulseRange = pointB - pointA;
  
  return levels.map(level => {
    // Alternative extension: B + (impulse * extension_ratio)
    const extensionPrice = pointB + (impulseRange * level);
    
    return {
      level,
      price: extensionPrice,
      label: `Extension ${(level * 100).toFixed(1)}%`
    };
  });
};
