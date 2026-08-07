import { Trans } from "@lingui/macro";

import { USD_DECIMALS } from "config/factors";
import useV2Stats from "domain/synthetics/stats/useV2Stats";
import { useChainId } from "lib/chains";
import { formatAmountHuman } from "lib/numbers";

import { AppCard, AppCardSection } from "components/AppCard/AppCard";
import TooltipComponent from "components/Tooltip/Tooltip";

export function StatsCard() {
  const { chainId } = useChainId();
  const v2Overview = useV2Stats(chainId);

  const totalFeesUsd = v2Overview.totalFees;
  const totalVolume = v2Overview.totalVolume;
  const totalUsers = v2Overview.totalUsers;

  return (
    <AppCard>
      <AppCardSection className="text-body-large font-medium">
        <Trans>Stats</Trans>
      </AppCardSection>
      <AppCardSection>
        <div className="App-card-row">
          <div className="label">
            <Trans>Total Fees</Trans>
          </div>
          <div>
            <TooltipComponent
              position="bottom-end"
              className="whitespace-nowrap"
              handle={formatAmountHuman(totalFeesUsd, USD_DECIMALS, true, 2)}
              handleClassName="numbers"
              content={
                <>
                  <p className="Tooltip-row">
                    <span className="label">
                      <Trans>Position Fees:</Trans>
                    </span>
                    <span className="numbers">
                      {formatAmountHuman(v2Overview.totalPositionFees, USD_DECIMALS, true, 2)}
                    </span>
                  </p>
                  <p className="Tooltip-row">
                    <span className="label">
                      <Trans>Borrowing Fees:</Trans>
                    </span>
                    <span className="numbers">
                      {formatAmountHuman(v2Overview.totalBorrowingFees, USD_DECIMALS, true, 2)}
                    </span>
                  </p>
                  <p className="Tooltip-row">
                    <span className="label">
                      <Trans>Liquidation Fees:</Trans>
                    </span>
                    <span className="numbers">
                      {formatAmountHuman(v2Overview.totalLiquidationFees, USD_DECIMALS, true, 2)}
                    </span>
                  </p>
                </>
              }
            />
          </div>
        </div>
        <div className="App-card-row">
          <div className="label">
            <Trans>Volume</Trans>
          </div>
          <div>
            <span className="numbers">{formatAmountHuman(totalVolume, USD_DECIMALS, true, 2)}</span>
          </div>
        </div>
        <div className="App-card-row">
          <div className="label">
            <Trans>Users</Trans>
          </div>
          <div>
            <span className="numbers">{formatAmountHuman(totalUsers, 0, false, 2)}</span>
          </div>
        </div>
      </AppCardSection>
    </AppCard>
  );
}
