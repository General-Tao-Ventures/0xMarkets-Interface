import { BASE_MAINNET, BASE_SEPOLIA } from "config/chains";

export type VolumeInfo = {
  totalVolume: bigint;
  [BASE_MAINNET]: { totalVolume: bigint };
  [BASE_SEPOLIA]: { totalVolume: bigint };
};

export type VolumeStat = {
  swap: string;
  margin: string;
  liquidation: string;
  mint: string;
  burn: string;
};
