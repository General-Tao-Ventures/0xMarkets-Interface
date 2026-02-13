import { gql } from "@apollo/client";
import useSWR from "swr";

import { getCurrentEpochStartedTimestamp } from "domain/stats";
import { getWeekAgoTimestamp } from "domain/stats/getWeekAgoTimestamp";
import { getSubsquidGraphClient } from "lib/subgraph";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

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

function getSumFees(fees: WeeklyFeesInfo, epochStartedTimestamp: number) {
  let epochFees = 0n;

  const weeklyFees = fees.feesInfos.reduce((acc, fee) => {
    const timestamp = Number(fee.id);

    const increment =
      BigInt(fee.totalBorrowingFeeUsd) +
      BigInt(fee.totalPositionFeeUsd) +
      BigInt(fee.totalLiquidationFeeUsd) +
      BigInt(fee.totalSwapFeeUsd);

    if (timestamp >= epochStartedTimestamp) {
      epochFees += increment;
    }

    return acc + increment;
  }, 0n);

  return {
    weeklyFees,
    epochFees,
  };
}

export default function useV2FeesInfo(chainId: number) {
  async function fetcher() {
    try {
      const client = getSubsquidGraphClient(chainId);
      if (!client) return { epochFees: 0n, weeklyFees: 0n, totalFees: 0n };
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
      const totalFees = totalFeeItem
        ? BigInt(totalFeeItem.totalBorrowingFeeUsd) +
          BigInt(totalFeeItem.totalPositionFeeUsd) +
          BigInt(totalFeeItem.totalLiquidationFeeUsd) +
          BigInt(totalFeeItem.totalSwapFeeUsd)
        : 0n;

      const { weeklyFees, epochFees } = getSumFees(weeklyFeesInfo, epochStartedTimestamp);

      return {
        weeklyFees,
        epochFees,
        totalFees,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error fetching feesInfo data for chain ${chainId}:`, error);
      return {
        epochFees: 0n,
        weeklyFees: 0n,
        totalFees: 0n,
      };
    }
  }

  const { data: feesInfo } = useSWR([`useV2FeesInfo-${chainId}`], fetcher, {
    refreshInterval: CONFIG_UPDATE_INTERVAL,
  });

  return feesInfo;
}
