import { Signer } from "ethers";

export type StakeOrUnstakeParams = {
  amount: bigint;
  isStake: boolean;
  isWrapBeforeStake: boolean;
  isUnwrapAfterStake: boolean;
  setPendingTxns: (txns: any) => void;
};

// Staking is not supported on Base chains.
export async function createStakeOrUnstakeTxn(_chainId: number, _signer: Signer, _p: StakeOrUnstakeParams) {
  throw new Error("Stake and unstake is not supported on this chain");
}
