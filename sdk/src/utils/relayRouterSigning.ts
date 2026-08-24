import { concat, encodeAbiParameters, keccak256, parseAbiParameters, toHex } from "viem";
import type { Address, Hex } from "viem";

// Signing for RelayRouter, the in-house relay path. Distinct from the Gelato helpers in
// domain/synthetics/express: the domain name differs, and the relay params carry five members
// instead of six, with externalCalls and feeSwapPath removed.
//
// The digests here must match src/relay/eip712.ts in the unified-executor relayer byte for byte.
// A mismatch is not a visible failure: the signature stays well formed and simply recovers to the
// wrong address, surfacing only as InvalidSignature on chain.

export const RELAY_ROUTER_DOMAIN_NAME = "GmxBaseRelayRouter";
export const RELAY_ROUTER_DOMAIN_VERSION = "1";

const DOMAIN_TYPEHASH_STRING =
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

const CREATE_ORDER_TYPEHASH_STRING =
  "CreateOrder(uint256 collateralDeltaAmount,CreateOrderAddresses addresses,CreateOrderNumbers numbers,uint256 orderType,uint256 decreasePositionSwapType,bool isLong,bool shouldUnwrapNativeToken,bool autoCancel,bytes32 referralCode,bytes32 relayParams)CreateOrderAddresses(address receiver,address cancellationReceiver,address callbackContract,address uiFeeReceiver,address market,address initialCollateralToken,address[] swapPath)CreateOrderNumbers(uint256 sizeDeltaUsd,uint256 initialCollateralDeltaAmount,uint256 triggerPrice,uint256 acceptablePrice,uint256 executionFee,uint256 callbackGasLimit,uint256 minOutputAmount,uint256 validFromTime)";

const CREATE_ORDER_ADDRESSES_TYPEHASH_STRING =
  "CreateOrderAddresses(address receiver,address cancellationReceiver,address callbackContract,address uiFeeReceiver,address market,address initialCollateralToken,address[] swapPath)";

const CREATE_ORDER_NUMBERS_TYPEHASH_STRING =
  "CreateOrderNumbers(uint256 sizeDeltaUsd,uint256 initialCollateralDeltaAmount,uint256 triggerPrice,uint256 acceptablePrice,uint256 executionFee,uint256 callbackGasLimit,uint256 minOutputAmount,uint256 validFromTime)";

const th = (s: string) => keccak256(toHex(s));

export type RelayRouterTokenPermit = {
  owner: Address;
  spender: Address;
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
  token: Address;
};

export type RelayRouterParams = {
  oracleParams: { tokens: Address[]; providers: Address[]; data: Hex[] };
  tokenPermits: RelayRouterTokenPermit[];
  fee: { feeToken: Address; feeAmount: bigint };
  userNonce: bigint;
  deadline: bigint;
};

export type RelayRouterCreateOrderParams = {
  addresses: {
    receiver: Address;
    cancellationReceiver: Address;
    callbackContract: Address;
    uiFeeReceiver: Address;
    market: Address;
    initialCollateralToken: Address;
    swapPath: Address[];
  };
  numbers: {
    sizeDeltaUsd: bigint;
    initialCollateralDeltaAmount: bigint;
    triggerPrice: bigint;
    acceptablePrice: bigint;
    executionFee: bigint;
    callbackGasLimit: bigint;
    minOutputAmount: bigint;
    validFromTime: bigint;
  };
  orderType: number;
  decreasePositionSwapType: number;
  isLong: boolean;
  shouldUnwrapNativeToken: boolean;
  autoCancel: boolean;
  referralCode: Hex;
};

export function getRelayRouterDomainSeparator(chainId: bigint, verifyingContract: Address): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, bytes32, bytes32, uint256, address"), [
      th(DOMAIN_TYPEHASH_STRING),
      th(RELAY_ROUTER_DOMAIN_NAME),
      th(RELAY_ROUTER_DOMAIN_VERSION),
      chainId,
      verifyingContract,
    ])
  );
}

// Five separate members, not a wrapping tuple: an outer tuple around dynamic members prepends an
// offset word and changes the hash.
export function hashRelayRouterParams(p: RelayRouterParams): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        [
          "(address[] tokens, address[] providers, bytes[] data),",
          "(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s, address token)[],",
          "(address feeToken, uint256 feeAmount), uint256, uint256",
        ].join(" ")
      ),
      [p.oracleParams, p.tokenPermits, p.fee, p.userNonce, p.deadline] as never
    )
  );
}

function hashAddresses(a: RelayRouterCreateOrderParams["addresses"]): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, address, address, address, address, address, address, bytes32"),
      [
        th(CREATE_ORDER_ADDRESSES_TYPEHASH_STRING),
        a.receiver,
        a.cancellationReceiver,
        a.callbackContract,
        a.uiFeeReceiver,
        a.market,
        a.initialCollateralToken,
        keccak256(a.swapPath.length === 0 ? "0x" : concat(a.swapPath as Hex[])),
      ]
    )
  );
}

function hashNumbers(n: RelayRouterCreateOrderParams["numbers"]): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256"),
      [
        th(CREATE_ORDER_NUMBERS_TYPEHASH_STRING),
        n.sizeDeltaUsd,
        n.initialCollateralDeltaAmount,
        n.triggerPrice,
        n.acceptablePrice,
        n.executionFee,
        n.callbackGasLimit,
        n.minOutputAmount,
        n.validFromTime,
      ]
    )
  );
}

export function getRelayRouterCreateOrderStructHash(
  relayParams: RelayRouterParams,
  collateralDeltaAmount: bigint,
  params: RelayRouterCreateOrderParams
): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, uint256, bytes32, bytes32, uint256, uint256, bool, bool, bool, bytes32, bytes32"),
      [
        th(CREATE_ORDER_TYPEHASH_STRING),
        collateralDeltaAmount,
        hashAddresses(params.addresses),
        hashNumbers(params.numbers),
        BigInt(params.orderType),
        BigInt(params.decreasePositionSwapType),
        params.isLong,
        params.shouldUnwrapNativeToken,
        params.autoCancel,
        params.referralCode,
        hashRelayRouterParams(relayParams),
      ]
    )
  );
}

export function getRelayRouterTypedDataHash(domainSeparator: Hex, structHash: Hex): Hex {
  return keccak256(concat(["0x1901", domainSeparator, structHash]));
}
