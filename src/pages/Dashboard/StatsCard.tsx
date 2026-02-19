import { Trans } from "@lingui/macro";

import { BASE_SEPOLIA } from "config/chains";
import { USD_DECIMALS } from "config/factors";
import useV2Stats from "domain/synthetics/stats/useV2Stats";
import { formatAmountHuman } from "lib/numbers";

import { AppCard, AppCardSection } from "components/AppCard/AppCard";
import TooltipComponent from "components/Tooltip/Tooltip";

export function StatsCard() {
  const v2Overview = useV2Stats(BASE_SEPOLIA);

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
            <Trans>Fees</Trans>
          </div>
          <div>
            <span className="numbers">{formatAmountHuman(totalFeesUsd, USD_DECIMALS, true, 2)}</span>
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
