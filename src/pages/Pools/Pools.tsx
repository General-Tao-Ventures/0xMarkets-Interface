import { t, Trans } from "@lingui/macro";
import { useState } from "react";
import cx from "classnames";

import { useCarthaLpStats } from "domain/cartha/useCarthaLpStats";
import { useGmMarketsApy } from "domain/synthetics/markets/useGmMarketsApy";
import { usePerformanceAnnualized } from "domain/synthetics/markets/usePerformanceAnnualized";
import { usePerformanceSnapshots } from "domain/synthetics/markets/usePerformanceSnapshots";
import { usePoolsTimeRange } from "domain/synthetics/markets/usePoolsTimeRange";
import { useChainId } from "lib/chains";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";
import { GmList } from "components/GmList/GmList";
import Tabs from "components/Tabs/Tabs";

import CarthaLpCard from "./CarthaLpCard";
import PoolsTimeRangeFilter from "./PoolsTimeRangeFilter";
import { usePoolsIsMobilePage } from "./usePoolsIsMobilePage";

import "styles/pools-glass.css";

const POOLS_TAB_OPTIONS = [
  { value: "all" as const, label: "All Pools" },
  { value: "my" as const, label: "My Pools" },
];

export default function Pools() {
  const { timeRange, setTimeRange } = usePoolsTimeRange();
  const [poolsTab, setPoolsTab] = useState<"all" | "my">("all");

  const { chainId, srcChainId } = useChainId();

  const {
    marketsTokensApyData,
    marketsTokensIncentiveAprData,
    glvTokensIncentiveAprData,
    marketsTokensLidoAprData,
    glvApyInfoData,
  } = useGmMarketsApy(chainId, srcChainId, { period: timeRange });

  const { performance } = usePerformanceAnnualized({
    chainId,
    period: timeRange,
  });

  const { performanceSnapshots } = usePerformanceSnapshots({
    chainId,
    period: timeRange,
  });

  const isMobile = usePoolsIsMobilePage();

  return (
    <AppPageLayout header={<ChainContentHeader />}>
      <div
        className={cx("mb-24 flex w-full gap-16", {
          "flex-col": isMobile,
          "items-end justify-between": !isMobile,
        })}
      >
        <PoolsTvl />
        <PoolsTimeRangeFilter timeRange={timeRange} setTimeRange={setTimeRange} />
      </div>

      <div className="mb-16">
        <CarthaLpCard />
      </div>

      <div className="mb-16">
        <Tabs
          options={POOLS_TAB_OPTIONS}
          selectedValue={poolsTab}
          onChange={setPoolsTab}
          type="inline"
        />
      </div>

      <div className="flex grow flex-col gap-16 lg:overflow-hidden">
        <GmList
          glvTokensApyData={glvApyInfoData}
          glvTokensIncentiveAprData={glvTokensIncentiveAprData}
          marketsTokensApyData={marketsTokensApyData}
          marketsTokensIncentiveAprData={marketsTokensIncentiveAprData}
          marketsTokensLidoAprData={marketsTokensLidoAprData}
          performance={performance}
          performanceSnapshots={performanceSnapshots}
          isDeposit
          activeTab={poolsTab}
        />
      </div>
    </AppPageLayout>
  );
}

const tvlFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function PoolsTvl() {
  const { data } = useCarthaLpStats();
  const tvl = data?.tvl.current_usd;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-body-small font-medium uppercase tracking-wide text-typography-secondary">
        Total Value Locked
      </span>
      <span className="text-h1 normal-nums">{tvl != null ? tvlFormatter.format(tvl) : "—"}</span>
      <span className="text-body-medium text-typography-secondary">
        <Trans>In 0xMarkets LP</Trans>
      </span>
    </div>
  );
}
