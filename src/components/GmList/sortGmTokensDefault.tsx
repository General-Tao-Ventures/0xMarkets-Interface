import type { GlvAndGmMarketsInfoData } from "domain/synthetics/markets";
import { isGlvInfo } from "domain/synthetics/markets/glv";
import type { CarthaMarketLiquidity } from "domain/cartha/useCarthaMarketLiquidity";
import { getCarthaLiquidityForMarket } from "domain/cartha/useCarthaMarketLiquidity";
import { TokenData, TokensData, convertToUsd } from "domain/synthetics/tokens";

/**
 * Sorts GM tokens by:
 * 1. User owned wallet balance descending
 * 2. Cartha LP TVL (or GM supply USD fallback) descending
 */
export function sortGmTokensDefault(
  marketsInfoData: GlvAndGmMarketsInfoData,
  marketTokensData: TokensData,
  carthaLiquidityByMarket?: Record<string, CarthaMarketLiquidity>
) {
  if (marketsInfoData === undefined || marketTokensData === undefined) {
    return [];
  }

  const tokens: { tokenData: TokenData; totalSupplyUsd: bigint; balanceUsd: bigint }[] = [];

  for (const market of Object.values(marketsInfoData)) {
    if (market.isDisabled) {
      continue;
    }

    const marketTokenData = isGlvInfo(market) ? market.glvToken : marketTokensData[market.marketTokenAddress];

    if (!marketTokenData) {
      continue;
    }

    const cartha = getCarthaLiquidityForMarket(
      carthaLiquidityByMarket,
      isGlvInfo(market) ? undefined : market.marketTokenAddress
    );
    const totalSupplyUsd =
      cartha && cartha.tvlUsd > 0n
        ? cartha.tvlUsd
        : (convertToUsd(marketTokenData.totalSupply, marketTokenData.decimals, marketTokenData.prices.minPrice) ?? 0n);

    const balanceUsd = convertToUsd(marketTokenData.balance, marketTokenData.decimals, marketTokenData.prices.minPrice);

    tokens.push({
      tokenData: marketTokenData,
      totalSupplyUsd,
      balanceUsd: balanceUsd ?? 0n,
    });
  }

  // Sort by user balance first (descending), then by TVL (descending)
  tokens.sort((a, b) => {
    // Compare balances directly - tokens with higher balance come first
    if (a.balanceUsd !== b.balanceUsd) {
      return a.balanceUsd > b.balanceUsd ? -1 : 1;
    }

    // If balances are equal, sort by total supply descending
    return a.totalSupplyUsd > b.totalSupplyUsd ? -1 : 1;
  });

  return tokens.map((token) => token.tokenData);
}
