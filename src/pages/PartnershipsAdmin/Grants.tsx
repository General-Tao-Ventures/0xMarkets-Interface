import { Trans, t } from "@lingui/macro";
import { useMemo, useState } from "react";

import { usePartnerTier } from "domain/partnerships";
import { useAdminData } from "domain/partnerships/admin";
import { useChainId } from "lib/chains";
import { BLENDED_FEE_RATE, LADDER, splitFee } from "pages/Partnerships/tierLadder";
import { getContract } from "sdk/configs/contracts";

import { AdminLayout } from "./AdminLayout";
import { AdminCard, CardHead, Pnl, Tag, money, pct, short } from "./components";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Decision support for a governance tier grant, plus an honest account of how one is actually made.
 *
 * The prototype for this screen showed a 2-of-3 multisig with a 48-hour timelock and an on-chain
 * rationale. None of that exists: ReferralStorage.gov is an EOA, and setReferrerTier is onlyGov, so
 * today a single key changes a partner's rate immediately and silently. The numbers below are real;
 * the ceremony is not, and pretending otherwise in an internal tool would be the worst option.
 */
export default function AdminGrants() {
  const { chainId } = useChainId();
  const { data } = useAdminData(chainId);
  const [address, setAddress] = useState("");

  const valid = ADDRESS_RE.test(address.trim());
  const target = valid ? address.trim().toLowerCase() : undefined;
  const tier = usePartnerTier(target);
  const partner = useMemo(() => data.partners.find((p) => p.affiliate === target), [data.partners, target]);

  const [newTierIndex, setNewTierIndex] = useState(5); // Kingmaker

  const impact = useMemo(() => {
    if (!partner) return undefined;
    const fee = partner.volume30dUsd * BLENDED_FEE_RATE;
    const current = splitFee(fee, partner.rebatePct);
    const proposed = splitFee(fee, LADDER[newTierIndex].ratePct);
    return {
      fee,
      lpDelta: proposed.lp - current.lp,
      veDelta: proposed.veAlpha - current.veAlpha,
      rebateDelta: proposed.rebate - current.rebate,
      treasuryDelta: proposed.treasury - current.treasury,
    };
  }, [partner, newTierIndex]);

  const referralStorage = getContract(chainId, "ReferralStorage");

  return (
    <AdminLayout
      title={<Trans>Tier grants</Trans>}
      lede={
        <Trans>
          Kingmaker and Sovereign are agreed case by case. Rates are public; grants never appear in the partner ladder.
        </Trans>
      }
    >
      <AdminCard className="border border-yellow-500/30 p-16">
        <h2 className="text-15 font-medium text-yellow-500">
          <Trans>How a grant is actually made today</Trans>
        </h2>
        <p className="leading-relaxed mt-8 max-w-[100ch] text-12 text-slate-100">
          <Trans>
            <b>There is no multisig and no timelock.</b> <span className="font-mono">setReferrerTier</span> is{" "}
            <span className="font-mono">onlyGov</span>, and <span className="font-mono">ReferralStorage.gov</span> is an
            externally owned account — a single key. A grant takes effect the moment that key sends the transaction,
            with no second signature, no delay in which to cancel a wrong address, and no rationale written anywhere on
            chain. Treat everything below as preparation for a transaction a human still has to send deliberately.
          </Trans>
        </p>
        <dl className="mt-12 grid grid-cols-1 gap-8 text-12 md:grid-cols-2">
          <div className="rounded-4 bg-slate-700/50 p-10">
            <dt className="text-slate-100">
              <Trans>Contract</Trans>
            </dt>
            <dd className="font-mono">{referralStorage}</dd>
          </div>
          <div className="rounded-4 bg-slate-700/50 p-10">
            <dt className="text-slate-100">
              <Trans>Call required</Trans>
            </dt>
            <dd className="font-mono">setReferrerTier(address,uint256)</dd>
          </div>
        </dl>
      </AdminCard>

      <div className="grid grid-cols-1 gap-16 xl:grid-cols-2">
        <AdminCard className="p-16">
          <CardHead
            title={<Trans>Inspect a partner</Trans>}
            sub={<Trans>Everything below is measured, not assumed</Trans>}
          />
          <label className="text-12 text-slate-100" htmlFor="grant-address">
            <Trans>Partner address</Trans>
          </label>
          <input
            id="grant-address"
            className="mt-4 w-full rounded-4 bg-slate-700 px-12 py-10 font-mono text-13 outline-none"
            placeholder="0x…"
            spellCheck={false}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          {address && !valid && (
            <div className="mt-4 text-11 text-red-500">
              <Trans>That is not a valid address.</Trans>
            </div>
          )}

          {valid && (
            <dl className="mt-16 text-13">
              <Row
                label={t`Live tier`}
                value={
                  tier
                    ? `${t`Tier`} ${tier.tierLevel} · ${pct(tier.affiliateShareBps / 100)} ${t`affiliate share`}`
                    : "—"
                }
              />
              <Row label={t`Measured rate paid`} value={partner ? pct(partner.liveAffiliateSharePct) : "—"} />
              <Row label={t`30-day volume`} value={partner ? money(partner.volume30dUsd, 0) : "—"} />
              <Row
                label={t`Funded referrals`}
                value={partner ? `${partner.fundedReferrals} / ${partner.referrals}` : "—"}
              />
              <Row label={t`Trader P&L / $1m`} value={partner ? <Pnl value={partner.pnlPer1mUsd} /> : "—"} />
              <Row
                label={t`Self-referred volume`}
                value={
                  partner
                    ? money(
                        data.referrals
                          .filter((r) => r.affiliate === partner.affiliate && r.flags.includes("self"))
                          .reduce((a, r) => a + r.volumeUsd, 0),
                        0
                      )
                    : "—"
                }
              />
            </dl>
          )}
          {valid && !partner && (
            <p className="mt-12 text-11 text-slate-100">
              <Trans>No indexed referral activity for this address — it has never been traded under.</Trans>
            </p>
          )}
        </AdminCard>

        <AdminCard className="p-16">
          <CardHead
            title={<Trans>Cost of a move</Trans>}
            sub={<Trans>At this partner's current 30-day volume</Trans>}
          />
          <label className="text-12 text-slate-100" htmlFor="grant-tier">
            <Trans>Proposed tier</Trans>
          </label>
          <select
            id="grant-tier"
            className="mt-4 w-full rounded-4 bg-slate-700 px-12 py-10 text-13 outline-none"
            value={newTierIndex}
            onChange={(e) => setNewTierIndex(Number(e.target.value))}
          >
            {LADDER.map((r, i) => (
              <option key={r.name} value={i}>
                {r.name} — {r.ratePct}%
              </option>
            ))}
          </select>

          {impact ? (
            <>
              <div className="mt-16 rounded-4 bg-slate-700/50 p-12 text-12">
                <Trans>
                  Moving this partner to <b className="text-white">{LADDER[newTierIndex].name}</b> costs about{" "}
                  <b className="text-white">{money(-impact.lpDelta)}/month to LPs</b> and{" "}
                  <b className="text-white">{money(-impact.veDelta)}</b> to veAlpha, on {money(impact.fee)} of monthly
                  fees. Treasury is unaffected — it takes a fixed share at every tier, so the rebate is funded entirely
                  by the LP and veAlpha pools.
                </Trans>
              </div>
              <dl className="mt-12 text-13">
                <Row
                  label={t`Rebate paid`}
                  value={`${impact.rebateDelta >= 0 ? "+" : ""}${money(impact.rebateDelta)}`}
                />
                <Row label={t`LP share`} value={`${impact.lpDelta >= 0 ? "+" : ""}${money(impact.lpDelta)}`} />
                <Row label={t`veAlpha share`} value={`${impact.veDelta >= 0 ? "+" : ""}${money(impact.veDelta)}`} />
                <Row label={t`Treasury`} value={money(impact.treasuryDelta)} />
              </dl>
            </>
          ) : (
            <p className="mt-16 text-12 text-slate-100">
              <Trans>Enter a partner address with indexed volume to see what a move would cost.</Trans>
            </p>
          )}
        </AdminCard>
      </div>

      <AdminCard>
        <CardHead
          title={<Trans>Partners above the entry tier</Trans>}
          sub={<Trans>Measured affiliate share, from what the contract actually paid</Trans>}
        />
        <div className="p-16 pt-0">
          {data.partners.length === 0 ? (
            <p className="text-13 text-slate-100">
              <Trans>No partners indexed yet.</Trans>
            </p>
          ) : (
            <ul className="flex flex-col gap-6 text-13">
              {data.partners.map((p) => (
                <li key={p.affiliate} className="flex items-center gap-8">
                  <span className="font-mono">{short(p.affiliate)}</span>
                  <Tag tone={p.liveAffiliateSharePct > 5 ? "violet" : "blue"}>{pct(p.liveAffiliateSharePct)}</Tag>
                  <span className="text-slate-100">
                    {money(p.volume30dUsd, 0)} · {p.fundedReferrals} funded
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AdminCard>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-700 py-8 last:border-0">
      <dt className="text-slate-100">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
