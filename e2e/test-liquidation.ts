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

const MARKET_NAME = "WETH/USD";
const market = MARKETS[MARKET_NAME];
if (!market) {
  console.error(`FATAL: Market ${MARKET_NAME} not found in config`);
  process.exit(1);
}

// Minimal collateral ($1 USDC) with high size for maximum leverage.
// We try multiple size tiers in case the market enforces a max leverage cap.
const COLLATERAL_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)
const SIZE_TIERS = [
  { label: "$50", value: 50n * 10n ** 30n },
  { label: "$30", value: 30n * 10n ** 30n },
  { label: "$20", value: 20n * 10n ** 30n },
  { label: "$10", value: 10n * 10n ** 30n },
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

async function createPosition(sizeDeltaUsd: bigint, sizeLabel: string): Promise<boolean> {
  const walletAddress = config.walletAddress as Address;

  console.log(`\n--- Attempting position: ${sizeLabel} size, $1 USDC collateral ---`);
  console.log(`  Market: ${MARKET_NAME} (${market.market})`);
  console.log(`  Collateral: ${formatUnits(COLLATERAL_AMOUNT, 6)} USDC`);
  console.log(`  Size: ${sizeLabel} USD`);
  console.log(`  Direction: Long`);
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
      acceptablePrice: maxUint256,
      executionFee: EXECUTION_FEE,
      callbackGasLimit: 0n,
      minOutputAmount: 0n,
      validFromTime: 0n,
    },
    orderType: 2, // MarketIncrease
    isLong: true,
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
    const executionResult = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      operationKey,
      "Order",
      120_000 // 2 min timeout (keeper may take a cycle)
    );

    if (executionResult.status === "executed") {
      console.log(`  Order EXECUTED at block ${executionResult.blockNumber}`);
      console.log(`  Execution TX: ${executionResult.txHash}`);

      // Compute and display the position key
      const positionKey = computePositionKey(
        walletAddress,
        market.market,
        USDC_ADDRESS,
        true // isLong
      );

      console.log(`\n=== POSITION CREATED SUCCESSFULLY ===`);
      console.log(`  Account:          ${walletAddress}`);
      console.log(`  Market:           ${MARKET_NAME} (${market.market})`);
      console.log(`  Collateral:       ${formatUnits(COLLATERAL_AMOUNT, 6)} USDC`);
      console.log(`  Size:             ${sizeLabel} USD`);
      console.log(`  Direction:        Long`);
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
  console.log(`Market: ${MARKET_NAME}`);
  console.log(`Strategy: Minimal collateral ($1 USDC) with high leverage\n`);

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

  // Try each size tier, highest leverage first
  for (const tier of SIZE_TIERS) {
    console.log(`\n========================================`);
    console.log(`Trying size tier: ${tier.label}`);
    console.log(`========================================`);

    const success = await createPosition(tier.value, tier.label);
    if (success) {
      console.log(`\nPosition created successfully at ${tier.label} size.`);
      process.exit(0);
    }

    console.log(`\nSize ${tier.label} did not work. Trying next tier...`);
  }

  console.error(`\nFATAL: All size tiers failed. Could not create undercollateralized position.`);
  console.error(`Check the market's max leverage setting and available liquidity.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
