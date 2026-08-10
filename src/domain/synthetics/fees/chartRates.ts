import { CHART_PERIODS } from "lib/legacy";
import { getBorrowingFactorPerPeriod, getFundingFactorPerPeriod } from "domain/synthetics/fees";
import { MarketInfo } from "sdk/types/markets";
import { bigMath } from "sdk/utils/bigmath";
import { PRECISION } from "sdk/utils/numbers";

/**
 * Chart-header rate helpers.
 *
 * Live `fundingFactorPerSecond` / `borrowingFactorPerSecond*` from the reader are often 0
 * between keeper updates even while positions still accrue fees. For display we fall back to
 * configured mins / estimated borrow from utilization so Net Rate isn't stuck at 0.0000%.
 */
export function getChartFundingRateHourly(marketInfo: MarketInfo, isLong: boolean): bigint {
  const period = CHART_PERIODS["1h"];
  const live = getFundingFactorPerPeriod(marketInfo, isLong, period);
  if (live !== 0n) return live;

  const { longInterestUsd, shortInterestUsd, minFundingFactorPerSecond } = marketInfo;
  if (longInterestUsd === 0n && shortInterestUsd === 0n) return 0n;
  if (minFundingFactorPerSecond === 0n) return 0n;
  if (longInterestUsd === shortInterestUsd) return 0n;

  // When live rate is unset, estimate from minFundingFactorPerSecond + current imbalance.
  // Heavier side pays.
  const patched: MarketInfo = {
    ...marketInfo,
    fundingFactorPerSecond: minFundingFactorPerSecond,
    longsPayShorts: longInterestUsd >= shortInterestUsd,
  };

  return getFundingFactorPerPeriod(patched, isLong, period);
}

export function getChartBorrowingRateHourly(marketInfo: MarketInfo, isLong: boolean): bigint {
  const period = CHART_PERIODS["1h"];
  const live = getBorrowingFactorPerPeriod(marketInfo, isLong, period);
  if (live !== 0n) return -live; // borrow is always a cost

  const poolUsd = bigMath.max(marketInfo.poolValueMax, marketInfo.poolValueMin);
  const openInterestUsd = isLong ? marketInfo.longInterestUsd : marketInfo.shortInterestUsd;
  if (poolUsd === 0n || openInterestUsd === 0n) return 0n;

  const borrowingFactor = isLong ? marketInfo.borrowingFactorLong : marketInfo.borrowingFactorShort;
  if (!borrowingFactor || borrowingFactor === 0n) return 0n;

  // utilization = OI / pool (capped at 100%), then borrowPerSecond ≈ borrowingFactor * utilization.
  const utilization = bigMath.min(PRECISION, bigMath.mulDiv(openInterestUsd, PRECISION, poolUsd));
  const factorPerSecond = bigMath.mulDiv(borrowingFactor, utilization, PRECISION);
  return -(factorPerSecond * BigInt(period));
}
