import { Trans, t } from "@lingui/macro";
import { useCallback, useEffect, useState } from "react";

import { REFERRAL_CODE_KEY } from "config/localStorage";
import { helperToast } from "lib/helperToast";
import { decodeReferralCode } from "sdk/utils/referrals";

/**
 * Shows the referral code a visitor is carrying, and lets them drop it.
 *
 * Attribution is captured from `?ref=` before a wallet ever connects and then persists in this
 * browser indefinitely, so without this a trader has no way to know a partner will be credited for
 * their trades, or to decline it. Silent attribution is the part people object to, not the discount.
 */
export function ActiveReferralCode({ className }: { className?: string }) {
  const [code, setCode] = useState<string | undefined>();

  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(REFERRAL_CODE_KEY);
      const decoded = raw ? decodeReferralCode(raw as `0x${string}`) : "";
      setCode(decoded || undefined);
    } catch {
      setCode(undefined);
    }
  }, []);

  useEffect(() => {
    read();
    // Another tab may set or clear it.
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [read]);

  if (!code) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-8 rounded-4 bg-slate-800 px-12 py-8 text-12">
        <span className="text-slate-100">
          <Trans>Referral code</Trans>
        </span>
        <span className="font-mono">{code}</span>
        <span className="text-slate-100">
          <Trans>— you get a fee discount</Trans>
        </span>
        <button
          type="button"
          className="ml-auto text-slate-100 underline hover:text-white"
          onClick={() => {
            localStorage.removeItem(REFERRAL_CODE_KEY);
            setCode(undefined);
            helperToast.success(t`Referral code removed.`);
          }}
        >
          <Trans>Remove</Trans>
        </button>
      </div>
    </div>
  );
}
