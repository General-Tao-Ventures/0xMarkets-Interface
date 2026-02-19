import { ExternalSwapPath, ExternalSwapQuote, ExternalSwapQuoteParams } from "types/trade";

export const getExternalSwapQuoteByPath = ({
  amountIn: _amountIn,
  externalSwapPath: _externalSwapPath,
  externalSwapQuoteParams: _externalSwapQuoteParams,
}: {
  amountIn: bigint;
  externalSwapPath: ExternalSwapPath;
  externalSwapQuoteParams: ExternalSwapQuoteParams;
}): ExternalSwapQuote | undefined => {
  return undefined;
};
