import { Token } from "types/tokens";
import { expandDecimals, USD_DECIMALS } from "utils/numbers";
import { periodToSeconds } from "utils/time";

import { ContractsChainId, BASE_SEPOLIA, LOCALHOST } from "./chains";
import { getTokenBySymbol, getWrappedToken } from "./tokens";

export const SUBACCOUNT_MESSAGE =
  "Generate a GMX 1CT (One-Click Trading) session. Only sign this message on a trusted website.";
export const SUBACCOUNT_DOCS_URL = "https://docs.gmx.io/docs/trading/v2/#one-click-trading";

export const DEFAULT_SUBACCOUNT_EXPIRY_DURATION = periodToSeconds(7, "1d"); // 1 week
export const DEFAULT_SUBACCOUNT_MAX_ALLOWED_COUNT = 90;

export const DEFAULT_PERMIT_DEADLINE_DURATION = periodToSeconds(1, "1h");
export const DEFAULT_EXPRESS_ORDER_DEADLINE_DURATION = periodToSeconds(1, "1h");

export const MIN_GELATO_USD_BALANCE_FOR_SPONSORED_CALL = expandDecimals(100, USD_DECIMALS); // 100$
export const MIN_RELAYER_FEE_USD = 5n ** BigInt(USD_DECIMALS - 1); // 0.5$

export const EXPRESS_EXTRA_EXECUTION_FEE_BUFFER_BPS = 1000;

const GAS_PAYMENT_TOKENS: Record<ContractsChainId, string[]> = {
  [BASE_SEPOLIA]: [getTokenBySymbol(BASE_SEPOLIA, "USDC").address, getTokenBySymbol(BASE_SEPOLIA, "WETH").address],
  [LOCALHOST]: [getTokenBySymbol(LOCALHOST, "USDC").address, getTokenBySymbol(LOCALHOST, "WETH").address],
};

export function getGasPaymentTokens(chainId: number): string[] {
  return GAS_PAYMENT_TOKENS[chainId];
}

export function getDefaultGasPaymentToken(chainId: number): string {
  return GAS_PAYMENT_TOKENS[chainId][0];
}

export function getRelayerFeeToken(chainId: number): Token {
  return getWrappedToken(chainId);
}
