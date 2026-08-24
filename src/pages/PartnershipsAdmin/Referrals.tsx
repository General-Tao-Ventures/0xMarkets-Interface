import { Trans, t } from "@lingui/macro";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAdminData } from "domain/partnerships/admin";
import { useChainId } from "lib/chains";
import { decodeReferralCode } from "sdk/utils/referrals";

import { AdminLayout } from "./AdminLayout";
import { AdminCard, Cell, DataTable, Empty, Pnl, Segmented, Stat, Tag, day, money, pct, short } from "./components";

type Sort = "vol" | "lp" | "pnl";
type Filter = "" | "flagged" | "winner" | "funded" | "self";

export default function AdminReferrals() {
  const { chainId } = useChainId();
  const { data, isLoading } = useAdminData(chainId);
  const { search: qs } = useLocation();

  const preselect = new URLSearchParams(qs).get("affiliate")?.toLowerCase() ?? "";
  const [affiliate, setAffiliate] = useState(preselect);
  const [filter, setFilter] = useState<Filter>("");
  const [sort, setSort] = useState<Sort>("vol");
  const [search, setSearch] = useState("");

  const affiliates = useMemo(
    () => Array.from(new Set(data.referrals.map((r) => r.affiliate))).sort(),
    [data.referrals]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.referrals.filter((r) => {
      if (affiliate && r.affiliate !== affiliate) return false;
      if (filter === "flagged" && r.flags.length === 0) return false;
      if (filter === "winner" && !r.flags.includes("winner")) return false;
      if (filter === "self" && !r.flags.includes("self")) return false;
      if (filter === "funded" && !r.isFunded) return false;
      if (q && !r.trader.includes(q) && !r.affiliate.includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) =>
      sort === "vol"
        ? b.volumeUsd - a.volumeUsd
        : sort === "lp"
          ? a.lpNetUsd - b.lpNetUsd
          : b.pnlPer1mUsd - a.pnlPer1mUsd
    );
  }, [data.referrals, affiliate, filter, sort, search]);

  const scoped = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          volume: acc.volume + r.volumeUsd,
          fees: acc.fees + r.feesPaidUsd,
          rebate: acc.rebate + r.rebateToPartnerUsd,
          pnl: acc.pnl + r.traderPnlUsd,
          lpNet: acc.lpNet + r.lpNetUsd,
        }),
        { volume: 0, fees: 0, rebate: 0, pnl: 0, lpNet: 0 }
      ),
    [rows]
  );

  return (
    <AdminLayout
      title={<Trans>Referrals</Trans>}
      lede={
        <Trans>
          Every trader a partner has brought in, and what their flow is worth. Pick a partner to scope the view.
        </Trans>
      }
    >
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 xl:grid-cols-4">
        <Stat label={t`Traders in view`} value={rows.length} sub={<Trans>of {data.referrals.length} total</Trans>} />
        <Stat label={t`Volume`} value={money(scoped.volume, 0)} sub={<Trans>Lifetime, scoped to filters</Trans>} />
        <Stat
          label={t`Rebate to partners`}
          value={money(scoped.rebate, 4)}
          sub={<Trans>Out of {money(scoped.fees, 4)} fees</Trans>}
        />
        <Stat
          label={t`LP net`}
          value={money(scoped.lpNet, 4)}
          tone={scoped.lpNet >= 0 ? "pos" : "neg"}
          sub={<Trans>Fee share less trader P&L</Trans>}
        />
      </div>

      <AdminCard>
        <div className="flex flex-wrap items-center gap-8 p-16">
          <select
            className="rounded-4 bg-slate-700 px-10 py-8 text-13 outline-none"
            value={affiliate}
            onChange={(e) => setAffiliate(e.target.value)}
          >
            <option value="">{t`All partners`}</option>
            {affiliates.map((a) => (
              <option key={a} value={a}>
                {short(a)}
              </option>
            ))}
          </select>
          <select
            className="rounded-4 bg-slate-700 px-10 py-8 text-13 outline-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="">{t`All traders`}</option>
            <option value="flagged">{t`Flagged only`}</option>
            <option value="winner">{t`Consistent winners`}</option>
            <option value="funded">{t`Funded referrals`}</option>
            <option value="self">{t`Self-referred`}</option>
          </select>
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
            className="min-w-[200px] flex-1 rounded-4 bg-slate-700 px-12 py-8 text-13 outline-none"
            placeholder={t`Search trader or partner…`}
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DataTable
          head={[
            { label: t`Trader` },
            { label: t`Referred by` },
            { label: t`Code` },
            { label: t`Joined` },
            { label: t`Volume`, right: true },
            { label: t`Fees paid`, right: true },
            { label: t`Rebate to partner`, right: true },
            { label: t`Trader P&L`, right: true },
            { label: t`P&L / $1m`, right: true },
            { label: t`LP net`, right: true },
            { label: t`Flags` },
          ]}
        >
          {isLoading ? (
            <Empty colSpan={11}>
              <Trans>Loading…</Trans>
            </Empty>
          ) : rows.length === 0 ? (
            <Empty colSpan={11}>
              <Trans>Nothing matches those filters.</Trans>
            </Empty>
          ) : (
            rows.map((r) => (
              <tr key={`${r.affiliate}-${r.trader}`} className="border-t border-slate-700">
                <Cell mono>{short(r.trader)}</Cell>
                <Cell mono>{short(r.affiliate)}</Cell>
                <Cell mono>{decodeReferralCode(r.referralCode as `0x${string}`)}</Cell>
                <Cell>{day(r.joinedAt)}</Cell>
                <Cell right>{money(r.volumeUsd, 0)}</Cell>
                <Cell right>{money(r.feesPaidUsd, 4)}</Cell>
                <Cell right className="text-blue-300">
                  {money(r.rebateToPartnerUsd, 4)}
                </Cell>
                <Cell right>
                  <Pnl value={r.traderPnlUsd} />
                </Cell>
                <Cell right>
                  <Pnl value={r.pnlPer1mUsd} />
                </Cell>
                <Cell right>
                  <Pnl value={-r.lpNetUsd} render={() => money(r.lpNetUsd, 4)} />
                </Cell>
                <Cell>
                  <span className="flex flex-wrap gap-4">
                    {!r.isFunded && (
                      <Tag tone="grey">
                        <Trans>Registered only</Trans>
                      </Tag>
                    )}
                    {r.flags.includes("self") && (
                      <Tag tone="red">
                        <Trans>Self-referred</Trans>
                      </Tag>
                    )}
                    {r.flags.includes("winner") && (
                      <Tag tone="amber">
                        <Trans>Consistent winner</Trans>
                      </Tag>
                    )}
                  </span>
                </Cell>
              </tr>
            ))
          )}
        </DataTable>
      </AdminCard>

      <p className="leading-relaxed max-w-[110ch] text-11 text-slate-100">
        <Trans>
          <b>Flags.</b> <b>Self-referred</b> — the trader owns the code they traded under, which the contract does not
          currently prevent. <b>Consistent winner</b> — profitable in each of the last three months; expensive flow, not
          necessarily abuse. <b>Registered only</b> — attached to a code but has never traded, so it does not count
          toward a tier. <b>Funded by partner</b>, the wash-trading signature, is not shown: detecting it needs a
          transfer graph the indexer does not build, and guessing would be worse than saying nothing.
        </Trans>
      </p>
    </AdminLayout>
  );
}
