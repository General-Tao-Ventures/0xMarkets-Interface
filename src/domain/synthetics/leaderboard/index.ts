import { gql } from "@apollo/client";
import useSWR from "swr";
import { getAddress } from "viem";

import { expandDecimals } from "lib/numbers";
import { getSubsquidGraphClient } from "lib/subgraph";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import { MIN_COLLATERAL_USD_IN_LEADERBOARD } from "./constants";
import { LeaderboardDataType } from "./types";

export * from "./types";

type LeaderboardAccountsJson = {
  all: {
    id: string;
    account?: string;
    cumsumCollateral: string;
    cumsumSize: string;
    sumMaxSize: string;

    maxCapital: string;
    netCapital: string;

    realizedPnl: string;
    realizedPriceImpact: string;
    realizedFees: string;

    startUnrealizedPnl: string;
    startUnrealizedPriceImpact: string;
    startUnrealizedFees: string;

    closedCount: number;
    volume: string;
    losses: number;
    wins: number;

    hasRank?: boolean;
  }[];
  account: {
    id: string;
    account?: string;
    cumsumCollateral: string;
    cumsumSize: string;
    sumMaxSize: string;

    maxCapital: string;
    netCapital: string;

    realizedPnl: string;
    realizedPriceImpact: string;
    realizedFees: string;

    startUnrealizedPnl: string;
    startUnrealizedPriceImpact: string;
    startUnrealizedFees: string;

    closedCount: number;
    volume: string;
    losses: number;
    wins: number;

    hasRank?: boolean;
  }[];
};

export type LeaderboardAccountBase = {
  account: string;
  cumsumCollateral: bigint;
  cumsumSize: bigint;
  sumMaxSize: bigint;

  maxCapital: bigint;
  netCapital: bigint;
  hasRank: boolean;

  realizedPriceImpact: bigint;
  realizedFees: bigint;
  realizedPnl: bigint;

  startUnrealizedPnl: bigint;
  startUnrealizedPriceImpact: bigint;
  startUnrealizedFees: bigint;

  closedCount: number;
  volume: bigint;
  losses: number;
  wins: number;
};

export type LeaderboardAccount = LeaderboardAccountBase & {
  totalCount: number;
  totalPnl: bigint;
  totalQualifyingPnl: bigint;
  totalFees: bigint;
  unrealizedFees: bigint;
  unrealizedPnl: bigint;
  pnlPercentage: bigint;
  averageSize: bigint;
  averageLeverage: bigint;
};

type LeaderboardPositionsJson = {
  positions: {
    account: string;
    collateralAmount: string;
    collateralToken: string;
    entryPrice: string;
    id: string;
    isLong: boolean;
    isSnapshot: boolean;
    market: string;
    maxSize: string;
    realizedFees: string;
    realizedPriceImpact: string;
    unrealizedFees: string;
    unrealizedPnl: string;
    unrealizedPriceImpact: string;
    realizedPnl: string;
    sizeInTokens: string;
    sizeInUsd: string;
    snapshotTimestamp: number;
  }[];
};

export type LeaderboardPositionBase = {
  key: string;
  account: string;
  realizedFees: bigint;
  unrealizedFees: bigint;
  isLong: boolean;
  market: string;
  maxSize: bigint;
  realizedPriceImpact: bigint;
  unrealizedPriceImpact: bigint;
  isSnapshot: boolean;
  unrealizedPnl: bigint;
  realizedPnl: bigint;
  sizeInTokens: bigint;
  sizeInUsd: bigint;
  entryPrice: bigint;
  collateralToken: string;
  collateralAmount: bigint;
  snapshotTimestamp: number;
};

export type LeaderboardPosition = LeaderboardPositionBase & {
  rank: number;
  fees: bigint;
  pnl: bigint;
  qualifyingPnl: bigint;
  leverage: bigint;
  collateralUsd: bigint;
  closingFeeUsd: bigint;
};

const fetchAccounts = async (
  chainId: number,
  p: { account?: string; from?: number; to?: number }
): Promise<LeaderboardAccountBase[] | undefined> => {
  const client = getSubsquidGraphClient(chainId);
  if (!client) {
    // eslint-disable-next-line
    console.error("no client");
    return;
  }

  const allAccounts = await client.query<LeaderboardAccountsJson>({
    query: gql`
      query PeriodAccountStats($requiredMaxCapital: BigInt, $from: Int, $to: Int, $account: String) {
        all: periodAccountStats(limit: 100000, where: { maxCapital_gte: $requiredMaxCapital, periodStart_eq: $from, periodEnd_eq: $to }) {
          id
          account
          closedCount
          cumsumCollateral
          cumsumSize
          losses
          maxCapital
          realizedPriceImpact
          sumMaxSize
          netCapital
          realizedFees
          realizedPnl
          volume
          wins
          startUnrealizedPnl
          startUnrealizedFees
          startUnrealizedPriceImpact
        }
        account: periodAccountStats(limit: 1, where: { account_eq: $account, periodStart_eq: $from, periodEnd_eq: $to }) {
          id
          account
          closedCount
          cumsumCollateral
          cumsumSize
          losses
          maxCapital
          realizedPriceImpact
          sumMaxSize
          netCapital
          realizedFees
          realizedPnl
          volume
          wins
          startUnrealizedPnl
          startUnrealizedFees
          startUnrealizedPriceImpact
        }
      }
    `,
    variables: {
      requiredMaxCapital: MIN_COLLATERAL_USD_IN_LEADERBOARD.toString(),
      from: p.from,
      to: p.to,
      account: p.account,
    },
    fetchPolicy: "no-cache",
  });

  const allAccountsSet = new Set(allAccounts?.data.all.map((a) => (a.account || a.id).toLowerCase()));

  if (p.account && !allAccountsSet.has(p.account.toLowerCase()) && allAccounts?.data.account.length) {
    allAccounts?.data.all.push({ ...allAccounts.data.account[0], hasRank: false });
  }

  return allAccounts?.data.all.map((p) => {
    return {
      account: getAddress(p.account || p.id),
      cumsumCollateral: BigInt(p.cumsumCollateral),
      cumsumSize: BigInt(p.cumsumSize),
      sumMaxSize: BigInt(p.sumMaxSize),
      maxCapital: BigInt(p.maxCapital),
      netCapital: BigInt(p.netCapital),

      realizedPnl: BigInt(p.realizedPnl),
      realizedPriceImpact: BigInt(p.realizedPriceImpact),
      realizedFees: BigInt(p.realizedFees),

      startUnrealizedPnl: BigInt(p.startUnrealizedPnl),
      startUnrealizedPriceImpact: BigInt(p.startUnrealizedPriceImpact),
      startUnrealizedFees: BigInt(p.startUnrealizedFees),

      volume: BigInt(p.volume),
      closedCount: p.closedCount,
      losses: p.losses,
      wins: p.wins,

      hasRank: p.hasRank ?? true,
    };
  });
};

// Decrease order types: MarketDecrease=4, LimitDecrease=5, StopLossDecrease=6, Liquidation=7
const DECREASE_ORDER_TYPES = new Set([4, 5, 6, 7]);

/**
 * Rolling window queries (7d, 30d) can't use PeriodAccountStat because
 * the squid only stores all-time and fixed competition periods.
 * Instead, fetch executed OrderExecuted TradeActions within the time window
 * and aggregate per account. PositionIncrease/Decrease events are merged
 * into OrderExecuted records by the squid enrichment pipeline.
 */
const fetchAccountsFromTrades = async (
  chainId: number,
  p: { account?: string; from?: number }
): Promise<LeaderboardAccountBase[] | undefined> => {
  const client = getSubsquidGraphClient(chainId);
  if (!client) return;

  const response = await client.query<{
    tradeActions: {
      account: string;
      orderType: number;
      sizeDeltaUsd: string | null;
      basePnlUsd: string | null;
      priceImpactUsd: string | null;
      positionFeeAmount: string | null;
      borrowingFeeAmount: string | null;
      fundingFeeAmount: string | null;
      collateralTokenPriceMin: string | null;
      initialCollateralDeltaAmount: string;
    }[];
  }>({
    query: gql`
      query RollingWindowTrades($from: Int!) {
        tradeActions(
          limit: 100000
          where: {
            timestamp_gte: $from
            eventName_eq: "OrderExecuted"
            orderType_in: [2, 3, 4, 5, 6, 7, 8]
          }
        ) {
          account
          orderType
          sizeDeltaUsd
          basePnlUsd
          priceImpactUsd
          positionFeeAmount
          borrowingFeeAmount
          fundingFeeAmount
          collateralTokenPriceMin
          initialCollateralDeltaAmount
        }
      }
    `,
    variables: { from: p.from },
    fetchPolicy: "no-cache",
  });

  // Aggregate per account
  const accountMap = new Map<
    string,
    {
      volume: bigint;
      cumsumSize: bigint;
      cumsumCollateral: bigint;
      netCapital: bigint;
      maxCapital: bigint;
      realizedPnl: bigint;
      realizedFees: bigint;
      realizedPriceImpact: bigint;
      closedCount: number;
      wins: number;
      losses: number;
    }
  >();

  for (const t of response.data.tradeActions) {
    const account = t.account.toLowerCase();
    let stat = accountMap.get(account);
    if (!stat) {
      stat = {
        volume: 0n,
        cumsumSize: 0n,
        cumsumCollateral: 0n,
        netCapital: 0n,
        maxCapital: 0n,
        realizedPnl: 0n,
        realizedFees: 0n,
        realizedPriceImpact: 0n,
        closedCount: 0,
        wins: 0,
        losses: 0,
      };
      accountMap.set(account, stat);
    }

    const sizeDeltaUsd = t.sizeDeltaUsd ? BigInt(t.sizeDeltaUsd) : 0n;
    const absSizeDelta = sizeDeltaUsd < 0n ? -sizeDeltaUsd : sizeDeltaUsd;
    stat.volume += absSizeDelta;
    stat.cumsumSize += absSizeDelta;

    const collateralPrice = t.collateralTokenPriceMin ? BigInt(t.collateralTokenPriceMin) : 0n;
    const collateralDelta = BigInt(t.initialCollateralDeltaAmount);
    const collateralDeltaUsd = collateralDelta * collateralPrice;
    const isDecrease = DECREASE_ORDER_TYPES.has(t.orderType);

    if (!isDecrease) {
      // Increase order
      stat.cumsumCollateral += collateralDeltaUsd;
      stat.netCapital += collateralDeltaUsd;
    } else {
      // Decrease order (market decrease, limit decrease, stop loss, liquidation)
      const basePnlUsd = t.basePnlUsd ? BigInt(t.basePnlUsd) : 0n;
      const priceImpactUsd = t.priceImpactUsd ? BigInt(t.priceImpactUsd) : 0n;

      const positionFee = t.positionFeeAmount ? BigInt(t.positionFeeAmount) : 0n;
      const borrowingFee = t.borrowingFeeAmount ? BigInt(t.borrowingFeeAmount) : 0n;
      const fundingFee = t.fundingFeeAmount ? BigInt(t.fundingFeeAmount) : 0n;
      const totalFeeUsd = (positionFee + borrowingFee + fundingFee) * collateralPrice;

      stat.netCapital -= collateralDeltaUsd;
      stat.realizedPnl += basePnlUsd;
      stat.realizedFees += totalFeeUsd;
      stat.realizedPriceImpact += priceImpactUsd;
      stat.closedCount++;

      if (basePnlUsd > 0n) stat.wins++;
      else if (basePnlUsd < 0n) stat.losses++;
    }

    if (stat.netCapital > stat.maxCapital) {
      stat.maxCapital = stat.netCapital;
    }
  }

  const results: LeaderboardAccountBase[] = [];
  for (const [account, stat] of accountMap) {
    results.push({
      account: getAddress(account),
      cumsumCollateral: stat.cumsumCollateral,
      cumsumSize: stat.cumsumSize,
      sumMaxSize: 0n,
      maxCapital: stat.maxCapital,
      netCapital: stat.netCapital,
      hasRank: true,
      realizedPnl: stat.realizedPnl,
      realizedFees: stat.realizedFees,
      realizedPriceImpact: stat.realizedPriceImpact,
      startUnrealizedPnl: 0n,
      startUnrealizedFees: 0n,
      startUnrealizedPriceImpact: 0n,
      volume: stat.volume,
      closedCount: stat.closedCount,
      wins: stat.wins,
      losses: stat.losses,
    });
  }

  // If the user's account isn't in the results, add it with hasRank: false
  if (p.account) {
    const userLower = p.account.toLowerCase();
    if (!accountMap.has(userLower)) {
      results.push({
        account: getAddress(userLower),
        cumsumCollateral: 0n,
        cumsumSize: 0n,
        sumMaxSize: 0n,
        maxCapital: 0n,
        netCapital: 0n,
        hasRank: false,
        realizedPnl: 0n,
        realizedFees: 0n,
        realizedPriceImpact: 0n,
        startUnrealizedPnl: 0n,
        startUnrealizedFees: 0n,
        startUnrealizedPriceImpact: 0n,
        volume: 0n,
        closedCount: 0,
        wins: 0,
        losses: 0,
      });
    }
  }

  return results;
};

/**
 * Detect if a timeframe is a rolling window (not all-time and not a competition period).
 * Rolling windows have a non-zero `from` and undefined `to`.
 */
function isRollingWindow(from: number, to: number | undefined): boolean {
  return from > 0 && to === undefined;
}

export function useLeaderboardData(
  enabled: boolean,
  chainId: number,
  p: {
    account: string | undefined;
    from: number;
    to: number | undefined;
    positionsSnapshotTimestamp: number | undefined;
    leaderboardDataType: LeaderboardDataType | undefined;
  }
) {
  const { data, error, isLoading } = useSWR(
    enabled
      ? [
          "leaderboard/useLeaderboardData",
          chainId,
          p.account,
          p.from,
          p.to,
          p.positionsSnapshotTimestamp,
          p.leaderboardDataType,
        ]
      : null,
    async () => {
      const useTradesQuery = isRollingWindow(p.from, p.to);

      const [accounts, positions] = await Promise.all([
        p.leaderboardDataType === "positions"
          ? Promise.resolve([])
          : useTradesQuery
            ? fetchAccountsFromTrades(chainId, p)
            : fetchAccounts(chainId, p),
        fetchPositions(chainId, p.positionsSnapshotTimestamp),
      ]);

      return {
        accounts,
        positions,
      };
    },
    {
      refreshInterval: CONFIG_UPDATE_INTERVAL,
    }
  );

  return { data, error, isLoading };
}

const fetchPositions = async (
  chainId: number,
  snapshotTimestamp: number | undefined
): Promise<LeaderboardPositionBase[] | undefined> => {
  const client = getSubsquidGraphClient(chainId);
  if (!client) {
    // eslint-disable-next-line
    console.error("no endpoint");
    return;
  }

  const response = await client.query<LeaderboardPositionsJson>({
    query: gql`
      query PositionQuery($requiredMaxCapital: BigInt, $isSnapshot: Boolean, $snapshotTimestamp: Int) {
        positions(
          limit: 100000
          where: {
            isSnapshot_eq: $isSnapshot
            snapshotTimestamp_eq: $snapshotTimestamp
            accountStat: { maxCapital_gt: $requiredMaxCapital }
          }
        ) {
          id
          account
          market
          collateralToken
          isLong
          realizedFees
          unrealizedFees
          maxSize
          realizedPriceImpact
          unrealizedPriceImpact
          unrealizedPnl
          realizedPnl
          sizeInTokens
          sizeInUsd
          entryPrice
          collateralAmount
          snapshotTimestamp
          isSnapshot
        }
      }
    `,
    variables: {
      isSnapshot: snapshotTimestamp !== undefined,
      // filtering by maxCapital capital is not accurate for any specific period
      // because it uses maxCapital of total period
      // if trader's pnl is positive at the start of the period
      // then maxCapital at the start of the period is higher than total maxCapital
      // use lower threshold to mitigate this issue
      requiredMaxCapital: expandDecimals(50, 30).toString(),
      snapshotTimestamp,
    },
    fetchPolicy: "no-cache",
  });

  return response?.data.positions.map((p) => {
    return {
      key: p.id,
      account: getAddress(p.account),
      market: getAddress(p.market),
      collateralToken: getAddress(p.collateralToken),
      isLong: p.isLong,
      realizedPriceImpact: BigInt(p.realizedPriceImpact),
      realizedFees: BigInt(p.realizedFees),
      collateralAmount: BigInt(p.collateralAmount),
      unrealizedFees: BigInt(p.unrealizedFees),
      entryPrice: BigInt(p.entryPrice),
      sizeInUsd: BigInt(p.sizeInUsd),
      sizeInTokens: BigInt(p.sizeInTokens),
      realizedPnl: BigInt(p.realizedPnl),
      unrealizedPriceImpact: BigInt(p.unrealizedPriceImpact),
      unrealizedPnl: BigInt(p.unrealizedPnl),
      maxSize: BigInt(p.maxSize),
      snapshotTimestamp: p.snapshotTimestamp,
      isSnapshot: p.isSnapshot,
    };
  });
};
