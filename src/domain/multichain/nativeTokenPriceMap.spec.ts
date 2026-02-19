import { describe, it, expect } from "vitest";

import { SETTLEMENT_CHAINS, SOURCE_CHAINS } from "config/multichain";
import {
  BASE_SEPOLIA,
  getChainName,
  SOURCE_BASE_MAINNET,
  SourceChainId,
} from "sdk/configs/chains";
import { getNativeToken } from "sdk/configs/tokens";

import { areChainsRelated } from "./areChainsRelated";
import { NATIVE_TOKEN_PRICE_MAP } from "./nativeTokenPriceMap";

const SOURCE_CHAIN_NATIVE_SYMBOL_MAP: Record<SourceChainId, string> = {
  [SOURCE_BASE_MAINNET]: "ETH",
  [BASE_SEPOLIA]: "ETH",
};

describe("NATIVE_TOKEN_PRICE_MAP", () => {
  it("should be defined", () => {
    for (const srcChainId of SOURCE_CHAINS) {
      for (const settlementChainId of SETTLEMENT_CHAINS) {
        if (!areChainsRelated(settlementChainId, srcChainId)) {
          continue;
        }

        const srcChainNativeSymbol = SOURCE_CHAIN_NATIVE_SYMBOL_MAP[srcChainId];
        const settlementChainNativeSymbol = getNativeToken(settlementChainId).symbol;

        if (srcChainNativeSymbol === settlementChainNativeSymbol) {
          continue;
        }

        expect(
          NATIVE_TOKEN_PRICE_MAP[srcChainId]?.[settlementChainId],
          `Native token price map is not defined for ${getChainName(srcChainId)} -> ${getChainName(settlementChainId)}`
        ).toBeDefined();
      }
    }
  });
});
