import { t, Trans } from "@lingui/macro";
import { useMemo } from "react";

import { selectTradeboxMarketInfo } from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import {
  getMaxOpenInterestUsd,
  getMaxReservedUsd,
  getOpenInterestUsd,
  getReservedUsd,
} from "domain/synthetics/markets";
import { formatUsd } from "lib/numbers";

import StatsTooltipRow from "components/StatsTooltip/StatsTooltipRow";

export function AvailableLiquidityTooltip({
  isLong,
  carthaTvlUsd,
}: {
  isLong: boolean;
  carthaTvlUsd?: bigint;
}) {
  const longShortText = isLong ? t`Long` : t`Short`;
  const marketInfo = useSelector(selectTradeboxMarketInfo);

  const indexToken = marketInfo?.indexToken;

  const { reservedUsd, maxReservedUsd, currentOpenInterest, maxOpenInterest } = useMemo(() => {
    if (!marketInfo) {
      return {};
    }

    return {
      reservedUsd: getReservedUsd(marketInfo, isLong),
      maxReservedUsd: getMaxReservedUsd(marketInfo, isLong),
      currentOpenInterest: getOpenInterestUsd(marketInfo, isLong),
      maxOpenInterest: getMaxOpenInterestUsd(marketInfo, isLong),
    };
  }, [marketInfo, isLong]);

  const usingCartha = carthaTvlUsd !== undefined && carthaTvlUsd > 0n;

  return (
    <div>
      {usingCartha ? (
        <>
          <StatsTooltipRow
            label={t`Cartha LP TVL`}
            value={formatUsd(carthaTvlUsd, { displayDecimals: 0 }) || "..."}
            showDollar={false}
          />
          <StatsTooltipRow
            label={t`${longShortText} Open Interest`}
            value={formatUsd(currentOpenInterest, { displayDecimals: 0 }) || "..."}
            showDollar={false}
          />
          <br />
          <Trans>
            Available liquidity is Cartha LP TVL minus current {longShortText.toLowerCase()} open interest.
          </Trans>
        </>
      ) : (
        <>
          <StatsTooltipRow
            label={t`${longShortText} ${indexToken?.symbol} Reserve`}
            value={`${formatUsd(reservedUsd, { displayDecimals: 0 })} / ${formatUsd(maxReservedUsd, {
              displayDecimals: 0,
            })}`}
            showDollar={false}
          />
          <StatsTooltipRow
            label={t`${longShortText} ${indexToken?.symbol} Open Interest`}
            value={`${formatUsd(currentOpenInterest, { displayDecimals: 0 })} / ${formatUsd(maxOpenInterest, {
              displayDecimals: 0,
            })}`}
            showDollar={false}
          />
          <br />
          {longShortText === t`Long` && <Trans>There may be open interest limits for this market.</Trans>}
        </>
      )}
    </div>
  );
}
