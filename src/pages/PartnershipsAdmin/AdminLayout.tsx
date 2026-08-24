import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Trans } from "@lingui/macro";
import { NavLink } from "react-router-dom";

import { useIsPartnerAdmin } from "domain/partnerships/admin";
import useWallet from "lib/wallets/useWallet";

import { AddressDropdown } from "components/AddressDropdown/AddressDropdown";
import ConnectWalletButton from "components/ConnectWalletButton/ConnectWalletButton";

import LogoText from "img/logo-text.svg?react";
import logoIcon from "img/logo_0xMarkets.svg";

const TABS = [
  { to: "/", label: <Trans>Partners</Trans>, exact: true },
  { to: "/referrals", label: <Trans>Referrals</Trans> },
  { to: "/grants", label: <Trans>Tier grants</Trans> },
  { to: "/economics", label: <Trans>Tier economics</Trans> },
  { to: "/risk", label: <Trans>Risk</Trans> },
];

/**
 * Chrome for the standalone console.
 *
 * The trading app's AppPageLayout is deliberately not reused: it brings the market sidebar, the
 * beta banner and a footer full of trader links, none of which belong in an internal tool. This is
 * the same design language — same palette, same logo, same wallet control — with only the parts an
 * operator needs.
 *
 * A wallet not on the allowlist gets a flat "not found", not "access denied": there is no reason to
 * confirm the console exists to someone who cannot use it.
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
  const { isAdmin, isConfigured, account } = useIsPartnerAdmin();
  const { openConnectModal } = useConnectModal();

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-16 px-16 py-12">
          {/* LogoText already carries the wordmark, so the mark itself is decorative. */}
          <span className="flex shrink-0 items-center gap-5 text-typography-primary">
            <img src={logoIcon} alt="" aria-hidden className="h-24 w-24" />
            <LogoText />
          </span>
          <span className="rounded-full bg-yellow-500/15 px-10 py-4 text-11 text-yellow-500">
            <Trans>Partnerships admin</Trans>
          </span>

          {isAdmin && (
            <nav className="order-3 flex w-full flex-wrap gap-2 lg:order-none lg:w-auto">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  exact={tab.exact}
                  className="rounded-4 px-12 py-6 text-13 text-slate-100 hover:text-white"
                  activeClassName="bg-slate-700 text-white"
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto">
            {account ? (
              <AddressDropdown account={account} />
            ) : (
              <ConnectWalletButton onClick={() => openConnectModal?.()}>
                <Trans>Connect Wallet</Trans>
              </ConnectWalletButton>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1500px] grow flex-col gap-16 px-16 py-20">
        {!isAdmin ? (
          <NotAuthorised isConfigured={isConfigured} connected={Boolean(account)} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-8 rounded-4 bg-yellow-500/10 px-12 py-8 text-12 text-yellow-500">
              <span className="font-medium">
                <Trans>INTERNAL</Trans>
              </span>
              <span className="text-slate-100">
                <Trans>Not part of the partner product. Revenue splits assume the programme fee model.</Trans>
              </span>
            </div>

            <div>
              <h1 className="text-24 font-medium">{title}</h1>
              {lede ? <p className="mt-4 max-w-[80ch] text-13 text-slate-100">{lede}</p> : null}
            </div>

            {children}
          </>
        )}
      </main>

      <footer className="border-t border-slate-700 px-16 py-12 text-11 text-slate-100">
        <div className="mx-auto w-full max-w-[1500px]">
          <Trans>0xMarkets partnerships admin · internal use only</Trans>
        </div>
      </footer>
    </div>
  );
}

function NotAuthorised({ isConfigured, connected }: { isConfigured: boolean; connected: boolean }) {
  return (
    <div className="mx-auto max-w-[52ch] py-64 text-center">
      <h1 className="text-24 font-medium">
        <Trans>Not found</Trans>
      </h1>
      <p className="mt-8 text-13 text-slate-100">
        {!connected ? (
          <Trans>Connect the wallet you administer the partnerships programme with.</Trans>
        ) : (
          <Trans>This wallet cannot open the console.</Trans>
        )}
      </p>
      {!isConfigured && (
        <p className="mt-16 text-11 text-yellow-500">
          <Trans>
            No admin allowlist is configured on this deployment, so nobody can get in. Set VITE_PARTNER_ADMIN_ADDRESSES.
          </Trans>
        </p>
      )}
    </div>
  );
}
