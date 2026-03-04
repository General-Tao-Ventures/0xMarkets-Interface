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
  ExchangeRouter: "0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321" as Address,
  DepositVault: "0x4AFE24c4e2477F54aFa4bF30d6D7385e588dfeC4" as Address,
  WithdrawalVault: "0x64D496E867000875Dd19C808592fAB6Fc99cBE7F" as Address,
  OrderVault: "0x18916C70dFEb3fA3366089d35464aC40f5a1D903" as Address,
  DataStore: "0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7" as Address,
  EventEmitter: "0xd5aAfa71f745645Db84cB4877873701ddAf2514c" as Address,
  SyntheticsReader: "0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C" as Address,
  SyntheticsRouter: "0x33153255bed0219b571483e6a0801Fa0B916f7D7" as Address,
  PythLazer: "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05" as Address,
} as const;

// Token addresses
export const USDC_ADDRESS: Address = "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b";
export const WETH_ADDRESS: Address = "0x4200000000000000000000000000000000000006";

// Execution fee: 0.00005 ETH (MIN_EXECUTION_FEE on testnet is 0, so we minimize gas spend)
// Base Sepolia gas is cheap (~5-6 gwei), so 0.00005 ETH is plenty for keeper execution
export const EXECUTION_FEE = 50_000_000_000_000n; // 5e13 wei

// Market definitions (from SDK markets.ts -- all use USDC as long and short token)
export const MARKETS: Record<string, { market: Address; indexToken: Address }> = {
  "WETH/USD": {
    market: "0x41a281111Aa12a968564a33f9293D9B7b0dDFf19",
    indexToken: "0x4200000000000000000000000000000000000006",
  },
  "WBTC/USD": {
    market: "0x3c3D358701B4df855b3B88D4c840f694c9db8324",
    indexToken: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39",
  },
  "EUR/USD": {
    market: "0xd3c882AbD5854267d509b944429faA82f3d36088",
    indexToken: "0x86e6ab05217318Db4A63f0361BADBf5aF0c69270",
  },
  "GBP/USD": {
    market: "0x981977239025C8F2E133f87b79bEcc587B0e7562",
    indexToken: "0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e",
  },
  "GOLD/USD": {
    market: "0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563",
    indexToken: "0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4",
  },
  "JPY/USD": {
    market: "0xF28b8572AD4c0BfF5EdfB6579b1Fa6fF0A9Eef5A",
    indexToken: "0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A",
  },
};
