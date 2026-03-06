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
  fundingFees: "https://docs.0xmarkets.io/trading/fees#funding-fees",
  adaptiveFunding: "https://docs.0xmarkets.io/trading/fees#funding-fees",
  borrowingFees: "https://docs.0xmarkets.io/trading/fees#borrowing-fees",
};

export const INCENTIVES_V2_URL = "https://docs.0xmarkets.io/trading";

export function getIncentivesV2Url(_chainId: number): string {
  return INCENTIVES_V2_URL;
}
