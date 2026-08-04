import { defineChain } from "viem";
import { base, Chain, baseSepolia, localhost as viemLocalhost } from "viem/chains";

import type { GasLimitsConfig } from "types/fees";

import { SOURCE_BASE_MAINNET, BASE_MAINNET, BASE_SEPOLIA, LOCALHOST } from "./chainIds";
export { SOURCE_BASE_MAINNET, BASE_MAINNET, BASE_SEPOLIA, LOCALHOST };

export const CONTRACTS_CHAIN_IDS: ContractsChainId[] = [BASE_MAINNET];
export const CONTRACTS_CHAIN_IDS_DEV: ContractsChainId[] = [BASE_MAINNET, BASE_SEPOLIA, LOCALHOST];

export type ContractsChainId = typeof BASE_MAINNET | typeof BASE_SEPOLIA | typeof LOCALHOST;

export type SettlementChainId = typeof BASE_MAINNET | typeof BASE_SEPOLIA;
export type SourceChainId = typeof SOURCE_BASE_MAINNET | typeof BASE_SEPOLIA;
export type AnyChainId = ContractsChainId | SettlementChainId | SourceChainId;

export type ChainName = "Base" | "Base Sepolia" | "Localhost";

export const CHAIN_NAMES_MAP: Record<AnyChainId, ChainName> = {
  [SOURCE_BASE_MAINNET]: "Base",
  [BASE_SEPOLIA]: "Base Sepolia",
  [LOCALHOST]: "Localhost",
};

export const HIGH_EXECUTION_FEES_MAP: Record<ContractsChainId, number> = {
  [BASE_MAINNET]: 5, // 5 USD
  [BASE_SEPOLIA]: 5, // 5 USD
  [LOCALHOST]: 5, // 5 USD
};

export const MAX_FEE_PER_GAS_MAP: Record<number, bigint> = {};

export const GAS_PRICE_PREMIUM_MAP: Record<number, bigint> = {};

export const MAX_PRIORITY_FEE_PER_GAS_MAP: Record<ContractsChainId, bigint | undefined> = {
  [BASE_MAINNET]: 1500000000n,
  [BASE_SEPOLIA]: 1500000000n,
  [LOCALHOST]: 1500000000n,
};

export const EXCESSIVE_EXECUTION_FEES_MAP: Partial<Record<ContractsChainId, number>> = {
  [BASE_MAINNET]: 10, // 10 USD
  [BASE_SEPOLIA]: 10, // 10 USD
  [LOCALHOST]: 10, // 10 USD
};

export const MIN_EXECUTION_FEE_USD: Partial<Record<ContractsChainId, bigint | undefined>> = {
  [BASE_MAINNET]: 1000000000000000000000000000n, // 1e27 $0.001
  [BASE_SEPOLIA]: 1000000000000000000000000000n, // 1e27 $0.001
};

export const GAS_PRICE_BUFFER_MAP: Record<number, bigint> = {};

export const localhost: Chain = defineChain({
  id: LOCALHOST,
  name: "Localhost",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  contracts: {
    multicall3: {
      address: "0xCD8a1C3ba11CF5ECfa6267617243239504a98d90",
    },
  },
});

const VIEM_CHAIN_BY_CHAIN_ID: Record<AnyChainId, Chain> = {
  [SOURCE_BASE_MAINNET]: base,
  [BASE_SEPOLIA]: baseSepolia,
  [LOCALHOST]: localhost,
};

export function getChainName(chainId: number): ChainName {
  return CHAIN_NAMES_MAP[chainId];
}

export const getViemChain = (chainId: number): Chain => {
  return VIEM_CHAIN_BY_CHAIN_ID[chainId];
};

export function getHighExecutionFee(chainId: number) {
  return HIGH_EXECUTION_FEES_MAP[chainId] ?? 5;
}

export function getExcessiveExecutionFee(chainId: number) {
  return EXCESSIVE_EXECUTION_FEES_MAP[chainId] ?? 10;
}

export function isContractsChain(chainId: number, dev = false): chainId is ContractsChainId {
  return (dev ? CONTRACTS_CHAIN_IDS_DEV : CONTRACTS_CHAIN_IDS).includes(chainId as ContractsChainId);
}

export function isTestnetChain(chainId: number): boolean {
  return [BASE_SEPOLIA, LOCALHOST].includes(chainId);
}

export const EXECUTION_FEE_CONFIG_V2: {
  [chainId in ContractsChainId]: {
    shouldUseMaxPriorityFeePerGas: boolean;
    defaultBufferBps?: number;
  };
} = {
  [BASE_MAINNET]: {
    shouldUseMaxPriorityFeePerGas: false,
    defaultBufferBps: 1000, // 10%
  },
  [BASE_SEPOLIA]: {
    shouldUseMaxPriorityFeePerGas: false,
    defaultBufferBps: 1000, // 10%
  },
  [LOCALHOST]: {
    shouldUseMaxPriorityFeePerGas: false,
    defaultBufferBps: 1000, // 10%
  },
};

type StaticGasLimitsConfig = Pick<
  GasLimitsConfig,
  | "createOrderGasLimit"
  | "updateOrderGasLimit"
  | "cancelOrderGasLimit"
  | "tokenPermitGasLimit"
  | "gmxAccountCollateralGasLimit"
>;

export const GAS_LIMITS_STATIC_CONFIG: Record<ContractsChainId, StaticGasLimitsConfig> = {
  [BASE_MAINNET]: {
    createOrderGasLimit: 1_000_000n,
    updateOrderGasLimit: 800_000n,
    cancelOrderGasLimit: 700_000n,
    tokenPermitGasLimit: 90_000n,
    gmxAccountCollateralGasLimit: 0n,
  },
  [BASE_SEPOLIA]: {
    createOrderGasLimit: 1_000_000n,
    updateOrderGasLimit: 800_000n,
    cancelOrderGasLimit: 700_000n,
    tokenPermitGasLimit: 90_000n,
    gmxAccountCollateralGasLimit: 0n,
  },
  [LOCALHOST]: {
    createOrderGasLimit: 1_000_000n,
    updateOrderGasLimit: 800_000n,
    cancelOrderGasLimit: 700_000n,
    tokenPermitGasLimit: 90_000n,
    gmxAccountCollateralGasLimit: 0n,
  },
};
