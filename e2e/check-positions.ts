import { formatUnits, type Address } from "viem";
import { config, publicClient, CONTRACTS } from "./config.js";

const READER_ABI = [
  {
    type: "function" as const,
    name: "getAccountPositions" as const,
    inputs: [
      { name: "dataStore", type: "address" as const },
      { name: "account", type: "address" as const },
      { name: "start", type: "uint256" as const },
      { name: "end", type: "uint256" as const },
    ],
    outputs: [
      {
        type: "tuple[]" as const,
        components: [
          {
            type: "tuple" as const,
            name: "addresses",
            components: [
              { name: "account", type: "address" as const },
              { name: "market", type: "address" as const },
              { name: "collateralToken", type: "address" as const },
            ],
          },
          {
            type: "tuple" as const,
            name: "numbers",
            components: [
              { name: "sizeInUsd", type: "uint256" as const },
              { name: "sizeInTokens", type: "uint256" as const },
              { name: "collateralAmount", type: "uint256" as const },
              { name: "borrowingFactor", type: "uint256" as const },
              { name: "fundingFeeAmountPerSize", type: "uint256" as const },
              { name: "longTokenClaimableFundingAmountPerSize", type: "uint256" as const },
              { name: "shortTokenClaimableFundingAmountPerSize", type: "uint256" as const },
              { name: "increasedAtTime", type: "uint256" as const },
              { name: "decreasedAtTime", type: "uint256" as const },
            ],
          },
          {
            type: "tuple" as const,
            name: "flags",
            components: [
              { name: "isLong", type: "bool" as const },
              { name: "reversed", type: "bool" as const },
            ],
          },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
] as const;

async function main() {
  const account = config.walletAddress as Address;
  console.log(`Checking positions for account: ${account}`);

  const positions = await publicClient.readContract({
    address: CONTRACTS.SyntheticsReader,
    abi: READER_ABI,
    functionName: "getAccountPositions",
    args: [CONTRACTS.DataStore, account, 0n, 100n],
  });

  console.log(`Found ${positions.length} positions:\n`);

  for (const pos of positions) {
    const sizeInUsd = pos.numbers.sizeInUsd;
    const collateral = pos.numbers.collateralAmount;

    if (sizeInUsd === 0n) {
      console.log("  (empty position slot)");
      continue;
    }

    console.log(`  Market: ${pos.addresses.market}`);
    console.log(`  Collateral Token: ${pos.addresses.collateralToken}`);
    console.log(`  Size in USD: ${formatUnits(sizeInUsd, 30)}`);
    console.log(`  Collateral: ${formatUnits(collateral, 6)} USDC`);
    console.log(`  Is Long: ${pos.flags.isLong}`);
    if (collateral > 0n) {
      console.log(`  Leverage: ~${(Number(sizeInUsd) / Number(collateral * 10n ** 24n)).toFixed(1)}x`);
    }
    console.log(`  Increased At: ${new Date(Number(pos.numbers.increasedAtTime) * 1000).toISOString()}`);
    console.log();
  }
}

main().catch(console.error);
