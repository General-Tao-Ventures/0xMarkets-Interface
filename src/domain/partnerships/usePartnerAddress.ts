import { useLocation } from "react-router-dom";

import useWallet from "lib/wallets/useWallet";

/**
 * Whose partner figures to show.
 *
 * `?address=0x…` wins over the connected wallet, mirroring /accounts/:account elsewhere in the app.
 * It lets support look at a partner without holding their key, and lets a partner open their own
 * page from a link before connecting.
 */
export function usePartnerAddress() {
  const { account } = useWallet();
  const { search } = useLocation();

  const override = new URLSearchParams(search).get("address");
  const viewed = override && /^0x[0-9a-fA-F]{40}$/.test(override) ? override : account;

  return {
    address: viewed as string | undefined,
    isViewingOther: Boolean(override && override !== account),
  };
}
