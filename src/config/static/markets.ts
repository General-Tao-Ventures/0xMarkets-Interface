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
    // EUR/USD [USDC-USDC]
    "0xB6BfB9D1b8bF5d3603DA6A0C3452119f96500869": {
      enabled: true,
    },
    // GBP/USD [USDC-USDC]
    "0x8c1816E2c44ed62525e128b734FF36579BFdA040": {
      enabled: true,
    },
    // GOLD/USD [USDC-USDC]
    "0x5C7309926a1C58cABB5b991867450894099d9A78": {
      enabled: true,
    },
    // USD/JPY [USDC-USDC]
    "0x8C1bFbC4026dC63e2C04962264007b2c57e20314": {
      enabled: true,
    },
    // WTI/USD [USDC-USDC]
    "0xaE9D503A778803d28CaB919DFC090e8eB2464E6a": {
      enabled: true,
      comingSoon: true,
    },
    // WBTC/USD [USDC-USDC]
    "0x69C926BE8441174c58D93544fF9dEC7F38c7ce32": {
      enabled: true,
    },
    // WETH/USD [USDC-USDC]
    "0x16d3d0c9f0B0C958b281Daa8Cc98cA95991AAFA3": {
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
      }
    >
  >
);
