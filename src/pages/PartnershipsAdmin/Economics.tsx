import { Trans, t } from "@lingui/macro";

import {
  BLENDED_FEE_RATE,
  LADDER,
  REACH_OUT,
  TREASURY_SHARE,
  compactUsd,
  splitFee,
} from "pages/Partnerships/tierLadder";

import { AdminLayout } from "./AdminLayout";
import { AdminCard, Cell, CardHead, DataTable, Tag, money, pct } from "./components";

/**
 * What each rung costs. Pure arithmetic over the ladder — no indexer, no chain.
 *
 * The dollar columns assume a partner sitting exactly at that rung's volume threshold, so they
 * scale linearly with the fee assumption. The thresholds themselves do not.
 */
export default function AdminEconomics() {
  return (
    <AdminLayout
      title={<Trans>Tier economics</Trans>}
      lede={
        <Trans>
          What each tier pays, what it requires, and what it leaves for LPs and veAlpha. Parameter changes go through
          veAlpha governance.
        </Trans>
      }
    >
      <AdminCard>
        <CardHead
          title={<Trans>The ladder</Trans>}
          sub={
            <Trans>
              Dollar columns assume a partner at threshold and a blended {pct(BLENDED_FEE_RATE * 100, 3)} fee
            </Trans>
          }
          right={
            <Tag tone="violet">
              <Trans>veAlpha governed</Trans>
            </Tag>
          }
        />
        <DataTable
          head={[
            { label: t`Tier` },
            { label: t`Visibility` },
            { label: t`Rebate`, right: true },
            { label: t`bps`, right: true },
            { label: t`30d volume`, right: true },
            { label: t`Funded referrals`, right: true },
            { label: t`Treasury %`, right: true },
            { label: t`LP %`, right: true },
            { label: t`veAlpha %`, right: true },
            { label: t`Treasury $/mo`, right: true },
            { label: t`LP $/mo`, right: true },
            { label: t`veAlpha $/mo`, right: true },
          ]}
        >
          {LADDER.map((rung) => {
            const thresholdVolume = rung.volumeUsd ?? rung.indicativeVolumeUsd ?? null;
            const fee = thresholdVolume ? thresholdVolume * BLENDED_FEE_RATE : null;
            const share = splitFee(100, rung.ratePct); // percentages, via a $100 fee
            const dollars = fee ? splitFee(fee, rung.ratePct) : null;

            return (
              <tr
                key={rung.name}
                className={rung.earned ? "border-t border-slate-700" : "border-t border-slate-700 opacity-70"}
              >
                <Cell className="font-medium">{rung.name}</Cell>
                <Cell>
                  {rung.earned ? (
                    <Tag tone="green">
                      <Trans>Earned</Trans>
                    </Tag>
                  ) : (
                    <Tag tone="violet">
                      <Trans>Governance</Trans>
                    </Tag>
                  )}
                </Cell>
                <Cell right>{rung.ratePct}%</Cell>
                <Cell right>{rung.ratePct * 100}</Cell>
                <Cell right>
                  {rung.volumeUsd ? compactUsd(rung.volumeUsd) : rung.earned ? t`Sign-up` : REACH_OUT.volume}
                </Cell>
                <Cell right>{rung.referrals ?? (rung.earned ? "—" : REACH_OUT.referrals)}</Cell>
                <Cell right>{pct(TREASURY_SHARE * 100, 1)}</Cell>
                <Cell right>{pct(share.lp, 1)}</Cell>
                <Cell right>{pct(share.veAlpha, 1)}</Cell>
                <Cell right>{dollars ? money(dollars.treasury, 0) : "—"}</Cell>
                <Cell right>{dollars ? money(dollars.lp, 0) : "—"}</Cell>
                <Cell right>{dollars ? money(dollars.veAlpha, 0) : "—"}</Cell>
              </tr>
            );
          })}
        </DataTable>
      </AdminCard>

      <p className="leading-relaxed max-w-[110ch] text-11 text-slate-100">
        <Trans>
          Both conditions must be met — volume <b>and</b> funded referrals. Volume alone is farmable by a single wallet;
          distinct funded counterparties are not. Treasury is fixed at {pct(TREASURY_SHARE * 100, 0)} of the fee at
          every tier, and LP and veAlpha split the remainder 5:4, so{" "}
          <span className="font-mono">LP = (90 − r) × 5/9</span>. At a 90% rebate both reach zero — the contract must
          reject any tier above that.
        </Trans>
      </p>
      <p className="leading-relaxed max-w-[110ch] text-11 text-yellow-500">
        <Trans>
          These are programme targets. What a partner is actually paid comes from ReferralStorage, and today mainnet
          tier 0 pays a 10% total rebate split 50/50 — a 5% affiliate share, not the 20% on this ladder. The Partners
          screen shows the measured rate for exactly this reason.
        </Trans>
      </p>
    </AdminLayout>
  );
}
