import { useMemo } from "react";

import useWallet from "lib/wallets/useWallet";

/**
 * Who may open the admin console.
 *
 * This is a UI gate, not a security boundary — anything it protects that actually matters must be
 * enforced server-side as well. It is honest about that: the indexer data behind most of these
 * screens is public anyway, but partner CONTACT DETAILS are not, and those come from an endpoint
 * that checks the same allowlist against a signed session before returning anything.
 */
export function usePartnerAdminAllowlist(): string[] {
  return useMemo(() => {
    const raw = import.meta.env.VITE_PARTNER_ADMIN_ADDRESSES ?? "";
    return raw
      .split(",")
      .map((a: string) => a.trim().toLowerCase())
      .filter((a: string) => /^0x[0-9a-f]{40}$/.test(a));
  }, []);
}

export function useIsPartnerAdmin() {
  const { account } = useWallet();
  const allowlist = usePartnerAdminAllowlist();

  return useMemo(() => {
    const address = account?.toLowerCase();
    return {
      isAdmin: Boolean(address && allowlist.includes(address)),
      /** No allowlist configured at all — the console is simply off, rather than open to everyone. */
      isConfigured: allowlist.length > 0,
      account: address,
    };
  }, [account, allowlist]);
}
