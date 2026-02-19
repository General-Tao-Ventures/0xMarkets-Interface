import { ClientConfig, MulticallBatchOptions } from "viem";

import {
  AnyChainId,
  BASE_SEPOLIA,
  LOCALHOST,
  SOURCE_BASE_MAINNET,
} from "./chains";

export const BATCH_CONFIGS: Record<
  AnyChainId,
  {
    http: MulticallBatchOptions;
    client: ClientConfig["batch"];
  }
> = {
  [SOURCE_BASE_MAINNET]: {
    http: {
      batchSize: 0,
      wait: 0,
    },
    client: {
      multicall: {
        batchSize: 1024 * 1024,
        wait: 0,
      },
    },
  },
  [BASE_SEPOLIA]: {
    http: {
      batchSize: 40,
      wait: 100,
    },
    client: {
      multicall: {
        batchSize: 1024 * 1024,
        wait: 100,
      },
    },
  },
  [LOCALHOST]: {
    http: {
      batchSize: 40,
      wait: 0,
    },
    client: {
      multicall: {
        batchSize: 1024 * 1024,
        wait: 0,
      },
    },
  },
};
