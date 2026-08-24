import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";

import {
  getRelayRouterCreateOrderStructHash,
  getRelayRouterDomainSeparator,
  getRelayRouterTypedDataHash,
  hashRelayRouterParams,
  type RelayRouterCreateOrderParams,
  type RelayRouterParams,
} from "../relayRouterSigning";

// These four values are produced by src/relay/eip712.ts in the unified-executor relayer, which in
// turn matches BaseRelayRouter/RelayRouter. They are pinned rather than recomputed because a wrong
// encoding still yields a well formed signature — it just recovers to the wrong address, and the
// only symptom is InvalidSignature on chain.
const EXPECTED = {
  domainSeparator: "0xefaaedfe0378fbc9c812c88f909cc394ec5b47e737f92d3f7710356ec19f4e66",
  relayParams: "0xb5754eb9a18f914bf92293e34c4bf38975e1ed325959e8c8a89a7be451e70b81",
  structHash: "0x3cc8d3770467fe83d12a0660558029594718c60a443c9cb01c4a8a8ddeb4b215",
  digest: "0xbe19c5f2446aabf0b9ce282cdbbea2567886af8ac7ac6ecd502d266c5b7f92b8",
} as const;

const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ROUTER: Address = "0x2222222222222222222222222222222222222222";

const relayParams: RelayRouterParams = {
  oracleParams: { tokens: [], providers: [], data: [] },
  tokenPermits: [],
  fee: { feeToken: USDC, feeAmount: 2_000_000n },
  userNonce: 0n,
  deadline: 9_999_999_999n,
};

const params: RelayRouterCreateOrderParams = {
  addresses: {
    receiver: "0x1111111111111111111111111111111111111111",
    cancellationReceiver: "0x1111111111111111111111111111111111111111",
    callbackContract: "0x0000000000000000000000000000000000000000",
    uiFeeReceiver: "0x0000000000000000000000000000000000000000",
    market: "0x35ecCBcAb7963Ea442D25aF1c405f8Cea27D8cF7",
    initialCollateralToken: USDC,
    swapPath: [],
  },
  numbers: {
    sizeDeltaUsd: 1000n,
    initialCollateralDeltaAmount: 0n,
    triggerPrice: 0n,
    acceptablePrice: 0n,
    executionFee: 0n,
    callbackGasLimit: 200_000n,
    minOutputAmount: 700n,
    validFromTime: 0n,
  },
  orderType: 3,
  decreasePositionSwapType: 0,
  isLong: true,
  shouldUnwrapNativeToken: false,
  autoCancel: false,
  referralCode: `0x${"00".repeat(32)}` as Hex,
};

const COLLATERAL = 100_000_000_000_000_000n;

describe("relay router signing", () => {
  it("matches the relayer's domain separator", () => {
    expect(getRelayRouterDomainSeparator(8453n, ROUTER)).toBe(EXPECTED.domainSeparator);
  });

  it("matches the relayer's relay params hash", () => {
    expect(hashRelayRouterParams(relayParams)).toBe(EXPECTED.relayParams);
  });

  it("matches the relayer's create order struct hash", () => {
    expect(getRelayRouterCreateOrderStructHash(relayParams, COLLATERAL, params)).toBe(EXPECTED.structHash);
  });

  it("matches the relayer's final digest", () => {
    const structHash = getRelayRouterCreateOrderStructHash(relayParams, COLLATERAL, params);
    const ds = getRelayRouterDomainSeparator(8453n, ROUTER);
    expect(getRelayRouterTypedDataHash(ds, structHash)).toBe(EXPECTED.digest);
  });

  it("changes the digest when the signed fee changes", () => {
    const a = getRelayRouterCreateOrderStructHash(relayParams, COLLATERAL, params);
    const b = getRelayRouterCreateOrderStructHash(
      { ...relayParams, fee: { feeToken: USDC, feeAmount: 3_000_000n } },
      COLLATERAL,
      params
    );
    expect(a).not.toBe(b);
  });

  it("changes the digest when the nonce changes", () => {
    const a = getRelayRouterCreateOrderStructHash(relayParams, COLLATERAL, params);
    const b = getRelayRouterCreateOrderStructHash({ ...relayParams, userNonce: 1n }, COLLATERAL, params);
    expect(a).not.toBe(b);
  });
});
