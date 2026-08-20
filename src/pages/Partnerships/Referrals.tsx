import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { useMemo, useState } from "react";

import { usePartnerAddress, usePartnerData } from "domain/partnerships";
import { useChainId } from "lib/chains";
import { decodeReferralCode } from "sdk/utils/referrals";

import { Card, EmptyRow, Table, Td, dayLabel, shortAddress, usd } from "./components";
import { PartnershipsLayout } from "./PartnershipsLayout";

type StatusFilter = "" | "funded" | "registered";

export default function PartnershipsReferrals() {
  const { chainId } = useChainId();
  const { address } = usePartnerAddress();
  const { data, isLoading } = usePartnerData(chainId, address);

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");

  const codes = useMemo(() => [...new Set(data.traders.map((tr) => tr.referralCode))], [data.traders]);

  const rows = useMemo(
    () =>
      data.traders.filter(
        (tr) =>
          (!code || tr.referralCode === code) &&
          (!status || (status === "funded" ? tr.isFunded : !tr.isFunded)) &&
          (!search || tr.trader.toLowerCase().includes(search.toLowerCase()))
      ),
    [data.traders, code, status, search]
  );

  const dash = <span className="text-slate-100">—</span>;

  return (
    <PartnershipsLayout title={t`Referrals`}>
      <p className="-mt-8 text-13 text-slate-100">
        <Trans>Everyone who joined through your codes, and how they're trading.</Trans>
      </p>

      <Card className="p-0">
        <div className="flex flex-col gap-12 p-16">
          <select
            className="w-full rounded-4 bg-slate-700 px-12 py-10 text-13"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          >
            <option value="">{t`All codes`}</option>
            {codes.map((c) => (
              <option key={c} value={c}>
                {decodeReferralCode(c)}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-4 bg-slate-700 px-12 py-10 text-13"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="">{t`All traders`}</option>
            <option value="funded">{t`Funded only`}</option>
            <option value="registered">{t`Registered, not funded`}</option>
          </select>
          <input
            className="w-full rounded-4 bg-slate-700 px-12 py-10 text-13"
            placeholder={t`Search address…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            spellCheck={false}
          />
          <div className="text-right text-12 text-slate-100">
            <Trans>
              {rows.length} of {data.traders.length} traders
            </Trans>
          </div>
        </div>

        <Table head={[t`Trader`, t`Code`, t`Joined`, t`Volume`, t`Fees paid`, t`You earned`, t`Their P&L`, t`Status`]}>
          {isLoading ? (
            <EmptyRow colSpan={8}>
              <Trans>Loading…</Trans>
            </EmptyRow>
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={8}>
              <Trans>Nothing matches those filters.</Trans>
            </EmptyRow>
          ) : (
            rows.map((tr) => {
              const joined = tr.registeredAt ?? tr.firstTradeTimestamp;
              const pnl = tr.realizedPnlUsd;
              return (
                <tr key={tr.trader} className="border-t border-slate-700">
                  <Td className="font-mono">{shortAddress(tr.trader)}</Td>
                  <Td right className="font-mono text-slate-100">
                    {decodeReferralCode(tr.referralCode)}
                  </Td>
                  <Td right className="text-slate-100">
                    {joined ? dayLabel(joined) : dash}
                  </Td>
                  <Td right>{tr.isFunded ? usd(tr.volumeUsd) : dash}</Td>
                  <Td right>{tr.isFunded ? usd(tr.feesPaidUsd) : dash}</Td>
                  <Td right className="text-blue-300">
                    {tr.isFunded ? usd(tr.rebateGeneratedUsd) : dash}
                  </Td>
                  <Td
                    right
                    className={cx(pnl === undefined || pnl === 0n ? "" : pnl > 0n ? "text-green-500" : "text-red-500")}
                  >
                    {tr.isFunded && pnl !== undefined ? usd(pnl) : dash}
                  </Td>
                  <Td right>
                    <span
                      className={cx(
                        "rounded-full px-8 py-2 text-11",
                        tr.isFunded ? "bg-green-500/20 text-green-500" : "bg-slate-700 text-slate-100"
                      )}
                    >
                      {tr.isFunded ? <Trans>Funded</Trans> : <Trans>Registered</Trans>}
                    </span>
                  </Td>
                </tr>
              );
            })
          )}
        </Table>
      </Card>

      <p className="text-12 text-slate-100">
        <Trans>
          Only <b className="text-white">funded</b> traders count toward your tier. Their P&L is shown so you can see
          who's active and who's gone quiet — it doesn't affect what you earn. You're paid on fees, win or lose.
        </Trans>
      </p>
    </PartnershipsLayout>
  );
}
