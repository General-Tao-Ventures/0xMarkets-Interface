import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

import { useLocalPartnerCodes } from "./useLocalPartnerCodes";
import { usePartnerCodes } from "./usePartnerCodes";

export type PartnerStatus =
  /** No wallet, so there is nobody to look up. */
  | "no-wallet"
  /** We have an address but not yet an answer. Never route on this. */
  | "resolving"
  /** Owns at least one code. */
  | "partner"
  /** Definitively owns none. */
  | "stranger";

/**
 * Is this address a partner? The single source of truth for every partnerships route.
 *
 * The distinction that matters is "not a partner" versus "we do not know yet", and it is easy to
 * lose: SWR reports isLoading false whenever its key is null, which happens both before a wallet
 * connects AND whenever the indexer client is unavailable for the current chain. Treating that as
 * "stranger" is what bounced returning partners into sign-up — the answer had simply not arrived.
 *
 * So the rule here is: only `stranger` means no, and it is only reached once the query has actually
 * returned. Anything else routes to a spinner.
 */
export function usePartnerStatus(address: string | undefined): {
  status: PartnerStatus;
  codes: string[];
  refresh: () => void;
} {
  const { chainId } = useChainId();
  const { account } = useWallet();
  const { codes, isLoading, hasAnswer, refresh } = usePartnerCodes(chainId, address);

  // Codes registered in this browser but not yet indexed. Scoped to the address being viewed, so
  // your own pending codes never leak into someone else's page via ?address=.
  const { localCodes } = useLocalPartnerCodes(chainId, address ?? account);

  if (!address) return { status: "no-wallet", codes: [], refresh };
  if (codes.length > 0 || localCodes.length > 0) return { status: "partner", codes, refresh };
  if (isLoading || !hasAnswer) return { status: "resolving", codes: [], refresh };
  return { status: "stranger", codes: [], refresh };
}
