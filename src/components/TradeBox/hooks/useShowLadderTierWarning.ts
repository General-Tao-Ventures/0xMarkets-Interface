import { useMemo } from "react";

import {
  selectTradeboxIncreasePositionAmounts,
  selectTradeboxMaxLeverage,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { getMaxAllowedLeverageByMinCollateralFactor, ladderMaxLeverageToBps } from "domain/synthetics/markets";
import { BASIS_POINTS_DIVISOR } from "sdk/configs/factors";
import type { MarketInfo } from "sdk/types/markets";

export type LadderTierWarning = {
  showLadderTierWarning: boolean;
  activeTierMaxLeverage: number | undefined;
  tierBoundaryUsd: bigint | undefined;
};

export function useShowLadderTierWarning(marketInfo: MarketInfo | undefined): LadderTierWarning {
  const amounts = useSelector(selectTradeboxIncreasePositionAmounts);
  const effectiveMaxLeverage = useSelector(selectTradeboxMaxLeverage);

  return useMemo(() => {
    if (!marketInfo?.leverageLadder?.length) {
      return { showLadderTierWarning: false, activeTierMaxLeverage: undefined, tierBoundaryUsd: undefined };
    }

    const sizeDeltaUsd = amounts?.sizeDeltaUsd ?? 0n;

    // Tier 0 is the loosest cap, so skip the banner there — it would just
    // restate the headline rate.
    const activeTierIndex = marketInfo.leverageLadder.findIndex((tier) => sizeDeltaUsd <= tier.maxNotionalUsd);
    if (activeTierIndex <= 0) {
      return { showLadderTierWarning: false, activeTierMaxLeverage: undefined, tierBoundaryUsd: undefined };
    }

    const activeTier = marketInfo.leverageLadder[activeTierIndex];
    const ladderMaxBps = ladderMaxLeverageToBps(activeTier.maxLeverage);
    const baseMaxBps = getMaxAllowedLeverageByMinCollateralFactor(marketInfo.minCollateralFactor);

    if (ladderMaxBps >= baseMaxBps) {
      return { showLadderTierWarning: false, activeTierMaxLeverage: undefined, tierBoundaryUsd: undefined };
    }

    return {
      showLadderTierWarning: true,
      activeTierMaxLeverage: Math.round(effectiveMaxLeverage / BASIS_POINTS_DIVISOR),
      tierBoundaryUsd: activeTier.maxNotionalUsd,
    };
  }, [marketInfo, amounts?.sizeDeltaUsd, effectiveMaxLeverage]);
}
