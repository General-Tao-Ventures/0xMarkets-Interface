import { BASE_SEPOLIA } from "./chains";
import { isDevelopment } from "./env";
import { getSubgraphUrlKey } from "./localStorage";

const SUBGRAPH_URLS = {
  [BASE_SEPOLIA]: {
    subsquid: "https://7e27672d-eadb-408b-b9b8-71f30d76effd.squids.live/0xmarkets-base-sepolia@v1/api/graphql",
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
