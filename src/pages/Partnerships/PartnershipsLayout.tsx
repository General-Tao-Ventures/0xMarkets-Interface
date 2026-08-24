import { Trans } from "@lingui/macro";
import { Link, NavLink, Redirect } from "react-router-dom";

import { usePartnerAddress, usePartnerStatus } from "domain/partnerships";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import Button from "components/Button/Button";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";
import PageTitle from "components/PageTitle/PageTitle";

const TABS = [
  { to: "/partnerships", label: <Trans>Overview</Trans>, exact: true },
  { to: "/partnerships/codes", label: <Trans>Codes</Trans> },
  { to: "/partnerships/referrals", label: <Trans>Referrals</Trans> },
  { to: "/partnerships/performance", label: <Trans>Performance</Trans> },
];

export function PartnershipsLayout({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  const { address, isViewingOther } = usePartnerAddress();
  const { status } = usePartnerStatus(address);

  // Deep-linking straight to a tab must resolve the same way /partnerships does. Without this a
  // stranger who lands on /partnerships/codes sees an empty portal instead of the sign-up steps.
  if (!isViewingOther && status === "stranger") return <Redirect to="/partnerships/start" />;

  return (
    <AppPageLayout header={<ChainContentHeader />}>
      <PageTitle isTop title={title} />

      <nav className="flex gap-4 border-b border-slate-700">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            exact={tab.exact}
            className="px-12 py-8 text-13 text-slate-100"
            activeClassName="border-b-2 border-blue-300 text-white"
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {address ? (
        children
      ) : (
        // Not connected: the highest-intent moment to explain the programme, so the empty state is
        // the pitch rather than a dead end.
        <div className="rounded-4 bg-slate-800 p-32 text-center">
          <h2 className="text-24 font-medium">
            <Trans>Introduce traders. Earn on every fee they pay.</Trans>
          </h2>
          <p className="mx-auto mt-12 max-w-[520px] text-14 text-slate-100">
            <Trans>Connect your wallet to see your partner figures — or read how the programme works first.</Trans>
          </p>
          <div className="mt-20 flex flex-wrap justify-center gap-12">
            <Link to="/partnerships/join">
              <Button variant="primary-action">
                <Trans>How it works</Trans>
              </Button>
            </Link>
          </div>
          <p className="mt-16 text-11 text-slate-100">
            <Trans>Viewing someone else? Append ?address=0x… to any partner page.</Trans>
          </p>
        </div>
      )}
    </AppPageLayout>
  );
}
