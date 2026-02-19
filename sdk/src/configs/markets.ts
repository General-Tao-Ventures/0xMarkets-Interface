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
    "0xD25DaA1A1c740c070A6DC6F0287bD14398C090E4": {
      marketTokenAddress: "0xD25DaA1A1c740c070A6DC6F0287bD14398C090E4",
      indexTokenAddress: "0x86e6ab05217318Db4A63f0361BADBf5aF0c69270",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // GBP/USD [USDC-USDC]
    "0x36C1EF9F39f42d7e84FB054D15E4d3171b7977BF": {
      marketTokenAddress: "0x36C1EF9F39f42d7e84FB054D15E4d3171b7977BF",
      indexTokenAddress: "0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // GOLD/USD [USDC-USDC]
    "0xBA69c6dc7F28E1299e20D5D1d0a48529cB189980": {
      marketTokenAddress: "0xBA69c6dc7F28E1299e20D5D1d0a48529cB189980",
      indexTokenAddress: "0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // USD/JPY [USDC-USDC]
    "0x4834B9a77b32ca7F1d8A20cf7CA886d92Be98aeF": {
      marketTokenAddress: "0x4834B9a77b32ca7F1d8A20cf7CA886d92Be98aeF",
      indexTokenAddress: "0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WBTC/USD [USDC-USDC]
    "0xA4c80F91f4F4b4095220048cb24186e20e48B9D4": {
      marketTokenAddress: "0xA4c80F91f4F4b4095220048cb24186e20e48B9D4",
      indexTokenAddress: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WETH/USD [USDC-USDC]
    "0x4DF435E8D40740291571Df779e48662C9521ed7d": {
      marketTokenAddress: "0x4DF435E8D40740291571Df779e48662C9521ed7d",
      indexTokenAddress: "0x4200000000000000000000000000000000000006",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
  },
  [LOCALHOST]: {},
};
