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
    "0xB6BfB9D1b8bF5d3603DA6A0C3452119f96500869": {
      marketTokenAddress: "0xB6BfB9D1b8bF5d3603DA6A0C3452119f96500869",
      indexTokenAddress: "0x18909CC26672376e8FDF1fa54Fc5B892dd6E2b0C",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // GBP/USD [USDC-USDC]
    "0x8c1816E2c44ed62525e128b734FF36579BFdA040": {
      marketTokenAddress: "0x8c1816E2c44ed62525e128b734FF36579BFdA040",
      indexTokenAddress: "0xf7255EAb2968Fb6B8b6226eB25c6EDC2F1CcE60a",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // GOLD/USD [USDC-USDC]
    "0x5C7309926a1C58cABB5b991867450894099d9A78": {
      marketTokenAddress: "0x5C7309926a1C58cABB5b991867450894099d9A78",
      indexTokenAddress: "0xf4ac308123764edFB7453a7446D01277D7DEa1A7",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // USD/JPY [USDC-USDC]
    "0x8C1bFbC4026dC63e2C04962264007b2c57e20314": {
      marketTokenAddress: "0x8C1bFbC4026dC63e2C04962264007b2c57e20314",
      indexTokenAddress: "0x7836DF766375f02D71fa3617F5F06a0712699A81",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WTI/USD [USDC-USDC]
    "0xaE9D503A778803d28CaB919DFC090e8eB2464E6a": {
      marketTokenAddress: "0xaE9D503A778803d28CaB919DFC090e8eB2464E6a",
      indexTokenAddress: "0x4B4A8E5a0deEC8611e647255425eC68A846046d4",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WBTC/USD [USDC-USDC]
    "0x69C926BE8441174c58D93544fF9dEC7F38c7ce32": {
      marketTokenAddress: "0x69C926BE8441174c58D93544fF9dEC7F38c7ce32",
      indexTokenAddress: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
    // WETH/USD [USDC-USDC]
    "0x16d3d0c9f0B0C958b281Daa8Cc98cA95991AAFA3": {
      marketTokenAddress: "0x16d3d0c9f0B0C958b281Daa8Cc98cA95991AAFA3",
      indexTokenAddress: "0x4200000000000000000000000000000000000006",
      longTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
      shortTokenAddress: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b",
    },
  },
  [LOCALHOST]: {},
};
