import { gql } from "@apollo/client";
import { useMemo } from "react";
import useSWR from "swr";

import { getSubsquidGraphClient } from "lib/subgraph";

export type PeriodAccountStats = {
  closedCount: number;
  cumsumCollateral: bigint;
  cumsumSize: bigint;
  losses: number;
  maxCapital: bigint;
  netCapital: bigint;
  realizedFees: bigint;
  realizedPnl: bigint;
  realizedPriceImpact: bigint;
  startUnrealizedFees: bigint;
  startUnrealizedPnl: bigint;
  startUnrealizedPriceImpact: bigint;
  sumMaxSize: bigint;
  volume: bigint;
  wins: number;
  id: string;
};

// Query raw trade actions to compute period stats client-side
const TRADE_ACTIONS_QUERY = gql`
  query TradeActionsForPeriodStats($account: String!, $from: Int, $to: Int) {
    tradeActions(
      where: { account_eq: $account, timestamp_gte: $from, timestamp_lte: $to, eventName_in: ["OrderExecuted", "PositionDecrease", "PositionIncrease"] }
      orderBy: timestamp_ASC
      limit: 1000
    ) {
      id
      eventName
      timestamp
      sizeDeltaUsd
      pnlUsd
      priceImpactUsd
      positionFeeAmount
      borrowingFeeAmount
      fundingFeeAmount
      initialCollateralDeltaAmount
      collateralTokenPriceMin
    }
  }
`;

type RawTradeAction = {
  id: string;
  eventName: string;
  timestamp: number;
  sizeDeltaUsd: string | null;
  pnlUsd: string | null;
  priceImpactUsd: string | null;
  positionFeeAmount: string | null;
  borrowingFeeAmount: string | null;
  fundingFeeAmount: string | null;
  initialCollateralDeltaAmount: string | null;
  collateralTokenPriceMin: string | null;
};

function computePeriodStatsFromTrades(trades: RawTradeAction[], account: string): PeriodAccountStats {
  let closedCount = 0;
  let wins = 0;
  let losses = 0;
  let volume = 0n;
  let cumsumSize = 0n;
  let cumsumCollateral = 0n;
  let sumMaxSize = 0n;
  let maxCapital = 0n;
  let netCapital = 0n;
  let realizedPnl = 0n;
  let realizedFees = 0n;
  let realizedPriceImpact = 0n;

  let currentCapital = 0n;

  for (const trade of trades) {
    // Volume from sizeDeltaUsd
    if (trade.sizeDeltaUsd) {
      const sizeDelta = BigInt(trade.sizeDeltaUsd);
      const absSizeDelta = sizeDelta > 0n ? sizeDelta : -sizeDelta;
      volume += absSizeDelta;
      cumsumSize += absSizeDelta;

      if (absSizeDelta > sumMaxSize) {
        sumMaxSize = absSizeDelta;
      }
    }

    // Collateral tracking
    if (trade.initialCollateralDeltaAmount && trade.collateralTokenPriceMin) {
      const collateral = BigInt(trade.initialCollateralDeltaAmount);
      const price = BigInt(trade.collateralTokenPriceMin);
      const collateralUsd = (collateral * price) / BigInt(1e30);

      if (collateral > 0n) {
        cumsumCollateral += collateralUsd;
        currentCapital += collateralUsd;
        if (currentCapital > maxCapital) {
          maxCapital = currentCapital;
        }
      } else {
        currentCapital += collateralUsd; // negative collateral reduces capital
      }
    }

    // PnL tracking
    const pnl = trade.pnlUsd ? BigInt(trade.pnlUsd) : 0n;
    const priceImpact = trade.priceImpactUsd ? BigInt(trade.priceImpactUsd) : 0n;

    // Calculate fees in USD
    const positionFee = trade.positionFeeAmount ? BigInt(trade.positionFeeAmount) : 0n;
    const borrowingFee = trade.borrowingFeeAmount ? BigInt(trade.borrowingFeeAmount) : 0n;
    const fundingFee = trade.fundingFeeAmount ? BigInt(trade.fundingFeeAmount) : 0n;
    const collateralPrice = trade.collateralTokenPriceMin ? BigInt(trade.collateralTokenPriceMin) : 1n;
    const feesUsd = ((positionFee + borrowingFee + fundingFee) * collateralPrice) / BigInt(1e30);

    realizedPnl += pnl;
    realizedFees += feesUsd;
    realizedPriceImpact += priceImpact;

    // Count closed positions
    if (trade.eventName === "PositionDecrease" || trade.eventName === "OrderExecuted") {
      if (pnl !== 0n) {
        closedCount++;
        if (pnl > 0n) {
          wins++;
        } else {
          losses++;
        }
      }
    }
  }

  netCapital = currentCapital + realizedPnl;

  return {
    closedCount,
    cumsumCollateral,
    cumsumSize,
    losses,
    maxCapital,
    netCapital,
    realizedFees,
    realizedPnl,
    realizedPriceImpact,
    startUnrealizedFees: 0n, // Would need open positions at period start
    startUnrealizedPnl: 0n,
    startUnrealizedPriceImpact: 0n,
    sumMaxSize,
    volume,
    wins,
    id: account,
  };
}

export function usePeriodAccountStats(
  chainId: number,
  params: { account?: string; from?: number; to?: number; enabled?: boolean }
) {
  const { account, from, to, enabled = true } = params;

  const { data, error, isLoading } = useSWR<PeriodAccountStats | undefined>(
    enabled && account ? ["usePeriodAccountStats", from, to, chainId, account] : null,
    {
      fetcher: async () => {
        const client = getSubsquidGraphClient(chainId);
        if (!client || !account) return undefined;

        const res = await client.query({
          query: TRADE_ACTIONS_QUERY,
          variables: { account: account.toLowerCase(), from, to },
          fetchPolicy: "no-cache",
        });

        const trades = (res.data?.tradeActions || []) as RawTradeAction[];

        if (trades.length === 0) {
          return undefined;
        }

        return computePeriodStatsFromTrades(trades, account);
      },
    }
  );

  return useMemo(() => ({ data, error, loading: isLoading }), [data, error, isLoading]);
}
