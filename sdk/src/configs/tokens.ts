import { zeroAddress } from "viem";

import type { Token, TokenAddressTypesMap, TokenCategory } from "types/tokens";

import { BASE_SEPOLIA, LOCALHOST } from "./chains";
import { getContract } from "./contracts";

export const NATIVE_TOKEN_ADDRESS = zeroAddress;

export const TOKENS: { [chainId: number]: Token[] } = {
  [BASE_SEPOLIA]: [
    {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      address: zeroAddress,
      isNative: true,
      isShortable: true,
      categories: ["layer1"],
      imageUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png?1595348880",
      coingeckoUrl: "https://www.coingecko.com/en/coins/ethereum",
      isV1Available: true,
    },
    {
      name: "Wrapped ETH",
      symbol: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      isWrapped: true,
      baseSymbol: "ETH",
      categories: ["layer1"],
      imageUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png?1595348880",
      coingeckoUrl: "https://www.coingecko.com/en/coins/ethereum",
    },
    {
      name: "USD0",
      symbol: "USD0",
      address: "0x3ae4474579d24a743c9016F017e76185A834d837",
      decimals: 6,
      isStable: true,
      imageUrl: "https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png?1547042389",
    },
    {
      name: "Euro",
      symbol: "EUR",
      decimals: 6,
      address: "0x18909CC26672376e8FDF1fa54Fc5B892dd6E2b0C",
      isSynthetic: true,
      imageUrl: "https://assets.coingecko.com/coins/images/14423/small/stasis-euro.png",
      coingeckoUrl: "https://www.coingecko.com/en/coins/stasis-euro",
    },
    {
      name: "British Pound",
      symbol: "GBP",
      decimals: 6,
      address: "0xf7255EAb2968Fb6B8b6226eB25c6EDC2F1CcE60a",
      isSynthetic: true,
      imageUrl: "https://assets.coingecko.com/coins/images/1/small/gbp.png",
      coingeckoUrl: "https://www.coingecko.com/en/coins/gbp",
    },
    {
      name: "Gold",
      symbol: "GOLD",
      decimals: 6,
      address: "0xf4ac308123764edFB7453a7446D01277D7DEa1A7",
      isSynthetic: true,
      imageUrl: "https://assets.coingecko.com/coins/images/3090/small/gold.png",
      coingeckoUrl: "https://www.coingecko.com/en/coins/gold",
    },
    {
      name: "Silver",
      symbol: "XAG",
      decimals: 6,
      address: "0x25f79151C3E00ba7710EcF02192836994E36b440",
      isSynthetic: true,
      imageUrl: "https://assets.coingecko.com/coins/images/1090/small/silver.png",
    },
    {
      name: "Japanese Yen",
      symbol: "JPY",
      decimals: 6,
      address: "0x7836DF766375f02D71fa3617F5F06a0712699A81",
      isSynthetic: true,
      imageUrl: "https://assets.coingecko.com/coins/images/1/small/jpy.png",
      coingeckoUrl: "https://www.coingecko.com/en/coins/jpy",
    },
    {
      name: "WTI Crude Oil",
      symbol: "WTI",
      decimals: 6,
      address: "0x4B4A8E5a0deEC8611e647255425eC68A846046d4",
      isSynthetic: true,
      imageUrl: "https://assets.coingecko.com/coins/images/1/small/oil.png",
    },
    {
      name: "Wrapped BTC",
      symbol: "WBTC",
      baseSymbol: "BTC",
      decimals: 8,
      address: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
      isSynthetic: false,
      imageUrl: "https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png",
      coingeckoUrl: "https://www.coingecko.com/en/coins/wrapped-bitcoin",
    },
    /** Placeholder tokens */
    {
      name: "0xMarkets Market tokens",
      symbol: "0xM",
      address: "<market-token-address>",
      decimals: 18,
      imageUrl: "https://raw.githubusercontent.com/gmx-io/gmx-assets/main/GMX-Assets/PNG/GM_LOGO.png",
      isPlatformToken: true,
    },
    {
      name: "GLV Market tokens",
      symbol: "GLV",
      address: "<market-token-address>",
      decimals: 18,
      imageUrl: "https://raw.githubusercontent.com/gmx-io/gmx-assets/main/GMX-Assets/PNG/GLV_LOGO.png",
      isPlatformToken: true,
    },
  ],
  [LOCALHOST]: [
    {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      address: zeroAddress,
      isNative: true,
      isShortable: true,
      categories: ["layer1"],
      imageUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png?1595348880",
      coingeckoUrl: "https://www.coingecko.com/en/coins/ethereum",
      isV1Available: true,
    },
    {
      name: "Wrapped ETH",
      symbol: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      isWrapped: true,
      baseSymbol: "ETH",
      categories: ["layer1"],
      imageUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png?1595348880",
      coingeckoUrl: "https://www.coingecko.com/en/coins/ethereum",
    },
    {
      name: "USD0",
      symbol: "USD0",
      address: "0x3ae4474579d24a743c9016F017e76185A834d837",
      decimals: 6,
      isStable: true,
      imageUrl: "https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png?1547042389",
    },
    /** Placeholder tokens */
    {
      name: "0xMarkets Market tokens",
      symbol: "0xM",
      address: "<market-token-address>",
      decimals: 18,
      imageUrl: "https://raw.githubusercontent.com/gmx-io/gmx-assets/main/GMX-Assets/PNG/GM_LOGO.png",
      isPlatformToken: true,
    },
    {
      name: "GLV Market tokens",
      symbol: "GLV",
      address: "<market-token-address>",
      decimals: 18,
      imageUrl: "https://raw.githubusercontent.com/gmx-io/gmx-assets/main/GMX-Assets/PNG/GLV_LOGO.png",
      isPlatformToken: true,
    },
  ],
};

export const TOKENS_MAP: { [chainId: number]: { [address: string]: Token } } = {};
export const TOKENS_BY_SYMBOL_MAP: { [chainId: number]: { [symbol: string]: Token } } = {};
export const SYNTHETIC_TOKENS: { [chainId: number]: Token[] } = {};
export const V1_TOKENS: { [chainId: number]: Token[] } = {};
export const V2_TOKENS: { [chainId: number]: Token[] } = {};
export const WRAPPED_TOKENS_MAP: { [chainId: number]: Token } = {};
export const NATIVE_TOKENS_MAP: { [chainId: number]: Token } = {};

const CHAIN_IDS = [BASE_SEPOLIA, LOCALHOST];

for (let j = 0; j < CHAIN_IDS.length; j++) {
  const chainId = CHAIN_IDS[j];

  TOKENS_MAP[chainId] = {};
  TOKENS_BY_SYMBOL_MAP[chainId] = {};
  SYNTHETIC_TOKENS[chainId] = [];
  V1_TOKENS[chainId] = [];
  V2_TOKENS[chainId] = [];

  let tokens = TOKENS[chainId];
  let wrappedTokenAddress: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    TOKENS_MAP[chainId][token.address] = token;
    TOKENS_BY_SYMBOL_MAP[chainId][token.symbol] = token;

    if (token.isWrapped) {
      WRAPPED_TOKENS_MAP[chainId] = token;
      wrappedTokenAddress = token.address;
    }

    if (token.isNative) {
      NATIVE_TOKENS_MAP[chainId] = token;
    }

    if (token.isV1Available && !token.isTempHidden) {
      V1_TOKENS[chainId].push(token);
    }

    if ((!token.isPlatformToken || (token.isPlatformToken && token.isPlatformTradingToken)) && !token.isTempHidden) {
      V2_TOKENS[chainId].push(token);
    }

    if (token.isSynthetic) {
      SYNTHETIC_TOKENS[chainId].push(token);
    }
  }

  NATIVE_TOKENS_MAP[chainId].wrappedAddress = wrappedTokenAddress;
}

export function getSyntheticTokens(chainId: number) {
  return SYNTHETIC_TOKENS[chainId];
}

export function getWrappedToken(chainId: number) {
  return WRAPPED_TOKENS_MAP[chainId];
}

export function getNativeToken(chainId: number) {
  return NATIVE_TOKENS_MAP[chainId];
}

export function getTokens(chainId: number) {
  return TOKENS[chainId];
}

export function getV1Tokens(chainId: number) {
  return V1_TOKENS[chainId];
}

export function getV2Tokens(chainId: number) {
  return V2_TOKENS[chainId];
}

export function getTokensMap(chainId: number) {
  return TOKENS_MAP[chainId];
}

export function getWhitelistedV1Tokens(chainId: number) {
  return getV1Tokens(chainId);
}

export function getVisibleV1Tokens(chainId: number) {
  return getV1Tokens(chainId).filter((token) => !token.isWrapped);
}

export function isValidToken(chainId: number, address: string) {
  if (!TOKENS_MAP[chainId]) {
    throw new Error(`Incorrect chainId ${chainId}`);
  }
  return address in TOKENS_MAP[chainId];
}

export function isValidTokenSafe(chainId: number, address: string) {
  return address in TOKENS_MAP[chainId];
}

export function getToken(chainId: number, address: string) {
  if (!TOKENS_MAP[chainId]) {
    throw new Error(`Incorrect chainId ${chainId}`);
  }
  if (!TOKENS_MAP[chainId][address]) {
    throw new Error(`Incorrect address "${address}" for chainId ${chainId}`);
  }

  return TOKENS_MAP[chainId][address];
}

export function getTokenBySymbol(
  chainId: number,
  symbol: string,
  {
    isSynthetic,
    version,
    symbolType = "symbol",
  }: { isSynthetic?: boolean; version?: "v1" | "v2"; symbolType?: "symbol" | "baseSymbol" } = {}
) {
  let tokens = Object.values(TOKENS_MAP[chainId]);

  if (version) {
    tokens = version === "v1" ? getV1Tokens(chainId) : getV2Tokens(chainId);
  }

  let token: Token | undefined;

  if (isSynthetic !== undefined) {
    token = tokens.find((token) => {
      return token[symbolType]?.toLowerCase() === symbol.toLowerCase() && Boolean(token.isSynthetic) === isSynthetic;
    });
  } else {
    if (symbolType === "symbol" && TOKENS_BY_SYMBOL_MAP[chainId][symbol]) {
      token = TOKENS_BY_SYMBOL_MAP[chainId][symbol];
    } else {
      token = tokens.find((token) => token[symbolType]?.toLowerCase() === symbol.toLowerCase());
    }
  }

  if (!token) {
    throw new Error(`Incorrect symbol "${symbol}" for chainId ${chainId}`);
  }

  return token;
}

export function convertTokenAddress<T extends keyof TokenAddressTypesMap, R extends TokenAddressTypesMap[T]>(
  chainId: number,
  address: string,
  convertTo?: T
): R {
  const wrappedToken = getWrappedToken(chainId);

  if (convertTo === "wrapped" && address === NATIVE_TOKEN_ADDRESS) {
    return wrappedToken.address as R;
  }

  if (convertTo === "native" && address === wrappedToken.address) {
    return NATIVE_TOKEN_ADDRESS as R;
  }

  return address as R;
}

export function getNormalizedTokenSymbol(tokenSymbol: string) {
  if (["WBTC", "WETH", "WAVAX"].includes(tokenSymbol)) {
    return tokenSymbol.substr(1);
  } else if (["PBTC", "STBTC"].includes(tokenSymbol)) {
    return "BTC";
  } else if (tokenSymbol.includes(".")) {
    return tokenSymbol.split(".")[0];
  }
  return tokenSymbol;
}

export function isChartAvailableForToken(chainId: number, tokenSymbol: string) {
  let token;

  try {
    token = getTokenBySymbol(chainId, tokenSymbol);
  } catch (e) {
    return false;
  }

  if (token.isChartDisabled || (token.isPlatformToken && !token.isPlatformTradingToken)) return false;

  return true;
}

export function getPriceDecimals(chainId: number, tokenSymbol?: string) {
  if (!tokenSymbol) return 2;

  try {
    const token = getTokenBySymbol(chainId, tokenSymbol);
    return token.priceDecimals ?? 2;
  } catch (e) {
    return 2;
  }
}

export function getTokenBySymbolSafe(
  chainId: number,
  symbol: string,
  params: Parameters<typeof getTokenBySymbol>[2] = {}
) {
  try {
    return getTokenBySymbol(chainId, symbol, params);
  } catch (e) {
    return;
  }
}

export function isTokenInList(token: Token, tokenList: Token[]): boolean {
  return tokenList.some((t) => t.address === token.address);
}

export function isSimilarToken(tokenA: Token, tokenB: Token) {
  if (tokenA.address === tokenB.address) {
    return true;
  }

  if (tokenA.symbol === tokenB.symbol || tokenA.baseSymbol === tokenB.symbol || tokenA.symbol === tokenB.baseSymbol) {
    return true;
  }

  return false;
}

export function getTokenVisualMultiplier(token: Token): string {
  return token.visualPrefix || token.visualMultiplier?.toString() || "";
}

export function getStableTokens(chainId: number) {
  return getTokens(chainId).filter((t) => t.isStable);
}

export function getCategoryTokenAddresses(chainId: number, category: TokenCategory) {
  return TOKENS[chainId].filter((token) => token.categories?.includes(category)).map((token) => token.address);
}

export const createTokensMap = (tokens: Token[]) => {
  return tokens.reduce(
    (acc, token) => {
      acc[token.address] = token;
      return acc;
    },
    {} as Record<string, Token>
  );
};
