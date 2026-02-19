import { gql } from "@apollo/client";
import { useMemo } from "react";
import useSWR from "swr";

import { getServerUrl } from "config/backend";
import { PerformanceInfo, useOracleKeeperFetcher } from "lib/oracleKeeperFetcher";
import { getSubsquidGraphClient } from "lib/subgraph";
import { BASE_SEPOLIA } from "sdk/configs/chainIds";
import { MarketInfo } from "sdk/types/subsquid";

export type PoolsData = {
  glvApy: number;
  gmApy: number;
  totalLiquidity: bigint;
  openInterest: bigint;
  totalDepositedUsers: number;
};

// combined by the requests used
export function usePoolsData(): Partial<PoolsData> {
  const { data: performance } = usePerformanceByChainId(BASE_SEPOLIA);
  const { data: apys } = useApysByChainId(BASE_SEPOLIA);
  const { data: positionStats } = usePositionStats();
  const { data: marketInfos } = useMarketInfos();

  const { sortedAggregatedMarketInfos, totalLiquidity, openInterest } = marketInfos ?? {};

  const glvApy = useMemo(() => {
    if (performance && apys) {
      let result = 0;
      for (const perf of performance) {
        const performanceApy = parseFloat(perf.uniswapV2Performance);
        if (perf.entity === "Glv" && performanceApy > result) {
          result = performanceApy;
        }
      }
      if (result < 0.1) {
        const glvApys = apys.glvs ?? {};

        for (const glvKey of Object.keys(glvApys)) {
          const glv = glvApys[glvKey];
          if (glv.apy > result) {
            result = glv.apy;
          }
        }
      }
      return { glvApy: result };
    }
    return {};
  }, [performance, apys]);

  // Helper - performance lookup for optimization
  const performanceLookup = useMemo(() => {
    if (!performance) {
      return null;
    }
    const result: Record<string, PerformanceInfo & { performanceApy: number }> = {};
    for (const perf of performance) {
      if (perf.entity === "Market") {
        const performanceApy = parseFloat(perf.uniswapV2Performance);
        result[perf.address] = { ...perf, performanceApy };
      }
    }
    return result;
  }, [performance]);

  // GM APY
  const gmApy = useMemo(() => {
    if (sortedAggregatedMarketInfos && performanceLookup && apys) {
      let gmApy = 0;
      for (const marketIndex in sortedAggregatedMarketInfos) {
        const market = sortedAggregatedMarketInfos[marketIndex];
        const marketApy = performanceLookup[market.id]?.performanceApy ?? 0;
        if (Number(marketIndex) < 20 && marketApy > gmApy) {
          gmApy = marketApy;
        }
      }
      // If the GM APY is less than 0.1, we need to calculate the GM APY based on the market APYs
      if (gmApy <= 0.1) {
        for (const market of sortedAggregatedMarketInfos) {
          const marketApy = apys.markets[market.id]?.apy ?? 0;
          if (marketApy > gmApy) {
            gmApy = marketApy;
          }
        }
      }
      return { gmApy };
    }
    return {};
  }, [sortedAggregatedMarketInfos, performanceLookup, apys]);
  const result: Partial<PoolsData> = {
    ...gmApy,
    ...glvApy,
    totalLiquidity: totalLiquidity,
    openInterest: positionStats && openInterest ? positionStats.openInterest + openInterest : undefined,
    totalDepositedUsers: marketInfos?.totalDepositedUsers,
  };
  return result;
}

function useApysByChainId(chainId: number) {
  const fetcher = useOracleKeeperFetcher(chainId);
  return useSWR(["apys", chainId], async () => {
    const res = await fetcher.fetchApys("90d");
    return res;
  });
}

const marketInfoQuery = {
  query: gql`
    query MarketInfos {
      marketInfos(orderBy: poolValue_DESC, where: { isDisabled_eq: false }) {
        poolValue
        longOpenInterestUsd
        shortOpenInterestUsd
        id
      }
      platformStats {
        depositedUsers
      }
    }
  `,
};

function useMarketInfos() {
  const client = getSubsquidGraphClient(BASE_SEPOLIA);
  return useSWR(["marketInfos"], async () => {
    if (!client) return undefined;
    const res = await client.query(marketInfoQuery);
    const marketInfos = res.data?.marketInfos ?? [];
    const platformStats = res.data?.platformStats?.[0];
    let totalLiquidity = 0n;
    let openInterest = 0n;
    const sortedAggregatedMarketInfos: (MarketInfo & { chainId: number })[] = [];
    for (const marketInfo of marketInfos) {
      sortedAggregatedMarketInfos.push({ ...marketInfo, chainId: BASE_SEPOLIA });
      openInterest +=
        BigInt(marketInfo.longOpenInterestUsd ?? 0n) + BigInt(marketInfo.shortOpenInterestUsd ?? 0n);
      totalLiquidity += BigInt(marketInfo.poolValue);
    }
    return {
      sortedAggregatedMarketInfos,
      totalLiquidity,
      openInterest,
      totalDepositedUsers: platformStats?.depositedUsers ?? 0,
    };
  });
}

function usePerformanceByChainId(chainId: number) {
  const fetcher = useOracleKeeperFetcher(chainId);
  return useSWR(["performance", chainId], async () => {
    const res = await fetcher.fetchPerformanceAnnualized("90d");
    return res;
  });
}

function usePositionStats() {
  return useSWR(
    ["positionStats"],
    async () => {
      const res = await fetchPositionStatsByChainId(BASE_SEPOLIA);
      return {
        openInterest:
          BigInt(res.totalLongPositionSizes) +
          BigInt(res.totalShortPositionSizes),
      };
    },
    {}
  );
}

function fetchPositionStatsByChainId(chainId: number) {
  const url = getServerUrl(chainId, "/position_stats");
  return fetch(url).then((res) => res.json());
}
