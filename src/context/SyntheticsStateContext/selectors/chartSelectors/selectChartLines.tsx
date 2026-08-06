import { t } from "@lingui/macro";

import { USD_DECIMALS } from "config/factors";
import {
  selectChainId,
  selectPositionsInfoData,
  selectTokensData,
} from "context/SyntheticsStateContext/selectors/globalSelectors";
import { createSelector } from "context/SyntheticsStateContext/utils";
import { getTokenData } from "domain/synthetics/tokens";
import { formatAmount } from "lib/numbers";
import { EMPTY_ARRAY } from "lib/objects";
import { convertTokenAddress, getPriceDecimals } from "sdk/configs/tokens";
import { toFxDisplayIsLong, toFxDisplayPrice } from "sdk/utils/fxDisplay";
import { getMarketIndexName } from "sdk/utils/markets";

import { StaticChartLine } from "components/TVChartContainer/types";

import { selectChartToken } from ".";

/** Skip chart lines that would blow Y-axis autoscale (e.g. short liq → huge price). */
function isSaneChartPrice(price: number, markPrice: number | undefined): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  if (markPrice === undefined || !Number.isFinite(markPrice) || markPrice <= 0) {
    // Absolute guard when mark is missing
    return price < 1_000_000;
  }
  // Allow wide but finite band around mark (covers metals/crypto moves; blocks 1e9+ liq lines)
  return price > markPrice / 100 && price < markPrice * 100;
}

function toChartPrice(
  value: bigint | undefined,
  priceDecimal: number,
  visualMultiplier: number | undefined
): number | undefined {
  if (value === undefined || value < 0n) return undefined;
  const formatted = formatAmount(value, USD_DECIMALS, priceDecimal, undefined, undefined, visualMultiplier);
  if (!formatted || formatted === "NA") return undefined;
  const price = parseFloat(formatted);
  return Number.isFinite(price) ? price : undefined;
}

export const selectChartLines = createSelector<StaticChartLine[]>((q) => {
  const chainId = q(selectChainId);
  const { chartToken } = q(selectChartToken);
  const positionsInfo = q(selectPositionsInfoData);

  const chartTokenAddress = chartToken?.address;

  if (!chartTokenAddress) {
    return EMPTY_ARRAY;
  }

  const filteredPositions = Object.values(positionsInfo || {}).filter(
    (position) =>
      position.marketInfo &&
      convertTokenAddress(chainId, position.marketInfo.indexTokenAddress, "wrapped") ===
        convertTokenAddress(chainId, chartTokenAddress, "wrapped")
  );

  const positionLines = filteredPositions.flatMap((position) => {
    const priceDecimal = getPriceDecimals(chainId, position.indexToken.symbol);
    const displayIsLong = toFxDisplayIsLong(position.isLong, position.indexToken.symbol);
    const longOrShortText = displayIsLong ? t`Long` : t`Short`;
    const token = q((state) => getTokenData(selectTokensData(state), position.marketInfo?.indexTokenAddress, "native"));
    const marketIndexName = getMarketIndexName(position.marketInfo!) ?? "";
    const tokenVisualMultiplier = token?.visualMultiplier;
    const indexSymbol = position.indexToken.symbol;

    const markPrice = toChartPrice(toFxDisplayPrice(position.markPrice, indexSymbol), priceDecimal, tokenVisualMultiplier);
    const entryPrice = toChartPrice(toFxDisplayPrice(position.entryPrice, indexSymbol), priceDecimal, tokenVisualMultiplier);
    const liquidationPrice = toChartPrice(
      toFxDisplayPrice(position.liquidationPrice, indexSymbol),
      priceDecimal,
      tokenVisualMultiplier
    );

    const lines: StaticChartLine[] = [];

    if (entryPrice !== undefined && isSaneChartPrice(entryPrice, markPrice)) {
      lines.push({
        title: t`Open ${longOrShortText} - ${marketIndexName}`,
        price: entryPrice,
      });
    }

    if (liquidationPrice !== undefined && isSaneChartPrice(liquidationPrice, markPrice ?? entryPrice)) {
      lines.push({
        title: t`Liq. ${longOrShortText} - ${marketIndexName}`,
        price: liquidationPrice,
      });
    }

    return lines;
  });

  return positionLines;
});
