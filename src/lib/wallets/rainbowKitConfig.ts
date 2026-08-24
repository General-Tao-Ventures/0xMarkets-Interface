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
import { base } from "viem/chains";

import { FORK_RPC_URL, localhost } from "config/chains";
import { isLocal } from "config/env";

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
    chains: isLocal() ? [base, localhost as Chain] : [base],
    // With VITE_FORK_RPC_URL set, wagmi's public client for Base must read the local anvil
    // fork too, otherwise usePublicClient() silently reads real mainnet state.
    transports: isLocal()
      ? {
          [base.id]: FORK_RPC_URL ? http(FORK_RPC_URL) : http(),
          [localhost.id]: http(),
        }
      : {
          [base.id]: FORK_RPC_URL ? http(FORK_RPC_URL) : http(),
        },
    wallets: [...popularWalletList, ...othersWalletList],
  })
);
