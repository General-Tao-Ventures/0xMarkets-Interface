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

// WETH/USD only -- user added $1000 USDC liquidity to this pool.
// Synthetic markets (GOLD, EUR, GBP) have oracle "best ask price" data gaps
// that prevent the order-execution-keeper from executing orders.
// WBTC/USD has no liquidity.
const TARGET_MARKET = "WETH/USD";

// Collateral and size strategy:
// - The WETH/USD pool has $1548 USDC, 95% reserve factor => $1471 max reserved
// - Current OI: $695 LONG + $675 SHORT = $1370 reserved => ~$101 headroom
// - Reserve calculation includes BOTH size AND collateral
// - $20 collateral + $400 size SHORT was previously executed (but fees ate collateral)
// - With $100 collateral, even $25 size gets cancelled (collateral inflates reserve calc)
// - Use minimal collateral ($5 USDC) to minimize reserve impact, accept that position
//   will be near-instant liquidation due to fees eating into the tiny collateral.
// - A position that's immediately liquidatable is IDEAL for testing the pipeline.
const COLLATERAL_AMOUNT = 5_000_000n; // 5 USDC (6 decimals)

// Size tiers: With $5 collateral, we need sizes that fit within pool headroom.
// The $400 SHORT previously worked with $20 collateral. With $5, smaller sizes should fit.
const SIZE_TIERS = [
  { label: "$200",  value: 200n * 10n ** 30n },
  { label: "$100",  value: 100n * 10n ** 30n },
  { label: "$50",   value: 50n * 10n ** 30n },
  { label: "$25",   value: 25n * 10n ** 30n },
  { label: "$10",   value: 10n * 10n ** 30n },
  { label: "$5",    value: 5n * 10n ** 30n },
];

// Try both directions -- pool may have reserves on one side but not the other
const DIRECTIONS: Array<{ isLong: boolean; label: string }> = [
  { isLong: true,  label: "LONG" },
  { isLong: false, label: "SHORT" },
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
      console.log(`  Order TX reverted. Likely InsufficientReserve or max leverage exceeded.`);
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
      180_000, // 3 min timeout (keeper may take a full cycle)
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
      if (positionCollateralOnChain > 0n) {
        console.log(`  Effective levg:   ~${(Number(positionSizeOnChain) / Number(positionCollateralOnChain * 10n**24n)).toFixed(1)}x`);
      }
      console.log(`  Direction:        ${isLong ? "Long" : "Short"}`);
      console.log(`  Position key:     ${positionKey}`);
      console.log(`  Order TX:         ${txHash}`);
      console.log(`  Execution TX:     ${executionResult.txHash}`);
      console.log(`\n=== NEXT STEPS ===`);
      console.log(`  1. keeper-service scanner should detect this position`);
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
      console.log(`  TIMEOUT: Order-execution-keeper did not execute within 180s.`);
      console.log(`  Ensure the order-execution-keeper is running on port 37018.`);
      return false;
    }
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 300) || "Unknown error";
    console.log(`  FAILED: ${msg}`);
    return false;
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== Liquidation Test: Create Undercollateralized Position ===");
  console.log(`Wallet: ${config.walletAddress}`);
  console.log(`Target market: ${TARGET_MARKET}`);
  console.log(`Strategy: $${formatUnits(COLLATERAL_AMOUNT, 6)} USDC collateral with high leverage\n`);

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

  if (ethBalance < EXECUTION_FEE) {
    console.error(`\nFATAL: Insufficient ETH for execution fee.`);
    console.error(`Need at least ${formatEther(EXECUTION_FEE)} ETH, have ${formatEther(ethBalance)} ETH.`);
    process.exit(1);
  }

  // Ensure approvals (also mints 500 USDC if balance < 200)
  console.log("\nChecking approvals...");
  await ensureApprovals(walletClient, publicClient, CONTRACTS.SyntheticsRouter);

  // Pre-flight: check order-execution-keeper health
  console.log("\nChecking order-execution-keeper health...");
  try {
    const resp = await fetch("http://localhost:37018/health");
    if (resp.ok) {
      const health = await resp.json();
      console.log(`  Order-execution-keeper is running. Seen: ${health.seenCount}, Queue: ${health.queueLength}`);
    } else {
      console.log(`  WARNING: Order-execution-keeper returned status ${resp.status}`);
    }
  } catch {
    console.log("  WARNING: Order-execution-keeper not reachable at localhost:37018");
    console.log("  Orders will not be executed. Start it first, or the order will time out.");
  }

  // Try each direction with all size tiers
  for (const dir of DIRECTIONS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Trying: ${TARGET_MARKET} ${dir.label}`);
    console.log(`${"=".repeat(60)}`);

    for (const tier of SIZE_TIERS) {
      console.log(`\n--- Size tier: ${tier.label} on ${TARGET_MARKET} ${dir.label} ---`);

      const success = await createPosition(
        tier.value,
        tier.label,
        TARGET_MARKET,
        dir.isLong
      );
      if (success) {
        console.log(`\nPosition created successfully: ${tier.label} on ${TARGET_MARKET} ${dir.label}.`);
        process.exit(0);
      }

      console.log(`  ${tier.label} on ${TARGET_MARKET} ${dir.label} did not work. Trying next...`);
    }

    console.log(`\nAll size tiers exhausted for ${TARGET_MARKET} ${dir.label}. Moving to next direction.`);
  }

  console.error(`\nFATAL: All size/direction combinations failed for ${TARGET_MARKET}.`);
  console.error(`The pool may need more liquidity or the order-execution-keeper may have oracle issues.`);
  console.error(`Check order-keeper logs: tail -50 /tmp/order-keeper.log`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
