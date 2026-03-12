import { geminiRainbowKitConnector } from "@gemini-wallet/rainbow";
import { Chain, getDefaultConfig, WalletList } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  coreWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  safeWallet,
  talismanWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import once from "lodash/once";
import { http } from "viem";
import { base, baseSepolia } from "viem/chains";

import { localhost } from "config/chains";

import binanceWallet from "./connecters/binanceW3W/binanceWallet";

const WALLET_CONNECT_PROJECT_ID = "de24cddbaf2a68f027eae30d9bb5df58";
const APP_NAME = "0xMarkets";

const popularWalletList: WalletList = [
  {
    // Group name with standard name is localized by rainbow kit
    groupName: "Popular",
    wallets: [
      rabbyWallet,
      metaMaskWallet,
      walletConnectWallet,
      // This wallet will automatically hide itself from the list when the fallback is not necessary or if there is no injected wallet available.
      injectedWallet,
      // The Safe option will only appear in the Safe Wallet browser environment.
      safeWallet,
      talismanWallet,
      geminiRainbowKitConnector,
    ],
  },
];

const othersWalletList: WalletList = [
  {
    groupName: "Others",
    wallets: [binanceWallet, coinbaseWallet, trustWallet, coreWallet, okxWallet],
  },
];

export const getRainbowKitConfig = once(() =>
  getDefaultConfig({
    appName: APP_NAME,
    projectId: WALLET_CONNECT_PROJECT_ID,
    chains: [
      base,
      baseSepolia,
      localhost as Chain,
    ],
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http(),
      [localhost.id]: http(),
    },
    wallets: [...popularWalletList, ...othersWalletList],
  })
);
