import { gql } from "@apollo/client";
import useSWR from "swr";

import { getCurrentEpochStartedTimestamp } from "domain/stats";
import { getWeekAgoTimestamp } from "domain/stats/getWeekAgoTimestamp";
import { getSubsquidGraphClient } from "lib/subgraph";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

/**
 * The squid stores fee values in collateral-token precision (6 decimals for
 * USD0) but the rest of the frontend expects 30-decimal USD values. Multiply
 * by this factor to bridge the gap: 10^(30 - 6) = 10^24.
 */
const FEE_PRECISION_SCALE = 10n ** 24n;

const totalFeeQuery = gql`
  query totalFeesInfo {
    feesInfos(where: { id_eq: "total" }) {
      totalBorrowingFeeUsd
      totalPositionFeeUsd
      totalLiquidationFeeUsd
      totalSwapFeeUsd
    }
  }
`;

const weeklyFeeQuery = gql`
  query weeklyFeesInfo($weekAgoTimestamp: String!) {
    feesInfos(
      where: { id_gte: $weekAgoTimestamp, period_eq: "1d" }
      orderBy: id_ASC
    ) {
      id
      totalBorrowingFeeUsd
      totalPositionFeeUsd
      totalLiquidationFeeUsd
      totalSwapFeeUsd
    }
  }
`;

type FeesInfoItem = {
  id: string;
  totalBorrowingFeeUsd: string;
  totalPositionFeeUsd: string;
  totalLiquidationFeeUsd: string;
  totalSwapFeeUsd: string;
};

type WeeklyFeesInfo = {
  feesInfos: FeesInfoItem[];
};

function scaleToUsd30(raw: bigint): bigint {
  return raw * FEE_PRECISION_SCALE;
}

function sumAllFeeTypes(item: FeesInfoItem): bigint {
  return (
    BigInt(item.totalPositionFeeUsd) +
    BigInt(item.totalBorrowingFeeUsd) +
    BigInt(item.totalLiquidationFeeUsd) +
    BigInt(item.totalSwapFeeUsd)
  );
}

function getSumFees(fees: WeeklyFeesInfo, epochStartedTimestamp: number) {
  let epochFees = 0n;

  const weeklyFees = fees.feesInfos.reduce((acc, fee) => {
    const timestamp = Number(fee.id);
    const increment = sumAllFeeTypes(fee);

    if (timestamp >= epochStartedTimestamp) {
      epochFees += increment;
    }

    return acc + increment;
  }, 0n);

  return {
    weeklyFees: scaleToUsd30(weeklyFees),
    epochFees: scaleToUsd30(epochFees),
  };
}

export type FeesInfoData = {
  epochFees: bigint;
  weeklyFees: bigint;
  totalFees: bigint;
  totalPositionFees: bigint;
  totalBorrowingFees: bigint;
  totalLiquidationFees: bigint;
};

const EMPTY_FEES: FeesInfoData = {
  epochFees: 0n,
  weeklyFees: 0n,
  totalFees: 0n,
  totalPositionFees: 0n,
  totalBorrowingFees: 0n,
  totalLiquidationFees: 0n,
};

export default function useV2FeesInfo(chainId: number) {
  async function fetcher(): Promise<FeesInfoData> {
    try {
      const client = getSubsquidGraphClient(chainId);
      if (!client) return EMPTY_FEES;
      const epochStartedTimestamp = getCurrentEpochStartedTimestamp();
      const weekAgoTimestamp = getWeekAgoTimestamp();

      const [{ data: weeklyFeesInfo }, { data: totalFeesInfo }] = await Promise.all([
        client.query<WeeklyFeesInfo>({
          query: weeklyFeeQuery,
          variables: {
            weekAgoTimestamp: String(weekAgoTimestamp),
          },
          fetchPolicy: "no-cache",
        }),
        client.query<{ feesInfos: FeesInfoItem[] }>({
          query: totalFeeQuery,
          fetchPolicy: "no-cache",
        }),
      ]);

      const totalFeeItem = totalFeesInfo.feesInfos[0];

      const totalPositionFees = scaleToUsd30(BigInt(totalFeeItem?.totalPositionFeeUsd ?? "0"));
      const totalBorrowingFees = scaleToUsd30(BigInt(totalFeeItem?.totalBorrowingFeeUsd ?? "0"));
      const totalLiquidationFees = scaleToUsd30(BigInt(totalFeeItem?.totalLiquidationFeeUsd ?? "0"));
      const totalFees = totalPositionFees + totalBorrowingFees + totalLiquidationFees;

      const { weeklyFees, epochFees } = getSumFees(weeklyFeesInfo, epochStartedTimestamp);

      return {
        weeklyFees,
        epochFees,
        totalFees,
        totalPositionFees,
        totalBorrowingFees,
        totalLiquidationFees,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error fetching feesInfo data for chain ${chainId}:`, error);
      return EMPTY_FEES;
    }
  }

  const { data: feesInfo } = useSWR([`useV2FeesInfo-${chainId}`], fetcher, {
    refreshInterval: CONFIG_UPDATE_INTERVAL,
  });

  return feesInfo;
}
