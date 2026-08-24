import { ethers, JsonRpcProvider, Network, Signer, WebSocketProvider } from "ethers";
import { useEffect, useMemo, useState } from "react";

import {
  AnyChainId,
  FALLBACK_PROVIDERS,
  FORK_RPC_URL,
  getExpressRpcUrl,
  getFallbackRpcUrl,
  ONFINALITY_BASE_WS_URL,
  SOURCE_BASE_MAINNET,
  BASE_SEPOLIA,
  LOCALHOST,
} from "config/chains";
import { isDevelopment } from "config/env";
import { getIsLargeAccount } from "domain/stats/isLargeAccount";
import { getCurrentRpcUrls, useCurrentRpcUrls } from "lib/rpc/bestRpcTracker";

export function getProvider(signer: undefined, chainId: number): ethers.JsonRpcProvider;
export function getProvider(signer: Signer, chainId: number): Signer;
export function getProvider(signer: Signer | undefined, chainId: number): ethers.JsonRpcProvider | Signer;
export function getProvider(signer: Signer | undefined, chainId: number): ethers.JsonRpcProvider | Signer {
  let url;

  if (signer) {
    return signer;
  }

  url = getCurrentRpcUrls(chainId).primary;

  const network = Network.from(chainId);

  return new ethers.JsonRpcProvider(url, chainId, { staticNetwork: network });
}

export function getWsProvider(chainId: AnyChainId): WebSocketProvider | JsonRpcProvider {
  const network = Network.from(chainId);

  // Local anvil fork has no websocket endpoint we want to use -> poll the fork over HTTP.
  if (FORK_RPC_URL) {
    const forkProvider = new ethers.JsonRpcProvider(FORK_RPC_URL, network, {
      staticNetwork: network,
    });
    forkProvider.pollingInterval = 2000;
    return forkProvider;
  }

  if (chainId === SOURCE_BASE_MAINNET) {
    return new ethers.WebSocketProvider(ONFINALITY_BASE_WS_URL, network, {
      staticNetwork: network,
    });
  }

  if (chainId === BASE_SEPOLIA) {
    return new ethers.WebSocketProvider("wss://base-sepolia.core.chainstack.com/eb2a709e3101b602a19c3bebf81d1124", network, {
      staticNetwork: network,
    });
  }

  if (chainId === LOCALHOST) {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", network, {
      staticNetwork: network,
    });
    provider.pollingInterval = 2000;
    return provider;
  }

  throw new Error(`Unsupported websocket provider for chain id: ${chainId}`);
}

export function getFallbackProvider(chainId: number) {
  if (!FALLBACK_PROVIDERS[chainId]) {
    return;
  }

  const providerUrl = getFallbackRpcUrl(chainId, getIsLargeAccount());

  return new ethers.JsonRpcProvider(providerUrl, chainId, {
    staticNetwork: Network.from(chainId),
  });
}

export function getExpressProvider(chainId: number): JsonRpcProvider | undefined {
  const providerUrl: string | undefined = getExpressRpcUrl(chainId);

  if (!providerUrl) {
    return;
  }

  return new ethers.JsonRpcProvider(providerUrl, chainId, {
    staticNetwork: Network.from(chainId),
  });
}

export function useJsonRpcProvider(chainId: number | undefined, { isExpress = false }: { isExpress?: boolean } = {}) {
  const [provider, setProvider] = useState<JsonRpcProvider>();

  const { primary } = useCurrentRpcUrls(chainId);
  const rpcUrl = useMemo(
    () => (isExpress && chainId ? getExpressRpcUrl(chainId) : primary),
    [chainId, isExpress, primary]
  );

  useEffect(() => {
    if (!chainId || !rpcUrl) {
      return;
    }

    let cancelled = false;
    const network = Network.from(chainId);
    const newProvider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });

    newProvider._start();
    newProvider._waitUntilReady().then(() => {
      if (!cancelled) {
        setProvider(newProvider);
      }
    }).catch(() => {
      // Provider failed to initialize; will be retried when rpcUrl changes
    });

    return () => {
      cancelled = true;
      newProvider.destroy();
    };
  }, [chainId, rpcUrl]);

  return { provider };
}

export function isWebsocketProvider(provider: any): provider is WebSocketProvider {
  return Boolean(provider?.websocket);
}

export enum WSReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

const readyStateByEnum = {
  [WSReadyState.CONNECTING]: "connecting",
  [WSReadyState.OPEN]: "open",
  [WSReadyState.CLOSING]: "closing",
  [WSReadyState.CLOSED]: "closed",
};

export function isProviderInClosedState(wsProvider: WebSocketProvider) {
  return [WSReadyState.CLOSED, WSReadyState.CLOSING].includes(wsProvider.websocket.readyState);
}

export function closeWsConnection(wsProvider: WebSocketProvider) {
  if (isDevelopment()) {
    // eslint-disable-next-line no-console
    console.log(
      "closing ws connection, state =",
      readyStateByEnum[wsProvider.websocket.readyState] ?? wsProvider.websocket.readyState
    );
  }

  // Always remove listeners first to prevent duplicate message processing during shutdown
  wsProvider.removeAllListeners();

  if (isProviderInClosedState(wsProvider)) {
    return;
  }

  wsProvider.websocket.close();
}
