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

export function isSettlementChain(_chainId: number): _chainId is SettlementChainId {
  // GMX Account / multichain deposit features not used in 0xMarkets
  return false;
}

export function isSourceChain(_chainId: number | undefined): _chainId is SourceChainId {
  // GMX Account / multichain deposit features not used in 0xMarkets
  return false;
}
