import { gql } from "@apollo/client";
import useSWR from "swr";

import { getSubsquidGraphClient } from "lib/subgraph";
import { LP_SPLIT, TREASURY_SHARE } from "pages/Partnerships/tierLadder";

import type { AdminPartner, AdminReferral, TraderFlag } from "./types";

const DAY = 86400;
const USD = 10n ** 30n;
const PAGE = 1000;

/** 30-decimal bigint -> plain USD. Precision loss is irrelevant at reporting scale. */
const toUsd = (v: bigint | string | null | undefined) => (v == null ? 0 : Number(BigInt(v)) / 1e30);

const BASE_QUERY = gql`
  query adminBase($from: Int!, $limit: Int!) {
    affiliateStats(limit: $limit, orderBy: volumeUsd_DESC) {
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
    periodAffiliateStats(limit: $limit, where: { periodStart_gte: $from }) {
      affiliate
      periodStart
      volumeUsd
      tradesCount
      feesGeneratedUsd
      affiliateRewardUsd
    }
    referredTraders(limit: $limit, orderBy: volumeUsd_DESC) {
      affiliate
      trader
      referralCode
      isFunded
      registeredAt
      firstTradeTimestamp
      volumeUsd
      tradesCount
      feesPaidUsd
      rebateGeneratedUsd
    }
    referralCodes(limit: $limit) {
      code
      owner
      registeredAt
    }
  }
`;

const PNL_QUERY = gql`
  query adminPnl($ids: [String!], $from: Int!, $limit: Int!) {
    accountStats(limit: $limit, where: { id_in: $ids }) {
      id
      realizedPnl
      volume
      closedCount
      wins
      losses
    }
    periodAccountStats(limit: $limit, where: { account_in: $ids, periodStart_gte: $from }) {
      account
      periodStart
      realizedPnl
      volume
    }
  }
`;

export type AdminData = {
  partners: AdminPartner[];
  referrals: AdminReferral[];
  /** Set when the indexer returned a full page and there may be more rows we did not see. */
  truncated: boolean;
};

const EMPTY: AdminData = { partners: [], referrals: [], truncated: false };

/**
 * Everything the admin console reads, in two round trips.
 *
 * Partner and referral views share the same base data, so they are fetched once and derived
 * together rather than each screen re-querying.
 *
 * Rebate rates here are MEASURED, not looked up: `totalRebateUsd / feesGeneratedUsd` is what the
 * contract actually paid over the window. A configured tier says what a partner should get; this
 * says what they got, which is the only honest thing to put in a revenue report.
 */
export function useAdminData(chainId: number) {
  const client = getSubsquidGraphClient(chainId);

  const { data, error, isLoading, mutate } = useSWR<AdminData>(
    client ? ["partnerships-admin", chainId] : null,
    async () => {
      const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
      const from = today - 30 * DAY;

      const base = await client!.query({
        query: BASE_QUERY,
        variables: { from, limit: PAGE },
        fetchPolicy: "no-cache",
      });

      const affiliateStats = base.data?.affiliateStats ?? [];
      const periods = base.data?.periodAffiliateStats ?? [];
      const referred = base.data?.referredTraders ?? [];
      const codes = base.data?.referralCodes ?? [];

      // AccountStat is keyed by the account address, so trader addresses are the ids.
      const traderIds: string[] = Array.from(new Set(referred.map((r: any) => r.trader.toLowerCase())));
      let accountStats: any[] = [];
      let periodAccountStats: any[] = [];
      if (traderIds.length) {
        const pnl = await client!.query({
          query: PNL_QUERY,
          variables: { ids: traderIds, from: today - 92 * DAY, limit: PAGE },
          fetchPolicy: "no-cache",
        });
        accountStats = pnl.data?.accountStats ?? [];
        periodAccountStats = pnl.data?.periodAccountStats ?? [];
      }

      const pnlByTrader = new Map<string, number>(
        accountStats.map((a: any) => [a.id.toLowerCase(), toUsd(a.realizedPnl)])
      );

      // "Consistent winner" = profitable in each of the last three monthly buckets. The daily
      // buckets are folded into months so a single good day cannot trip the flag.
      const monthlyPnl = new Map<string, Map<number, number>>();
      for (const p of periodAccountStats) {
        if (!p.periodStart) continue; // periodStart 0 is the all-time row, not a month
        const id = p.account.toLowerCase();
        const month =
          new Date(p.periodStart * 1000).getUTCMonth() + 12 * new Date(p.periodStart * 1000).getUTCFullYear();
        const m = monthlyPnl.get(id) ?? new Map<number, number>();
        m.set(month, (m.get(month) ?? 0) + toUsd(p.realizedPnl));
        monthlyPnl.set(id, m);
      }
      const isConsistentWinner = (trader: string) => {
        const m = monthlyPnl.get(trader);
        if (!m || m.size < 3) return false;
        const recent = [...m.entries()].sort((a, b) => b[0] - a[0]).slice(0, 3);
        return recent.length === 3 && recent.every(([, v]) => v > 0);
      };

      const ownerByCode = new Map<string, string>(codes.map((c: any) => [c.code, c.owner.toLowerCase()]));

      // ---- per-affiliate 30-day rollup ----
      const window30 = new Map<string, { volume: number; fees: number; reward: number; trades: number }>();
      for (const p of periods) {
        const k = p.affiliate.toLowerCase();
        const acc = window30.get(k) ?? { volume: 0, fees: 0, reward: 0, trades: 0 };
        acc.volume += toUsd(p.volumeUsd);
        acc.fees += toUsd(p.feesGeneratedUsd);
        acc.reward += toUsd(p.affiliateRewardUsd);
        acc.trades += Number(p.tradesCount);
        window30.set(k, acc);
      }

      const tradersByAffiliate = new Map<string, any[]>();
      for (const r of referred) {
        const k = r.affiliate.toLowerCase();
        tradersByAffiliate.set(k, [...(tradersByAffiliate.get(k) ?? []), r]);
      }

      const codesByOwner = new Map<string, string[]>();
      for (const c of codes) {
        const k = c.owner.toLowerCase();
        codesByOwner.set(k, [...(codesByOwner.get(k) ?? []), c.code]);
      }

      // affiliate -> (total rebate / affiliate reward). Used by both views so they reconcile.
      const rebateMultipleByAffiliate = new Map<string, number>();

      const partners: AdminPartner[] = affiliateStats.map((s: any) => {
        const affiliate = s.affiliate.toLowerCase();
        const w = window30.get(affiliate) ?? { volume: 0, fees: 0, reward: 0, trades: 0 };
        const mine = tradersByAffiliate.get(affiliate) ?? [];

        const lifetimeFees = toUsd(s.feesGeneratedUsd);
        const lifetimeRebate = toUsd(s.totalRebateUsd);
        // Measured, over the whole life of the book — a 30-day window can be empty.
        const rebatePct = lifetimeFees > 0 ? (lifetimeRebate / lifetimeFees) * 100 : 0;
        const affiliateSharePct = lifetimeFees > 0 ? (toUsd(s.affiliateRewardUsd) / lifetimeFees) * 100 : 0;

        const fees30 = w.fees;
        // The daily buckets record the affiliate's cut but not the trader's discount, so the total
        // rebate for the window is scaled by this partner's own measured lifetime ratio rather than
        // assuming a 50/50 split. A totalRebateUsd column on PeriodAffiliateStat would make it exact.
        const lifetimeReward = toUsd(s.affiliateRewardUsd);
        const rebateMultiple = lifetimeReward > 0 ? lifetimeRebate / lifetimeReward : 1;
        rebateMultipleByAffiliate.set(affiliate, rebateMultiple);
        const totalRebate30 = w.reward * rebateMultiple;
        const lpFeeShare = (fees30 - fees30 * TREASURY_SHARE - totalRebate30) * LP_SPLIT;
        const traderPnl = mine.reduce((acc, r) => acc + (pnlByTrader.get(r.trader.toLowerCase()) ?? 0), 0);

        return {
          affiliate,
          codes: codesByOwner.get(affiliate) ?? [],
          tierIndex: 0,
          tierName: "",
          rebatePct,
          liveAffiliateSharePct: affiliateSharePct,
          volume30dUsd: w.volume,
          lifetimeVolumeUsd: toUsd(s.volumeUsd),
          referrals: mine.length,
          fundedReferrals: mine.filter((r) => r.isFunded).length,
          feesUsd: fees30,
          rebatePaidUsd: w.reward,
          lpFeeShareUsd: lpFeeShare,
          traderPnlUsd: traderPnl,
          lpNetUsd: lpFeeShare - traderPnl,
          pnlPer1mUsd: w.volume > 0 ? traderPnl / (w.volume / 1e6) : 0,
          pnlPctVolume: w.volume > 0 ? (traderPnl / w.volume) * 100 : 0,
        };
      });

      const referrals: AdminReferral[] = referred.map((r: any) => {
        const trader = r.trader.toLowerCase();
        const volume = toUsd(r.volumeUsd);
        const fees = toUsd(r.feesPaidUsd);
        // rebateGeneratedUsd is the AFFILIATE's cut only. The pool loses the whole rebate, trader
        // discount included, so scale it up by this affiliate's measured ratio — otherwise this
        // screen reports a higher LP share than the partners screen for the same flow.
        const rebateToPartner = toUsd(r.rebateGeneratedUsd);
        const totalRebate = rebateToPartner * (rebateMultipleByAffiliate.get(r.affiliate.toLowerCase()) ?? 1);
        const pnl = pnlByTrader.get(trader) ?? 0;
        const lpFeeShare = (fees - fees * TREASURY_SHARE - totalRebate) * LP_SPLIT;

        const flags: TraderFlag[] = [];
        // The contract does not stop a code owner trading under their own code.
        if (ownerByCode.get(r.referralCode) === trader) flags.push("self");
        if (isConsistentWinner(trader)) flags.push("winner");

        return {
          trader,
          affiliate: r.affiliate.toLowerCase(),
          referralCode: r.referralCode,
          joinedAt: r.registeredAt ?? r.firstTradeTimestamp ?? null,
          isFunded: r.isFunded,
          volumeUsd: volume,
          feesPaidUsd: fees,
          rebateToPartnerUsd: rebateToPartner,
          traderPnlUsd: pnl,
          lpFeeShareUsd: lpFeeShare,
          lpNetUsd: lpFeeShare - pnl,
          pnlPer1mUsd: volume > 0 ? pnl / (volume / 1e6) : 0,
          pnlPctVolume: volume > 0 ? (pnl / volume) * 100 : 0,
          flags,
        };
      });

      return {
        partners,
        referrals,
        truncated: affiliateStats.length >= PAGE || referred.length >= PAGE,
      };
    },
    { revalidateOnFocus: false }
  );

  return { data: data ?? EMPTY, error, isLoading, refresh: mutate };
}

export { toUsd, USD };
