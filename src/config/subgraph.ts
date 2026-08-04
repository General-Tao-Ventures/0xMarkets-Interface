import { BASE_MAINNET, BASE_SEPOLIA } from "./chains";
import { isDevelopment } from "./env";
import { getSubgraphUrlKey } from "./localStorage";

const SUBGRAPH_URLS = {
  [BASE_MAINNET]: {
    // Same-origin Vercel proxy → GCP Squid (avoids mixed-content on HTTPS Preview/Prod)
    subsquid: "/api/squid/graphql",
  },
  [BASE_SEPOLIA]: {
    subsquid: "https://zero-x-markets.squids.live/0xmarkets-base-sepolia@v1/api/graphql",
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

  return SUBGRAPH_URLS?.[chainId]?.[subgraph];
}
