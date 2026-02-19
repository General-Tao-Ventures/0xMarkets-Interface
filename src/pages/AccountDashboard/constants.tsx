import invert from "lodash/invert";
import mapValues from "lodash/mapValues";

import { BASE_SEPOLIA, LOCALHOST, type ContractsChainId } from "config/chains";

export const NETWORK_QUERY_PARAM = "network";
export const VERSION_QUERY_PARAM = "v";

export const NETWORK_ID_SLUGS_MAP: Record<ContractsChainId, string> = {
  [BASE_SEPOLIA]: "base_sepolia",
  [LOCALHOST]: "localhost",
};

export const NETWORK_SLUGS_ID_MAP = mapValues(invert(NETWORK_ID_SLUGS_MAP), Number);
