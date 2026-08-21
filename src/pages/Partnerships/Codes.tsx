import { Trans, t } from "@lingui/macro";
import { useMemo, useState } from "react";
import { useCopyToClipboard } from "react-use";

import { usePendingTxns } from "context/PendingTxnsContext/PendingTxnsContext";
import { useLocalPartnerCodes, usePartnerAddress, usePartnerCodes, usePartnerData } from "domain/partnerships";
import { registerReferralCode } from "domain/referrals";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import useWallet from "lib/wallets/useWallet";
import { decodeReferralCode } from "sdk/utils/referrals";

import Button from "components/Button/Button";
import { getReferralCodeTradeUrl } from "components/Referrals/referralsHelper";

import { Card, EmptyRow, SectionTitle, Table, Td, usd } from "./components";
import { PartnershipsLayout } from "./PartnershipsLayout";

const CODE_PATTERN = /^[A-Za-z0-9_]{1,20}$/;

export default function PartnershipsCodes() {
  const { chainId } = useChainId();
  const { signer, account } = useWallet();
  const { address, isViewingOther } = usePartnerAddress();
  const { data, isLoading } = usePartnerData(chainId, address);
  // Ownership comes from the registration events, not from trading. A code with no traders yet
  // still belongs to you and must still be listed — that is every brand-new partner.
  const { codes: ownedCodes, isLoading: ownedLoading } = usePartnerCodes(chainId, address);
  const { pendingTxns } = usePendingTxns();
  const [, copyToClipboard] = useCopyToClipboard();

  // Labels are the partner's own private note per code. Not on chain, and there is no backend for
  // them, so they live in this browser only — stated plainly under the table.
  const [labels, setLabels] = useLocalStorageSerializeKey<Record<string, string>>(
    [chainId, "partnership-code-labels", address ?? ""],
    {}
  );
  const { localCodes, remember } = useLocalPartnerCodes(chainId, account);

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const rows = useMemo(() => {
    // Per-code trading figures, keyed by the decoded code. Only codes someone has traded under
    // appear here, so this is an enrichment layer rather than the list itself.
    const statsByCode = new Map(
      data.codes.map((c) => [
        decodeReferralCode(c.referralCode),
        { traders: c.tradersCount, volumeUsd: c.volumeUsd, rebateUsd: c.rebateEarnedUsd },
      ])
    );

    const owned = ownedCodes.map((raw) => {
      const code = decodeReferralCode(raw);
      const stats = statsByCode.get(code);
      return {
        code,
        traders: stats?.traders ?? 0,
        volumeUsd: stats?.volumeUsd ?? 0n,
        rebateUsd: stats?.rebateUsd ?? 0n,
        pending: false,
      };
    });

    // A code registered in this browser but not yet seen by the indexer.
    const seen = new Set(owned.map((r) => r.code));
    const pendingOnes = localCodes
      .filter((c) => !seen.has(c))
      .map((c) => ({ code: c, traders: 0, volumeUsd: 0n, rebateUsd: 0n, pending: true }));

    return [...owned, ...pendingOnes];
  }, [data.codes, ownedCodes, localCodes]);

  const canCreate = Boolean(account) && !isViewingOther && CODE_PATTERN.test(newCode) && !isCreating;

  async function handleCreate() {
    if (!canCreate) return;
    setIsCreating(true);
    try {
      await registerReferralCode(chainId, newCode, signer, {
        sentMsg: t`Referral code submitted.`,
        failMsg: t`Referral code creation failed.`,
        successMsg: t`Referral code created.`,
        pendingTxns,
      });
      remember(newCode);
      if (newLabel) setLabels({ ...(labels ?? {}), [newCode]: newLabel });
      setNewCode("");
      setNewLabel("");
    } catch (error) {
      helperToast.error(t`Could not create the code.`);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <PartnershipsLayout title={t`Codes`}>
      <p className="-mt-8 max-w-[640px] text-13 text-slate-100">
        <Trans>Create a separate code per channel, campaign or region so you can tell what's working.</Trans>
      </p>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-0">
          <div className="flex items-baseline justify-between p-16">
            <h2 className="text-16 font-medium">
              <Trans>Your codes</Trans>
            </h2>
            <span className="text-12 text-slate-100">
              <Trans>{rows.length} active</Trans>
            </span>
          </div>
          <Table head={[t`Code`, t`Label`, t`Traders`, t`Volume`, t`Rebate earned`, ""]}>
            {isLoading || ownedLoading ? (
              <EmptyRow colSpan={6}>
                <Trans>Loading…</Trans>
              </EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6}>
                <Trans>No codes yet. Create one on the right.</Trans>
              </EmptyRow>
            ) : (
              rows.map((r) => (
                <tr key={r.code} className="border-t border-slate-700">
                  <Td className="font-mono">
                    {r.code}
                    {r.pending && (
                      <span className="text-10 ml-8 rounded-full bg-slate-700 px-8 py-2 text-slate-100">
                        <Trans>Pending</Trans>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <input
                      className="bg-transparent w-full text-13 text-slate-100 outline-none placeholder:text-slate-100/50"
                      placeholder={t`Add a private label…`}
                      value={labels?.[r.code] ?? ""}
                      disabled={isViewingOther}
                      onChange={(e) => setLabels({ ...(labels ?? {}), [r.code]: e.target.value })}
                    />
                  </Td>
                  <Td right>{r.traders}</Td>
                  <Td right>{usd(r.volumeUsd)}</Td>
                  <Td right className="text-blue-300">
                    {usd(r.rebateUsd)}
                  </Td>
                  <Td right>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        copyToClipboard(getReferralCodeTradeUrl(r.code));
                        helperToast.success(t`Share link copied.`);
                      }}
                    >
                      <Trans>Copy link</Trans>
                    </Button>
                  </Td>
                </tr>
              ))
            )}
          </Table>
          <p className="p-16 pt-8 text-11 text-slate-100">
            <Trans>
              Volume is lifetime, not 30-day: the indexer keeps daily totals per partner, not per code. Labels are
              private and stored in this browser only. "Pending" means the code was registered here but no one has
              traded under it yet, so the indexer has not seen it.
            </Trans>
          </p>
        </Card>

        <Card>
          <SectionTitle sub={t`Letters, numbers and underscores. Up to 20 characters.`}>
            <Trans>Create a code</Trans>
          </SectionTitle>

          <label className="text-12 text-slate-100" htmlFor="pt-new-code">
            <Trans>Code</Trans>
          </label>
          <input
            id="pt-new-code"
            className="mt-4 w-full rounded-4 bg-slate-700 px-12 py-10 font-mono text-13 outline-none"
            placeholder="gulf_signals"
            spellCheck={false}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
          />
          {newCode && !CODE_PATTERN.test(newCode) && (
            <div className="mt-4 text-11 text-red-500">
              <Trans>Letters, numbers and underscores only, up to 20 characters.</Trans>
            </div>
          )}

          <label className="mt-12 block text-12 text-slate-100" htmlFor="pt-new-label">
            <Trans>Label — private, for your own reporting</Trans>
          </label>
          <input
            id="pt-new-label"
            className="mt-4 w-full rounded-4 bg-slate-700 px-12 py-10 text-13 outline-none"
            placeholder={t`Telegram channel — Gulf`}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />

          <div className="mt-16">
            <Button variant="primary-action" disabled={!canCreate} onClick={handleCreate}>
              {isCreating ? <Trans>Creating…</Trans> : <Trans>Create code</Trans>}
            </Button>
          </div>
          {!account && (
            <div className="mt-8 text-11 text-slate-100">
              <Trans>Connect your wallet to register a code on chain.</Trans>
            </div>
          )}

          <dl className="mt-16 rounded-4 bg-slate-700/50 p-12 text-12">
            <div className="flex justify-between py-4">
              <dt className="text-slate-100">
                <Trans>Share link</Trans>
              </dt>
              <dd className="font-mono">{`${window.location.host}/#/trade/?ref=…`}</dd>
            </div>
            <div className="flex justify-between py-4">
              <dt className="text-slate-100">
                <Trans>Attribution</Trans>
              </dt>
              <dd>
                <Trans>On first wallet connect</Trans>
              </dd>
            </div>
            <div className="flex justify-between py-4">
              <dt className="text-slate-100">
                <Trans>Codes allowed</Trans>
              </dt>
              <dd>
                <Trans>Unlimited</Trans>
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </PartnershipsLayout>
  );
}
