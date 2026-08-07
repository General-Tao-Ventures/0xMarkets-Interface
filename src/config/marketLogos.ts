const MARKET_LOGOS: Record<string, string> = {
  EUR: "/market_logo/EUR.png",
  GBP: "/market_logo/GBP.png",
  GOLD: "/market_logo/GOLD.png",
  SILVER: "/market_logo/SILVER.png",
  JPY: "/market_logo/JPY.png",
  // Oracle ticker alias still used in some feeds/configs
  XAG: "/market_logo/SILVER.png",
};

/** Custom market logos from /public/market_logo for forex & commodities. */
export function getMarketLogoUrl(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  return MARKET_LOGOS[symbol.toUpperCase()];
}
