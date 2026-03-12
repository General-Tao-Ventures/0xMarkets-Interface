import dotenv from "dotenv";
import { createPublicClient, createWalletClient, http, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function requiredHex(name: string): `0x${string}` {
  const value = required(name);
  return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
}

// Base Sepolia chain definition
const baseSepolia: Chain = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [required("RPC_URL")] },
  },
  testnet: true,
};

// Wallet setup
const account = privateKeyToAccount(requiredHex("PRIVATE_KEY"));

// Viem clients
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(required("RPC_URL")),
});

export const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(required("RPC_URL")),
});

// Config object
export const config = {
  rpcUrl: required("RPC_URL"),
  chainId: parseInt(process.env.CHAIN_ID || "84532", 10),
  privateKey: requiredHex("PRIVATE_KEY"),
  walletAddress: account.address,
} as const;

// Contract addresses (from SDK contracts.ts -- Base Sepolia)
export const CONTRACTS = {
  ExchangeRouter: "0xB326e9903271766F2eb0CcCd7180c73985d373aA" as Address,
  DepositVault: "0x590d1d8e50A3a3d9F3448657D1Cb64D486978781" as Address,
  WithdrawalVault: "0xE47130E74CAEd3Cae1Bf2c7e1e0af0B592354b57" as Address,
  OrderVault: "0x76DE02F06979a24A87F2cD743Ab533a44EdcFb08" as Address,
  DataStore: "0x0cA7D71845cb485B7593bBdCbcac93d82d52d053" as Address,
  EventEmitter: "0x68001935Ec7C2e3980f99435db3CabC89dea602B" as Address,
  SyntheticsReader: "0x4debCC0Cf123529C2a42beC0F8027B03DB1a8b9e" as Address,
  SyntheticsRouter: "0xE92B08345125dc77eB071d1a2D513751C4D22714" as Address,
  PythLazer: "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05" as Address,
} as const;

// Token addresses
export const USD0_ADDRESS: Address = "0x3ae4474579d24a743c9016F017e76185A834d837";
export const USDC_ADDRESS = USD0_ADDRESS; // legacy alias
export const WETH_ADDRESS: Address = "0x4200000000000000000000000000000000000006";

// Execution fee: 0.00005 ETH (MIN_EXECUTION_FEE on testnet is 0, so we minimize gas spend)
// Base Sepolia gas is cheap (~5-6 gwei), so 0.00005 ETH is plenty for keeper execution
export const EXECUTION_FEE = 50_000_000_000_000n; // 5e13 wei

// Market definitions (from SDK markets.ts -- all use USD0 as long and short token)
export const MARKETS: Record<string, { market: Address; indexToken: Address }> = {
  "WETH/USD": {
    market: "0x23F40e3279685413b252A6944AF9a0641D3aa6ce",
    indexToken: "0x4200000000000000000000000000000000000006",
  },
  "WBTC/USD": {
    market: "0x63D05Da932541380df8d9eE20D8FdB4B02849398",
    indexToken: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
  },
  "EUR/USD": {
    market: "0x7054eb596aCF4fC1C0686C9B2cdAC4aE6c6D0F33",
    indexToken: "0x18909CC26672376e8FDF1fa54Fc5B892dd6E2b0C",
  },
  "GBP/USD": {
    market: "0xa09b59adf15B4ED98a099441b84Ff1eABf71B548",
    indexToken: "0xf7255EAb2968Fb6B8b6226eB25c6EDC2F1CcE60a",
  },
  "GOLD/USD": {
    market: "0x89c3B33bEE4b9cD1B246BE44aDcEd870F74637a3",
    indexToken: "0xf4ac308123764edFB7453a7446D01277D7DEa1A7",
  },
  "JPY/USD": {
    market: "0xD847a999faCe1f862120117C33ae8faBA768fD4b",
    indexToken: "0x7836DF766375f02D71fa3617F5F06a0712699A81",
  },
};
