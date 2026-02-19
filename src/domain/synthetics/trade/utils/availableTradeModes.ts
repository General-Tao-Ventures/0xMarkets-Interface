import { BASE_SEPOLIA } from "config/chains";
import { getTokenBySymbol } from "sdk/configs/tokens";
import { NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";
import { TradeMode, TradeType } from "sdk/types/trade";

const AVAILABLE_TRADE_MODES = {
  [TradeType.Long]: [
    TradeMode.Market,
    TradeMode.Limit,
    [TradeMode.Trigger, TradeMode.StopMarket, TradeMode.Twap],
  ] as const,
  [TradeType.Short]: [
    TradeMode.Market,
    TradeMode.Limit,
    [TradeMode.Trigger, TradeMode.StopMarket, TradeMode.Twap],
  ] as const,
  [TradeType.Swap]: [TradeMode.Market, TradeMode.Limit, TradeMode.Twap] as const,
};

const ONLY_MARKET_TRADE_MODES = [TradeMode.Market] as const;

const ETH_TOKEN_ADDRESS = NATIVE_TOKEN_ADDRESS;
const WETH_TOKEN_ADDRESS = getTokenBySymbol(BASE_SEPOLIA, "WETH")?.address;

export function getAvailableTradeModes({
  tradeType,
  fromTokenAddress,
  toTokenAddress,
}: {
  chainId: number;
  tradeType: TradeType;
  fromTokenAddress: string | undefined;
  toTokenAddress: string | undefined;
}) {
  if (!tradeType) {
    return [];
  }

  if (tradeType === TradeType.Swap) {
    // Wrapping/unwrapping ETH <-> WETH only supports market mode
    if (fromTokenAddress === ETH_TOKEN_ADDRESS && toTokenAddress === WETH_TOKEN_ADDRESS) {
      return ONLY_MARKET_TRADE_MODES;
    }

    if (fromTokenAddress === WETH_TOKEN_ADDRESS && toTokenAddress === ETH_TOKEN_ADDRESS) {
      return ONLY_MARKET_TRADE_MODES;
    }
  }

  return AVAILABLE_TRADE_MODES[tradeType];
}
