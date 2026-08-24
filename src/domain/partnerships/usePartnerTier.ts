import { useMemo } from "react";

import { useAffiliateTier, useReferrerDiscountShare, useTiers } from "domain/referrals";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

import type { PartnerTier } from "./types";

const BASIS_POINTS = 10000n;

/**
 * The tier a partner is actually on, read from ReferralStorage.
 *
 * Deliberately not a hardcoded ladder. The programme spec describes rates like 20%/25%/30%, but
 * what a partner is paid is whatever `tiers(tierLevel)` currently returns on chain, and the two are
 * not the same today — mainnet tier 0 is 1000 bps total rebate split 50/50, so the affiliate's
 * share is 500 bps of the fee, not 2000. Showing the spec ladder as though it were live would
 * promise a rate the contract will not pay.
 *
 * `totalRebate` is the whole slice carved out of the trading fee. `discountShare` is the portion
 * handed back to the trader, so the partner keeps the remainder. A per-affiliate override, when
 * set, wins over the tier default — the same precedence the contract applies.
 */
export function usePartnerTier(account: string | undefined) {
  const { signer } = useWallet();
  const { chainId } = useChainId();

  const { affiliateTier } = useAffiliateTier(signer, chainId, account);
  const { totalRebate, discountShare } = useTiers(signer, chainId, affiliateTier);
  const { discountShare: customDiscountShare } = useReferrerDiscountShare(signer, chainId, account);

  return useMemo<PartnerTier | undefined>(() => {
    if (affiliateTier === undefined || totalRebate === undefined || discountShare === undefined) {
      return undefined;
    }

    const effectiveDiscountShare = (customDiscountShare ?? 0n) > 0n ? (customDiscountShare as bigint) : discountShare;

    const affiliateShareBps = (totalRebate * (BASIS_POINTS - effectiveDiscountShare)) / BASIS_POINTS;

    return {
      tierLevel: affiliateTier,
      totalRebateBps: Number(totalRebate),
      discountShareBps: Number(effectiveDiscountShare),
      affiliateShareBps: Number(affiliateShareBps),
    };
  }, [affiliateTier, totalRebate, discountShare, customDiscountShare]);
}
