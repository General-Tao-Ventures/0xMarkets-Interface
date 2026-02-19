import { Image } from "@davatar/react";
import { useEnsAvatar } from "wagmi";

// Hardcode Ethereum mainnet chain ID for ENS resolution
const ETH_MAINNET = 1;

export type Props = {
  size: number;
  address: string;
  ensName?: string;
};

export function Avatar({ size, address, ensName }: Props) {
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName,
    chainId: ETH_MAINNET,
  });

  return <Image size={size} address={address} uri={ensAvatar} />;
}
