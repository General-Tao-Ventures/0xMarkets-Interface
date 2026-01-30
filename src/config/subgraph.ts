import { ARBITRUM, ARBITRUM_SEPOLIA, AVALANCHE, AVALANCHE_FUJI, BASE_SEPOLIA, BOTANIX, ETH_MAINNET } from "./chains";
import { isDevelopment } from "./env";
import { getSubgraphUrlKey } from "./localStorage";

const SUBGRAPH_URLS = {
  // TODO: Deploy 0xMarkets indexers for other chains when ready
  [ARBITRUM]: {
    // Placeholder - will need 0xMarkets indexer deployment
  },

  [AVALANCHE]: {
    // Placeholder - will need 0xMarkets indexer deployment
  },

  [AVALANCHE_FUJI]: {
    // Placeholder - will need 0xMarkets indexer deployment
  },

  [ARBITRUM_SEPOLIA]: {
    // Placeholder - will need 0xMarkets indexer deployment
  },

  [BOTANIX]: {
    // Placeholder - will need 0xMarkets indexer deployment
  },

  [BASE_SEPOLIA]: {
    subsquid: "https://7e27672d-eadb-408b-b9b8-71f30d76effd.squids.live/0xmarkets-base-sepolia@v1/api/graphql",
  },

  common: {
    [ETH_MAINNET]: {
      chainLink: "https://api.thegraph.com/subgraphs/name/deividask/chainlink",
    },
  },
};

export function getSubgraphUrl(
  chainId: number,
  subgraph: "stats" | "referrals" | "nissohVault" | "syntheticsStats" | "subsquid" | "chainLink"
): string | undefined {
  if (isDevelopment()) {
    const localStorageKey = getSubgraphUrlKey(chainId, subgraph);
    const url = localStorage.getItem(localStorageKey);
    if (url) {
      // eslint-disable-next-line no-console
      console.warn("%s subgraph on chain %s url is overriden: %s", subgraph, chainId, url);
      return url;
    }
  }

  if (chainId === ETH_MAINNET) {
    return SUBGRAPH_URLS.common[ETH_MAINNET]?.[subgraph];
  }

  return SUBGRAPH_URLS?.[chainId]?.[subgraph];
}
