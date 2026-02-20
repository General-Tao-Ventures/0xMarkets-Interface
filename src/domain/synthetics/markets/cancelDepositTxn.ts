import { t } from "@lingui/macro";
import { Signer, ethers } from "ethers";

import { getContract } from "config/contracts";
import { callContract } from "lib/contracts";
import { abis } from "sdk/abis";
import type { ContractsChainId } from "sdk/configs/chains";

export async function cancelDepositTxn(chainId: ContractsChainId, signer: Signer, depositKey: string) {
  const contract = new ethers.Contract(getContract(chainId, "ExchangeRouter"), abis.ExchangeRouter, signer);

  return callContract(chainId, contract, "cancelDeposit", [depositKey], {
    sentMsg: t`Cancelling deposit.`,
    successMsg: t`Deposit cancelled.`,
    failMsg: t`Failed to cancel deposit.`,
  });
}
