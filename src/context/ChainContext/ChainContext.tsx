import { createContext, PropsWithChildren, useContext, useMemo } from "react";

import { isSourceChain } from "config/multichain";
import { useGmxAccountSettlementChainId } from "context/GmxAccountContext/hooks";
import { useChainIdImpl } from "lib/chains/useChainIdImpl";
import { BASE_SEPOLIA, ContractsChainId, SourceChainId } from "sdk/configs/chains";

export type ChainContext = {
  chainId: ContractsChainId;
  srcChainId: SourceChainId | undefined;
  isConnectedToChainId: boolean | undefined;
};

const initialChainId: ContractsChainId = BASE_SEPOLIA;
const realChainId = window.ethereum?.chainId ? parseInt(window.ethereum?.chainId) : initialChainId;

export const context = createContext<ChainContext>({
  chainId: initialChainId,
  srcChainId: isSourceChain(realChainId) ? realChainId : undefined,
  isConnectedToChainId: false,
});

export function ChainContextProvider({ children }: PropsWithChildren) {
  const [gmxAccountSettlementChainId] = useGmxAccountSettlementChainId();

  const { chainId, srcChainId, isConnectedToChainId } = useChainIdImpl(gmxAccountSettlementChainId);

  const value = useMemo(
    () => ({
      chainId,
      srcChainId,
      isConnectedToChainId,
    }),
    [chainId, srcChainId, isConnectedToChainId]
  );

  return <context.Provider value={value}>{children}</context.Provider>;
}

export const useChainContext = () => useContext(context);
