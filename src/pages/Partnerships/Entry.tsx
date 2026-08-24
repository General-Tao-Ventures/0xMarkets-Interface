import { Trans } from "@lingui/macro";
import { Redirect } from "react-router-dom";

import { usePartnerAddress, usePartnerStatus } from "domain/partnerships";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";

import Overview from "./Overview";

/**
 * What `/partnerships` should show.
 *
 * A partner gets their portal; everyone else gets the sign-up steps. The one rule that matters is
 * never to route while the answer is still unknown — doing that is what sent returning partners
 * back through sign-up.
 */
export default function PartnershipsEntry() {
  const { address, isViewingOther } = usePartnerAddress();
  const { status } = usePartnerStatus(address);

  // Support looking at someone else's figures is never redirected into sign-up.
  if (isViewingOther) return <Overview />;

  if (status === "no-wallet") return <Redirect to="/partnerships/start" />;

  if (status === "resolving") {
    return (
      <AppPageLayout>
        <div className="py-64 text-center text-13 text-slate-100">
          <Trans>Loading…</Trans>
        </div>
      </AppPageLayout>
    );
  }

  return status === "partner" ? <Overview /> : <Redirect to="/partnerships/start" />;
}
