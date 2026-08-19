import { useMemo } from "react";

import { marketsInfoData2IndexTokenStatsMap } from "domain/synthetics/stats/marketsInfoDataToIndexTokensStats";
import { EMPTY_ARRAY } from "lib/objects";

import { selectMarketsInfoData } from "../selectors/globalSelectors";
import { useSelector } from "../utils";

export const useMarketsInfoDataToIndexTokensStats = () => {
  const marketsInfoData = useSelector(selectMarketsInfoData);

  return useMemo(() => {
    if (!marketsInfoData) {
      return EMPTY_ARRAY;
    }

    const stats = marketsInfoData2IndexTokenStatsMap(marketsInfoData);
    return stats.sortedByTotalPoolValue.map((address) => stats.indexMap[address]!);
  }, [marketsInfoData]);
};
