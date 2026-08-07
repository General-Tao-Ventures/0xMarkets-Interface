import { useMemo } from "react";
import useSWR from "swr";

import { PerformanceAnnualizedResponse, PerformancePeriod, useOracleKeeperFetcher } from "lib/oracleKeeperFetcher";

export type PerformanceData = {
  [address: string]: bigint;
};

/** Keeper returns 30-decimal fixed-point ints as decimal strings (e.g. "5e28"), not human floats. */
function parseFixedPointString(value: string | undefined): bigint | undefined {
  if (value === undefined || value === "") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

export function usePerformanceAnnualized({
  chainId,
  period,
  address,
}: {
  chainId: number;
  period: PerformancePeriod;
  address?: string;
}) {
  const oracleKeeperFetcher = useOracleKeeperFetcher(chainId);

  const { data, error, isLoading } = useSWR<PerformanceAnnualizedResponse>(
    ["usePerformanceAnnualized", chainId, period, address],
    {
      fetcher: async () => {
        return oracleKeeperFetcher.fetchPerformanceAnnualized(period, address);
      },
    }
  );

  const performance = useMemo(() => {
    if (!data) return {};

    const dataArray = Array.isArray(data) ? data : [];

    return dataArray.reduce((acc, item) => {
      const performance = parseFixedPointString(item.uniswapV2Performance);
      if (typeof performance === "undefined") return acc;
      acc[item.address.toLowerCase()] = performance;
      return acc;
    }, {} as PerformanceData);
  }, [data]);

  return {
    performance,
    error,
    isLoading,
  };
}
