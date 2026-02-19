import { SettlementChainId, SourceChainId } from "config/static/chains";

// On Base, source and settlement chains both use ETH as native token,
// so no cross-chain native token price mapping is needed.
export const NATIVE_TOKEN_PRICE_MAP: Partial<Record<SourceChainId, Partial<Record<SettlementChainId, string>>>> = {};
