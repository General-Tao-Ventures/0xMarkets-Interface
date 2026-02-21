import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

const isLocalhost = typeof self !== "undefined" && self.location?.host?.includes("localhost");

const BASE_SEPOLIA_KEEPER_URL = isLocalhost ? "http://142.93.203.222:37017" : "/api/keeper";

const ORACLE_KEEPER_URLS: Record<ContractsChainId, string> = {
  [BASE_SEPOLIA]: BASE_SEPOLIA_KEEPER_URL,
  [LOCALHOST]: "http://127.0.0.1:37017",
};

const ORACLE_KEEPER_FALLBACK_URLS: Record<ContractsChainId, string[]> = {
  [BASE_SEPOLIA]: [BASE_SEPOLIA_KEEPER_URL],
  [LOCALHOST]: ["http://127.0.0.1:37017"],
};

export function getOracleKeeperUrl(chainId: number) {
  if (!ORACLE_KEEPER_URLS[chainId]) {
    throw new Error(`No oracle keeper url for chain ${chainId}`);
  }

  return ORACLE_KEEPER_URLS[chainId];
}

export function getOracleKeeperFallbackUrls(chainId: number) {
  if (!ORACLE_KEEPER_FALLBACK_URLS[chainId]) {
    throw new Error(`No oracle keeper fallback urls for chain ${chainId}`);
  }

  return ORACLE_KEEPER_FALLBACK_URLS[chainId];
}
