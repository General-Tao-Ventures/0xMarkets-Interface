import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";

import {
  RelayError,
  fetchRelayQuote,
  fetchRelayUserNonce,
  sendRelayCreateOrder,
  serializeCreateOrderRequest,
  SIGNED_EXECUTION_FEE,
} from "../relayRouterClient";
import type { RelayRouterCreateOrderParams, RelayRouterParams } from "../relayRouterSigning";

const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USER: Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const relayParams: RelayRouterParams = {
  oracleParams: { tokens: [], providers: [], data: [] },
  tokenPermits: [
    {
      owner: USER,
      spender: "0x3333333333333333333333333333333333333333",
      value: 2_000_000n,
      deadline: 9_999_999_999n,
      v: 27,
      r: `0x${"11".repeat(32)}` as Hex,
      s: `0x${"22".repeat(32)}` as Hex,
      token: USDC,
    },
  ],
  fee: { feeToken: USDC, feeAmount: 9_007_199_254_740_993n },
  userNonce: 0n,
  deadline: 9_999_999_999n,
};

const params: RelayRouterCreateOrderParams = {
  addresses: {
    receiver: USER,
    cancellationReceiver: USER,
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
    executionFee: SIGNED_EXECUTION_FEE,
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

const request = {
  account: USER,
  signature: `0x${"11".repeat(65)}` as Hex,
  collateralDeltaAmount: 100_000_000_000_000_000n,
  relayParams,
  params,
};

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "stub",
      json: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("relay router client", () => {
  it("sends every numeric field as a decimal string", () => {
    const body = serializeCreateOrderRequest(request);
    expect(body.collateralDeltaAmount).toBe("100000000000000000");
    expect(body.relayParams.fee.feeAmount).toBe("9007199254740993");
    expect(body.relayParams.userNonce).toBe("0");
    expect(body.params.numbers.sizeDeltaUsd).toBe("1000");
    expect(body.relayParams.tokenPermits[0].value).toBe("2000000");
  });

  it("survives a round trip above 2^53 that a float would round", () => {
    const body = serializeCreateOrderRequest(request);
    expect(BigInt(body.relayParams.fee.feeAmount)).toBe(relayParams.fee.feeAmount);
    // Going through a float instead loses the low bit, which is the whole reason for the strings.
    expect(BigInt(Number(body.relayParams.fee.feeAmount))).not.toBe(relayParams.fee.feeAmount);
  });

  it("keeps v as a number, since the relayer expects a byte not a string", () => {
    const body = serializeCreateOrderRequest(request);
    expect(body.relayParams.tokenPermits[0].v).toBe(27);
  });

  it("signs a zero execution fee, since the relayer sets its own", () => {
    expect(SIGNED_EXECUTION_FEE).toBe(0n);
    expect(serializeCreateOrderRequest(request).params.numbers.executionFee).toBe("0");
  });

  it("parses the nonce as a bigint", async () => {
    const { impl } = stubFetch(200, { userNonce: "9007199254740993" });
    expect(await fetchRelayUserNonce(USER, { fetchImpl: impl })).toBe(9_007_199_254_740_993n);
  });

  it("parses the quote fee as a bigint", async () => {
    const { impl } = stubFetch(200, { feeToken: USDC, feeAmount: "1500000", expiresAt: 1 });
    expect((await fetchRelayQuote({ fetchImpl: impl })).feeAmount).toBe(1_500_000n);
  });

  it("returns the tx hash on success", async () => {
    const { impl, calls } = stubFetch(200, { txHash: "0xdead" });
    expect(await sendRelayCreateOrder(request, { fetchImpl: impl })).toBe("0xdead");
    expect(calls[0].url).toBe("/api/relay/order");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("surfaces the relayer's rejection code and status", async () => {
    const { impl } = stubFetch(409, { error: "NONCE_MISMATCH", detail: "on chain 3, signed 2" });
    await expect(sendRelayCreateOrder(request, { fetchImpl: impl })).rejects.toMatchObject({
      rejection: { code: "NONCE_MISMATCH", status: 409 },
    });
  });

  it("still throws a RelayError when a gateway answers with non json", async () => {
    const impl = (async () =>
      ({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => {
          throw new Error("not json");
        },
      }) as unknown as Response) as unknown as typeof fetch;
    await expect(sendRelayCreateOrder(request, { fetchImpl: impl })).rejects.toBeInstanceOf(RelayError);
  });

  it("honours a custom base path", async () => {
    const { impl, calls } = stubFetch(200, { txHash: "0x1" });
    await sendRelayCreateOrder(request, { fetchImpl: impl, basePath: "https://relay.example" });
    expect(calls[0].url).toBe("https://relay.example/order");
  });
});
