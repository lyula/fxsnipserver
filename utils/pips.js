/**
 * Get pip size for a symbol (e.g. EURUSD = 0.0001, USDJPY = 0.01).
 * Pair can be "EURUSD", "EURUSD.x", "USDJPY", etc.
 */
function getPipSize(pair) {
  if (!pair || typeof pair !== 'string') return 0.0001;
  const upper = pair.toUpperCase();
  if (upper.includes('JPY')) return 0.01;
  return 0.0001;
}

/**
 * Calculate pips from open and close price.
 * Buy: positive pips when closePrice > openPrice (profit).
 * Sell: positive pips when openPrice > closePrice (profit).
 * Returns number rounded to 1 decimal.
 */
function calcPips(type, openPrice, closePrice, pair) {
  if (openPrice == null || closePrice == null || !pair) return 0;
  const pipSize = getPipSize(pair);
  if (pipSize <= 0) return 0;
  const isBuy = type === 'Buy' || (typeof type === 'string' && type.toLowerCase() === 'buy');
  const diff = isBuy ? closePrice - openPrice : openPrice - closePrice;
  const pips = diff / pipSize;
  return Math.round(pips * 10) / 10;
}

module.exports = { getPipSize, calcPips };
