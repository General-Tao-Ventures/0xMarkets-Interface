import { useMemo } from "react";

import { useCarthaMarketLiquidity } from "domain/cartha/useCarthaMarketLiquidity";
import { marketsInfoData2IndexTokenStatsMap } from "domain/synthetics/stats/marketsInfoDataToIndexTokensStats";
import { EMPTY_ARRAY } from "lib/objects";

import { selectMarketsInfoData } from "../selectors/globalSelectors";
import { useSelector } from "../utils";

/** Index-token stats for /stats MarketsList — prefers Cartha LP TVL when available. */
export const useMarketsInfoDataToIndexTokensStats = () => {
  const marketsInfoData = useSelector(selectMarketsInfoData);
  const { liquidityByMarket } = useCarthaMarketLiquidity();

  return useMemo(() => {
    if (!marketsInfoData) {
      return EMPTY_ARRAY;
    }

    const stats = marketsInfoData2IndexTokenStatsMap(marketsInfoData, liquidityByMarket);
    return stats.sortedByTotalPoolValue.map((address) => stats.indexMap[address]!);
  }, [marketsInfoData, liquidityByMarket]);
};
