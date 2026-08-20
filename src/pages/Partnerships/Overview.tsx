import { Trans, t } from "@lingui/macro";
import { useMemo, useState } from "react";

import { sumWindow, usePartnerAddress, usePartnerData, usePartnerTier } from "domain/partnerships";
import { useMarketsInfoRequest } from "domain/synthetics/markets";
import { useAffiliateRewards } from "domain/synthetics/referrals/useAffiliateRewards";
import { getTotalClaimableAffiliateRewardsUsd } from "domain/synthetics/referrals/utils";
import { useTokensDataRequest } from "domain/synthetics/tokens";
import { useChainId } from "lib/chains";
import { formatUsd } from "lib/numbers";
import useWallet from "lib/wallets/useWallet";

import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";
import { ClaimAffiliatesModal } from "components/Referrals/ClaimAffiliatesModal/ClaimAffiliatesModal";

import { Card, Progress, SectionTitle, StatCard, bpsToPct, dayLabel, usd } from "./components";
import { Ladder } from "./Ladder";
import { PartnershipsLayout } from "./PartnershipsLayout";
import { REACH_OUT, compactUsd, rungForNumbers } from "./tierLadder";

export default function PartnershipsOverview() {
  const { chainId } = useChainId();
  const { account } = useWallet();
  const { address, isViewingOther } = usePartnerAddress();
  const { data, isLoading } = usePartnerData(chainId, address);
  const tier = usePartnerTier(address);

  const [isClaiming, setIsClaiming] = useState(false);
  const { tokensData } = useTokensDataRequest(chainId);
  const { marketsInfoData } = useMarketsInfoRequest(chainId, { tokensData });
  const { affiliateRewardsData } = useAffiliateRewards(chainId);

  // Claimable is read from chain, not from the indexer ledger: the ledger records what was
  // credited, the contract knows what is still unclaimed.
  const claimableUsd = useMemo(() => {
    if (!affiliateRewardsData || !marketsInfoData) return 0n;
    return getTotalClaimableAffiliateRewardsUsd(marketsInfoData, affiliateRewardsData);
  }, [affiliateRewardsData, marketsInfoData]);

  const stat = data.stat;
  const last30 = sumWindow(data.periods, 30);
  const volume30 = Number(last30.volumeUsd) / 1e30;
  const funded = data.traders.filter((tr) => tr.isFunded).length;
  const { index, rung, next } = rungForNumbers(volume30, funded);

  const prior30 = useMemo(() => {
    const day = 86400;
    const today = Math.floor(Date.now() / 1000 / day) * day;
    return data.periods
      .filter((p) => p.periodStart >= today - 59 * day && p.periodStart <= today - 30 * day)
      .reduce((acc, p) => acc + p.volumeUsd, 0n);
  }, [data.periods]);
  const trend = prior30 > 0n ? Number(((last30.volumeUsd - prior30) * 100n) / prior30) : undefined;

  const remaining = next?.volumeUsd ? Math.max(0, next.volumeUsd - volume30) : 0;

  return (
    <PartnershipsLayout title={t`Overview`}>
      <Card className="flex flex-wrap items-center gap-16">
        <div>
          <div className="text-12 uppercase tracking-wide text-slate-100">
            <Trans>Ready to claim</Trans>
          </div>
          <div className="mt-4 text-32 font-medium tabular-nums">
            {formatUsd(claimableUsd, { displayDecimals: 2 }) ?? "$0.00"}
          </div>
          <div className="mt-4 text-12 text-slate-100">
            <Trans>Across {data.codes.length} codes · settles to your wallet on Base</Trans>
          </div>
        </div>
        <div className="ml-auto">
          <Button
            variant="primary-action"
            disabled={claimableUsd <= 0n || !account || isViewingOther}
            onClick={() => setIsClaiming(true)}
          >
            <Trans>Claim all</Trans>
          </Button>
        </div>
      </Card>

      <Card className="flex flex-wrap gap-24">
        <div className="min-w-[190px]">
          <div className="text-12 uppercase tracking-wide text-slate-100">
            <Trans>Your tier</Trans>
          </div>
          <div className="text-28 mt-4 font-medium">{rung.name}</div>
          <div className="mt-6 text-13 text-slate-100">
            {tier ? (
              <Trans>
                You earn <b className="text-blue-300">{bpsToPct(tier.affiliateShareBps)}</b> of referred trading fees
              </Trans>
            ) : (
              <Trans>Reading your rate from the contract…</Trans>
            )}
          </div>
          {tier && (
            <div className="mt-6 text-11 text-slate-100">
              <Trans>
                Live contract rate. Total rebate {bpsToPct(tier.totalRebateBps)} of fees, of which{" "}
                {bpsToPct(tier.discountShareBps)} goes to the trader.
              </Trans>
            </div>
          )}
        </div>

        <div className="min-w-[280px] grow">
          {next ? (
            <>
              <div className="flex justify-between text-13">
                <span>
                  <Trans>
                    Volume toward <b>{next.name}</b> — {next.ratePct}%
                  </Trans>
                </span>
                <span className="tabular-nums">
                  <b>{compactUsd(volume30)}</b> / {compactUsd(next.volumeUsd ?? 0)}
                </span>
              </div>
              <Progress value={last30.volumeUsd} target={BigInt(next.volumeUsd ?? 0) * 10n ** 30n} />

              <div className="mt-12 flex justify-between text-13">
                <span>
                  <Trans>Funded referrals</Trans>
                </span>
                <span className="tabular-nums">
                  <b>{funded}</b> / {next.referrals}
                  {funded >= (next.referrals ?? 0) && (
                    <span className="ml-8 rounded-full bg-green-500/20 px-8 py-2 text-11 text-green-500">
                      <Trans>Met</Trans>
                    </span>
                  )}
                </span>
              </div>
              <Progress value={BigInt(funded)} target={BigInt(next.referrals ?? 1)} />

              <p className="mt-12 text-12 text-slate-100">
                <Trans>
                  <b className="text-white">{compactUsd(remaining)} more volume</b> to reach {next.name}. Promotion is a
                  governance action, not automatic.
                </Trans>
              </p>
            </>
          ) : (
            <p className="text-13 text-slate-100">
              <Trans>You are on the highest earned rung. Higher rates are agreed case by case.</Trans>
            </p>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle sub={t`Climb on volume and funded referrals — both.`}>
          <Trans>The Operators</Trans>
        </SectionTitle>
        <Ladder currentIndex={index} />
        <div className="mt-16 flex flex-wrap items-center gap-12 border-t border-slate-700 pt-14 text-12 text-slate-100">
          <span className="rounded-full bg-green-500/20 px-8 py-2 text-11 text-green-500">
            <Trans>Tier held</Trans>
          </span>
          <span>
            <Trans>
              Once reached, you keep a tier's rate for at least <b className="text-white">60 days</b>.
            </Trans>
          </span>
          <span className="ml-auto">
            <Trans>Rates above are programme targets; your live rate is read from the contract.</Trans>
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-4">
        <StatCard
          label={t`Referrals`}
          value={isLoading ? "—" : data.traders.length}
          sub={
            <Trans>
              {funded} funded · {data.traders.length - funded} registered
            </Trans>
          }
        />
        <StatCard
          label={t`30-day volume`}
          value={isLoading ? "—" : usd(last30.volumeUsd)}
          sub={
            trend === undefined ? (
              <Trans>No prior period to compare</Trans>
            ) : (
              <Trans>
                {trend >= 0 ? "+" : ""}
                {trend}% vs prior 30d
              </Trans>
            )
          }
        />
        <StatCard
          label={t`Lifetime volume`}
          value={isLoading ? "—" : usd(stat?.volumeUsd)}
          sub={stat ? <Trans>Since {dayLabel(stat.firstTradeTimestamp)}</Trans> : undefined}
        />
        <StatCard
          label={t`Rebates earned`}
          value={isLoading ? "—" : usd(stat?.affiliateRewardUsd)}
          sub={t`All time, all codes`}
        />
      </div>

      <Card className="flex flex-wrap items-center gap-16">
        <div>
          <div className="text-15 font-medium">
            <Trans>
              Running {REACH_OUT.volume} a month with {REACH_OUT.referrals} funded referrals?
            </Trans>
          </div>
          <div className="mt-4 text-13 text-slate-100">
            <Trans>Rates up to {REACH_OUT.maxRate}%, agreed case by case.</Trans>
          </div>
        </div>
        <div className="ml-auto">
          <ExternalLink href="https://discord.gg/0xmarkets">
            <Button variant="secondary">
              <Trans>Reach out on Discord</Trans>
            </Button>
          </ExternalLink>
        </div>
      </Card>

      {isClaiming && <ClaimAffiliatesModal onClose={() => setIsClaiming(false)} />}
    </PartnershipsLayout>
  );
}
