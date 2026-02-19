import { TOKENS_BY_SYMBOL_MAP } from "sdk/configs/tokens";

export const PRODUCTION_HOST = "https://app.0xmarkets.io";

export function get1InchSwapUrl(chainId: number, from?: string, to?: string) {
  const rootUrl = `https://app.1inch.io/#/${chainId}/simple/swap`;
  const chainTokensMap = TOKENS_BY_SYMBOL_MAP[chainId];
  const isInvalidInput = !from || !to || !chainTokensMap[from] || !chainTokensMap[to];
  if (isInvalidInput) {
    return rootUrl;
  }
  return `${rootUrl}/${from}/${to}`;
}

export function get1InchSwapUrlFromAddresses(chainId: number, fromAddress?: string, toAddress?: string) {
  const addressesStr = [fromAddress, toAddress].filter(Boolean).join("/");
  return `https://app.1inch.io/#/${chainId}/simple/swap/${addressesStr}`;
}

export function getLeaderboardLink(_chainId) {
  return "https://app.0xmarkets.io/leaderboard";
}

export const DOCS_LINKS = {
  multiplierPoints: "https://docs.0xmarkets.io/docs/tokenomics/rewards/#multiplier-points",
  fundingFees: "https://docs.0xmarkets.io/docs/trading/v2/#funding-fees",
  adaptiveFunding: "https://docs.0xmarkets.io/docs/trading/v2/#adaptive-funding",
  borrowingFees: "https://docs.0xmarkets.io/docs/trading/v2/#borrowing-fees",
};

export const INCENTIVES_V2_URL = "https://docs.0xmarkets.io/incentives";

export function getIncentivesV2Url(_chainId: number): string {
  return INCENTIVES_V2_URL;
}
