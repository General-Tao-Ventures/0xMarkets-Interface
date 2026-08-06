import { selectMarketsInfoData, selectTokensData } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { marketsInfoData2IndexTokenStatsMap } from "domain/synthetics/stats/marketsInfoDataToIndexTokensStats";
import { calculateDisplayDecimals } from "lib/numbers";
import { EMPTY_ARRAY, getByKey } from "lib/objects";
import { toFxDisplayPrice } from "sdk/utils/fxDisplay";

import { createSelector, createSelectorFactory } from "../utils";
import { selectChartToken, selectSelectedMarketVisualMultiplier } from "./shared/marketSelectors";
import { selectTradeboxTradeFlags } from "./tradeboxSelectors";

export const selectIndexTokenStats = createSelector((q) => {
  const marketsInfoData = q(selectMarketsInfoData);

  if (!marketsInfoData) {
    return EMPTY_ARRAY;
  }

  const stats = q(selectIndexTokenStatsMap);

  return stats.sortedByTotalPoolValue.map((address) => stats.indexMap[address]!);
});

const FALLBACK: ReturnType<typeof marketsInfoData2IndexTokenStatsMap> = {
  indexMap: {},
  sortedByTotalPoolValue: [],
};

export const selectIndexTokenStatsMap = createSelector((q) => {
  const marketsInfoData = q(selectMarketsInfoData);

  if (!marketsInfoData) {
    return FALLBACK;
  }

  return marketsInfoData2IndexTokenStatsMap(marketsInfoData);
});

export const selectSelectedMarketPriceDecimals = createSelector((q) => {
  const { chartToken } = q(selectChartToken);

  if (!chartToken) {
    return 2;
  }

  if (chartToken.priceDecimals !== undefined) {
    return chartToken.priceDecimals;
  }

  // Prefer display-domain magnitude (USD/JPY ~157) so JPY doesn't inherit ~0.006's high dp count.
  const displayPrice = toFxDisplayPrice(chartToken.prices.minPrice, chartToken.symbol) ?? chartToken.prices.minPrice;
  return calculateDisplayDecimals(displayPrice);
});

export const makeSelectMarketPriceDecimals = createSelectorFactory((tokenAddress?: string) =>
  createSelector(function selectSelectedMarketPriceDecimals(q) {
    const tokensData = q(selectTokensData);
    const token = getByKey(tokensData, tokenAddress);
    const { isSwap } = q(selectTradeboxTradeFlags);

    if (!token) {
      return;
    }

    if (token.priceDecimals !== undefined) {
      return token.priceDecimals;
    }

    const visualMultiplier = isSwap ? 1 : token.visualMultiplier;
    const displayPrice = toFxDisplayPrice(token.prices.minPrice, token.symbol) ?? token.prices.minPrice;

    return calculateDisplayDecimals(displayPrice, undefined, visualMultiplier);
  })
);

export { selectSelectedMarketVisualMultiplier };
