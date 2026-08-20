import { useCallback } from "react";

import { useLocalStorageSerializeKey } from "lib/localStorage";

/**
 * Codes this browser registered that the indexer has not seen yet.
 *
 * A code only reaches the indexer on its first fill, so between "transaction confirmed" and "first
 * trader arrives" a brand-new partner would otherwise look like a stranger — bounced back to the
 * sign-up steps by the very page that just created their code. Remembering it locally bridges that
 * gap. It is a display aid, never authority: ownership is decided on chain.
 */
export function useLocalPartnerCodes(chainId: number, account: string | undefined) {
  const [codes, setCodes] = useLocalStorageSerializeKey<string[]>(
    [chainId, "partnership-local-codes", account?.toLowerCase() ?? ""],
    []
  );

  const remember = useCallback(
    (code: string) => {
      setCodes(Array.from(new Set([...(codes ?? []), code])));
    },
    [codes, setCodes]
  );

  return { localCodes: codes ?? [], remember };
}
