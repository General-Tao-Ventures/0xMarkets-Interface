import { SOURCE_BASE_MAINNET, BASE_SEPOLIA } from "./chainIds";
import { SettlementChainId, SourceChainId } from "./chains";

function ensureExhaustive<T extends number>(value: Record<T, true>): T[] {
  return Object.keys(value).map(Number) as T[];
}

export const SETTLEMENT_CHAINS: SettlementChainId[] = ensureExhaustive<SettlementChainId>({
  [BASE_SEPOLIA]: true,
});

export const SOURCE_CHAINS: SourceChainId[] = ensureExhaustive<SourceChainId>({
  [SOURCE_BASE_MAINNET]: true,
  [BASE_SEPOLIA]: true,
});

export function isSettlementChain(chainId: number): chainId is SettlementChainId {
  return SETTLEMENT_CHAINS.includes(chainId as SettlementChainId);
}

export function isSourceChain(chainId: number | undefined): chainId is SourceChainId {
  return SOURCE_CHAINS.includes(chainId as SourceChainId);
}
