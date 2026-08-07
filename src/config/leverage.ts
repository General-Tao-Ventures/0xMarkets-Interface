import { BASIS_POINTS_DIVISOR } from "config/factors";
import { getNormalizedTokenSymbol } from "sdk/configs/tokens";

/** Forex pairs — UI max leverage badge / slider cap. */
const FOREX_SYMBOLS = new Set(["EUR", "GBP", "JPY"]);

/**
 * Product UI leverage caps (display + trade slider), independent of on-chain
 * minCollateralFactor which may still allow higher.
 * - Forex: 200x
 * - Crypto & metals: 100x
 */
export function getUiMaxLeverageForSymbol(symbol?: string, baseSymbol?: string): number {
  const candidates = [baseSymbol, symbol, symbol ? getNormalizedTokenSymbol(symbol) : undefined]
    .filter(Boolean)
    .map((s) => s!.toUpperCase());

  if (candidates.some((s) => FOREX_SYMBOLS.has(s))) {
    return 200;
  }

  return 100;
}

export function getUiMaxLeverageBps(symbol?: string, baseSymbol?: string): number {
  return getUiMaxLeverageForSymbol(symbol, baseSymbol) * BASIS_POINTS_DIVISOR;
}
