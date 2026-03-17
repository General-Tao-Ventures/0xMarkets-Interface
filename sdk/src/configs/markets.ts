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
  reversed?: boolean;
};

/*
  ATTENTION
  When adding new markets, please add them also to the end of the list in ./src/configs/static/sortedMarkets.ts
*/
export const MARKETS: Record<ContractsChainId, Record<string, MarketConfig>> = {
  [BASE_SEPOLIA]: {
    // EUR/USD [USD0-USD0]
    "0x7054eb596aCF4fC1C0686C9B2cdAC4aE6c6D0F33": {
      marketTokenAddress: "0x7054eb596aCF4fC1C0686C9B2cdAC4aE6c6D0F33",
      indexTokenAddress: "0x18909CC26672376e8FDF1fa54Fc5B892dd6E2b0C",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // GBP/USD [USD0-USD0]
    "0xa09b59adf15B4ED98a099441b84Ff1eABf71B548": {
      marketTokenAddress: "0xa09b59adf15B4ED98a099441b84Ff1eABf71B548",
      indexTokenAddress: "0xf7255EAb2968Fb6B8b6226eB25c6EDC2F1CcE60a",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // GOLD/USD [USD0-USD0]
    "0x89c3B33bEE4b9cD1B246BE44aDcEd870F74637a3": {
      marketTokenAddress: "0x89c3B33bEE4b9cD1B246BE44aDcEd870F74637a3",
      indexTokenAddress: "0xf4ac308123764edFB7453a7446D01277D7DEa1A7",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // XAG/USD [USD0-USD0] (v2 — replaces old 0xF95b market)
    "0x6D260c4229dBb55a0a91041b5c07b320fdD6303B": {
      marketTokenAddress: "0x6D260c4229dBb55a0a91041b5c07b320fdD6303B",
      indexTokenAddress: "0x25f79151C3E00ba7710EcF02192836994E36b440",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // USD/JPY [USD0-USD0]
    "0xD847a999faCe1f862120117C33ae8faBA768fD4b": {
      marketTokenAddress: "0xD847a999faCe1f862120117C33ae8faBA768fD4b",
      indexTokenAddress: "0x7836DF766375f02D71fa3617F5F06a0712699A81",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      reversed: true,
    },
    // WTI/USD [USD0-USD0]
    "0x80d260188c592F7F175F843EDc257b6A6Af6e5eF": {
      marketTokenAddress: "0x80d260188c592F7F175F843EDc257b6A6Af6e5eF",
      indexTokenAddress: "0x4B4A8E5a0deEC8611e647255425eC68A846046d4",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // WBTC/USD [USD0-USD0]
    "0x63D05Da932541380df8d9eE20D8FdB4B02849398": {
      marketTokenAddress: "0x63D05Da932541380df8d9eE20D8FdB4B02849398",
      indexTokenAddress: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // WETH/USD [USD0-USD0]
    "0x23F40e3279685413b252A6944AF9a0641D3aa6ce": {
      marketTokenAddress: "0x23F40e3279685413b252A6944AF9a0641D3aa6ce",
      indexTokenAddress: "0x4200000000000000000000000000000000000006",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
  },
  [LOCALHOST]: {},
};
