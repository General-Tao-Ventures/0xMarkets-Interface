import { createSelector } from "../utils";
import { selectPositionsInfoData } from "./globalSelectors";
import { selectTradeboxMarketsSortMap } from "./tradeboxSelectors";

export const selectPositionsInfoDataSortedByMarket = createSelector((q) => {
  const positionsInfoData = q(selectPositionsInfoData);
  const marketsSortMap = q(selectTradeboxMarketsSortMap);

  const positions = Object.values(positionsInfoData || {});
  const sortedPositions = positions.sort((a, b) => {
    const aMarketIdx = marketsSortMap[a.market.indexTokenAddress];
    const bMarketIdx = marketsSortMap[b.market.indexTokenAddress];

    if (aMarketIdx === bMarketIdx) {
      if (b.sizeInUsd !== a.sizeInUsd) {
        return b.sizeInUsd > a.sizeInUsd ? 1 : -1;
      }
      // Stable tiebreaker: sort by position key
      return a.key < b.key ? -1 : 1;
    }

    return aMarketIdx - bMarketIdx;
  });
  return sortedPositions;
});
