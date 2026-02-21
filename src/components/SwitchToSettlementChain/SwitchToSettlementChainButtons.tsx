import { Trans } from "@lingui/macro";
import { useAccount } from "wagmi";

import { getChainName } from "config/chains";
import { MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING } from "config/multichain";
import { switchNetwork } from "lib/wallets";

import Button from "components/Button/Button";

import { needSwitchToSettlementChain } from "./utils";

export function SwitchToSettlementChainButtons({ children }: { children: React.ReactNode }) {
  const { chainId: walletChainId, isConnected } = useAccount();

  const settlements = needSwitchToSettlementChain(walletChainId)
    ? MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING[walletChainId]
    : undefined;

  if (!settlements?.length) {
    return children;
  }

  return (
    <div className="flex flex-col gap-8">
      {settlements.map((chainId) => (
        <Button
          key={chainId}
          type="button"
          className="w-full"
          variant="primary-action"
          onClick={() => {
            switchNetwork(chainId, isConnected);
          }}
        >
          <Trans>Switch to {getChainName(chainId)}</Trans>
        </Button>
      ))}
    </div>
  );
}
