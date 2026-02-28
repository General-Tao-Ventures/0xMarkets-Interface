import {
  encodeFunctionData,
  encodeAbiParameters,
  zeroAddress,
  zeroHash,
  maxUint256,
  formatUnits,
  formatEther,
  keccak256,
  type Address,
} from "viem";
import {
  config,
  publicClient,
  walletClient,
  CONTRACTS,
  MARKETS,
  USDC_ADDRESS,
  EXECUTION_FEE,
} from "./config.js";
import { exchangeRouterAbi, erc20Abi } from "./abis.js";
import {
  ensureApprovals,
  extractOperationKey,
  waitForExecution,
} from "./helpers.js";

// ============================================================
// Configuration
// ============================================================

// Strategy: Try multiple markets and directions to find one with available reserves.
// Each "attempt" is a (market, direction) pair. We try all size tiers for each attempt
// before moving to the next. This handles the testnet pool reserve exhaustion issue.
interface MarketAttempt {
  marketName: string;
  isLong: boolean;
  label: string;
}

// Try synthetic markets first -- they have near-zero open interest and available reserves.
// WETH/USD and WBTC/USD pools are exhausted (InsufficientReserve on all directions).
// Note: JPY/USD excluded due to known Pyth Lazer oracle data gap.
const MARKET_ATTEMPTS: MarketAttempt[] = [
  { marketName: "GOLD/USD", isLong: false, label: "GOLD/USD SHORT" },
  { marketName: "GOLD/USD", isLong: true,  label: "GOLD/USD LONG" },
  { marketName: "EUR/USD",  isLong: false, label: "EUR/USD SHORT" },
  { marketName: "EUR/USD",  isLong: true,  label: "EUR/USD LONG" },
  { marketName: "GBP/USD",  isLong: false, label: "GBP/USD SHORT" },
  { marketName: "GBP/USD",  isLong: true,  label: "GBP/USD LONG" },
  { marketName: "WBTC/USD", isLong: false, label: "WBTC/USD SHORT" },
  { marketName: "WETH/USD", isLong: false, label: "WETH/USD SHORT" },
  { marketName: "WBTC/USD", isLong: true,  label: "WBTC/USD LONG" },
  { marketName: "WETH/USD", isLong: true,  label: "WETH/USD LONG" },
];

// Use enough collateral for the position to survive execution fees (~$0.50-$2 impact/position fees).
// The position must survive creation so the scanner can detect and liquidate it later.
// Increased from $10 to $50 USDC to ensure positions survive after fees.
const COLLATERAL_AMOUNT = 50_000_000n; // 50 USDC (6 decimals)

// Size tiers: With $50 USDC collateral, target high leverage for near-liquidation positions.
// Max leverage on these markets is typically 50x. We start just under that and work down.
// A position at 40-50x leverage with $50 collateral = $2000-$2500 size, very near liquidation.
const SIZE_TIERS = [
  { label: "$2500", value: 2500n * 10n ** 30n },
  { label: "$2000", value: 2000n * 10n ** 30n },
  { label: "$1500", value: 1500n * 10n ** 30n },
  { label: "$1000", value: 1000n * 10n ** 30n },
  { label: "$750",  value: 750n * 10n ** 30n },
  { label: "$500",  value: 500n * 10n ** 30n },
  { label: "$400",  value: 400n * 10n ** 30n },
  { label: "$300",  value: 300n * 10n ** 30n },
  { label: "$200",  value: 200n * 10n ** 30n },
  { label: "$150",  value: 150n * 10n ** 30n },
  { label: "$100",  value: 100n * 10n ** 30n },
];

// ============================================================
// Position key computation
// ============================================================

/**
 * Compute the position key as the contract does:
 * keccak256(abi.encode(account, market, collateralToken, isLong))
 */
function computePositionKey(
  account: Address,
  marketAddress: Address,
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
      [account, marketAddress, collateralToken, isLong]
    )
  );
}

// ============================================================
// Create undercollateralized position
// ============================================================

async function createPosition(
  sizeDeltaUsd: bigint,
  sizeLabel: string,
  marketName: string,
  isLong: boolean
): Promise<boolean> {
  const market = MARKETS[marketName];
  if (!market) {
    console.log(`  Market ${marketName} not found in config. Skipping.`);
    return false;
  }

  const walletAddress = config.walletAddress as Address;

  console.log(`\n--- Attempting position: ${sizeLabel} size, ${formatUnits(COLLATERAL_AMOUNT, 6)} USDC collateral ---`);
  console.log(`  Market: ${marketName} (${market.market})`);
  console.log(`  Collateral: ${formatUnits(COLLATERAL_AMOUNT, 6)} USDC`);
  console.log(`  Size: ${sizeLabel} USD`);
  console.log(`  Direction: ${isLong ? "Long" : "Short"}`);
  console.log(`  Estimated leverage: ~${Number(sizeDeltaUsd / (10n ** 30n))}x`);

  const orderParams = {
    addresses: {
      receiver: walletAddress,
      cancellationReceiver: zeroAddress,
      callbackContract: zeroAddress,
      uiFeeReceiver: zeroAddress,
      market: market.market,
      initialCollateralToken: USDC_ADDRESS,
      swapPath: [] as Address[],
    },
    numbers: {
      sizeDeltaUsd,
      initialCollateralDeltaAmount: 0n,
      triggerPrice: 0n,
      acceptablePrice: isLong ? maxUint256 : 0n,
      executionFee: EXECUTION_FEE,
      callbackGasLimit: 0n,
      minOutputAmount: 0n,
      validFromTime: 0n,
    },
    orderType: 2, // MarketIncrease
    isLong,
    shouldUnwrapNativeToken: false,
    decreasePositionSwapType: 0,
    autoCancel: false,
    referralCode: zeroHash,
  };

  // Encode multicall: sendWnt + sendTokens + createOrder
  const multicallData = [
    encodeFunctionData({
      abi: exchangeRouterAbi,
      functionName: "sendWnt",
      args: [CONTRACTS.OrderVault, EXECUTION_FEE],
    }),
    encodeFunctionData({
      abi: exchangeRouterAbi,
      functionName: "sendTokens",
      args: [USDC_ADDRESS, CONTRACTS.OrderVault, COLLATERAL_AMOUNT],
    }),
    encodeFunctionData({
      abi: exchangeRouterAbi,
      functionName: "createOrder",
      args: [orderParams],
    }),
  ];

  try {
    const txHash = await walletClient.writeContract({
      address: CONTRACTS.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [multicallData],
      value: EXECUTION_FEE,
      gas: 2_500_000n,
    });

    console.log(`  Order TX submitted: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`  Order TX mined in block ${receipt.blockNumber}`);

    if (receipt.status === "reverted") {
      console.log(`  Order TX reverted. Max leverage may have been exceeded.`);
      return false;
    }

    // Extract operation key from receipt
    const operationKey = extractOperationKey(receipt, CONTRACTS.EventEmitter, "Order");
    if (!operationKey) {
      console.log(`  Could not extract operation key from receipt.`);
      return false;
    }

    console.log(`  Operation key: ${operationKey}`);
    console.log(`  Waiting for order-execution-keeper to execute the order...`);

    // Wait for the order-execution-keeper to fill the order
    // Pass receipt block so we only look for events from this order's block onwards
    const executionResult = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      operationKey,
      "Order",
      120_000, // 2 min timeout (keeper may take a cycle)
      receipt.blockNumber
    );

    if (executionResult.status === "executed") {
      console.log(`  Order EXECUTED at block ${executionResult.blockNumber}`);
      console.log(`  Execution TX: ${executionResult.txHash}`);

      // Compute and display the position key
      const positionKey = computePositionKey(
        walletAddress,
        market.market,
        USDC_ADDRESS,
        isLong
      );

      // Verify the position actually exists on-chain (not immediately closed by fees)
      const positionSizeOnChain = await publicClient.readContract({
        address: CONTRACTS.DataStore,
        abi: [{ name: "getUint", type: "function", stateMutability: "view",
                inputs: [{ name: "key", type: "bytes32" }],
                outputs: [{ name: "", type: "uint256" }] }] as const,
        functionName: "getUint",
        args: [keccak256(encodeAbiParameters(
          [{ type: "bytes32" }, { type: "string" }],
          [positionKey, "sizeInUsd"]
        ))],
      });

      if (positionSizeOnChain === 0n) {
        console.log(`\n  WARNING: Order was executed but position has zero size on-chain.`);
        console.log(`  The position was likely immediately closed (fees exceeded collateral).`);
        console.log(`  Trying next size tier with more surviving collateral...`);
        return false;
      }

      const positionCollateralOnChain = await publicClient.readContract({
        address: CONTRACTS.DataStore,
        abi: [{ name: "getUint", type: "function", stateMutability: "view",
                inputs: [{ name: "key", type: "bytes32" }],
                outputs: [{ name: "", type: "uint256" }] }] as const,
        functionName: "getUint",
        args: [keccak256(encodeAbiParameters(
          [{ type: "bytes32" }, { type: "string" }],
          [positionKey, "collateralAmount"]
        ))],
      });

      console.log(`\n=== POSITION CREATED SUCCESSFULLY ===`);
      console.log(`  Account:          ${walletAddress}`);
      console.log(`  Market:           ${marketName} (${market.market})`);
      console.log(`  Collateral sent:  ${formatUnits(COLLATERAL_AMOUNT, 6)} USDC`);
      console.log(`  On-chain collat:  ${formatUnits(positionCollateralOnChain, 6)} USDC`);
      console.log(`  On-chain size:    ${formatUnits(positionSizeOnChain, 30)} USD`);
      console.log(`  Effective levg:   ~${(Number(positionSizeOnChain) / Number(positionCollateralOnChain * 10n**24n)).toFixed(1)}x`);
      console.log(`  Direction:        ${isLong ? "Long" : "Short"}`);
      console.log(`  Position key:     ${positionKey}`);
      console.log(`  Order TX:         ${txHash}`);
      console.log(`  Execution TX:     ${executionResult.txHash}`);
      console.log(`\n=== NEXT STEPS ===`);
      console.log(`  1. Start keeper-service: cd /Users/ken/Projects/0xM/keeper-service && npm run dev`);
      console.log(`  2. Watch for "found liquidatable position" in keeper logs`);
      console.log(`  3. Verify liquidation_candidates and liquidation_executions in PostgreSQL`);
      console.log(`  4. Check Basescan TX for the executeLiquidation call`);
      console.log(`\n  Position key for cross-reference with scanner output: ${positionKey}`);

      return true;
    } else if (executionResult.status === "cancelled") {
      console.log(`  Order was CANCELLED by keeper at block ${executionResult.blockNumber}`);
      console.log(`  Cancellation TX: ${executionResult.txHash}`);
      console.log(`  This may indicate max leverage exceeded or insufficient liquidity.`);
      return false;
    } else {
      console.log(`  TIMEOUT: Order-execution-keeper did not execute within 120s.`);
      console.log(`  Ensure the order-execution-keeper is running on port 37018.`);
      return false;
    }
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 200) || "Unknown error";
    console.log(`  FAILED: ${msg}`);

    if (msg.toLowerCase().includes("leverage") || msg.toLowerCase().includes("max_leverage")) {
      console.log(`  Max leverage exceeded. Will try a smaller size.`);
    }

    return false;
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== Liquidation Test: Create Undercollateralized Position ===");
  console.log(`Wallet: ${config.walletAddress}`);
  console.log(`Strategy: $${formatUnits(COLLATERAL_AMOUNT, 6)} USDC collateral with high leverage`);
  console.log(`Markets to try: ${MARKET_ATTEMPTS.map(a => a.label).join(", ")}\n`);

  // Check balances
  const walletAddress = config.walletAddress as Address;
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress],
  });
  const ethBalance = await publicClient.getBalance({ address: walletAddress });

  console.log(`USDC balance: ${formatUnits(usdcBalance, 6)}`);
  console.log(`ETH balance:  ${formatEther(ethBalance)}`);

  if (usdcBalance < COLLATERAL_AMOUNT) {
    console.log(`\nInsufficient USDC balance. Need at least ${formatUnits(COLLATERAL_AMOUNT, 6)} USDC.`);
    console.log(`Current balance: ${formatUnits(usdcBalance, 6)} USDC`);
  }

  if (ethBalance < EXECUTION_FEE) {
    console.error(`\nFATAL: Insufficient ETH for execution fee.`);
    console.error(`Need at least ${formatEther(EXECUTION_FEE)} ETH, have ${formatEther(ethBalance)} ETH.`);
    process.exit(1);
  }

  // Ensure approvals (also mints USDC if balance < 200)
  console.log("\nChecking approvals...");
  await ensureApprovals(walletClient, publicClient, CONTRACTS.SyntheticsRouter);

  // Pre-flight: check order-execution-keeper health
  console.log("\nChecking order-execution-keeper health...");
  try {
    const resp = await fetch("http://localhost:37018/health");
    if (resp.ok) {
      console.log("  Order-execution-keeper is running.");
    } else {
      console.log(`  WARNING: Order-execution-keeper returned status ${resp.status}`);
      console.log("  Orders may not be executed. Proceeding anyway...");
    }
  } catch {
    console.log("  WARNING: Order-execution-keeper not reachable at localhost:37018");
    console.log("  Orders will not be executed. Start it first, or the order will time out.");
  }

  // Try each market/direction combination with all size tiers
  for (const attempt of MARKET_ATTEMPTS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Trying: ${attempt.label}`);
    console.log(`${"=".repeat(60)}`);

    for (const tier of SIZE_TIERS) {
      console.log(`\n--- Size tier: ${tier.label} on ${attempt.label} ---`);

      const success = await createPosition(
        tier.value,
        tier.label,
        attempt.marketName,
        attempt.isLong
      );
      if (success) {
        console.log(`\nPosition created successfully: ${tier.label} on ${attempt.label}.`);
        process.exit(0);
      }

      console.log(`  ${tier.label} on ${attempt.label} did not work. Trying next...`);
    }

    console.log(`\nAll size tiers exhausted for ${attempt.label}. Moving to next market/direction.`);
  }

  console.error(`\nFATAL: All market/direction/size combinations failed.`);
  console.error(`All testnet pools appear to have exhausted open interest reserves.`);
  console.error(`Please add liquidity to a pool via the Buy GM flow before retrying.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
