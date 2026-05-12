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
  /** Whether the ladder is binding the trader's leverage at the current size. */
  showLadderTierWarning: boolean;
  /** Active tier's max leverage in human-readable units (e.g. 150 for 150x). Undefined when not binding. */
  activeTierMaxLeverage: number | undefined;
  /** Upper notional bound of the active tier, in 30-decimal fixed-point. Undefined when not binding. */
  tierBoundaryUsd: bigint | undefined;
};

/**
 * Returns whether the trade ticket should show a leverage-ladder tier warning,
 * along with the active tier's cap and notional ceiling.
 *
 * The banner fires whenever the ladder's tier cap is *strictly tighter* than the
 * market-wide cap derived from `minCollateralFactor`. When no ladder is configured
 * or when the ladder's cap matches the market cap, the warning stays hidden.
 */
export function useShowLadderTierWarning(marketInfo: MarketInfo | undefined): LadderTierWarning {
  const amounts = useSelector(selectTradeboxIncreasePositionAmounts);
  const effectiveMaxLeverage = useSelector(selectTradeboxMaxLeverage);

  return useMemo(() => {
    if (!marketInfo?.leverageLadder?.length) {
      return { showLadderTierWarning: false, activeTierMaxLeverage: undefined, tierBoundaryUsd: undefined };
    }

    const sizeDeltaUsd = amounts?.sizeDeltaUsd ?? 0n;

    // Find the active tier index. Tier 0 is the loosest (headline) cap, so we
    // only warn once the trader has crossed at least one tier boundary —
    // otherwise every small trade in every market would show a banner that
    // just restates the headline rate.
    const activeTierIndex = marketInfo.leverageLadder.findIndex((tier) => sizeDeltaUsd <= tier.maxNotionalUsd);
    if (activeTierIndex <= 0) {
      return { showLadderTierWarning: false, activeTierMaxLeverage: undefined, tierBoundaryUsd: undefined };
    }

    const activeTier = marketInfo.leverageLadder[activeTierIndex];
    const ladderMaxBps = ladderMaxLeverageToBps(activeTier.maxLeverage);
    const baseMaxBps = getMaxAllowedLeverageByMinCollateralFactor(marketInfo.minCollateralFactor);

    // Defensive — if for some reason the tier cap is no longer tighter than
    // the market cap, don't show the banner.
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
