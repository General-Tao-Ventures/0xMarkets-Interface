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
  const { longInterestUsd, shortInterestUsd, minFundingFactorPerSecond } = marketInfo;

  // Funding is a transfer between longs and shorts. With no counterparty OI there
  // is nothing to pay/receive — never show a one-sided rate (e.g. long pays while short is $0).
  if (longInterestUsd === 0n || shortInterestUsd === 0n) return 0n;
  if (longInterestUsd === shortInterestUsd) return 0n;

  const live = getFundingFactorPerPeriod(marketInfo, isLong, period);
  if (live !== 0n) return live;

  if (minFundingFactorPerSecond === 0n) return 0n;

  // When live rate is unset, estimate from minFundingFactorPerSecond + current imbalance.
  // Heavier side pays; getFundingFactorPerPeriod keeps USD paid == USD received
  // (percentage rates differ when OI is imbalanced).
  const patched: MarketInfo = {
    ...marketInfo,
    fundingFactorPerSecond: minFundingFactorPerSecond,
    longsPayShorts: longInterestUsd >= shortInterestUsd,
  };

  return getFundingFactorPerPeriod(patched, isLong, period);
}

export function getChartBorrowingRateHourly(marketInfo: MarketInfo, isLong: boolean): bigint {
  const period = CHART_PERIODS["1h"];
  const liveLong = getBorrowingFactorPerPeriod(marketInfo, true, period);
  const liveShort = getBorrowingFactorPerPeriod(marketInfo, false, period);
  const live = isLong ? liveLong : liveShort;
  if (live !== 0n) return -live; // borrow is always a cost

  // A single side can legitimately be 0 on an imbalanced market. Only invent a
  // rate when both sides look stale/missing (both live factors are 0).
  if (liveLong !== 0n || liveShort !== 0n) return 0n;

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
