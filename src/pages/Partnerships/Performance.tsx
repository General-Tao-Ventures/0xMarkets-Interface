import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { useMemo, useState } from "react";

import { sumWindow, usePartnerAddress, usePartnerData, usePartnerTier } from "domain/partnerships";
import { useChainId } from "lib/chains";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { decodeReferralCode } from "sdk/utils/referrals";

import { Card, EmptyRow, StatCard, Table, Td, bpsToPct, dayLabel, shortAddress, usd } from "./components";
import { PartnershipsLayout } from "./PartnershipsLayout";
import { rungForNumbers } from "./tierLadder";

type Mode = "full" | "code" | "trader";

export default function PartnershipsPerformance() {
  const { chainId } = useChainId();
  const { address } = usePartnerAddress();
  const { data, isLoading } = usePartnerData(chainId, address);
  const tier = usePartnerTier(address);

  const [mode, setMode] = useState<Mode>("full");
  const [days, setDays] = useState(30);

  const [labels] = useLocalStorageSerializeKey<Record<string, string>>(
    [chainId, "partnership-code-labels", address ?? ""],
    {}
  );

  const RANGES = [
    { days: 30, label: t`Last 30 days` },
    { days: 90, label: t`Last 90 days` },
    { days: 0, label: t`All time` },
  ];

  const periods = useMemo(() => {
    if (days === 0) return [...data.periods].reverse();
    const from = Math.floor(Date.now() / 1000 / 86400) * 86400 - (days - 1) * 86400;
    return data.periods.filter((p) => p.periodStart >= from).reverse();
  }, [data.periods, days]);

  // All-time totals come from the lifetime row, not from summing buckets: only ninety days of daily
  // rows are fetched, so summing them would under-report anything older.
  const totals = useMemo(() => {
    if (days === 0) {
      return {
        volumeUsd: data.stat?.volumeUsd ?? 0n,
        feesGeneratedUsd: data.stat?.feesGeneratedUsd ?? 0n,
        affiliateRewardUsd: data.stat?.affiliateRewardUsd ?? 0n,
        tradesCount: data.stat?.tradesCount ?? 0,
      };
    }
    return sumWindow(data.periods, days);
  }, [data, days]);

  const funded = data.traders.filter((tr) => tr.isFunded).length;
  const volume30 = Number(sumWindow(data.periods, 30).volumeUsd) / 1e30;
  const { rung } = rungForNumbers(volume30, funded);

  const share = (part: bigint) =>
    totals.volumeUsd > 0n ? `${(Number((part * 10000n) / totals.volumeUsd) / 100).toFixed(1)}%` : "—";
  const effectiveRate = (reward: bigint, fees: bigint) =>
    fees > 0n ? `${(Number((reward * 10000n) / fees) / 100).toFixed(1)}%` : "—";

  const count =
    mode === "full"
      ? t`${periods.length} periods`
      : mode === "code"
        ? t`${data.codes.length} codes`
        : t`${funded} traders`;

  return (
    <PartnershipsLayout title={t`Performance`}>
      <p className="-mt-8 text-13 text-slate-100">
        <Trans>Break your earnings down by code, by trader, or view the whole book.</Trans>
      </p>

      <Card className="p-0">
        <div className="flex flex-col gap-12 p-16">
          <div className="flex w-fit gap-4 rounded-4 bg-slate-700/60 p-4">
            {(["full", "code", "trader"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cx(
                  "rounded-4 px-14 py-6 text-13",
                  mode === m ? "bg-slate-800 text-blue-300" : "text-slate-100"
                )}
              >
                {m === "full" ? t`Full view` : m === "code" ? t`By code` : t`By trader`}
              </button>
            ))}
          </div>
          <select
            className="w-full rounded-4 bg-slate-700 px-12 py-10 text-13"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="text-right text-12 text-slate-100">{count}</div>
        </div>

        <div className="grid grid-cols-1 gap-16 border-t border-slate-700 p-16 md:grid-cols-4">
          <StatCard label={t`Volume`} value={isLoading ? "—" : usd(totals.volumeUsd)} />
          <StatCard label={t`Fees generated`} value={isLoading ? "—" : usd(totals.feesGeneratedUsd)} />
          <StatCard
            label={t`You earned`}
            value={isLoading ? "—" : usd(totals.affiliateRewardUsd)}
            sub={
              tier ? (
                <Trans>
                  at {bpsToPct(tier.affiliateShareBps)} — {rung.name}
                </Trans>
              ) : undefined
            }
          />
          <StatCard label={t`Funded referrals`} value={isLoading ? "—" : funded} />
        </div>

        {mode === "full" && (
          <Table head={[t`Period`, t`Volume`, t`Fees generated`, t`You earned`, t`Effective rate`, t`Traders active`]}>
            {periods.length === 0 ? (
              <EmptyRow colSpan={6}>
                <Trans>No activity in this window.</Trans>
              </EmptyRow>
            ) : (
              periods.map((p) => (
                <tr key={p.periodStart} className="border-t border-slate-700">
                  <Td>{dayLabel(p.periodStart)}</Td>
                  <Td right>{usd(p.volumeUsd)}</Td>
                  <Td right>{usd(p.feesGeneratedUsd)}</Td>
                  <Td right className="text-blue-300">
                    {usd(p.affiliateRewardUsd)}
                  </Td>
                  <Td right>{effectiveRate(p.affiliateRewardUsd, p.feesGeneratedUsd)}</Td>
                  <Td right>{p.tradersActive}</Td>
                </tr>
              ))
            )}
          </Table>
        )}

        {mode === "code" && (
          <Table head={[t`Code`, t`Label`, t`Traders`, t`Volume`, t`Fees`, t`You earned`, t`Share of book`]}>
            {data.codes.length === 0 ? (
              <EmptyRow colSpan={7}>
                <Trans>No code has been used yet.</Trans>
              </EmptyRow>
            ) : (
              data.codes.map((c) => {
                const name = decodeReferralCode(c.referralCode);
                return (
                  <tr key={c.referralCode} className="border-t border-slate-700">
                    <Td className="font-mono">{name}</Td>
                    <Td className="text-slate-100">{labels?.[name] || "—"}</Td>
                    <Td right>{c.tradersCount}</Td>
                    <Td right>{usd(c.volumeUsd)}</Td>
                    <Td right>{usd(c.feesGeneratedUsd)}</Td>
                    <Td right className="text-blue-300">
                      {usd(c.rebateEarnedUsd)}
                    </Td>
                    <Td right>{share(c.volumeUsd)}</Td>
                  </tr>
                );
              })
            )}
          </Table>
        )}

        {mode === "trader" && (
          <Table head={[t`Trader`, t`Code`, t`Volume`, t`Fees`, t`You earned`, t`Share of book`]}>
            {funded === 0 ? (
              <EmptyRow colSpan={6}>
                <Trans>No funded traders yet.</Trans>
              </EmptyRow>
            ) : (
              data.traders
                .filter((tr) => tr.isFunded)
                .map((tr) => (
                  <tr key={tr.trader} className="border-t border-slate-700">
                    <Td className="font-mono">{shortAddress(tr.trader)}</Td>
                    <Td right className="font-mono text-slate-100">
                      {decodeReferralCode(tr.referralCode)}
                    </Td>
                    <Td right>{usd(tr.volumeUsd)}</Td>
                    <Td right>{usd(tr.feesPaidUsd)}</Td>
                    <Td right className="text-blue-300">
                      {usd(tr.rebateGeneratedUsd)}
                    </Td>
                    <Td right>{share(tr.volumeUsd)}</Td>
                  </tr>
                ))
            )}
          </Table>
        )}
      </Card>

      {days !== 0 && (
        <p className="text-12 text-slate-100">
          <Trans>
            "By code" and "by trader" are lifetime figures; only the period table and the cards respect the selected
            window. Share of book is against the window total.
          </Trans>
        </p>
      )}
    </PartnershipsLayout>
  );
}
