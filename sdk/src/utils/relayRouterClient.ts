import type { Address, Hex } from "viem";

import type { RelayRouterCreateOrderParams, RelayRouterParams } from "./relayRouterSigning";

// Client for the in-house relayer. Additive: the Gelato transport in
// lib/transactions/sendExpressTransaction is untouched and stays live until the switch.
//
// Every numeric field goes over the wire as a decimal string. JSON has no bigint, and a float
// silently loses precision above 2^53 — which for a fee or a size means signing one number and
// sending another.

export const DEFAULT_RELAY_BASE_PATH = "/api/relay";

export type RelayQuote = {
  feeToken: Address;
  feeAmount: bigint;
  expiresAt: number;
};

export type RelayRejection = {
  code: string;
  detail: string;
  status: number;
};

export class RelayError extends Error {
  readonly rejection: RelayRejection;

  constructor(rejection: RelayRejection) {
    super(`${rejection.code}: ${rejection.detail}`);
    this.name = "RelayError";
    this.rejection = rejection;
  }
}

const dec = (v: bigint): string => v.toString();

export function serializeRelayParams(p: RelayRouterParams) {
  return {
    oracleParams: {
      tokens: p.oracleParams.tokens,
      providers: p.oracleParams.providers,
      data: p.oracleParams.data,
    },
    tokenPermits: p.tokenPermits.map((t) => ({
      owner: t.owner,
      spender: t.spender,
      value: dec(t.value),
      deadline: dec(t.deadline),
      v: t.v,
      r: t.r,
      s: t.s,
      token: t.token,
    })),
    fee: { feeToken: p.fee.feeToken, feeAmount: dec(p.fee.feeAmount) },
    userNonce: dec(p.userNonce),
    deadline: dec(p.deadline),
  };
}

export function serializeCreateOrderParams(p: RelayRouterCreateOrderParams) {
  return {
    addresses: { ...p.addresses },
    numbers: {
      sizeDeltaUsd: dec(p.numbers.sizeDeltaUsd),
      initialCollateralDeltaAmount: dec(p.numbers.initialCollateralDeltaAmount),
      triggerPrice: dec(p.numbers.triggerPrice),
      acceptablePrice: dec(p.numbers.acceptablePrice),
      executionFee: dec(p.numbers.executionFee),
      callbackGasLimit: dec(p.numbers.callbackGasLimit),
      minOutputAmount: dec(p.numbers.minOutputAmount),
      validFromTime: dec(p.numbers.validFromTime),
    },
    orderType: p.orderType,
    decreasePositionSwapType: p.decreasePositionSwapType,
    isLong: p.isLong,
    shouldUnwrapNativeToken: p.shouldUnwrapNativeToken,
    autoCancel: p.autoCancel,
    referralCode: p.referralCode,
  };
}

export function serializeCreateOrderRequest(req: {
  account: Address;
  signature: Hex;
  collateralDeltaAmount: bigint;
  relayParams: RelayRouterParams;
  params: RelayRouterCreateOrderParams;
}) {
  return {
    account: req.account,
    signature: req.signature,
    collateralDeltaAmount: dec(req.collateralDeltaAmount),
    relayParams: serializeRelayParams(req.relayParams),
    params: serializeCreateOrderParams(req.params),
  };
}

async function readError(res: Response): Promise<RelayError> {
  let code = "UNKNOWN";
  let detail = res.statusText;
  try {
    const body = (await res.json()) as { error?: string; detail?: string };
    if (body.error) code = body.error;
    if (body.detail) detail = body.detail;
  } catch {
    // a non-JSON body means a proxy or gateway answered, not the relayer
  }
  return new RelayError({ code, detail, status: res.status });
}

export type RelayClientOptions = {
  basePath?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

const call = async (path: string, init: RequestInit, o: RelayClientOptions): Promise<Response> => {
  const f = o.fetchImpl ?? fetch;
  const res = await f(`${o.basePath ?? DEFAULT_RELAY_BASE_PATH}${path}`, { ...init, signal: o.signal });
  if (!res.ok) throw await readError(res);
  return res;
};

// The signed nonce must match on chain at submission, so read it immediately before signing.
export async function fetchRelayUserNonce(account: Address, o: RelayClientOptions = {}): Promise<bigint> {
  const res = await call(`/nonce/${account}`, { method: "GET" }, o);
  const body = (await res.json()) as { userNonce: string };
  return BigInt(body.userNonce);
}

// The fee is inside the signature and cannot be raised afterwards, so it has to be shown to the
// user before they sign, not derived locally.
export async function fetchRelayQuote(o: RelayClientOptions = {}): Promise<RelayQuote> {
  const res = await call("/quote", { method: "GET" }, o);
  const body = (await res.json()) as { feeToken: Address; feeAmount: string; expiresAt: number };
  return { feeToken: body.feeToken, feeAmount: BigInt(body.feeAmount), expiresAt: body.expiresAt };
}

export async function sendRelayCreateOrder(
  req: Parameters<typeof serializeCreateOrderRequest>[0],
  o: RelayClientOptions = {}
): Promise<Hex> {
  const res = await call(
    "/order",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(serializeCreateOrderRequest(req)),
    },
    o
  );
  const body = (await res.json()) as { txHash: Hex };
  return body.txHash;
}

// The relayer overwrites params.numbers.executionFee with its own funded amount, but the field is
// still covered by the signature. Signing a fixed zero keeps the frontend from having to predict a
// number it does not control.
export const SIGNED_EXECUTION_FEE = 0n;
