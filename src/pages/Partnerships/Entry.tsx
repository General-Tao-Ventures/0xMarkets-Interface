import { Trans } from "@lingui/macro";
import { Redirect } from "react-router-dom";

import { useLocalPartnerCodes, usePartnerAddress, usePartnerCodes } from "domain/partnerships";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";

import Overview from "./Overview";

/**
 * What `/partnerships` should actually show.
 *
 * A partner gets their portal. Everyone else gets the sign-up steps — showing a stranger an empty
 * scoreboard tells them nothing about the programme and nothing about what to do next.
 *
 * Owning a code is the test, because that is the only fact the contract records about a partner.
 */
export default function PartnershipsEntry() {
  const { chainId } = useChainId();
  const { account } = useWallet();
  const { address, isViewingOther } = usePartnerAddress();
  const { isPartner, isLoading } = usePartnerCodes(chainId, address);
  const { localCodes } = useLocalPartnerCodes(chainId, account);

  // Support looking at someone else's figures never gets redirected into sign-up.
  if (isViewingOther) return <Overview />;

  if (!account) return <Redirect to="/partnerships/start" />;

  if (isLoading) {
    return (
      <AppPageLayout>
        <div className="py-64 text-center text-13 text-slate-100">
          <Trans>Loading…</Trans>
        </div>
      </AppPageLayout>
    );
  }

  // localCodes covers the gap between registering a code and the indexer seeing its first trade.
  if (isPartner || localCodes.length > 0) return <Overview />;

  return <Redirect to="/partnerships/start" />;
}
