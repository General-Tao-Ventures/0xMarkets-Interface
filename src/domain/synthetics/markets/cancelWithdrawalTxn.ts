import { t } from "@lingui/macro";
import { Signer, ethers } from "ethers";

import { getContract } from "config/contracts";
import { callContract } from "lib/contracts";
import { abis } from "sdk/abis";
import type { ContractsChainId } from "sdk/configs/chains";

export async function cancelWithdrawalTxn(chainId: ContractsChainId, signer: Signer, withdrawalKey: string) {
  const contract = new ethers.Contract(getContract(chainId, "ExchangeRouter"), abis.ExchangeRouter, signer);

  return callContract(chainId, contract, "cancelWithdrawal", [withdrawalKey], {
    sentMsg: t`Cancelling withdrawal.`,
    successMsg: t`Withdrawal cancelled.`,
    failMsg: t`Failed to cancel withdrawal.`,
  });
}
