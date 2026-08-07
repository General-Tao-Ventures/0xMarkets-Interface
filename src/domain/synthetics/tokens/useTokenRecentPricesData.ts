import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useKeeperWebSocket, useKeeperWebSocketState, isNewerThan } from "lib/keeperWebSocket";
import type { TickerData } from "lib/keeperWebSocket";
import { useOracleKeeperFetcher } from "lib/oracleKeeperFetcher/useOracleKeeperFetcher";
import { LEADERBOARD_PRICES_UPDATE_INTERVAL, PRICES_UPDATE_INTERVAL } from "lib/timeConstants";
import { getToken, getWrappedToken, NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";
import type { Token } from "sdk/types/tokens";

import { TokenPricesData } from "./types";
import { useSequentialTimedSWR } from "./useSequentialTimedSWR";
import { parseContractPrice } from "./utils";

const WS_CONNECTED_POLL_INTERVAL = 10_000;

/** Ignore wrong-chain WS feeds (e.g. Sepolia USD0 tickers while UI is on Base mainnet). */
const MIN_MAPPED_TICKERS_FOR_WS = 3;

type TokenPricesDataResult = {
  pricesData?: TokenPricesData;
  updatedAt?: number;
  error?: Error;
  isPriceDataLoading: boolean;
};

function mapTickersToPrices(chainId: number, priceItems: TickerData[]): TokenPricesData {
  const result: TokenPricesData = {};

  for (const priceItem of priceItems) {
    let tokenConfig: Token;

    try {
      tokenConfig = getToken(chainId, priceItem.tokenAddress);
    } catch {
      continue;
    }

    result[tokenConfig.address] = {
      minPrice: parseContractPrice(BigInt(priceItem.minPrice), tokenConfig.decimals),
      maxPrice: parseContractPrice(BigInt(priceItem.maxPrice), tokenConfig.decimals),
    };
  }

  const wrappedToken = getWrappedToken(chainId);

  if (result[wrappedToken.address] && !result[NATIVE_TOKEN_ADDRESS]) {
    result[NATIVE_TOKEN_ADDRESS] = result[wrappedToken.address];
  }

  return result;
}

function countMappedTickers(prices: TokenPricesData): number {
  // Native is mirrored from wrapped — don't double-count
  return Object.keys(prices).filter((address) => address !== NATIVE_TOKEN_ADDRESS).length;
}

export function useTokenRecentPricesRequest(chainId: number): TokenPricesDataResult {
  const oracleKeeperFetcher = useOracleKeeperFetcher(chainId);
  const pathname = useLocation().pathname;
  const { manager } = useKeeperWebSocket();
  const wsState = useKeeperWebSocketState();

  const wsLatestRef = useRef<{ data: TickerData[]; maxUpdatedAt: number } | null>(null);

  // Adaptive polling: 10s when WS connected, 1s when disconnected
  const refreshPricesInterval = useMemo(() => {
    if (pathname.startsWith("/leaderboard") || pathname.startsWith("/competitions")) {
      return LEADERBOARD_PRICES_UPDATE_INTERVAL;
    }
    return wsState === "connected" ? WS_CONNECTED_POLL_INTERVAL : PRICES_UPDATE_INTERVAL;
  }, [pathname, wsState]);

  const { data, error, isLoading, mutate } = useSequentialTimedSWR(
    [chainId, oracleKeeperFetcher.url, "useTokenRecentPrices"],
    {
      refreshInterval: refreshPricesInterval,
      fetcher: ([chainId]) =>
        oracleKeeperFetcher.fetchTickers().then((priceItems) => {
          // Prefer fresher WS only when it maps to this chain's tokens
          const wsLatest = wsLatestRef.current;
          if (wsLatest) {
            const httpMaxUpdatedAt = priceItems.length > 0 ? Math.max(...priceItems.map((t) => t.updatedAt)) : 0;
            if (isNewerThan(wsLatest.maxUpdatedAt, httpMaxUpdatedAt)) {
              const wsMapped = mapTickersToPrices(chainId, wsLatest.data);
              if (countMappedTickers(wsMapped) >= MIN_MAPPED_TICKERS_FOR_WS) {
                priceItems = wsLatest.data;
              }
            }
          }

          const result = mapTickersToPrices(chainId, priceItems);

          return {
            pricesData: result,
            updatedAt: Date.now(),
          };
        }),
      refreshWhenHidden: true,
    }
  );

  // Subscribe to WS ticker events and update SWR cache directly (no refetch)
  useEffect(() => {
    wsLatestRef.current = null;

    const handler = (tickers: TickerData[]) => {
      const result = mapTickersToPrices(chainId, tickers);

      // Sepolia (or other) feeds share WETH address — refuse to wipe mainnet USDC/indices
      if (countMappedTickers(result) < MIN_MAPPED_TICKERS_FOR_WS) {
        return;
      }

      const maxUpdatedAt = Math.max(...tickers.map((t) => t.updatedAt));
      wsLatestRef.current = { data: tickers, maxUpdatedAt };

      mutate({ result: { pricesData: result, updatedAt: Date.now() }, start: Date.now() }, { revalidate: false });
    };

    manager.on("ticker", handler);
    return () => {
      manager.off("ticker", handler);
    };
  }, [chainId, manager, mutate]);

  return {
    pricesData: data?.pricesData,
    updatedAt: data?.updatedAt,
    error,
    isPriceDataLoading: isLoading,
  };
}
