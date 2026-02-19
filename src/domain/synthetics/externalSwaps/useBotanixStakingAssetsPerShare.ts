import { ContractsChainId } from "config/chains";

// Botanix staking is not available on Base chains. Always returns undefined.
export const useBotanixStakingAssetsPerShare = ({ chainId: _chainId }: { chainId: ContractsChainId }):
  | bigint
  | undefined => {
  return undefined;
};
