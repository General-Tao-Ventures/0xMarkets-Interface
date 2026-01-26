import { gql } from "@apollo/client";
import useSWR from "swr";
import type { Address } from "viem";

import { getSubsquidGraphClient } from "lib/subgraph/clients";
import type { ContractsChainId } from "sdk/configs/chains";
import { getByKey } from "sdk/utils/objects";

import { convertToUsd, useTokensDataRequest } from "../tokens";

// Query all positions with collateral data to compute totals client-side
const POSITIONS_COLLATERAL_QUERY = gql`
  query PositionsCollateral {
    positions(where: { sizeInUsd_gt: "0" }) {
      collateralAmount
      collateralToken
    }
  }
`;

type PositionCollateralResponse = {
  positions: { collateralAmount: string; collateralToken: Address }[];
};

export function usePositionsTotalCollateral(chainId: ContractsChainId) {
  const { tokensData } = useTokensDataRequest(chainId);

  const { data } = useSWR<bigint | undefined>(
    [chainId, tokensData, "positionsCollateral"],
    async () => {
      const client = getSubsquidGraphClient(chainId);

      if (!client || !tokensData) {
        return;
      }

      const response = await client.query<PositionCollateralResponse>({
        query: POSITIONS_COLLATERAL_QUERY,
      });

      if (!response.data?.positions) {
        return 0n;
      }

      // Aggregate collateral by token first
      const collateralByToken = new Map<Address, bigint>();
      for (const position of response.data.positions) {
        const token = position.collateralToken;
        const amount = BigInt(position.collateralAmount);
        const existing = collateralByToken.get(token) || 0n;
        collateralByToken.set(token, existing + amount);
      }

      // Convert to USD
      let totalCollateralUsd = 0n;
      for (const [tokenAddress, amount] of collateralByToken) {
        const token = getByKey(tokensData, tokenAddress);

        if (!token || token.prices?.minPrice === undefined) {
          continue;
        }

        const collateralUsd = convertToUsd(amount, token.decimals, token.prices.minPrice);
        if (collateralUsd !== undefined) {
          totalCollateralUsd += collateralUsd;
        }
      }

      return totalCollateralUsd;
    },
    {
      errorRetryCount: 2,
      refreshInterval: 60_000,
    }
  );

  return data;
}
