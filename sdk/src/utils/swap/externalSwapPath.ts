import { ExternalSwapPath } from "types/trade";

export const getAvailableExternalSwapPaths = ({
  chainId: _chainId,
  fromTokenAddress: _fromTokenAddress,
}: {
  chainId: number;
  fromTokenAddress: string;
}): ExternalSwapPath[] => {
  return [];
};
