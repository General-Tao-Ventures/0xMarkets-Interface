import { useMemo } from "react";
import useSWR from "swr";

import { defined } from "lib/guards";
import { PerformancePeriod, PerformanceSnapshotsResponse, useOracleKeeperFetcher } from "lib/oracleKeeperFetcher";

/** Keeper returns 30-decimal fixed-point ints as decimal strings, not human floats. */
function parseFixedPointString(value: string | undefined): bigint | undefined {
  if (value === undefined || value === "") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

export type PerformanceSnapshot = {
  performance: bigint;
  snapshotTimestamp: number;
};

export type PerformanceSnapshotsData = {
  [address: string]: PerformanceSnapshot[];
};

export function usePerformanceSnapshots({
  chainId,
  period,
  address,
}: {
  chainId: number;
  period: PerformancePeriod;
  address?: string;
}) {
  const oracleKeeperFetcher = useOracleKeeperFetcher(chainId);

  const { data, error, isLoading } = useSWR<PerformanceSnapshotsResponse>(
    ["usePerformanceSnapshots", chainId, period, address],
    {
      fetcher: async () => {
        return oracleKeeperFetcher.fetchPerformanceSnapshots(period, address);
      },
    }
  );

  const performanceSnapshots = useMemo(() => {
    if (!data) return {};

    const dataArray = Array.isArray(data) ? data : [];

    return dataArray.reduce((acc, item) => {
      if (!item?.address || !Array.isArray(item.snapshots)) {
        return acc;
      }
      acc[item.address.toLowerCase()] = item.snapshots
        .map((snapshot) => {
          const performance = parseFixedPointString(snapshot.uniswapV2Performance);
          const snapshotTimestamp = parseInt(String(snapshot.snapshotTimestamp), 10);
          if (typeof performance === "undefined" || !Number.isFinite(snapshotTimestamp)) return null;
          return {
            snapshotTimestamp,
            performance,
          };
        })
        .filter(defined)
        .sort((a, b) => a.snapshotTimestamp - b.snapshotTimestamp);
      return acc;
    }, {} as PerformanceSnapshotsData);
  }, [data]);

  return {
    performanceSnapshots,
    error,
    isLoading,
  };
}
