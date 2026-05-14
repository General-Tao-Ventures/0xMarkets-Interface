/*
  This files is used to pre-build data during the build process.
  Avoid adding client-side code here, as it can break the build process.

  However, this files can be a dependency for the client code.
*/
import { MARKETS as SDK_MARKETS } from "sdk/configs/markets";

import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

type MarketUiConfig = {
  enabled: boolean;
  comingSoon?: boolean;
};

/*
  ATTENTION
  When adding new markets, please add them also to the end of the list in ./sortedMarkets.ts
*/
const MARKETS_UI_CONFIGS: Record<ContractsChainId, Record<string, MarketUiConfig>> = {
  [BASE_SEPOLIA]: {
    // EUR/USD [USD0-USD0]
    "0x8B56af349B530101D9d569555722B55E3919e4f7": {
      enabled: true,
    },
    // GBP/USD [USD0-USD0]
    "0x8FbD927DE4De0883DF8a560b41F772E2377809E8": {
      enabled: true,
    },
    // GOLD/USD [USD0-USD0]
    "0x9479d96EBFc0F2d4e5187F9ae51632770FBA6b6C": {
      enabled: true,
    },
    // XAG/USD [USD0-USD0]
    "0x8C0f2eB9804777118FA0cAA98e76e88F1ed5C8bA": {
      enabled: true,
    },
    // USD/JPY [USD0-USD0]
    "0xF59FBcA079260351d30338eC6B839f3CFA8cCf42": {
      enabled: true,
    },
    // WTI/USD [USD0-USD0]
    "0x9941A181B007Afb125b70d34F61d6A0ABB9eba5A": {
      enabled: true,
      comingSoon: true,
    },
    // WBTC/USD [USD0-USD0]
    "0xddF31Fd58463207225AaCE5c96f0410813A6e20e": {
      enabled: true,
    },
    // WETH/USD [USD0-USD0]
    "0x04bbdaA7d89e6456786d0dDD3BA224c275309a18": {
      enabled: true,
    },
    // TAO/USD [USD0-USD0]
    "0x2fFBE33E825a1520D0eAFaf8D19B7d1bd7f025dD": {
      enabled: true,
    },
  },
  [LOCALHOST]: {},
};

export const MARKETS = Object.keys(MARKETS_UI_CONFIGS).reduce(
  (acc, network) => {
    return {
      ...acc,
      [network]: Object.keys(MARKETS_UI_CONFIGS[network]).reduce((acc, address) => {
        return {
          ...acc,
          [address]: {
            ...SDK_MARKETS[network][address],
            ...MARKETS_UI_CONFIGS[network][address],
          },
        };
      }, {}),
    };
  },
  {} as Record<
    number,
    Record<
      string,
      MarketUiConfig & {
        longTokenAddress: string;
        shortTokenAddress: string;
        indexTokenAddress: string;
        marketTokenAddress: string;
        reversed?: boolean;
      }
    >
  >
);
