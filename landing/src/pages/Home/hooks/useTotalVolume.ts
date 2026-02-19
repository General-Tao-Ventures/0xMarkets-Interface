import { gql } from "@apollo/client";
import useSWR from "swr";

import { getSyntheticsGraphClient } from "lib/subgraph";
import { BASE_SEPOLIA } from "sdk/configs/chainIds";

const query = {
  query: gql`
    query VolumeInfos {
      volumeInfos(where: { period: "total" }) {
        volumeUsd
      }
    }
  `,
};

export function useTotalVolume() {
  const client = getSyntheticsGraphClient(BASE_SEPOLIA);
  return useSWR(["volumeInfos"], async () => {
    if (!client) return 0n;
    try {
      const res = await client.query(query);
      return BigInt(res.data?.volumeInfos?.[0]?.volumeUsd ?? 0n);
    } catch {
      return 0n;
    }
  });
}
