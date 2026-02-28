import { type Address } from "viem";
import { publicClient, CONTRACTS, MARKETS } from "./config.js";

const READER_ABI = [
  {
    type: "function" as const,
    name: "getMarket" as const,
    inputs: [
      { name: "dataStore", type: "address" as const },
      { name: "key", type: "address" as const },
    ],
    outputs: [
      {
        type: "tuple" as const,
        components: [
          { name: "marketToken", type: "address" as const },
          { name: "indexToken", type: "address" as const },
          { name: "longToken", type: "address" as const },
          { name: "shortToken", type: "address" as const },
          { name: "reversed", type: "bool" as const },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
] as const;

async function main() {
  const market = await publicClient.readContract({
    address: CONTRACTS.SyntheticsReader,
    abi: READER_ABI,
    functionName: "getMarket",
    args: [CONTRACTS.DataStore, MARKETS["WETH/USD"].market],
  });

  console.log("WETH/USD Market from Reader:");
  console.log("  marketToken:", market.marketToken);
  console.log("  indexToken:", market.indexToken);
  console.log("  longToken:", market.longToken);
  console.log("  shortToken:", market.shortToken);
  console.log("  reversed:", market.reversed);
}

main().catch(console.error);
