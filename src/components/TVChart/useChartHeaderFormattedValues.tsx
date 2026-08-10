import cx from "classnames";
import { useMemo } from "react";
import type { Address } from "viem";

import { USD_DECIMALS } from "config/factors";
import { selectChartToken } from "context/SyntheticsStateContext/selectors/chartSelectors";
import { selectChartHeaderInfo } from "context/SyntheticsStateContext/selectors/chartSelectors";
import { selectChainId } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { selectSelectedMarketPriceDecimals } from "context/SyntheticsStateContext/selectors/statsSelectors";
import {
  selectTradeboxMarketInfo,
  selectTradeboxTradeFlags,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { use24hPriceDeltaMap } from "domain/synthetics/tokens";
import { use24hVolumes } from "domain/synthetics/tokens/use24Volumes";
import {
  getCarthaAvailableLiquidityUsd,
  getCarthaLiquidityForMarket,
  useCarthaMarketLiquidity,
} from "domain/cartha/useCarthaMarketLiquidity";
import {
  formatAmountHuman,
  formatPercentageDisplay,
  formatRatePercentage,
  formatUsdPrice,
  numberWithCommas,
} from "lib/numbers";
import { getToken } from "sdk/configs/tokens";
import { bigMath } from "sdk/utils/bigmath";
import { toFxDisplayPrice } from "sdk/utils/fxDisplay";

import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import LongIcon from "img/long.svg?react";
import ShortIcon from "img/short.svg?react";

import { AvailableLiquidityTooltip } from "./components/AvailableLiquidityTooltip";

export function useChartHeaderFormattedValues() {
  const chainId = useSelector(selectChainId);
  const info = useSelector(selectChartHeaderInfo);
  const { isSwap } = useSelector(selectTradeboxTradeFlags);
  const { chartToken } = useSelector(selectChartToken);
  const chartTokenAddress = chartToken?.address as Address;
  const oraclePriceDecimals = useSelector(selectSelectedMarketPriceDecimals);
  const marketInfo = useSelector(selectTradeboxMarketInfo);
  const { liquidityByMarket } = useCarthaMarketLiquidity();

  const carthaLiquidity = getCarthaLiquidityForMarket(liquidityByMarket, marketInfo?.marketTokenAddress);
  // Only treat Cartha as active when LP TVL is positive so header + tooltip stay in sync.
  const carthaTvlUsd =
    carthaLiquidity && carthaLiquidity.tvlUsd > 0n ? carthaLiquidity.tvlUsd : undefined;

  const liquidityLongUsd = useMemo(() => {
    if (carthaTvlUsd !== undefined && info?.openInterestLong !== undefined) {
      return getCarthaAvailableLiquidityUsd({
        carthaTvlUsd,
        openInterestUsd: info.openInterestLong,
      });
    }
    return info?.liquidityLong;
  }, [carthaTvlUsd, info?.liquidityLong, info?.openInterestLong]);

  const liquidityShortUsd = useMemo(() => {
    if (carthaTvlUsd !== undefined && info?.openInterestShort !== undefined) {
      return getCarthaAvailableLiquidityUsd({
        carthaTvlUsd,
        openInterestUsd: info.openInterestShort,
      });
    }
    return info?.liquidityShort;
  }, [carthaTvlUsd, info?.liquidityShort, info?.openInterestShort]);

  const selectedTokenOption = chartTokenAddress ? getToken(chainId, chartTokenAddress) : undefined;
  const visualMultiplier = isSwap ? 1 : selectedTokenOption?.visualMultiplier ?? 1;

  const priceTokenAddress = useMemo(() => {
    if (selectedTokenOption?.isWrapped) {
      return selectedTokenOption.address;
    }

    return selectedTokenOption?.address;
  }, [selectedTokenOption]);

  const dailyVolumes = use24hVolumes();
  const dailyVolumesValue = marketInfo?.marketTokenAddress
    ? dailyVolumes.byMarketToken?.[marketInfo.marketTokenAddress]
    : undefined;
  const dayPriceDeltaMap = use24hPriceDeltaMap(chainId, [priceTokenAddress as Address]);
  const dayPriceDeltaData = chartTokenAddress ? dayPriceDeltaMap?.[chartTokenAddress] : undefined;

  const avgPriceValue = bigMath.avg(chartToken?.prices?.maxPrice, chartToken?.prices?.minPrice);

  const high24 = useMemo(() => {
    if (!dayPriceDeltaData?.high) {
      return "-";
    }

    let value = dayPriceDeltaData.high;
    if (!isSwap) {
      value = value * visualMultiplier;
    }

    return numberWithCommas(value.toFixed(oraclePriceDecimals), { showDollar: true });
  }, [dayPriceDeltaData, oraclePriceDecimals, visualMultiplier, isSwap]);

  const low24 = useMemo(() => {
    if (!dayPriceDeltaData?.low) {
      return "-";
    }

    let value = dayPriceDeltaData.low;
    if (!isSwap) {
      value = value * visualMultiplier;
    }

    return numberWithCommas(value.toFixed(oraclePriceDecimals), { showDollar: true });
  }, [dayPriceDeltaData, oraclePriceDecimals, visualMultiplier, isSwap]);

  const dayPriceDelta = useMemo(() => {
    return (
      <div
        className={cx("numbers", {
          positive: dayPriceDeltaData?.deltaPercentage && dayPriceDeltaData?.deltaPercentage > 0,
          negative: dayPriceDeltaData?.deltaPercentage && dayPriceDeltaData?.deltaPercentage < 0,
        })}
      >
        {dayPriceDeltaData?.deltaPercentageStr || "-"}
      </div>
    );
  }, [dayPriceDeltaData]);

  const avgPrice = useMemo(() => {
    return (
      formatUsdPrice(toFxDisplayPrice(avgPriceValue, chartToken?.symbol), {
        visualMultiplier,
        displayDecimals: chartToken?.priceDecimals,
      }) || "..."
    );
  }, [avgPriceValue, visualMultiplier, chartToken?.symbol, chartToken?.priceDecimals]);

  const [longOIValue, longOIPercentage] = useMemo(() => {
    if (info?.longOpenInterestPercentage !== undefined && info.openInterestLong !== undefined) {
      return [
        <>
          <LongIcon width={12} className="relative top-1 opacity-70" />
          <span key="long-oi-value" className="whitespace-nowrap numbers">
            {formatAmountHuman(info?.openInterestLong, USD_DECIMALS, true)}
          </span>
        </>,
        formatPercentageDisplay(info.longOpenInterestPercentage),
      ];
    }

    return ["...", null];
  }, [info?.longOpenInterestPercentage, info?.openInterestLong]);

  const [shortOIValue, shortOIPercentage] = useMemo(() => {
    if (info?.shortOpenInterestPercentage !== undefined && info.openInterestShort !== undefined) {
      return [
        <>
          <ShortIcon width={12} className="relative opacity-70" />
          <span key="short-oi-value" className="whitespace-nowrap numbers">
            {formatAmountHuman(info?.openInterestShort, USD_DECIMALS, true)}
          </span>
        </>,
        formatPercentageDisplay(info.shortOpenInterestPercentage),
      ];
    }

    return ["...", null];
  }, [info?.shortOpenInterestPercentage, info?.openInterestShort]);

  const liquidityLong = useMemo(() => {
    const liquidity = liquidityLongUsd;

    if (liquidity === undefined) {
      return "...";
    }

    return (
      <TooltipWithPortal
        variant="none"
        handle={
          <span className="flex items-center justify-center gap-4 numbers">
            <LongIcon width={12} className="relative top-1 opacity-70" />
            {formatAmountHuman(liquidity, USD_DECIMALS, true)}
          </span>
        }
        position="bottom-end"
        content={<AvailableLiquidityTooltip isLong carthaTvlUsd={carthaTvlUsd} />}
      />
    );
  }, [liquidityLongUsd, carthaTvlUsd]);

  const liquidityShort = useMemo(() => {
    const liquidity = liquidityShortUsd;

    if (liquidity === undefined) {
      return "...";
    }

    return (
      <TooltipWithPortal
        variant="none"
        handle={
          <span className="flex items-center justify-center gap-4 numbers">
            <ShortIcon width={12} className="relative opacity-70" />
            {formatAmountHuman(liquidity, USD_DECIMALS, true)}
          </span>
        }
        position="bottom-end"
        content={<AvailableLiquidityTooltip isLong={false} carthaTvlUsd={carthaTvlUsd} />}
      />
    );
  }, [liquidityShortUsd, carthaTvlUsd]);

  const netRateLong = useMemo(() => {
    const netRate = info?.netRateHourlyLong;

    if (netRate === undefined) {
      return "...";
    }

    return (
      <span className={cx("flex flex-row items-center gap-4 numbers")}>
        <LongIcon width={12} className="relative top-1" />
        {formatRatePercentage(netRate)}
      </span>
    );
  }, [info]);

  const netRateShort = useMemo(() => {
    const netRate = info?.netRateHourlyShort;

    if (netRate === undefined) {
      return "...";
    }

    return (
      <span className={cx("flex flex-row items-center gap-4 numbers")}>
        <ShortIcon width={12} />
        {formatRatePercentage(netRate)}
      </span>
    );
  }, [info]);

  const fundingRateLong = useMemo(() => {
    const rate = info?.fundingRateLong;
    if (rate === undefined) return "...";
    return (
      <span className={cx("flex flex-row items-center gap-4 numbers")}>
        <LongIcon width={12} className="relative top-1" />
        {formatRatePercentage(rate)}
      </span>
    );
  }, [info]);

  const fundingRateShort = useMemo(() => {
    const rate = info?.fundingRateShort;
    if (rate === undefined) return "...";
    return (
      <span className={cx("flex flex-row items-center gap-4 numbers")}>
        <ShortIcon width={12} />
        {formatRatePercentage(rate)}
      </span>
    );
  }, [info]);

  const borrowRateLong = useMemo(() => {
    const rate = info?.borrowingRateLong;
    if (rate === undefined) return "...";
    return (
      <span className={cx("flex flex-row items-center gap-4 numbers")}>
        <LongIcon width={12} className="relative top-1" />
        {formatRatePercentage(rate)}
      </span>
    );
  }, [info]);

  const borrowRateShort = useMemo(() => {
    const rate = info?.borrowingRateShort;
    if (rate === undefined) return "...";
    return (
      <span className={cx("flex flex-row items-center gap-4 numbers")}>
        <ShortIcon width={12} />
        {formatRatePercentage(rate)}
      </span>
    );
  }, [info]);

  const dailyVolume = useMemo(() => {
    // Quiet markets zero-fill to 0n after a successful Squid fetch. Keep "..." while
    // loading / before market info is ready, or when Squid has never returned data (isError
    // with no cache). Refresh errors keep the last good volumes — see use24hVolumes.
    if (dailyVolumes.isLoading || dailyVolumesValue === undefined) {
      return "...";
    }

    return <span className="numbers">{formatAmountHuman(dailyVolumesValue, USD_DECIMALS, true)}</span>;
  }, [dailyVolumes.isLoading, dailyVolumesValue]);

  return {
    avgPrice,
    high24,
    low24,
    longOIValue,
    shortOIValue,
    longOIPercentage,
    shortOIPercentage,
    liquidityLong,
    liquidityShort,
    netRateLong,
    netRateShort,
    fundingRateLong,
    fundingRateShort,
    borrowRateLong,
    borrowRateShort,
    dailyVolume,
    dayPriceDelta,
    info,
  };
}
