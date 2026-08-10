import { gql } from "@apollo/client";
import { useMemo } from "react";
import useSWR from "swr";
import { type Address, getAddress } from "viem";

import { selectChainId, selectMarketsInfoData } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { getSubsquidGraphClient } from "lib/subgraph/clients";
import { NATIVE_TOKEN_ADDRESS, convertTokenAddress } from "sdk/configs/tokens";
import { getByKey } from "sdk/utils/objects";

type PositionVolumeInfosResponse = Record<Address, bigint>;

export type DayVolumesResult = {
  byIndexToken: PositionVolumeInfosResponse;
  byMarketToken: PositionVolumeInfosResponse;
  isLoading: boolean;
  isError: boolean;
};

const MARKET_VOLUMES_QUERY = gql`
  query MarketVolumesInfoResolver($timestamp: Int!) {
    volumeInfos(where: { timestamp_gte: $timestamp, period_eq: "1h" }, limit: 10000) {
      volumeUsd
      market
    }
  }
`;

const EMPTY_VOLUMES: DayVolumesResult = {
  byIndexToken: {},
  byMarketToken: {},
  isLoading: true,
  isError: false,
};

export function use24hVolumes(): DayVolumesResult {
  const chainId = useSelector(selectChainId);
  const marketsInfoData = useSelector(selectMarketsInfoData);

  const LAST_DAY_UNIX_TIMESTAMP = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const timestamp = LAST_DAY_UNIX_TIMESTAMP;

  const variables = {
    timestamp: timestamp,
  };

  const { data, error, isLoading } = useSWR<PositionVolumeInfosResponse>(
    [chainId, "24hVolume"],
    async () => {
      const client = getSubsquidGraphClient(chainId);

      if (!client) {
        throw new Error("Subsquid GraphQL client unavailable");
      }

      const response = await client.query<{ volumeInfos: { volumeUsd: string; market: string }[] }>({
        query: MARKET_VOLUMES_QUERY,
        variables,
      });

      if (response.errors?.length) {
        throw new Error(response.errors[0]?.message ?? "Subsquid volumeInfos query failed");
      }

      // Sum hourly buckets per market (checksum addresses to match marketsInfoData keys)
      return (response.data?.volumeInfos ?? []).reduce(
        (acc, entry) => {
          const market = getAddress(entry.market) as Address;
          acc[market] = (acc[market] ?? 0n) + BigInt(entry.volumeUsd);
          return acc;
        },
        {} as Record<Address, bigint>
      );
    },
    {
      refreshInterval: 60_000,
    }
  );

  return useMemo(() => {
    const isError = Boolean(error);

    // Loading / error: do not invent $0 — header keeps "..." so ops can tell quiet from down.
    if (isLoading || data === undefined || isError) {
      return {
        ...EMPTY_VOLUMES,
        isLoading: isLoading || (data === undefined && !isError),
        isError,
      };
    }

    if (!marketsInfoData) {
      return {
        byIndexToken: {},
        byMarketToken: data,
        isLoading: true,
        isError: false,
      };
    }

    // Successful Squid response: zero-fill known markets so quiet pairs show $0, not "...".
    const byMarketToken: PositionVolumeInfosResponse = { ...data };
    for (const marketInfo of Object.values(marketsInfoData)) {
      const marketTokenAddress = marketInfo.marketTokenAddress as Address | undefined;
      if (marketTokenAddress && byMarketToken[marketTokenAddress] === undefined) {
        byMarketToken[marketTokenAddress] = 0n;
      }
    }

    const byIndexToken: PositionVolumeInfosResponse = {};
    for (const marketInfo of Object.values(marketsInfoData)) {
      const indexTokenAddress = marketInfo.indexTokenAddress as Address | undefined;
      if (indexTokenAddress && byIndexToken[indexTokenAddress] === undefined) {
        byIndexToken[indexTokenAddress] = 0n;
      }
    }

    Object.entries(byMarketToken).forEach(([market, volume]) => {
      const marketInfo = getByKey(marketsInfoData, market);

      if (!marketInfo) {
        return;
      }

      const indexTokenAddress = marketInfo.indexTokenAddress;

      if (!indexTokenAddress) {
        return;
      }

      byIndexToken[indexTokenAddress] = (byIndexToken[indexTokenAddress] ?? 0n) + BigInt(volume);

      if (indexTokenAddress === convertTokenAddress(chainId, NATIVE_TOKEN_ADDRESS, "wrapped")) {
        byIndexToken[NATIVE_TOKEN_ADDRESS] = byIndexToken[indexTokenAddress];
      }
    });

    return {
      byIndexToken,
      byMarketToken,
      isLoading: false,
      isError: false,
    };
  }, [data, marketsInfoData, chainId, error, isLoading]);
}
