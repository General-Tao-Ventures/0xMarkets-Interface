import { Trans, t } from "@lingui/macro";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAdminContacts, useAdminData } from "domain/partnerships/admin";
import { useChainId } from "lib/chains";
import { decodeReferralCode } from "sdk/utils/referrals";

import Button from "components/Button/Button";

import { AdminLayout } from "./AdminLayout";
import { AdminCard, Cell, DataTable, Empty, Pnl, Segmented, Stat, Tag, compact, money, pct, short } from "./components";

type Sort = "vol" | "lp" | "pnl";

export default function AdminPartners() {
  const { chainId } = useChainId();
  const { data, isLoading } = useAdminData(chainId);
  const { contacts, session, error: contactError } = useAdminContacts();

  const [sort, setSort] = useState<Sort>("vol");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.partners.filter((p) => {
      if (!q) return true;
      const codes = p.codes.map((c) => decodeReferralCode(c as `0x${string}`).toLowerCase()).join(" ");
      return p.affiliate.includes(q) || codes.includes(q);
    });
    return [...list].sort((a, b) =>
      sort === "vol"
        ? b.volume30dUsd - a.volume30dUsd
        : sort === "lp"
          ? a.lpNetUsd - b.lpNetUsd
          : b.pnlPer1mUsd - a.pnlPer1mUsd
    );
  }, [data.partners, search, sort]);

  const totals = useMemo(
    () =>
      data.partners.reduce(
        (acc, p) => ({
          volume: acc.volume + p.volume30dUsd,
          rebate: acc.rebate + p.rebatePaidUsd,
          fees: acc.fees + p.feesUsd,
          lpNet: acc.lpNet + p.lpNetUsd,
        }),
        { volume: 0, rebate: 0, fees: 0, lpNet: 0 }
      ),
    [data.partners]
  );

  return (
    <AdminLayout
      title={<Trans>Partners</Trans>}
      lede={<Trans>Every partner, what they cost, and what their flow is actually worth to the LP pool.</Trans>}
    >
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t`Active partners`}
          value={data.partners.length}
          sub={<Trans>{data.partners.filter((p) => p.fundedReferrals === 0).length} with no funded referrals</Trans>}
        />
        <Stat
          label={t`30-day referred volume`}
          value={compact(totals.volume)}
          sub={<Trans>Across {data.partners.length} books</Trans>}
        />
        <Stat
          label={t`Rebates paid`}
          value={money(totals.rebate)}
          sub={totals.fees > 0 ? <Trans>{pct((totals.rebate / totals.fees) * 100)} of referred fees</Trans> : "—"}
        />
        <Stat
          label={t`LP net from referred flow`}
          value={money(totals.lpNet)}
          tone={totals.lpNet >= 0 ? "pos" : "neg"}
          sub={<Trans>Fee share less trader P&L</Trans>}
        />
      </div>

      <AdminCard>
        <div className="flex flex-wrap items-center gap-8 p-16">
          <Segmented<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: "vol", label: <Trans>By volume</Trans> },
              { value: "lp", label: <Trans>By LP net</Trans> },
              { value: "pnl", label: <Trans>By P&L per $1m</Trans> },
            ]}
          />
          <input
            className="min-w-[220px] flex-1 rounded-4 bg-slate-700 px-12 py-8 text-13 outline-none"
            placeholder={t`Search code or address…`}
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-12 text-slate-100">
            <Trans>
              {rows.length} of {data.partners.length} partners
            </Trans>
          </span>
        </div>

        <DataTable
          head={[
            { label: t`Partner` },
            { label: t`Codes` },
            { label: t`Effective rate`, right: true },
            { label: t`Contact` },
            { label: t`30d volume`, right: true },
            { label: t`Referrals`, right: true },
            { label: t`Rebate paid`, right: true },
            { label: t`LP fee share`, right: true },
            { label: t`Trader P&L`, right: true },
            { label: t`P&L / $1m`, right: true },
            { label: t`P&L % vol`, right: true },
            { label: t`LP net`, right: true },
          ]}
        >
          {isLoading ? (
            <Empty colSpan={12}>
              <Trans>Loading…</Trans>
            </Empty>
          ) : rows.length === 0 ? (
            <Empty colSpan={12}>
              <Trans>No partners have generated referred volume yet.</Trans>
            </Empty>
          ) : (
            rows.map((p) => {
              const contact = contacts[p.affiliate];
              return (
                <tr key={p.affiliate} className="border-t border-slate-700">
                  <Cell mono>
                    <Link to={`/referrals?affiliate=${p.affiliate}`} className="text-blue-300">
                      {short(p.affiliate)}
                    </Link>
                  </Cell>
                  <Cell mono>
                    {p.codes.length ? p.codes.map((c) => decodeReferralCode(c as `0x${string}`)).join(", ") : "—"}
                  </Cell>
                  <Cell right>
                    {pct(p.liveAffiliateSharePct)}
                    <div className="text-10 text-slate-100">
                      <Trans>of {pct(p.rebatePct)} rebate</Trans>
                    </div>
                  </Cell>
                  <Cell>
                    {contact ? (
                      <span className="flex items-center gap-6">
                        <span className="font-mono text-12">{contact.handle}</span>
                        {contact.shared && (
                          <Tag tone="amber">
                            <Trans>Shared</Trans>
                          </Tag>
                        )}
                      </span>
                    ) : (
                      <span className="text-12 text-slate-100">—</span>
                    )}
                  </Cell>
                  <Cell right>{money(p.volume30dUsd, 0)}</Cell>
                  <Cell right>
                    {p.fundedReferrals}
                    <span className="text-slate-100"> / {p.referrals}</span>
                  </Cell>
                  <Cell right className="text-blue-300">
                    {money(p.rebatePaidUsd, 4)}
                  </Cell>
                  <Cell right>{money(p.lpFeeShareUsd, 4)}</Cell>
                  <Cell right>
                    <Pnl value={p.traderPnlUsd} />
                  </Cell>
                  <Cell right>
                    <Pnl value={p.pnlPer1mUsd} />
                  </Cell>
                  <Cell right>
                    <Pnl value={p.pnlPctVolume} render={(v) => pct(v, 4)} />
                  </Cell>
                  <Cell right>
                    <Pnl value={-p.lpNetUsd} render={() => money(p.lpNetUsd, 4)} />
                  </Cell>
                </tr>
              );
            })
          )}
        </DataTable>
      </AdminCard>

      {!session.isSignedIn && (
        <AdminCard className="flex flex-wrap items-center gap-12 p-16">
          <div className="text-13">
            <Trans>Contact details are hidden until you sign in — they are served only to an allowlisted signer.</Trans>
          </div>
          <div className="ml-auto">
            <Button variant="secondary" disabled={session.isLoading} onClick={() => void session.signIn()}>
              {session.isLoading ? <Trans>Check your wallet…</Trans> : <Trans>Sign in to load contacts</Trans>}
            </Button>
          </div>
        </AdminCard>
      )}
      {contactError && <div className="text-12 text-red-500">{contactError}</div>}

      <p className="leading-relaxed max-w-[110ch] text-11 text-slate-100">
        <Trans>
          <b>Reading this table.</b> Trader P&L is from the trader's side — negative is money the pool kept, so green is
          good for you. <b>LP net</b> is fee share minus trader P&L: what this partner's flow was actually worth.
          <b> P&L per $1m</b> normalises across books of different sizes and is the column to sort on when hunting toxic
          flow. <b>Effective rate</b> is measured from what the contract actually paid over the life of the book, not
          the configured tier.
        </Trans>
      </p>
      {data.truncated && (
        <p className="text-11 text-yellow-500">
          <Trans>The indexer returned a full page — some partners may not be listed.</Trans>
        </p>
      )}
    </AdminLayout>
  );
}
