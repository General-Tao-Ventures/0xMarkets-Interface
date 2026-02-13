import { gql } from "@apollo/client";
import useSWR from "swr";

import { getSubsquidGraphClient } from "lib/subgraph";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

const query = gql`
  query totalUsers {
    userStats(where: { id_eq: "total" }) {
      uniqueUsers
    }
  }
`;

export default function useUsers(chainId: number) {
  async function fetchUsersInfo(chainId: number) {
    try {
      const client = getSubsquidGraphClient(chainId);
      if (!client) return { totalUsers: 0n };
      const { data } = await client.query({
        query,
        fetchPolicy: "no-cache",
      });
      const { userStats } = data;
      return {
        totalUsers: userStats[0] ? BigInt(userStats[0].uniqueUsers) : 0n,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error fetching usersInfo data for chain ${chainId}:`, error);
      return {
        totalUsers: 0n,
      };
    }
  }

  async function fetcher([, chainId]) {
    try {
      const { totalUsers } = await fetchUsersInfo(chainId);
      return {
        totalUsers,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching usersInfo data:", error);
      return {
        totalUsers: 0n,
      };
    }
  }

  const { data: feesInfo } = useSWR(["v2UsersInfo", chainId], fetcher, {
    refreshInterval: CONFIG_UPDATE_INTERVAL,
  });

  return feesInfo;
}
