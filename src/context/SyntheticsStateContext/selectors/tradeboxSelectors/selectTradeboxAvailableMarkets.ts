import values from "lodash/values";

import { isMarketComingSoon } from "config/markets";
import { selectChainId, selectMarketsInfoData } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { selectTradeboxToTokenAddress } from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { createSelector } from "context/SyntheticsStateContext/utils";
import { isMarketIndexToken } from "domain/synthetics/markets";
import { EMPTY_ARRAY } from "lib/objects";

export const selectTradeboxAvailableMarkets = createSelector((q) => {
  const chainId = q(selectChainId);
  const marketsInfoData = q(selectMarketsInfoData);
  const indexTokenAddress = q(selectTradeboxToTokenAddress);

  if (!marketsInfoData || !indexTokenAddress) {
    return EMPTY_ARRAY;
  }

  const allMarkets = values(marketsInfoData).filter(
    (market) => !market.isSpotOnly && !market.isDisabled && !isMarketComingSoon(chainId, market.marketTokenAddress)
  );

  const availableMarkets = allMarkets.filter((market) => isMarketIndexToken(market, indexTokenAddress));

  return availableMarkets;
});
