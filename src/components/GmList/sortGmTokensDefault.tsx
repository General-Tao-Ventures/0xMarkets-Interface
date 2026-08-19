import type { GlvAndGmMarketsInfoData } from "domain/synthetics/markets";
import { isGlvInfo } from "domain/synthetics/markets/glv";
import { TokenData, TokensData, convertToUsd } from "domain/synthetics/tokens";

/**
 * Sorts GM tokens by:
 * 1. User owned wallet balance descending
 * 2. GM supply USD descending
 */
export function sortGmTokensDefault(marketsInfoData: GlvAndGmMarketsInfoData, marketTokensData: TokensData) {
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

    const totalSupplyUsd =
      convertToUsd(marketTokenData.totalSupply, marketTokenData.decimals, marketTokenData.prices.minPrice) ?? 0n;

    const balanceUsd = convertToUsd(marketTokenData.balance, marketTokenData.decimals, marketTokenData.prices.minPrice);

    tokens.push({
      tokenData: marketTokenData,
      totalSupplyUsd,
      balanceUsd: balanceUsd ?? 0n,
    });
  }

  tokens.sort((a, b) => {
    if (a.balanceUsd !== b.balanceUsd) {
      return a.balanceUsd > b.balanceUsd ? -1 : 1;
    }

    return a.totalSupplyUsd > b.totalSupplyUsd ? -1 : 1;
  });

  return tokens.map((token) => token.tokenData);
}
