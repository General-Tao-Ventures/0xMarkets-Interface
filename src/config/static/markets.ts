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
    "0xd3c882AbD5854267d509b944429faA82f3d36088": {
      enabled: true,
    },
    // GBP/USD [USDC-USDC]
    "0x981977239025C8F2E133f87b79bEcc587B0e7562": {
      enabled: true,
    },
    // GOLD/USD [USDC-USDC]
    "0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563": {
      enabled: true,
    },
    // USD/JPY [USDC-USDC]
    "0xF28b8572AD4c0BfF5EdfB6579b1Fa6fF0A9Eef5A": {
      enabled: true,
    },
    // WBTC/USD [USDC-USDC]
    "0x3c3D358701B4df855b3B88D4c840f694c9db8324": {
      enabled: true,
    },
    // WETH/USD [USDC-USDC]
    "0x41a281111Aa12a968564a33f9293D9B7b0dDFf19": {
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
