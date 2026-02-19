import { Trans } from "@lingui/macro";

import { BASE_SEPOLIA, getExplorerUrl } from "config/chains";
import { StakeOrUnstakeParams } from "domain/synthetics/orders/createStakeOrUnStakeTxn";
import { formatTokenAmount } from "lib/numbers";

import ExternalLink from "components/ExternalLink/ExternalLink";

export function StakeNotification({
  txnHash,
  amount,
  isStake,
  isWrapBeforeStake,
}: StakeOrUnstakeParams & { txnHash: string }) {
  const fromTokenSymbol = isStake ? (isWrapBeforeStake ? "ETH" : "WETH") : "WETH";
  const toTokenSymbol = isStake ? "WETH" : "ETH";
  const fromAmount = formatTokenAmount(amount, 18, fromTokenSymbol, { isStable: false });
  const toAmount = formatTokenAmount(amount, 18, toTokenSymbol, { isStable: false });

  return (
    <span className="flex justify-between font-bold">
      <Trans>
        Swap {fromAmount} for {toAmount}
      </Trans>

      <ExternalLink href={`${getExplorerUrl(BASE_SEPOLIA)}tx/${txnHash}`}>
        <Trans>View</Trans>
      </ExternalLink>
    </span>
  );
}
