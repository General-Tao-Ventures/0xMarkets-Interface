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
    "0x8B56af349B530101D9d569555722B55E3919e4f7": {
      marketTokenAddress: "0x8B56af349B530101D9d569555722B55E3919e4f7",
      indexTokenAddress: "0x86e6ab05217318Db4A63f0361BADBf5aF0c69270",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // GBP/USD [USD0-USD0]
    "0x8FbD927DE4De0883DF8a560b41F772E2377809E8": {
      marketTokenAddress: "0x8FbD927DE4De0883DF8a560b41F772E2377809E8",
      indexTokenAddress: "0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // GOLD/USD [USD0-USD0]
    "0x9479d96EBFc0F2d4e5187F9ae51632770FBA6b6C": {
      marketTokenAddress: "0x9479d96EBFc0F2d4e5187F9ae51632770FBA6b6C",
      indexTokenAddress: "0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // XAG/USD [USD0-USD0]
    "0x8C0f2eB9804777118FA0cAA98e76e88F1ed5C8bA": {
      marketTokenAddress: "0x8C0f2eB9804777118FA0cAA98e76e88F1ed5C8bA",
      indexTokenAddress: "0x135F2FF47e19BeDDD88572a39EcfF1edaFF8642E",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // USD/JPY [USD0-USD0]
    "0xF59FBcA079260351d30338eC6B839f3CFA8cCf42": {
      marketTokenAddress: "0xF59FBcA079260351d30338eC6B839f3CFA8cCf42",
      indexTokenAddress: "0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      reversed: true,
    },
    // WTI/USD [USD0-USD0]
    "0x9941A181B007Afb125b70d34F61d6A0ABB9eba5A": {
      marketTokenAddress: "0x9941A181B007Afb125b70d34F61d6A0ABB9eba5A",
      indexTokenAddress: "0x3456410D1D9C3fACEDCac77A38a8b66e8dD1e49B",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // WBTC/USD [USD0-USD0]
    "0xddF31Fd58463207225AaCE5c96f0410813A6e20e": {
      marketTokenAddress: "0xddF31Fd58463207225AaCE5c96f0410813A6e20e",
      indexTokenAddress: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // WETH/USD [USD0-USD0]
    "0x04bbdaA7d89e6456786d0dDD3BA224c275309a18": {
      marketTokenAddress: "0x04bbdaA7d89e6456786d0dDD3BA224c275309a18",
      indexTokenAddress: "0x4200000000000000000000000000000000000006",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
    // TAO/USD [USD0-USD0]
    "0x2fFBE33E825a1520D0eAFaf8D19B7d1bd7f025dD": {
      marketTokenAddress: "0x2fFBE33E825a1520D0eAFaf8D19B7d1bd7f025dD",
      indexTokenAddress: "0x8E235a31AB3bb754DA40d05e4E5787b67c8BeDcd",
      longTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
      shortTokenAddress: "0x3ae4474579d24a743c9016F017e76185A834d837",
    },
  },
  [LOCALHOST]: {},
};
