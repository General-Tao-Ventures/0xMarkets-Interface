import { t } from "@lingui/macro";

import { BASIS_POINTS_DIVISOR } from "config/factors";
import {
  OrderType,
  PositionOrderInfo,
  isLimitIncreaseOrderType,
  isStopIncreaseOrderType,
  isTriggerDecreaseOrderType,
} from "domain/synthetics/orders";
import { PositionInfoLoaded } from "domain/synthetics/positions";
import { NextPositionValues } from "domain/synthetics/trade";
import { formatAmount, PRECISION } from "lib/numbers";

export function getPositionOrderError({
  positionOrder,
  markPrice,
  sizeDeltaUsd,
  triggerPrice,
  acceptablePrice,
  existingPosition,
  nextPositionValuesForIncrease,
  maxAllowedLeverage,
  minLeverage,
}: {
  positionOrder: PositionOrderInfo;
  markPrice: bigint | undefined;
  sizeDeltaUsd: bigint | undefined;
  triggerPrice: bigint | undefined;
  acceptablePrice: bigint | undefined;
  existingPosition: PositionInfoLoaded | undefined;
  nextPositionValuesForIncrease: NextPositionValues | undefined;
  maxAllowedLeverage: number | undefined;
  /** On-chain MIN_LEVERAGE (1e30 factor). 0 / undefined = no floor. */
  minLeverage?: bigint;
}): string | undefined {
  if (markPrice === undefined) {
    return t`Loading...`;
  }

  if (sizeDeltaUsd === undefined || sizeDeltaUsd < 0) {
    return t`Enter an amount`;
  }

  if (triggerPrice === undefined || triggerPrice < 0) {
    return t`Enter a price`;
  }

  if (
    sizeDeltaUsd === positionOrder.sizeDeltaUsd &&
    triggerPrice === positionOrder.triggerPrice! &&
    acceptablePrice === positionOrder.acceptablePrice
  ) {
    return t`Enter new amount or price`;
  }

  if (isLimitIncreaseOrderType(positionOrder.orderType)) {
    if (positionOrder.isLong) {
      if (triggerPrice >= markPrice) {
        return t`Limit price above mark price`;
      }
    } else {
      if (triggerPrice <= markPrice) {
        return t`Limit price below mark price`;
      }
    }
  } else if (isStopIncreaseOrderType(positionOrder.orderType)) {
    if (positionOrder.isLong && triggerPrice <= markPrice) {
      return t`Stop Market price is below mark price`;
    } else if (!positionOrder.isLong && triggerPrice >= markPrice) {
      return t`Stop Market price is above mark price`;
    }
  }

  if (isTriggerDecreaseOrderType(positionOrder.orderType)) {
    if (markPrice === undefined) {
      return t`Loading...`;
    }

    if (
      sizeDeltaUsd === (positionOrder.sizeDeltaUsd ?? 0n) &&
      triggerPrice === (positionOrder.triggerPrice ?? 0n) &&
      acceptablePrice === positionOrder.acceptablePrice
    ) {
      return t`Enter a new size or price`;
    }

    if (existingPosition?.liquidationPrice) {
      if (existingPosition.isLong && triggerPrice <= existingPosition?.liquidationPrice) {
        return t`Trigger price below liq. price`;
      }

      if (!existingPosition.isLong && triggerPrice >= existingPosition?.liquidationPrice) {
        return t`Trigger price above liq. price`;
      }
    }

    if (positionOrder.isLong) {
      if (positionOrder.orderType === OrderType.LimitDecrease && triggerPrice <= markPrice) {
        return t`Trigger price below mark price`;
      }

      if (positionOrder.orderType === OrderType.StopLossDecrease && triggerPrice >= markPrice) {
        return t`Trigger price above mark price`;
      }
    } else {
      if (positionOrder.orderType === OrderType.LimitDecrease && triggerPrice >= markPrice) {
        return t`Trigger price above mark price`;
      }

      if (positionOrder.orderType === OrderType.StopLossDecrease && triggerPrice <= markPrice) {
        return t`Trigger price below mark price`;
      }
    }
  }

  if (isLimitIncreaseOrderType(positionOrder.orderType) || isStopIncreaseOrderType(positionOrder.orderType)) {
    if (
      nextPositionValuesForIncrease?.nextLeverage !== undefined &&
      maxAllowedLeverage !== undefined &&
      nextPositionValuesForIncrease.nextLeverage > maxAllowedLeverage
    ) {
      return t`Max leverage: ${(maxAllowedLeverage / BASIS_POINTS_DIVISOR).toFixed(1)}x`;
    }

    if (
      minLeverage !== undefined &&
      minLeverage > 0n &&
      nextPositionValuesForIncrease?.nextLeverage !== undefined
    ) {
      const minLeverageBps = (minLeverage * BigInt(BASIS_POINTS_DIVISOR)) / PRECISION;
      if (nextPositionValuesForIncrease.nextLeverage < minLeverageBps) {
        return t`Min. leverage: ${formatAmount(minLeverageBps, 4, 2)}x`;
      }
    }
  }
}
