export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export type TickerData = {
  minPrice: string;
  maxPrice: string;
  oracleDecimals: number;
  tokenSymbol: string;
  tokenAddress: string;
  updatedAt: number;
};

export type CandleData = {
  tokenSymbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  minuteTs: number;
};

export type TickerMessage = { type: "ticker"; data: TickerData[] };
export type CandleMessage = { type: "candle"; data: CandleData[] };
export type KeeperWsMessage = TickerMessage | CandleMessage;

export function isNewerThan(incomingTs: number, currentTs: number): boolean {
  return incomingTs > currentTs;
}
