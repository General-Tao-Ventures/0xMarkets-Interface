import { Trans, t } from "@lingui/macro";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useAdminContacts, useAdminData } from "domain/partnerships/admin";
import { useChainId } from "lib/chains";

import { AdminLayout } from "./AdminLayout";
import { AdminCard, Cell, CardHead, DataTable, Empty, Pnl, Stat, Tag, money, short } from "./components";

/**
 * The review queue. Nothing here blocks anything automatically.
 *
 * Two of the mock's signals are honest to compute and one is not, so only two are shown:
 * self-referral comes straight from comparing the trader to the code owner, and toxic flow from
 * realised P&L. "Funded by partner" needs a transfer graph the indexer does not build.
 */
export default function AdminRisk() {
  const { chainId } = useChainId();
  const { data, isLoading } = useAdminData(chainId);
  const { contacts, session } = useAdminContacts();

  const selfReferred = useMemo(() => data.referrals.filter((r) => r.flags.includes("self")), [data.referrals]);

  const toxic = useMemo(
    () => data.partners.filter((p) => p.lpNetUsd < 0 && p.volume30dUsd > 0).sort((a, b) => a.lpNetUsd - b.lpNetUsd),
    [data.partners]
  );

  const thinBooks = useMemo(
    () => data.partners.filter((p) => p.volume30dUsd > 0 && p.fundedReferrals > 0 && p.fundedReferrals <= 3),
    [data.partners]
  );

  // One verified channel behind several partner addresses.
  const clusters = useMemo(() => {
    const byHandle = new Map<string, { channel: string; handle: string; affiliates: string[] }>();
    for (const [address, c] of Object.entries(contacts)) {
      if (!c.shared) continue;
      const key = `${c.channel}:${c.handle.toLowerCase()}`;
      const entry = byHandle.get(key) ?? { channel: c.channel, handle: c.handle, affiliates: [] };
      entry.affiliates.push(address);
      byHandle.set(key, entry);
    }
    return [...byHandle.values()].map((e) => {
      const partners = data.partners.filter((p) => e.affiliates.includes(p.affiliate));
      return {
        ...e,
        combinedVolumeUsd: partners.reduce((a, p) => a + p.volume30dUsd, 0),
        traders: partners.reduce((a, p) => a + p.fundedReferrals, 0),
        combinedRebateUsd: partners.reduce((a, p) => a + p.rebatePaidUsd, 0),
      };
    });
  }, [contacts, data.partners]);

  const selfVolume = selfReferred.reduce((a, r) => a + r.volumeUsd, 0);
  const totalVolume = data.partners.reduce((a, p) => a + p.lifetimeVolumeUsd, 0);

  return (
    <AdminLayout
      title={<Trans>Risk</Trans>}
      lede={<Trans>Self-referral and toxic flow. Reviewed before any promotion is honoured.</Trans>}
    >
      <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
        <Stat
          label={t`Open flags`}
          value={selfReferred.length + toxic.length}
          sub={
            <Trans>
              {selfReferred.length} self-referred · {toxic.length} toxic flow
            </Trans>
          }
        />
        <Stat
          label={t`Self-referred volume`}
          value={money(selfVolume, 0)}
          tone={selfVolume > 0 ? "neg" : undefined}
          sub={
            totalVolume > 0 ? <Trans>{((selfVolume / totalVolume) * 100).toFixed(1)}% of referred volume</Trans> : "—"
          }
        />
        <Stat label={t`Toxic-flow partners`} value={toxic.length} sub={<Trans>LP net negative over 30 days</Trans>} />
      </div>

      <AdminCard>
        <CardHead title={<Trans>Flagged</Trans>} sub={<Trans>Highest LP impact first</Trans>} />
        <DataTable
          head={[
            { label: t`Subject` },
            { label: t`Flag` },
            { label: t`Volume at risk`, right: true },
            { label: t`LP impact`, right: true },
            { label: "" },
          ]}
        >
          {isLoading ? (
            <Empty colSpan={5}>
              <Trans>Loading…</Trans>
            </Empty>
          ) : toxic.length === 0 && selfReferred.length === 0 ? (
            <Empty colSpan={5}>
              <Trans>Nothing flagged. No self-referral and no partner is LP-negative.</Trans>
            </Empty>
          ) : (
            <>
              {toxic.map((p) => (
                <tr key={`toxic-${p.affiliate}`} className="border-t border-slate-700">
                  <Cell mono>{short(p.affiliate)}</Cell>
                  <Cell>
                    <span className="flex items-center gap-6">
                      <Tag tone="amber">
                        <Trans>Toxic flow</Trans>
                      </Tag>
                      <span className="text-12 text-slate-100">
                        <Trans>traders net profitable over the window</Trans>
                      </span>
                    </span>
                  </Cell>
                  <Cell right>{money(p.volume30dUsd, 0)}</Cell>
                  <Cell right>
                    <Pnl value={-p.lpNetUsd} render={() => money(p.lpNetUsd, 4)} />
                  </Cell>
                  <Cell right>
                    <Link to={`/referrals?affiliate=${p.affiliate}`} className="text-blue-300">
                      <Trans>Review</Trans>
                    </Link>
                  </Cell>
                </tr>
              ))}
              {selfReferred.map((r) => (
                <tr key={`self-${r.trader}`} className="border-t border-slate-700">
                  <Cell mono>{short(r.trader)}</Cell>
                  <Cell>
                    <span className="flex items-center gap-6">
                      <Tag tone="red">
                        <Trans>Self-referred</Trans>
                      </Tag>
                      <span className="text-12 text-slate-100">
                        <Trans>code owner is also the trader</Trans>
                      </span>
                    </span>
                  </Cell>
                  <Cell right>{money(r.volumeUsd, 0)}</Cell>
                  <Cell right>
                    <Pnl value={-r.lpNetUsd} render={() => money(r.lpNetUsd, 4)} />
                  </Cell>
                  <Cell right>
                    <Link to={`/referrals?affiliate=${r.affiliate}`} className="text-blue-300">
                      <Trans>Review</Trans>
                    </Link>
                  </Cell>
                </tr>
              ))}
            </>
          )}
        </DataTable>
      </AdminCard>

      <AdminCard>
        <CardHead
          title={<Trans>Thin books</Trans>}
          sub={<Trans>Real volume from three or fewer funded traders — the shape the referral gate exists for</Trans>}
        />
        <DataTable
          head={[
            { label: t`Partner` },
            { label: t`Funded traders`, right: true },
            { label: t`30d volume`, right: true },
            { label: t`P&L / $1m`, right: true },
            { label: "" },
          ]}
        >
          {thinBooks.length === 0 ? (
            <Empty colSpan={5}>
              <Trans>No partner is concentrated in three or fewer traders.</Trans>
            </Empty>
          ) : (
            thinBooks.map((p) => (
              <tr key={p.affiliate} className="border-t border-slate-700">
                <Cell mono>{short(p.affiliate)}</Cell>
                <Cell right>{p.fundedReferrals}</Cell>
                <Cell right>{money(p.volume30dUsd, 0)}</Cell>
                <Cell right>
                  <Pnl value={p.pnlPer1mUsd} />
                </Cell>
                <Cell right>
                  <Link to={`/referrals?affiliate=${p.affiliate}`} className="text-blue-300">
                    <Trans>Review</Trans>
                  </Link>
                </Cell>
              </tr>
            ))
          )}
        </DataTable>
      </AdminCard>

      <AdminCard>
        <CardHead
          title={<Trans>Shared contact clusters</Trans>}
          sub={<Trans>One verified channel, several partner addresses</Trans>}
        />
        <DataTable
          head={[
            { label: t`Verified contact` },
            { label: t`Addresses` },
            { label: t`Combined volume`, right: true },
            { label: t`Funded traders`, right: true },
            { label: t`Combined rebate`, right: true },
          ]}
        >
          {!session.isSignedIn ? (
            <Empty colSpan={5}>
              <Trans>Sign in to load contact details.</Trans>
            </Empty>
          ) : clusters.length === 0 ? (
            <Empty colSpan={5}>
              <Trans>No verified channel is shared between partner addresses.</Trans>
            </Empty>
          ) : (
            clusters.map((c) => (
              <tr key={`${c.channel}-${c.handle}`} className="border-t border-slate-700">
                <Cell mono>{c.handle}</Cell>
                <Cell mono className="text-slate-100">
                  {c.affiliates.map(short).join(" · ")}
                </Cell>
                <Cell right>{money(c.combinedVolumeUsd, 0)}</Cell>
                <Cell right>{c.traders}</Cell>
                <Cell right>{money(c.combinedRebateUsd, 4)}</Cell>
              </tr>
            ))
          )}
        </DataTable>
      </AdminCard>

      <p className="leading-relaxed max-w-[110ch] text-11 text-slate-100">
        <Trans>
          <b>This is a review queue, not a control.</b> Verified contact is an address book and an accountability record
          — it is <b>not</b> an anti-Sybil measure and must never be counted as one. Email is free and a Telegram
          account costs a phone number at most; a determined farmer will verify as many channels as they need wallets.
          What makes a row worth opening is the combination: one contact, several addresses, few traders, and P&L per
          $1m near zero. Multi-wallet desks are legitimate and common, so nothing here is blocked automatically.
        </Trans>
      </p>
      <p className="leading-relaxed max-w-[110ch] text-11 text-yellow-500">
        <Trans>
          <b>Not detected here:</b> wallets funded by their own referrer, the wash-trading signature. That needs a
          transfer graph the indexer does not build, so it is absent rather than guessed at.
        </Trans>
      </p>
    </AdminLayout>
  );
}
