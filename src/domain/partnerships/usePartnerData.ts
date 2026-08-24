import { gql } from "@apollo/client";
import { useMemo } from "react";
import useSWR from "swr";

import { getSubsquidGraphClient } from "lib/subgraph";

import type { AffiliateRewardEntry, AffiliateStat, CodeBreakdown, PeriodAffiliateStat, ReferredTrader } from "./types";

const DAY_SECONDS = 86400;

/**
 * One round trip for everything the partner portal needs.
 *
 * Daily buckets are fetched rather than a stored 30-day column: the indexer deliberately keeps no
 * rolling total, so any window is a sum over `periodAffiliateStats`. Ninety days are pulled so the
 * Performance page can offer 30/90/all without refetching.
 */
const PARTNER_QUERY = gql`
  query partnerData($affiliate: String!, $since: Int!) {
    affiliateStats(where: { affiliate_eq: $affiliate }) {
      affiliate
      volumeUsd
      tradesCount
      referredTradersCount
      feesGeneratedUsd
      totalRebateUsd
      affiliateRewardUsd
      traderDiscountUsd
      firstTradeTimestamp
      lastTradeTimestamp
    }
    periodAffiliateStats(where: { affiliate_eq: $affiliate, periodStart_gte: $since }, orderBy: periodStart_ASC) {
      periodStart
      volumeUsd
      tradesCount
      tradersActive
      feesGeneratedUsd
      affiliateRewardUsd
    }
    referredTraders(where: { affiliate_eq: $affiliate }, orderBy: volumeUsd_DESC) {
      trader
      referralCode
      isFunded
      registeredAt
      firstTradeTimestamp
      lastTradeTimestamp
      volumeUsd
      tradesCount
      feesPaidUsd
      rebateGeneratedUsd
    }
    affiliateRewards(where: { affiliate_eq: $affiliate }, orderBy: timestamp_DESC) {
      id
      market
      token
      delta
      nextValue
      isClaim
      timestamp
      transaction {
        hash
      }
    }
  }
`;

/** Realised P&L per referred trader, joined on from AccountStat. */
const TRADER_PNL_QUERY = gql`
  query traderPnl($accounts: [String!]!) {
    accountStats(where: { id_in: $accounts }) {
      id
      realizedPnl
    }
  }
`;

export type PartnerData = {
  stat?: AffiliateStat;
  periods: PeriodAffiliateStat[];
  traders: ReferredTrader[];
  rewards: AffiliateRewardEntry[];
  codes: CodeBreakdown[];
  /** Credited minus claimed, in collateral-token units. */
  outstandingRewardRaw: bigint;
};

const EMPTY: PartnerData = {
  stat: undefined,
  periods: [],
  traders: [],
  rewards: [],
  codes: [],
  outstandingRewardRaw: 0n,
};

function foldCodes(traders: ReferredTrader[]): CodeBreakdown[] {
  const byCode = new Map<string, CodeBreakdown>();
  for (const t of traders) {
    const existing = byCode.get(t.referralCode);
    if (existing) {
      existing.tradersCount += 1;
      existing.volumeUsd += t.volumeUsd;
      existing.feesGeneratedUsd += t.feesPaidUsd;
      existing.rebateEarnedUsd += t.rebateGeneratedUsd;
    } else {
      byCode.set(t.referralCode, {
        referralCode: t.referralCode,
        tradersCount: 1,
        volumeUsd: t.volumeUsd,
        feesGeneratedUsd: t.feesPaidUsd,
        rebateEarnedUsd: t.rebateGeneratedUsd,
      });
    }
  }
  return [...byCode.values()].sort((a, b) => (b.volumeUsd > a.volumeUsd ? 1 : -1));
}

export function usePartnerData(chainId: number, account: string | undefined) {
  const client = getSubsquidGraphClient(chainId);
  const affiliate = account?.toLowerCase();

  const { data, error, isLoading, mutate } = useSWR<PartnerData>(
    affiliate && client ? ["partnerData", chainId, affiliate] : null,
    async () => {
      if (!client || !affiliate) return EMPTY;

      const since = Math.floor(Date.now() / 1000 / DAY_SECONDS) * DAY_SECONDS - 90 * DAY_SECONDS;
      const res = await client.query({
        query: PARTNER_QUERY,
        variables: { affiliate, since },
        fetchPolicy: "no-cache",
      });

      const raw = res.data;
      const traders: ReferredTrader[] = (raw.referredTraders ?? []).map((t: any) => ({
        trader: t.trader,
        referralCode: t.referralCode as `0x${string}`,
        isFunded: Boolean(t.isFunded),
        registeredAt: t.registeredAt == null ? undefined : Number(t.registeredAt),
        firstTradeTimestamp: t.firstTradeTimestamp == null ? undefined : Number(t.firstTradeTimestamp),
        lastTradeTimestamp: t.lastTradeTimestamp == null ? undefined : Number(t.lastTradeTimestamp),
        volumeUsd: BigInt(t.volumeUsd),
        tradesCount: Number(t.tradesCount),
        feesPaidUsd: BigInt(t.feesPaidUsd),
        rebateGeneratedUsd: BigInt(t.rebateGeneratedUsd),
      }));

      // Second hop rather than a nested field: ReferredTrader has no relation to AccountStat, they
      // are joined only by address.
      if (traders.length > 0) {
        try {
          const pnlRes = await client.query({
            query: TRADER_PNL_QUERY,
            variables: { accounts: traders.map((t) => t.trader) },
            fetchPolicy: "no-cache",
          });
          const pnlByAccount = new Map<string, bigint>(
            (pnlRes.data.accountStats ?? []).map((a: any) => [a.id.toLowerCase(), BigInt(a.realizedPnl)])
          );
          for (const t of traders) {
            const pnl = pnlByAccount.get(t.trader.toLowerCase());
            if (pnl !== undefined) t.realizedPnlUsd = pnl;
          }
        } catch (error) {
          // P&L is supplementary — a failure here must not blank the whole portal.
        }
      }

      const rewards: AffiliateRewardEntry[] = (raw.affiliateRewards ?? []).map((r: any) => ({
        id: r.id,
        market: r.market,
        token: r.token,
        delta: BigInt(r.delta),
        nextValue: BigInt(r.nextValue),
        isClaim: Boolean(r.isClaim),
        timestamp: Number(r.timestamp),
        transactionHash: r.transaction?.hash ?? "",
      }));

      const outstandingRewardRaw = rewards.reduce((acc, r) => (r.isClaim ? acc - r.delta : acc + r.delta), 0n);

      const statRaw = (raw.affiliateStats ?? [])[0];

      return {
        stat: statRaw
          ? {
              affiliate: statRaw.affiliate,
              volumeUsd: BigInt(statRaw.volumeUsd),
              tradesCount: Number(statRaw.tradesCount),
              referredTradersCount: Number(statRaw.referredTradersCount),
              feesGeneratedUsd: BigInt(statRaw.feesGeneratedUsd),
              totalRebateUsd: BigInt(statRaw.totalRebateUsd),
              affiliateRewardUsd: BigInt(statRaw.affiliateRewardUsd),
              traderDiscountUsd: BigInt(statRaw.traderDiscountUsd),
              firstTradeTimestamp: Number(statRaw.firstTradeTimestamp),
              lastTradeTimestamp: Number(statRaw.lastTradeTimestamp),
            }
          : undefined,
        periods: (raw.periodAffiliateStats ?? []).map((p: any) => ({
          periodStart: Number(p.periodStart),
          volumeUsd: BigInt(p.volumeUsd),
          tradesCount: Number(p.tradesCount),
          tradersActive: Number(p.tradersActive),
          feesGeneratedUsd: BigInt(p.feesGeneratedUsd),
          affiliateRewardUsd: BigInt(p.affiliateRewardUsd),
        })),
        traders,
        rewards,
        codes: foldCodes(traders),
        outstandingRewardRaw,
      };
    },
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );

  return useMemo(() => ({ data: data ?? EMPTY, error, isLoading, refresh: mutate }), [data, error, isLoading, mutate]);
}

/** Sum a set of daily buckets over the trailing `days`. */
export function sumWindow(periods: PeriodAffiliateStat[], days: number) {
  const from = Math.floor(Date.now() / 1000 / DAY_SECONDS) * DAY_SECONDS - (days - 1) * DAY_SECONDS;
  return periods
    .filter((p) => p.periodStart >= from)
    .reduce(
      (acc, p) => ({
        volumeUsd: acc.volumeUsd + p.volumeUsd,
        feesGeneratedUsd: acc.feesGeneratedUsd + p.feesGeneratedUsd,
        affiliateRewardUsd: acc.affiliateRewardUsd + p.affiliateRewardUsd,
        tradesCount: acc.tradesCount + p.tradesCount,
      }),
      { volumeUsd: 0n, feesGeneratedUsd: 0n, affiliateRewardUsd: 0n, tradesCount: 0 }
    );
}
