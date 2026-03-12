import { Trans } from "@lingui/macro";

import { useSettings } from "context/SettingsContext/SettingsContextProvider";

import ExternalLink from "components/ExternalLink/ExternalLink";
import ToggleSwitch from "components/ToggleSwitch/ToggleSwitch";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import { SettingsSection } from "./shared";

export function DisplaySettings() {
  const settings = useSettings();

  return (
    <div className="flex flex-col gap-16 font-medium">
      <SettingsSection>
        <ToggleSwitch isChecked={settings.isLeverageSliderEnabled} setIsChecked={settings.setIsLeverageSliderEnabled}>
          <Trans>Show Leverage Slider</Trans>
        </ToggleSwitch>

        <ToggleSwitch isChecked={settings.showPnlAfterFees} setIsChecked={settings.setShowPnlAfterFees}>
          <Trans>Display PnL After Fees</Trans>
        </ToggleSwitch>

        <ToggleSwitch isChecked={settings.isPnlInLeverage} setIsChecked={settings.setIsPnlInLeverage}>
          <Trans>Include PnL in Leverage Display</Trans>
        </ToggleSwitch>

        <ToggleSwitch isChecked={settings.shouldShowPositionLines} setIsChecked={settings.setShouldShowPositionLines}>
          <Trans>Show Positions on Chart</Trans>
        </ToggleSwitch>

        <div className="flex items-center gap-8">
          <ToggleSwitch
            isChecked={settings.breakdownNetPriceImpactEnabled}
            setIsChecked={settings.setBreakdownNetPriceImpactEnabled}
          >
            <TooltipWithPortal
              handle={<Trans>Breakdown Net Price Impact</Trans>}
              position="top"
              renderContent={() => (
                <div>
                  <Trans>
                    When enabled, the net price impact is split into its components: stored impact from position
                    increases and close impact from decreases. This breakdown appears in the net value tooltip and close
                    modal.{" "}
                    <ExternalLink href="https://docs.0xmarkets.io/trading/fees#price-impact" newTab>
                      Read more
                    </ExternalLink>
                    .
                  </Trans>
                </div>
              )}
            />
          </ToggleSwitch>
        </div>
      </SettingsSection>
      {/* Theme selector hidden — light mode not yet polished */}
    </div>
  );
}
