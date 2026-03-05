/**
 * Frontend Data Verification Script
 *
 * Reads on-chain state directly from Base Sepolia contracts and outputs
 * structured verification results for pool balances, positions, orders,
 * and token balances. This provides ground truth for verifying the
 * frontend displays accurate data.
 *
 * Covers: FE-01 (pools), FE-02 (positions), FE-03 (orders), FE-04 (balances)
 *
 * Usage: cd e2e && npx tsx verify-frontend-data.ts
 */

import { formatUnits, keccak256, encodeAbiParameters, type Address } from "viem";
import { publicClient, config, CONTRACTS, MARKETS, USDC_ADDRESS } from "./config.js";
import { erc20Abi } from "./abis.js";

// ============================================================
// ABIs (inline, not in shared abis.ts)
// ============================================================

const getUintAbi = [
  {
    type: "function" as const,
    name: "getUint" as const,
    inputs: [{ type: "bytes32" as const }],
    outputs: [{ type: "uint256" as const }],
    stateMutability: "view" as const,
  },
] as const;

const totalSupplyAbi = [
  {
    type: "function" as const,
    name: "totalSupply" as const,
    inputs: [],
    outputs: [{ type: "uint256" as const }],
    stateMutability: "view" as const,
  },
] as const;

// getAccountOrders ABI -- matches SDK SyntheticsReader.json exactly
// Key differences from abis.ts: uint8 for enums, no updatedAtBlock field
const getAccountOrdersAbi = [
  {
    type: "function" as const,
    name: "getAccountOrders" as const,
    stateMutability: "view" as const,
    inputs: [
      { name: "dataStore", type: "address" as const },
      { name: "account", type: "address" as const },
      { name: "start", type: "uint256" as const },
      { name: "end", type: "uint256" as const },
    ],
    outputs: [
      {
        name: "orders",
        type: "tuple[]" as const,
        components: [
          {
            name: "addresses",
            type: "tuple" as const,
            components: [
              { name: "account", type: "address" as const },
              { name: "receiver", type: "address" as const },
              { name: "cancellationReceiver", type: "address" as const },
              { name: "callbackContract", type: "address" as const },
              { name: "uiFeeReceiver", type: "address" as const },
              { name: "market", type: "address" as const },
              { name: "initialCollateralToken", type: "address" as const },
              { name: "swapPath", type: "address[]" as const },
            ],
          },
          {
            name: "numbers",
            type: "tuple" as const,
            components: [
              { name: "orderType", type: "uint8" as const },
              { name: "decreasePositionSwapType", type: "uint8" as const },
              { name: "sizeDeltaUsd", type: "uint256" as const },
              { name: "initialCollateralDeltaAmount", type: "uint256" as const },
              { name: "triggerPrice", type: "uint256" as const },
              { name: "acceptablePrice", type: "uint256" as const },
              { name: "executionFee", type: "uint256" as const },
              { name: "callbackGasLimit", type: "uint256" as const },
              { name: "minOutputAmount", type: "uint256" as const },
              { name: "updatedAtTime", type: "uint256" as const },
              { name: "validFromTime", type: "uint256" as const },
            ],
          },
          {
            name: "flags",
            type: "tuple" as const,
            components: [
              { name: "isLong", type: "bool" as const },
              { name: "shouldUnwrapNativeToken", type: "bool" as const },
              { name: "isFrozen", type: "bool" as const },
              { name: "autoCancel", type: "bool" as const },
            ],
          },
        ],
      },
    ],
  },
] as const;

const getAccountPositionsAbi = [
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

// ============================================================
// DataStore key helpers (same pattern as check-pool.ts)
// ============================================================

function hashString(name: string): `0x${string}` {
  return keccak256(encodeAbiParameters([{ type: "string" }], [name]));
}

function poolAmountKey(market: `0x${string}`, token: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "address" }],
      [hashString("POOL_AMOUNT"), market, token]
    )
  );
}

// ============================================================
// Market name reverse lookup
// ============================================================

function marketName(addr: string): string {
  const lowerAddr = addr.toLowerCase();
  for (const [name, m] of Object.entries(MARKETS)) {
    if (m.market.toLowerCase() === lowerAddr) return name;
  }
  return addr.slice(0, 10) + "...";
}

// ============================================================
// Sections
// ============================================================

interface PoolResult {
  name: string;
  poolUsdc: string;
  gmTotalSupply: string;
  walletGm: string;
}

interface PositionResult {
  market: string;
  isLong: boolean;
  sizeInUsd: string;
  collateralAmount: string;
  leverage: string;
  positionKey: string;
}

interface OrderResult {
  orderType: number;
  orderTypeName: string;
  market: string;
  sizeDeltaUsd: string;
  triggerPrice: string;
  isLong: boolean;
  isFrozen: boolean;
}

const ORDER_TYPE_NAMES: Record<number, string> = {
  0: "MarketSwap",
  1: "LimitSwap",
  2: "MarketIncrease",
  3: "LimitIncrease",
  4: "MarketDecrease",
  5: "LimitDecrease",
  6: "StopLossDecrease",
  7: "Liquidation",
};

let hasError = false;

// ---- FE-01: Pool Verification ----

async function verifyPools(walletAddress: Address): Promise<PoolResult[]> {
  console.log("\n=== POOL VERIFICATION (FE-01) ===\n");
  const results: PoolResult[] = [];

  for (const [name, { market }] of Object.entries(MARKETS)) {
    try {
      // Read POOL_AMOUNT (USDC in pool) from DataStore
      const poolAmount = await publicClient.readContract({
        address: CONTRACTS.DataStore,
        abi: getUintAbi,
        functionName: "getUint",
        args: [poolAmountKey(market as `0x${string}`, USDC_ADDRESS)],
      });

      // Read GM token totalSupply (market address IS the GM token)
      const gmTotalSupply = await publicClient.readContract({
        address: market,
        abi: totalSupplyAbi,
        functionName: "totalSupply",
      });

      // Read wallet's GM token balance
      const walletGm = await publicClient.readContract({
        address: market,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress],
      });

      const poolUsdc = formatUnits(poolAmount, 6);
      const gmSupply = formatUnits(gmTotalSupply, 18);
      const walletGmBal = formatUnits(walletGm, 18);

      console.log(
        `${name}: Pool USDC=${poolUsdc}, GM Supply=${gmSupply}, Wallet GM=${walletGmBal}`
      );

      results.push({
        name,
        poolUsdc,
        gmTotalSupply: gmSupply,
        walletGm: walletGmBal,
      });
    } catch (err) {
      console.error(`${name}: ERROR - ${(err as Error).message?.slice(0, 120)}`);
      hasError = true;
    }
  }

  return results;
}

// ---- FE-02: Position Verification ----

async function verifyPositions(walletAddress: Address): Promise<PositionResult[]> {
  console.log("\n=== POSITION VERIFICATION (FE-02) ===\n");
  const results: PositionResult[] = [];

  try {
    const positions = await publicClient.readContract({
      address: CONTRACTS.SyntheticsReader,
      abi: getAccountPositionsAbi,
      functionName: "getAccountPositions",
      args: [CONTRACTS.DataStore, walletAddress, 0n, 100n],
    });

    const activePositions = positions.filter((p) => p.numbers.sizeInUsd > 0n);
    console.log(`Found ${activePositions.length} positions:`);

    for (const pos of activePositions) {
      const sizeInUsd = pos.numbers.sizeInUsd;
      const collateral = pos.numbers.collateralAmount;
      const mktName = marketName(pos.addresses.market);
      const isLong = pos.flags.isLong;

      // Leverage = sizeInUsd (30 decimals) / collateral (6 decimals) scaled to 30 decimals
      const leverage =
        collateral > 0n
          ? (Number(sizeInUsd) / Number(collateral * 10n ** 24n)).toFixed(1)
          : "N/A";

      const sizeFormatted = formatUnits(sizeInUsd, 30);
      const collateralFormatted = formatUnits(collateral, 6);

      // Compute position key for cross-referencing
      const positionKey = keccak256(
        encodeAbiParameters(
          [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "bool" }],
          [walletAddress, pos.addresses.market as `0x${string}`, pos.addresses.collateralToken as `0x${string}`, isLong]
        )
      );

      // Format size with commas for readability
      const sizeNum = Number(sizeFormatted);
      const sizeDisplay = sizeNum.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      console.log(
        `  ${mktName} ${isLong ? "LONG" : "SHORT"}: Size=$${sizeDisplay}, Collateral=${collateralFormatted} USDC, Leverage=${leverage}x`
      );

      results.push({
        market: mktName,
        isLong,
        sizeInUsd: sizeFormatted,
        collateralAmount: collateralFormatted,
        leverage,
        positionKey,
      });
    }

    if (activePositions.length === 0) {
      console.log("  (no open positions)");
    }
  } catch (err) {
    console.error(`Position read ERROR: ${(err as Error).message?.slice(0, 120)}`);
    hasError = true;
  }

  return results;
}

// ---- FE-03: Order Verification ----

async function verifyOrders(walletAddress: Address): Promise<OrderResult[]> {
  console.log("\n=== ORDER VERIFICATION (FE-03) ===\n");
  const results: OrderResult[] = [];

  try {
    const orders = await publicClient.readContract({
      address: CONTRACTS.SyntheticsReader,
      abi: getAccountOrdersAbi,
      functionName: "getAccountOrders",
      args: [CONTRACTS.DataStore, walletAddress, 0n, 100n],
    });

    console.log(`Found ${orders.length} pending orders:`);

    for (const order of orders) {
      const orderType = Number(order.numbers.orderType);
      const orderTypeName = ORDER_TYPE_NAMES[orderType] ?? `Unknown(${orderType})`;
      const mktName = marketName(order.addresses.market);
      const sizeDelta = formatUnits(order.numbers.sizeDeltaUsd, 30);
      const triggerPrice = formatUnits(order.numbers.triggerPrice, 30);
      const isLong = order.flags.isLong;
      const isFrozen = order.flags.isFrozen;

      console.log(
        `  ${orderTypeName} ${mktName} ${isLong ? "LONG" : "SHORT"}: Size=$${Number(sizeDelta).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, TriggerPrice=$${triggerPrice}, Frozen=${isFrozen}`
      );

      results.push({
        orderType,
        orderTypeName,
        market: mktName,
        sizeDeltaUsd: sizeDelta,
        triggerPrice,
        isLong,
        isFrozen,
      });
    }

    if (orders.length === 0) {
      console.log("  (no pending orders)");
    }
  } catch (err) {
    console.error(`Order read ERROR: ${(err as Error).message?.slice(0, 120)}`);
    hasError = true;
  }

  return results;
}

// ---- FE-04: Token Balance Verification ----

async function verifyTokenBalances(
  walletAddress: Address
): Promise<{ usdc: string; eth: string }> {
  console.log("\n=== TOKEN BALANCE VERIFICATION (FE-04) ===\n");

  let usdc = "0";
  let eth = "0";

  try {
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    });
    usdc = formatUnits(usdcBalance, 6);
    console.log(`USDC: ${usdc}`);
  } catch (err) {
    console.error(`USDC balance ERROR: ${(err as Error).message?.slice(0, 120)}`);
    hasError = true;
  }

  try {
    const ethBalance = await publicClient.getBalance({ address: walletAddress });
    eth = formatUnits(ethBalance, 18);
    console.log(`ETH: ${eth}`);
  } catch (err) {
    console.error(`ETH balance ERROR: ${(err as Error).message?.slice(0, 120)}`);
    hasError = true;
  }

  return { usdc, eth };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const walletAddress = config.walletAddress as Address;
  console.log("=== FRONTEND DATA VERIFICATION ===");
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Chain: Base Sepolia (84532)`);
  console.log(`DataStore: ${CONTRACTS.DataStore}`);
  console.log(`SyntheticsReader: ${CONTRACTS.SyntheticsReader}`);

  const pools = await verifyPools(walletAddress);
  const positions = await verifyPositions(walletAddress);
  const orders = await verifyOrders(walletAddress);
  const balances = await verifyTokenBalances(walletAddress);

  // ---- Summary ----
  const summary = {
    pools: pools.length,
    positions: positions.length,
    orders: orders.length,
    usdc: balances.usdc,
    eth: balances.eth,
    status: hasError ? "PARTIAL" : "COMPLETE",
  };

  console.log("\n=== VERIFICATION SUMMARY ===");
  console.log(JSON.stringify(summary));

  process.exit(hasError ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
