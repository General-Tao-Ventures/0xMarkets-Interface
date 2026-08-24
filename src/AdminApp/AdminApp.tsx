import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useEffect } from "react";
import { HashRouter as Router, Redirect, Route, Switch } from "react-router-dom";
import { SWRConfig } from "swr";

import { LANGUAGE_LOCALSTORAGE_KEY } from "config/localStorage";
import { ChainContextProvider } from "context/ChainContext/ChainContext";
import { GlobalStateProvider } from "context/GlobalContext/GlobalContextProvider";
import { GmxAccountContextProvider } from "context/GmxAccountContext/GmxAccountContext";
import { PendingTxnsContextProvider } from "context/PendingTxnsContext/PendingTxnsContext";
import { SettingsContextProvider } from "context/SettingsContext/SettingsContextProvider";
import { ThemeProvider } from "context/ThemeContext/ThemeContext";
import { defaultLocale, dynamicActivate } from "lib/i18n";
import { RainbowKitProviderWrapper } from "lib/wallets/WalletProvider";

import { SWRConfigProp } from "App/swrConfig";
import AdminEconomics from "pages/PartnershipsAdmin/Economics";
import AdminGrants from "pages/PartnershipsAdmin/Grants";
import AdminPartners from "pages/PartnershipsAdmin/Partners";
import AdminReferrals from "pages/PartnershipsAdmin/Referrals";
import AdminRisk from "pages/PartnershipsAdmin/Risk";

/**
 * The partnerships admin console, as its own application.
 *
 * Deliberately not a route inside the trading app: nothing here is ever served to a partner or a
 * trader, it deploys separately, and keeping it apart means the trading bundle cannot expose it.
 * It reuses the trading app's design system and wallet stack so it still looks like 0xMarkets.
 *
 * The provider stack is the trading app's minus everything to do with trading — no positions, no
 * order events, no websocket feed, no subaccounts. What remains is what the console actually reads:
 * chain, wallet, settings, translations and SWR.
 */
export function AdminApp() {
  useEffect(() => {
    dynamicActivate(localStorage.getItem(LANGUAGE_LOCALSTORAGE_KEY) || defaultLocale);
  }, []);

  let app = (
    <Switch>
      <Route exact path="/referrals">
        <AdminReferrals />
      </Route>
      <Route exact path="/grants">
        <AdminGrants />
      </Route>
      <Route exact path="/economics">
        <AdminEconomics />
      </Route>
      <Route exact path="/risk">
        <AdminRisk />
      </Route>
      <Route exact path="/">
        <AdminPartners />
      </Route>
      <Redirect to="/" />
    </Switch>
  );

  app = <RainbowKitProviderWrapper>{app}</RainbowKitProviderWrapper>;
  app = <I18nProvider i18n={i18n as any}>{app}</I18nProvider>;
  app = <PendingTxnsContextProvider>{app}</PendingTxnsContextProvider>;
  app = <SWRConfig value={SWRConfigProp}>{app}</SWRConfig>;
  app = <SettingsContextProvider>{app}</SettingsContextProvider>;
  app = <GlobalStateProvider>{app}</GlobalStateProvider>;
  // ChainContext reads the settlement chain from GmxAccountContext, so it must sit inside it.
  app = <ChainContextProvider>{app}</ChainContextProvider>;
  app = <GmxAccountContextProvider>{app}</GmxAccountContextProvider>;
  app = <ThemeProvider>{app}</ThemeProvider>;
  app = <Router>{app}</Router>;

  return app;
}

export default AdminApp;
