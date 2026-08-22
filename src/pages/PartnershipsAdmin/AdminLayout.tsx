import { Trans } from "@lingui/macro";
import { NavLink } from "react-router-dom";

import { useIsPartnerAdmin } from "domain/partnerships/admin";
import PageNotFound from "pages/PageNotFound/PageNotFound";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";

const TABS = [
  { to: "/partnerships-admin", label: <Trans>Partners</Trans>, exact: true },
  { to: "/partnerships-admin/referrals", label: <Trans>Referrals</Trans> },
  { to: "/partnerships-admin/grants", label: <Trans>Tier grants</Trans> },
  { to: "/partnerships-admin/economics", label: <Trans>Tier economics</Trans> },
  { to: "/partnerships-admin/risk", label: <Trans>Risk</Trans> },
];

/**
 * Internal console. Nothing here is ever shown to a partner.
 *
 * A wallet not on the allowlist gets the ordinary 404, not an "access denied" — there is no reason
 * to confirm the console exists to someone who cannot use it.
 */
export function AdminLayout({
  title,
  lede,
  children,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { isAdmin, isConfigured } = useIsPartnerAdmin();

  if (!isAdmin) return <PageNotFound />;

  return (
    <AppPageLayout>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-16 pb-32">
        <div className="flex flex-wrap items-center gap-8 rounded-4 bg-yellow-500/10 px-12 py-8 text-12 text-yellow-500">
          <span className="font-medium">
            <Trans>INTERNAL — ADMIN</Trans>
          </span>
          <span className="text-slate-100">
            <Trans>Not part of the partner product. Revenue splits assume the programme fee model.</Trans>
          </span>
          {!isConfigured && (
            <span className="ml-auto">
              <Trans>No allowlist configured</Trans>
            </span>
          )}
        </div>

        <nav className="flex flex-wrap gap-4 border-b border-slate-700">
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

        <div>
          <h1 className="text-24 font-medium">{title}</h1>
          {lede ? <p className="mt-4 max-w-[80ch] text-13 text-slate-100">{lede}</p> : null}
        </div>

        {children}
      </div>
    </AppPageLayout>
  );
}
