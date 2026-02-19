import { base, baseSepolia } from "viem/chains";

import {
  AnyChainId,
  BASE_SEPOLIA,
  LOCALHOST,
  getExplorerUrl,
  SOURCE_BASE_MAINNET,
} from "config/chains";

export const CHAIN_ID_TO_TX_URL_BUILDER: Record<
  AnyChainId | "layerzero" | "layerzero-testnet",
  (txId: string) => string
> = {
  [SOURCE_BASE_MAINNET]: (txId: string) => `${getExplorerUrl(SOURCE_BASE_MAINNET)}tx/${txId}`,
  [BASE_SEPOLIA]: (txId: string) => `${getExplorerUrl(BASE_SEPOLIA)}tx/${txId}`,
  [LOCALHOST]: (txId: string) => `${getExplorerUrl(LOCALHOST)}tx/${txId}`,
  layerzero: (txId: string) => `${getExplorerUrl("layerzero")}tx/${txId}`,
  "layerzero-testnet": (txId: string) => `${getExplorerUrl("layerzero-testnet")}tx/${txId}`,
};

export const CHAIN_ID_TO_EXPLORER_NAME: Record<AnyChainId, string> = {
  [SOURCE_BASE_MAINNET]: base.blockExplorers.default.name,
  [BASE_SEPOLIA]: baseSepolia.blockExplorers.default.name,
  [LOCALHOST]: "Localhost",
};
