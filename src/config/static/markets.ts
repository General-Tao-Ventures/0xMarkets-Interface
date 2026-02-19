/*
  This files is used to pre-build data during the build process.
  Avoid adding client-side code here, as it can break the build process.

  However, this files can be a dependency for the client code.
*/
import { MARKETS as SDK_MARKETS } from "sdk/configs/markets";

import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";

type MarketUiConfig = {
  enabled: boolean;
};

/*
  ATTENTION
  When adding new markets, please add them also to the end of the list in ./sortedMarkets.ts
*/
const MARKETS_UI_CONFIGS: Record<ContractsChainId, Record<string, MarketUiConfig>> = {
  [BASE_SEPOLIA]: {
    // EUR/USD [USDC-USDC]
    "0xD25DaA1A1c740c070A6DC6F0287bD14398C090E4": {
      enabled: true,
    },
    // GBP/USD [USDC-USDC]
    "0x36C1EF9F39f42d7e84FB054D15E4d3171b7977BF": {
      enabled: true,
    },
    // GOLD/USD [USDC-USDC]
    "0xBA69c6dc7F28E1299e20D5D1d0a48529cB189980": {
      enabled: true,
    },
    // USD/JPY [USDC-USDC]
    "0x4834B9a77b32ca7F1d8A20cf7CA886d92Be98aeF": {
      enabled: true,
    },
    // WBTC/USD [USDC-USDC]
    "0xA4c80F91f4F4b4095220048cb24186e20e48B9D4": {
      enabled: true,
    },
    // WETH/USD [USDC-USDC]
    "0x4DF435E8D40740291571Df779e48662C9521ed7d": {
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
