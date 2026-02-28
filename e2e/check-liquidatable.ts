import {
  formatUnits,
  keccak256,
  encodeAbiParameters,
  type Address,
} from "viem";
import {
  config,
  publicClient,
  CONTRACTS,
  MARKETS,
  USDC_ADDRESS,
} from "./config.js";

// Reader ABI for isPositionLiquidatable
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
              {
                name: "longTokenClaimableFundingAmountPerSize",
                type: "uint256" as const,
              },
              {
                name: "shortTokenClaimableFundingAmountPerSize",
                type: "uint256" as const,
              },
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
  {
    type: "function" as const,
    name: "isPositionLiquidatable" as const,
    inputs: [
      { name: "dataStore", type: "address" as const },
      { name: "referralStorage", type: "address" as const },
      { name: "positionKey", type: "bytes32" as const },
      {
        type: "tuple" as const,
        name: "market",
        components: [
          { name: "marketToken", type: "address" as const },
          { name: "indexToken", type: "address" as const },
          { name: "longToken", type: "address" as const },
          { name: "shortToken", type: "address" as const },
          { name: "reversed", type: "bool" as const },
        ],
      },
      {
        type: "tuple" as const,
        name: "prices",
        components: [
          {
            type: "tuple" as const,
            name: "indexTokenPrice",
            components: [
              { name: "min", type: "uint256" as const },
              { name: "max", type: "uint256" as const },
            ],
          },
          {
            type: "tuple" as const,
            name: "longTokenPrice",
            components: [
              { name: "min", type: "uint256" as const },
              { name: "max", type: "uint256" as const },
            ],
          },
          {
            type: "tuple" as const,
            name: "shortTokenPrice",
            components: [
              { name: "min", type: "uint256" as const },
              { name: "max", type: "uint256" as const },
            ],
          },
        ],
      },
      { name: "shouldValidateMinCollateralUsd", type: "bool" as const },
    ],
    outputs: [
      { name: "", type: "bool" as const },
      { name: "", type: "string" as const },
      {
        type: "tuple" as const,
        components: [
          { name: "remainingCollateralUsd", type: "int256" as const },
          { name: "minCollateralUsd", type: "int256" as const },
          { name: "minCollateralUsdForLeverage", type: "int256" as const },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
] as const;

function computePositionKey(
  account: Address,
  market: Address,
  collateralToken: Address,
  isLong: boolean
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "bool" },
      ],
      [account, market, collateralToken, isLong]
    )
  );
}

async function main() {
  const account = config.walletAddress as Address;
  const market = MARKETS["WETH/USD"];

  // USDC price: $1 = 1e30 (price precision is 30 decimals in GMX)
  // Provide a constant price for simplicity
  const usdcPrice = { min: 1n * 10n ** 30n, max: 1n * 10n ** 30n };

  // ETH price: ~$2400 at the time. We'll try a range to see at what price the position is liquidatable.
  // The positions were created at the market's current price when created.
  // For a LONG position, price dropping makes it liquidatable.
  // For a SHORT position, price rising makes it liquidatable.

  // Let me first get the current market ETH price from the RPC
  // We'll use a mock price and try various scenarios

  const directions = [
    { isLong: true, label: "LONG" },
    { isLong: false, label: "SHORT" },
  ];

  // Try at various ETH prices
  const ethPrices = [2300, 2400, 2500, 2200, 2100, 2000, 2600, 2700, 2800];

  for (const dir of directions) {
    const posKey = computePositionKey(
      account,
      market.market,
      USDC_ADDRESS,
      dir.isLong
    );
    console.log(`\n=== WETH/USD ${dir.label} (key: ${posKey.slice(0, 18)}...) ===`);

    for (const ethPrice of ethPrices) {
      const ethPriceX30 = BigInt(ethPrice) * 10n ** 30n;
      const indexTokenPrice = { min: ethPriceX30, max: ethPriceX30 };

      const marketStruct = {
        marketToken: market.market,
        indexToken: market.indexToken,
        longToken: USDC_ADDRESS,
        shortToken: USDC_ADDRESS,
        reversed: false,
      };

      const prices = {
        indexTokenPrice,
        longTokenPrice: usdcPrice,
        shortTokenPrice: usdcPrice,
      };

      try {
        const result = await publicClient.readContract({
          address: CONTRACTS.SyntheticsReader,
          abi: READER_ABI,
          functionName: "isPositionLiquidatable",
          args: [
            CONTRACTS.DataStore,
            "0x0000000000000000000000000000000000000000" as Address, // referralStorage (not used for liquidation check)
            posKey,
            marketStruct,
            prices,
            true,
          ],
        });

        const [isLiquidatable, reason, collateralInfo] = result;
        if (isLiquidatable) {
          console.log(
            `  ETH $${ethPrice}: LIQUIDATABLE! reason="${reason}" remainingCollateral=${formatUnits(BigInt(collateralInfo.remainingCollateralUsd), 30)}`
          );
        } else {
          console.log(
            `  ETH $${ethPrice}: not liquidatable. remainingCollateral=${formatUnits(BigInt(collateralInfo.remainingCollateralUsd), 30)}`
          );
        }
      } catch (err) {
        const msg = (err as Error).message?.slice(0, 200) || "Unknown error";
        console.log(`  ETH $${ethPrice}: ERROR: ${msg}`);
      }
    }
  }
}

main().catch(console.error);
