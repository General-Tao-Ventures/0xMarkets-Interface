/*
  This files is used to pre-build data during the build process.
  Avoid adding client-side code here, as it can break the build process.
*/
import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

export const SWAP_GRAPH_MAX_MARKETS_PER_TOKEN = 5;

export type MarketConfig = {
  marketTokenAddress: string;
  indexTokenAddress: string;
  longTokenAddress: string;
  shortTokenAddress: string;
};

/*
  ATTENTION
  When adding new markets, please add them also to the end of the list in ./src/configs/static/sortedMarkets.ts
*/
export const MARKETS: Record<ContractsChainId, Record<string, MarketConfig>> = {
  [BASE_SEPOLIA]: {
    // EUR/USD [USDC-USDC]
    "0xd3c882AbD5854267d509b944429faA82f3d36088": {
      marketTokenAddress: "0xd3c882AbD5854267d509b944429faA82f3d36088",
      indexTokenAddress: "0x86e6ab05217318Db4A63f0361BADBf5aF0c69270",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // GBP/USD [USDC-USDC]
    "0x981977239025C8F2E133f87b79bEcc587B0e7562": {
      marketTokenAddress: "0x981977239025C8F2E133f87b79bEcc587B0e7562",
      indexTokenAddress: "0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // GOLD/USD [USDC-USDC]
    "0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563": {
      marketTokenAddress: "0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563",
      indexTokenAddress: "0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // USD/JPY [USDC-USDC]
    "0xF28b8572AD4c0BfF5EdfB6579b1Fa6fF0A9Eef5A": {
      marketTokenAddress: "0xF28b8572AD4c0BfF5EdfB6579b1Fa6fF0A9Eef5A",
      indexTokenAddress: "0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WTI/USD [USDC-USDC]
    "0x86607dB26c36df5c31AcdB1C1A58AC113535F89E": {
      marketTokenAddress: "0x86607dB26c36df5c31AcdB1C1A58AC113535F89E",
      indexTokenAddress: "0x5074D0c0dDD78eBd67654BA4DEb0Da81211145B2",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WBTC/USD [USDC-USDC]
    "0x3c3D358701B4df855b3B88D4c840f694c9db8324": {
      marketTokenAddress: "0x3c3D358701B4df855b3B88D4c840f694c9db8324",
      indexTokenAddress: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WETH/USD [USDC-USDC]
    "0x41a281111Aa12a968564a33f9293D9B7b0dDFf19": {
      marketTokenAddress: "0x41a281111Aa12a968564a33f9293D9B7b0dDFf19",
      indexTokenAddress: "0x4200000000000000000000000000000000000006",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
  },
  [LOCALHOST]: {},
};
