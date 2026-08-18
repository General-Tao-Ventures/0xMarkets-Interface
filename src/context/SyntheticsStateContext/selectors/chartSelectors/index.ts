import {
  selectTradeboxAvailableTokensOptions,
  selectTradeboxFromTokenAddress,
  selectTradeboxMarketInfo,
  selectTradeboxToTokenAddress,
  selectTradeboxTradeFlags,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { createSelector } from "context/SyntheticsStateContext/utils";
import { getChartBorrowingRateHourly, getChartFundingRateHourly } from "domain/synthetics/fees/chartRates";
import { getAvailableUsdLiquidityForPosition } from "domain/synthetics/markets";
import { bigMath } from "sdk/utils/bigmath";

export { selectChartToken } from "../shared/marketSelectors";

export const selectAvailableChartTokens = createSelector(function selectChartToken(q) {
  const fromTokenAddress = q(selectTradeboxFromTokenAddress);
  const toTokenAddress = q(selectTradeboxToTokenAddress);

  if (!fromTokenAddress || !toTokenAddress) {
    return [];
  }

  const { isSwap } = q(selectTradeboxTradeFlags);
  const { swapTokens, indexTokens, sortedLongAndShortTokens, sortedIndexTokensWithPoolValue } = q(
    selectTradeboxAvailableTokensOptions
  );

  const availableChartTokens = isSwap ? swapTokens : indexTokens;
  const sortedAvailableChartTokens = availableChartTokens.sort((a, b) => {
    if (sortedIndexTokensWithPoolValue || sortedLongAndShortTokens) {
      const currentSortReferenceList = isSwap ? sortedLongAndShortTokens : sortedIndexTokensWithPoolValue;
      return currentSortReferenceList.indexOf(a.address) - currentSortReferenceList.indexOf(b.address);
    }
    return 0;
  });

  return sortedAvailableChartTokens;
});

export const selectChartHeaderInfo = createSelector((q) => {
  const marketInfo = q(selectTradeboxMarketInfo);

  if (!marketInfo) {
    return;
  }

  const borrowingRateLong = getChartBorrowingRateHourly(marketInfo, true);
  const borrowingRateShort = getChartBorrowingRateHourly(marketInfo, false);
  const fundingRateLong = getChartFundingRateHourly(marketInfo, true);
  const fundingRateShort = getChartFundingRateHourly(marketInfo, false);

  const netRateHourlyLong = (fundingRateLong ?? 0n) + (borrowingRateLong ?? 0n);
  const netRateHourlyShort = (fundingRateShort ?? 0n) + (borrowingRateShort ?? 0n);

  const longUsdVolume = marketInfo.longInterestUsd;
  const totalVolume = marketInfo.longInterestUsd + marketInfo.shortInterestUsd;

  const longOpenInterestPercentage =
    totalVolume !== 0n
      ? Math.max(Math.min(Math.round(Number(bigMath.mulDiv(longUsdVolume, 10000n, totalVolume)) / 100), 100), 0.01)
      : 0;

  const shortOpenInterestPercentage =
    totalVolume === 0n ? 0 : longOpenInterestPercentage !== undefined ? 100 - longOpenInterestPercentage : undefined;

  return {
    // On-chain reserve/OI-cap liquidity — used by trade chart header and order validation.
    liquidityLong: getAvailableUsdLiquidityForPosition(marketInfo, true),
    liquidityShort: getAvailableUsdLiquidityForPosition(marketInfo, false),
    netRateHourlyLong,
    netRateHourlyShort,
    borrowingRateLong,
    borrowingRateShort,
    fundingRateLong,
    fundingRateShort,
    openInterestLong: marketInfo.longInterestUsd,
    openInterestShort: marketInfo.shortInterestUsd,
    decimals: marketInfo.indexToken.decimals,
    longOpenInterestPercentage,
    shortOpenInterestPercentage,
  };
});
