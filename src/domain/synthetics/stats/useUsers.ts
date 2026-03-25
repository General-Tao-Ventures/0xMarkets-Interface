import { gql } from "@apollo/client";
import useSWR from "swr";

import { getSubsquidGraphClient } from "lib/subgraph";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

const query = gql`
  query totalUsers {
    accountStatsConnection(orderBy: id_ASC) {
      totalCount
    }
  }
`;

export default function useUsers(chainId: number) {
  async function fetcher([, chainId]: [string, number]) {
    try {
      const client = getSubsquidGraphClient(chainId);
      if (!client) return { totalUsers: 0n };
      const { data } = await client.query({
        query,
        fetchPolicy: "no-cache",
      });
      return {
        totalUsers: BigInt(data.accountStatsConnection?.totalCount ?? 0),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error fetching usersInfo data for chain ${chainId}:`, error);
      return { totalUsers: 0n };
    }
  }

  const { data: feesInfo } = useSWR(["v2UsersInfo", chainId], fetcher, {
    refreshInterval: CONFIG_UPDATE_INTERVAL,
  });

  return feesInfo;
}
