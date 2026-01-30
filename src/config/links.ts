import { ARBITRUM, AVALANCHE } from "config/chains";
import { TOKENS_BY_SYMBOL_MAP } from "sdk/configs/tokens";

export const PRODUCTION_HOST = "https://app.0xmarkets.io";

const oneInchTokensMap = {
  [ARBITRUM]: {
    BTC: "WBTC",
  },
  [AVALANCHE]: {
    BTC: "BTC.b",
    ETH: "WETH.e",
    WBTC: "WBTC.e",
  },
};

export function get1InchSwapUrl(chainId: number, from?: string, to?: string) {
  const rootUrl = `https://app.1inch.io/#/${chainId}/simple/swap`;
  const chainTokensMap = TOKENS_BY_SYMBOL_MAP[chainId];
  const isInvalidInput = !from || !to || !chainTokensMap[from] || !chainTokensMap[to];
  if (isInvalidInput) {
    return rootUrl;
  }
  const fromToken = oneInchTokensMap[chainId]?.[from] || from;
  const toToken = oneInchTokensMap[chainId]?.[to] || to;
  return `${rootUrl}/${fromToken}/${toToken}`;
}

export function get1InchSwapUrlFromAddresses(chainId: number, fromAddress?: string, toAddress?: string) {
  const addressesStr = [fromAddress, toAddress].filter(Boolean).join("/");
  return `https://app.1inch.io/#/${chainId}/simple/swap/${addressesStr}`;
}

export function getLeaderboardLink(chainId) {
  // TODO: Update with 0xMarkets leaderboard when available
  if (chainId === ARBITRUM) {
    return "https://app.0xmarkets.io/leaderboard";
  }
  if (chainId === AVALANCHE) {
    return "https://app.0xmarkets.io/leaderboard";
  }
  return "https://app.0xmarkets.io/leaderboard";
}

export const DOCS_LINKS = {
  // TODO: Update with 0xMarkets documentation when available
  multiplierPoints: "https://docs.0xmarkets.io/docs/tokenomics/rewards/#multiplier-points",
  fundingFees: "https://docs.0xmarkets.io/docs/trading/v2/#funding-fees",
  adaptiveFunding: "https://docs.0xmarkets.io/docs/trading/v2/#adaptive-funding",
  borrowingFees: "https://docs.0xmarkets.io/docs/trading/v2/#borrowing-fees",
};

// TODO: Update with 0xMarkets incentives pages when available
export const ARBITRUM_INCENTIVES_V2_URL = "https://docs.0xmarkets.io/incentives";
export const AVALANCHE_INCENTIVES_V2_URL = "https://docs.0xmarkets.io/incentives";

export function getIncentivesV2Url(chainId: number): string {
  if (chainId === ARBITRUM) {
    return ARBITRUM_INCENTIVES_V2_URL;
  }

  if (chainId === AVALANCHE) {
    return AVALANCHE_INCENTIVES_V2_URL;
  }

  return ARBITRUM_INCENTIVES_V2_URL;
}
