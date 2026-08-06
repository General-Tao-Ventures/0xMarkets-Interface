import { PRECISION } from "./numbers";

/**
 * Markets whose on-chain index is XXX/USD while humans trade/view USD/XXX
 * (e.g. JPY index ~0.00633, display USD/JPY ~157).
 *
 * Protocol math and keeper tickers stay in index domain; invert only at UI edges.
 */
const FX_DISPLAY_REVERSED_SYMBOLS = new Set(["JPY"]);

export function isFxDisplayReversedSymbol(symbol: string | undefined): boolean {
  return Boolean(symbol && FX_DISPLAY_REVERSED_SYMBOLS.has(symbol));
}

/** Same as OrderHandler: FLOAT_PRECISION² / price */
export function invertUsdPrice(price: bigint): bigint {
  if (price <= 0n) return 0n;
  return (PRECISION * PRECISION) / price;
}

/** Index-domain → human USD/XXX quote */
export function toFxDisplayPrice(price: bigint | undefined, indexSymbol?: string): bigint | undefined {
  if (price === undefined) return undefined;
  if (!isFxDisplayReversedSymbol(indexSymbol)) return price;
  return invertUsdPrice(price);
}

/** Human USD/XXX quote → index-domain */
export function toFxIndexPrice(displayPrice: bigint | undefined, indexSymbol?: string): bigint | undefined {
  if (displayPrice === undefined) return undefined;
  if (!isFxDisplayReversedSymbol(indexSymbol)) return displayPrice;
  return invertUsdPrice(displayPrice);
}

/**
 * On-chain Long JPY profits when USD/JPY falls. For USD/JPY UX, flip direction
 * so "Long" matches chart (profits when USD/JPY rises).
 */
export function toFxDisplayIsLong(isLong: boolean, indexSymbol?: string): boolean {
  return isFxDisplayReversedSymbol(indexSymbol) ? !isLong : isLong;
}

export function toFxIndexIsLong(displayIsLong: boolean, indexSymbol?: string): boolean {
  return isFxDisplayReversedSymbol(indexSymbol) ? !displayIsLong : displayIsLong;
}
