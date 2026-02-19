import { Trans } from "@lingui/macro";

import { getIcons } from "config/icons";
import { useChainId } from "lib/chains";

import { AppCard, AppCardSection } from "components/AppCard/AppCard";

export function GmxCard() {
  const { chainId } = useChainId();
  const currentIcons = getIcons(chainId)!;

  return (
    <AppCard>
      <AppCardSection>
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className="App-card-title-mark-icon">
              <img src={currentIcons.gmx} width="40" alt="0xMarkets Token Icon" />
            </div>
            <div>
              <div className="text-body-medium font-medium">0xMarkets</div>
            </div>
          </div>
        </div>
        <div className="text-13 text-typography-secondary">
          <Trans>
            0xMarkets is the utility and governance token. V1 staking is not available on this network.
          </Trans>
        </div>
      </AppCardSection>
    </AppCard>
  );
}
