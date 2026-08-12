import { ErrorLike, extendError } from "lib/errors";
import { OrderMetricId, sendTxnErrorMetric } from "lib/metrics";

import { setByKey, updateByKey } from "lib/objects";

import type {
  GelatoTaskStatus,
  OrderCreatedEventData,
  OrderStatuses,
  PendingDepositData,
  PendingOrderData,
  PendingShiftData,
  PendingWithdrawalData,
} from "./types";

export function getPendingOrderKey(
  data: Omit<PendingOrderData, "txnType" | "triggerPrice" | "acceptablePrice" | "autoCancel" | "createdAt">
) {
  return [
    data.account,
    data.marketAddress,
    data.initialCollateralTokenAddress,
    data.swapPath.join("-"),
    data.shouldUnwrapNativeToken,
    data.isLong,
    data.orderType,
  ].join(":");
}

/**
 * Seed a provisional OrderCreated-shaped status so create toasts can bind before
 * OrderCreated arrives (express / flaky WS). Key = getPendingOrderKey(order).
 */
export function pendingOrderToProvisionalCreatedData(order: PendingOrderData): OrderCreatedEventData {
  const zero = "0x0000000000000000000000000000000000000000";
  return {
    key: getPendingOrderKey(order),
    account: order.account,
    receiver: order.account,
    callbackContract: zero,
    marketAddress: order.marketAddress,
    initialCollateralTokenAddress: order.initialCollateralTokenAddress,
    swapPath: order.swapPath,
    sizeDeltaUsd: order.sizeDeltaUsd,
    initialCollateralDeltaAmount: order.initialCollateralDeltaAmount,
    contractTriggerPrice: order.triggerPrice,
    contractAcceptablePrice: order.acceptablePrice,
    executionFee: 0n,
    callbackGasLimit: 0n,
    minOutputAmount: order.minOutputAmount,
    updatedAtBlock: 0n,
    orderType: order.orderType,
    isLong: order.isLong,
    shouldUnwrapNativeToken: order.shouldUnwrapNativeToken,
    isFrozen: false,
    uiFeeReceiver: zero,
    externalSwapQuote: undefined,
    isTwap: order.isTwap,
  };
}

type PositionFillMatch = {
  account: string;
  marketAddress: string;
  collateralTokenAddress: string;
  isLong: boolean;
  orderType: number;
  sizeDeltaUsd?: bigint;
};

/** Match a create-toast provisional status to a PositionIncrease/Decrease fill. */
export function doesOrderStatusMatchPositionFill(data: OrderCreatedEventData, fill: PositionFillMatch): boolean {
  if (
    data.account.toLowerCase() !== fill.account.toLowerCase() ||
    data.marketAddress.toLowerCase() !== fill.marketAddress.toLowerCase() ||
    data.isLong !== fill.isLong ||
    data.orderType !== fill.orderType
  ) {
    return false;
  }

  // No swap: initial collateral token is the position collateral.
  // With a swap path, fill.collateralToken is the swap *output* — do not require equality.
  if (
    data.swapPath.length === 0 &&
    data.initialCollateralTokenAddress.toLowerCase() !== fill.collateralTokenAddress.toLowerCase()
  ) {
    return false;
  }

  // Size is intentionally not compared: UI estimate vs fill can differ slightly and was
  // leaving sticky toasts spinning after the position already appeared.

  return true;
}

/**
 * Mirror a terminal execute/cancel onto every sibling status the toast may be bound to
 * (provisional pending-order-key and any other entry sharing that pending key).
 */
export function mirrorTerminalStatusOntoProvisional(
  old: OrderStatuses,
  contractKey: string,
  patch: {
    executedTxnHash?: string;
    cancelledTxnHash?: string;
    cancelledReason?: string;
    createdTxnHash?: string;
  }
): OrderStatuses {
  const orderData = old[contractKey]?.data;
  if (!orderData) {
    // OrderExecuted before OrderCreated: propagate by matching create txn hash when present.
    if (!patch.createdTxnHash && !patch.executedTxnHash) return old;
    const terminalHash = patch.executedTxnHash ?? patch.cancelledTxnHash;
    let next = old;
    for (const [key, status] of Object.entries(next)) {
      if (key === contractKey) continue;
      if (!status.data || status.executedTxnHash || status.cancelledTxnHash) continue;
      // Same-tx express path: create hash on provisional equals execute txn.
      if (status.createdTxnHash && terminalHash && status.createdTxnHash === terminalHash) {
        next = updateByKey(next, key, {
          ...patch,
          createdTxnHash: status.createdTxnHash,
        });
      }
    }
    return next;
  }

  const pendingKey = getPendingOrderKey(orderData);
  let next = old;

  for (const [key, status] of Object.entries(next)) {
    if (key === contractKey) continue;
    if (status.executedTxnHash || status.cancelledTxnHash) continue;

    const samePendingKey = key === pendingKey;
    const samePendingData = status.data !== undefined && getPendingOrderKey(status.data) === pendingKey;
    if (!samePendingKey && !samePendingData) continue;

    next = updateByKey(next, key, {
      ...patch,
      createdTxnHash: status.createdTxnHash ?? patch.createdTxnHash,
    });
  }

  return next;
}

/**
 * Mark contract-key + matching provisional create statuses as executed so sticky
 * toasts can bind even when OrderCreated/OrderExecuted were missed.
 */
export function markMarketOrderStatusesExecuted(
  old: OrderStatuses,
  fill: PositionFillMatch & { orderKey: string },
  txnHash: string
): OrderStatuses {
  let next = old;

  if (!next[fill.orderKey]) {
    next = setByKey(next, fill.orderKey, {
      key: fill.orderKey,
      createdAt: Date.now(),
      createdTxnHash: txnHash,
      executedTxnHash: txnHash,
    });
  } else if (!next[fill.orderKey].executedTxnHash && !next[fill.orderKey].cancelledTxnHash) {
    next = updateByKey(next, fill.orderKey, {
      executedTxnHash: txnHash,
      createdTxnHash: next[fill.orderKey].createdTxnHash ?? txnHash,
    });
  }

  for (const [key, status] of Object.entries(next)) {
    if (key === fill.orderKey) continue;
    if (!status.data || status.executedTxnHash || status.cancelledTxnHash) continue;
    if (!doesOrderStatusMatchPositionFill(status.data, fill)) continue;

    next = updateByKey(next, key, {
      executedTxnHash: txnHash,
      createdTxnHash: status.createdTxnHash ?? txnHash,
    });
  }

  return next;
}

export function getPendingDepositKey(data: PendingDepositData) {
  if (data.isGlvDeposit) {
    return [
      data.account,
      data.glvAddress,
      data.initialLongTokenAddress,
      data.initialShortTokenAddress,
      data.longTokenSwapPath.join("-"),
      data.shortTokenSwapPath.join("-"),
      data.shouldUnwrapNativeToken,
      data.initialLongTokenAmount.toString(),
      data.initialShortTokenAmount.toString(),
      (data.initialMarketTokenAmount ?? 0n).toString(),
    ].join(":");
  }

  if (data.initialShortTokenAddress === data.initialLongTokenAddress) {
    return [
      data.account,
      data.marketAddress,
      data.initialLongTokenAddress,
      data.longTokenSwapPath.join("-"),
      data.shouldUnwrapNativeToken,
      (data.initialLongTokenAmount + data.initialShortTokenAmount).toString(),
    ].join(":");
  }

  return [
    data.account,
    data.marketAddress,
    data.initialLongTokenAddress,
    data.initialShortTokenAddress,
    data.longTokenSwapPath.join("-"),
    data.shortTokenSwapPath.join("-"),
    data.shouldUnwrapNativeToken,
    data.initialLongTokenAmount.toString(),
    data.initialShortTokenAmount.toString(),
  ].join(":");
}

export function getPendingWithdrawalKey(data: PendingWithdrawalData) {
  return [
    data.account,
    data.marketAddress,
    data.minLongTokenAmount.toString(),
    data.marketTokenAmount.toString(),
    data.shouldUnwrapNativeToken,
  ].join(":");
}

export function getPendingShiftKey(data: PendingShiftData) {
  return [
    data.account,
    data.fromMarket,
    data.marketTokenAmount.toString(),
    data.toMarket,
    data.minMarketTokens.toString(),
  ].join(":");
}

const BYTECODE_REGEXP = /0x[a-fA-F0-9]+/;

export function extractGelatoError(gelatoTaskStatus: GelatoTaskStatus) {
  const bytecodeMatch = gelatoTaskStatus.lastCheckMessage?.match(BYTECODE_REGEXP);

  if (bytecodeMatch) {
    const bytecode = bytecodeMatch[0];
    const error = extendError(new Error(`data="${bytecode}"`), {
      data: { taskId: gelatoTaskStatus.taskId, lastCheckMessage: gelatoTaskStatus.lastCheckMessage },
    });
    return error;
  }

  return extendError(new Error(`Gelato task cancelled, unknown reason`), {
    data: { taskId: gelatoTaskStatus.taskId, lastCheckMessage: gelatoTaskStatus.lastCheckMessage },
  });
}

export async function sendGelatoTaskStatusMetric(metricId: OrderMetricId, error: ErrorLike) {
  sendTxnErrorMetric(metricId, error, "relayer");
}

export function getGelatoTaskUrl({
  taskId,
  isDebug,
  tenderlyAccountSlug,
  tenderlyProjectSlug,
}: {
  taskId: string;
  isDebug: boolean;
  tenderlyAccountSlug?: string;
  tenderlyProjectSlug?: string;
}) {
  const tenderlySlugs =
    tenderlyAccountSlug && tenderlyProjectSlug
      ? `tenderlyUsername=${tenderlyAccountSlug}&tenderlyProjectName=${tenderlyProjectSlug}`
      : "";

  return `https://api.gelato.digital/tasks/status/${taskId}/${isDebug ? "debug" : ""}?${tenderlySlugs}`;
}
