import { formatUnits, type Address } from "viem";
import { publicClient } from "./config.js";

// PythLazerFeedProvider address from keeper-service .env
const PYTH_LAZER = "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05" as Address;

// Oracle provider used by executor
const ORACLE_PROVIDER = "0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6" as Address;

const getStoredPriceAbi = [
  {
    type: "function" as const,
    name: "getOraclePrice" as const,
    inputs: [
      { name: "token", type: "address" as const },
      { name: "data", type: "bytes" as const },
    ],
    outputs: [
      {
        type: "tuple" as const,
        components: [
          { name: "token", type: "address" as const },
          { name: "min", type: "uint256" as const },
          { name: "max", type: "uint256" as const },
          { name: "timestamp", type: "uint256" as const },
          { name: "provider", type: "address" as const },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
] as const;

const getStoredPriceSimpleAbi = [
  {
    type: "function" as const,
    name: "getStoredPrice" as const,
    inputs: [{ name: "token", type: "address" as const }],
    outputs: [
      { name: "ok", type: "bool" as const },
      {
        type: "tuple" as const,
        components: [
          { name: "token", type: "address" as const },
          { name: "min", type: "uint256" as const },
          { name: "max", type: "uint256" as const },
          { name: "timestamp", type: "uint256" as const },
          { name: "provider", type: "address" as const },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
] as const;

const TOKENS: Array<{ name: string; address: Address }> = [
  { name: "WETH", address: "0x4200000000000000000000000000000000000006" },
  { name: "USDC", address: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b" },
  { name: "WBTC", address: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39" },
];

async function main() {
  console.log("=== Checking Oracle Prices ===\n");

  for (const token of TOKENS) {
    console.log(`${token.name} (${token.address}):`);

    // Try PythLazer stored price
    try {
      const [ok, priceData] = await publicClient.readContract({
        address: PYTH_LAZER,
        abi: getStoredPriceSimpleAbi,
        functionName: "getStoredPrice",
        args: [token.address],
      });
      if (ok && priceData.min > 0n) {
        console.log(
          `  PythLazer: $${formatUnits(priceData.min, 30)} - $${formatUnits(priceData.max, 30)}`
        );
        console.log(
          `  Timestamp: ${new Date(Number(priceData.timestamp) * 1000).toISOString()}`
        );
      } else {
        console.log(`  PythLazer: no valid price (ok=${ok})`);
      }
    } catch (err) {
      console.log(
        `  PythLazer: ERROR - ${(err as Error).message?.slice(0, 100)}`
      );
    }

    // Try Oracle provider
    try {
      const priceData = await publicClient.readContract({
        address: ORACLE_PROVIDER,
        abi: getStoredPriceSimpleAbi,
        functionName: "getStoredPrice",
        args: [token.address],
      });
      console.log(`  OracleProvider: ok=${priceData[0]}, min=${priceData[1].min > 0n ? formatUnits(priceData[1].min, 30) : "0"}`);
    } catch (err) {
      console.log(
        `  OracleProvider: ERROR - ${(err as Error).message?.slice(0, 100)}`
      );
    }

    console.log();
  }
}

main().catch(console.error);
