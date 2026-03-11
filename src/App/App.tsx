import "@wagmi/connectors";
import "lib/plausible";

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useEffect } from "react";
import { HashRouter as Router } from "react-router-dom";
import { SWRConfig } from "swr";

import "react-toastify/dist/ReactToastify.css";
import "styles/Font.css";
import "styles/Input.css";
import "styles/Shared.scss";
import "styles/recharts.css";
import "styles/DeprecatedExchageStyles.scss";
import "components/Card/Card.css";
import "./App.scss";

import { LANGUAGE_LOCALSTORAGE_KEY } from "config/localStorage";
import { ChainContextProvider } from "context/ChainContext/ChainContext";
import { GlobalStateProvider } from "context/GlobalContext/GlobalContextProvider";
import { GmxAccountContextProvider } from "context/GmxAccountContext/GmxAccountContext";
import { PendingTxnsContextProvider } from "context/PendingTxnsContext/PendingTxnsContext";
import { SettingsContextProvider } from "context/SettingsContext/SettingsContextProvider";
import { SorterContextProvider } from "context/SorterContext/SorterContextProvider";
import { SubaccountContextProvider } from "context/SubaccountContext/SubaccountContextProvider";
import { SyntheticsEventsProvider } from "context/SyntheticsEvents";
import { ThemeProvider } from "context/ThemeContext/ThemeContext";
import { TokenPermitsContextProvider } from "context/TokenPermitsContext/TokenPermitsContextProvider";
import { TokensBalancesContextProvider } from "context/TokensBalancesContext/TokensBalancesContextProvider";
import { TokensFavoritesContextProvider } from "context/TokensFavoritesContext/TokensFavoritesContextProvider";
import { WebsocketContextProvider } from "context/WebsocketContext/WebsocketContextProvider";
import { useChainId } from "lib/chains";
import { defaultLocale, dynamicActivate } from "lib/i18n";
import { RainbowKitProviderWrapper } from "lib/wallets/WalletProvider";

import { KeeperStatusBanner } from "components/KeeperStatusBanner/KeeperStatusBanner";
import SEO from "components/Seo/SEO";

import { AppRoutes } from "./AppRoutes";
import { SWRConfigProp } from "./swrConfig";

// @ts-ignore
if (window?.ethereum?.autoRefreshOnNetworkChange) {
  // @ts-ignore
  window.ethereum.autoRefreshOnNetworkChange = false;
}

function SWRConfigWithKey({ children }: { children: React.ReactNode }) {
  const { chainId } = useChainId();
  return (
    <SWRConfig key={chainId} value={SWRConfigProp}>
      {children}
    </SWRConfig>
  );
}

function App() {
  useEffect(() => {
    const defaultLanguage = localStorage.getItem(LANGUAGE_LOCALSTORAGE_KEY) || defaultLocale;
    dynamicActivate(defaultLanguage);
  }, []);

  let app = (
    <>
      <div className="bg-yellow-500/20 text-center text-16 font-normal text-yellow-300 py-12 px-16 flex items-center justify-center gap-12 flex-wrap">
        <span>
          You are using the testnet environment. Funds are not real. Please report any issues/bugs in{" "}
          <a href="https://discord.gg/d87vC7uaNx" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
            Discord
          </a>
          .
        </span>
        <a
          href="https://faucet.0xMarkets.io"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-2 text-lg font-medium text-white rounded-md bg-gradient-to-r from-[#023c68] via-[#05666f] to-[#09837b] shadow-md hover:opacity-90 transition-all duration-300 hover:translate-y-[-2px]"
        >
          Launch Testnet
        </a>
      </div>
      <KeeperStatusBanner />
      <AppRoutes />
    </>
  );
  app = <SorterContextProvider>{app}</SorterContextProvider>;
  app = <TokensFavoritesContextProvider>{app}</TokensFavoritesContextProvider>;
  app = <SyntheticsEventsProvider>{app}</SyntheticsEventsProvider>;
  app = <SubaccountContextProvider>{app}</SubaccountContextProvider>;
  app = <TokenPermitsContextProvider>{app}</TokenPermitsContextProvider>;
  app = <TokensBalancesContextProvider>{app}</TokensBalancesContextProvider>;
  app = <WebsocketContextProvider>{app}</WebsocketContextProvider>;
  app = <SEO>{app}</SEO>;
  app = <RainbowKitProviderWrapper>{app}</RainbowKitProviderWrapper>;
  app = <I18nProvider i18n={i18n as any}>{app}</I18nProvider>;
  app = <PendingTxnsContextProvider>{app}</PendingTxnsContextProvider>;
  app = <SWRConfigWithKey>{app}</SWRConfigWithKey>;
  app = <SettingsContextProvider>{app}</SettingsContextProvider>;
  app = <GlobalStateProvider>{app}</GlobalStateProvider>;
  app = <ChainContextProvider>{app}</ChainContextProvider>;
  app = <GmxAccountContextProvider>{app}</GmxAccountContextProvider>;
  app = <ThemeProvider>{app}</ThemeProvider>;
  app = <Router>{app}</Router>;

  return app;
}

export default App;
