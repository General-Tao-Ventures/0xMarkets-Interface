import mapValues from "lodash/mapValues";

import { isDevelopment } from "config/env";
import { SETTLEMENT_CHAINS } from "config/multichain";

import { SettlementChainId } from "./chains";
import { MARKETS } from "./static/markets";

export * from "./static/markets";

export const ENOUGH_DAYS_SINCE_LISTING_FOR_APY = 8;

export const MARKETS_INDEX: Record<number, Record<string, boolean>> = mapValues(MARKETS, (markets) =>
  mapValues(markets, (market) => Boolean(market.enabled))
);

export function isMarketEnabled(chainId: number, marketAddress: string) {
  if (isDevelopment()) return true;

  return MARKETS_INDEX[chainId]?.[marketAddress] ?? false;
}

export const GLV_MARKETS: {
  [chainId: number]: Record<string, { name: string | undefined; subtitle: string; shortening: string }>;
} = {};

export function getMarketUiConfig(chainId: number, marketAddress: string) {
  return MARKETS[chainId]?.[marketAddress];
}

export function isMarketComingSoon(chainId: number, marketAddress: string) {
  return MARKETS[chainId]?.[marketAddress]?.comingSoon ?? false;
}

const SETTLEMENT_CHAIN_TRADABLE_ASSETS_MAP: Record<SettlementChainId, string[]> = {} as any;

for (const chainId of SETTLEMENT_CHAINS) {
  const tradableTokenAddressesSet = new Set<string>();

  for (const marketAddress in MARKETS[chainId]) {
    const marketConfig = MARKETS[chainId][marketAddress];

    tradableTokenAddressesSet.add(marketConfig.longTokenAddress);
    tradableTokenAddressesSet.add(marketConfig.shortTokenAddress);
  }

  SETTLEMENT_CHAIN_TRADABLE_ASSETS_MAP[chainId] = Array.from(tradableTokenAddressesSet);
}

export function getSettlementChainTradableTokenAddresses(chainId: SettlementChainId) {
  return SETTLEMENT_CHAIN_TRADABLE_ASSETS_MAP[chainId];
}
