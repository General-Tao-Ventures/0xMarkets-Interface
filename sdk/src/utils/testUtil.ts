import { createTestClient, http, publicActions, walletActions } from "viem";

import { BASE_SEPOLIA, getViemChain } from "configs/chains";
import { GmxSdkConfig } from "types/sdk";

import { GmxSdk } from "../index";

const client = createTestClient({
  chain: getViemChain(BASE_SEPOLIA),
  mode: "hardhat",
  transport: http(),
})
  .extend(publicActions)
  .extend(walletActions);

export const arbitrumSdkConfig: GmxSdkConfig = {
  chainId: BASE_SEPOLIA,
  account: "0x9f7198eb1b9Ccc0Eb7A07eD228d8FbC12963ea33",
  oracleUrl: "http://127.0.0.1:37017",
  rpcUrl: "https://base-sepolia.drpc.org",
  walletClient: client,
  subsquidUrl: "",
};

export const arbitrumSdk = new GmxSdk(arbitrumSdkConfig);
