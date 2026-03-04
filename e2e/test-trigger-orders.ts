import {
  encodeFunctionData,
  zeroAddress,
  zeroHash,
  maxUint256,
  formatUnits,
  formatEther,
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
import {
  exchangeRouterAbi,
  erc20Abi,
  pythLazerAbi,
  syntheticsReaderAbi,
} from "./abis.js";
import {
  ensureApprovals,
  extractOperationKey,
  waitForExecution,
  formatResults,
  sleep,
  type TestResult,
} from "./helpers.js";

// ============================================================
// Constants
// ============================================================

const WETH_MARKET = MARKETS["WETH/USD"];
const COLLATERAL_AMOUNT = 5_000_000n; // 5 USDC (6 decimals)
const SIZE_DELTA_USD = 10n * 10n ** 30n; // $10 in 30-decimal format
const TRIGGER_TIMEOUT_MS = 90_000; // 90s for trigger orders (keeper checks every ~15s)

// ============================================================
// Helpers
// ============================================================

/** Read current WETH oracle price from PythLazer on-chain */
async function getCurrentPrice(tokenAddress: Address): Promise<{ min: bigint; max: bigint }> {
  const [ok, priceData] = await publicClient.readContract({
    address: CONTRACTS.PythLazer,
    abi: pythLazerAbi,
    functionName: "getStoredPrice",
    args: [tokenAddress],
  });

  if (!ok || priceData.min === 0n) {
    throw new Error(`No valid oracle price for ${tokenAddress}`);
  }

  return { min: priceData.min, max: priceData.max };
}

/** Submit a market increase order and wait for execution (to open a position) */
async function openMarketPosition(
  marketAddress: Address,
  isLong: boolean
): Promise<{ orderKey: `0x${string}`; txHash: `0x${string}` }> {
  const walletAddress = config.walletAddress as Address;

  const orderParams = {
    addresses: {
      receiver: walletAddress,
      cancellationReceiver: zeroAddress,
      callbackContract: zeroAddress,
      uiFeeReceiver: zeroAddress,
      market: marketAddress,
      initialCollateralToken: USDC_ADDRESS,
      swapPath: [] as Address[],
    },
    numbers: {
      sizeDeltaUsd: SIZE_DELTA_USD,
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

  const txHash = await walletClient.writeContract({
    address: CONTRACTS.ExchangeRouter,
    abi: exchangeRouterAbi,
    functionName: "multicall",
    args: [multicallData],
    value: EXECUTION_FEE,
    gas: 2_500_000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error("Market order TX reverted");

  const orderKey = extractOperationKey(receipt, CONTRACTS.EventEmitter, "Order");
  if (!orderKey) throw new Error("Could not extract order key");

  const result = await waitForExecution(
    publicClient,
    CONTRACTS.EventEmitter,
    orderKey,
    "Order",
    60_000
  );

  if (result.status !== "executed") {
    throw new Error(`Market order not executed: ${result.status}`);
  }

  return { orderKey, txHash };
}

/** Submit a trigger order and return the order key */
async function submitTriggerOrder(p: {
  marketAddress: Address;
  orderType: number; // 3=LimitIncrease, 5=LimitDecrease, 6=StopLossDecrease
  isLong: boolean;
  triggerPrice: bigint;
  acceptablePrice: bigint;
  sizeDeltaUsd: bigint;
  collateralAmount: bigint;
  /** For decrease orders, send collateral delta instead of new collateral */
  isDecrease?: boolean;
}): Promise<{ orderKey: `0x${string}`; txHash: `0x${string}` }> {
  const walletAddress = config.walletAddress as Address;

  const orderParams = {
    addresses: {
      receiver: walletAddress,
      cancellationReceiver: zeroAddress,
      callbackContract: zeroAddress,
      uiFeeReceiver: zeroAddress,
      market: p.marketAddress,
      initialCollateralToken: USDC_ADDRESS,
      swapPath: [] as Address[],
    },
    numbers: {
      sizeDeltaUsd: p.sizeDeltaUsd,
      initialCollateralDeltaAmount: p.isDecrease ? p.collateralAmount : 0n,
      triggerPrice: p.triggerPrice,
      acceptablePrice: p.acceptablePrice,
      executionFee: EXECUTION_FEE,
      callbackGasLimit: 0n,
      minOutputAmount: 0n,
      validFromTime: 0n,
    },
    orderType: p.orderType,
    isLong: p.isLong,
    shouldUnwrapNativeToken: false,
    decreasePositionSwapType: 0,
    autoCancel: false,
    referralCode: zeroHash,
  };

  // For increase orders, send collateral to OrderVault
  // For decrease orders, no collateral transfer needed
  const multicallData = p.isDecrease
    ? [
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendWnt",
          args: [CONTRACTS.OrderVault, EXECUTION_FEE],
        }),
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "createOrder",
          args: [orderParams],
        }),
      ]
    : [
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendWnt",
          args: [CONTRACTS.OrderVault, EXECUTION_FEE],
        }),
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendTokens",
          args: [USDC_ADDRESS, CONTRACTS.OrderVault, p.collateralAmount],
        }),
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "createOrder",
          args: [orderParams],
        }),
      ];

  const txHash = await walletClient.writeContract({
    address: CONTRACTS.ExchangeRouter,
    abi: exchangeRouterAbi,
    functionName: "multicall",
    args: [multicallData],
    value: EXECUTION_FEE,
    gas: 2_500_000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error("Trigger order TX reverted");

  const orderKey = extractOperationKey(receipt, CONTRACTS.EventEmitter, "Order");
  if (!orderKey) throw new Error("Could not extract order key");

  return { orderKey, txHash };
}

/** Cancel an order via ExchangeRouter */
async function cancelOrder(orderKey: `0x${string}`): Promise<void> {
  const txHash = await walletClient.writeContract({
    address: CONTRACTS.ExchangeRouter,
    abi: exchangeRouterAbi,
    functionName: "cancelOrder",
    args: [orderKey],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

/** Check if an order key exists in the account's pending orders */
async function isOrderPending(orderKey: `0x${string}`): Promise<boolean> {
  const walletAddress = config.walletAddress as Address;
  const orders = await publicClient.readContract({
    address: CONTRACTS.SyntheticsReader,
    abi: syntheticsReaderAbi,
    functionName: "getAccountOrders",
    args: [CONTRACTS.DataStore, walletAddress, 0n, 50n],
  });

  // Orders array doesn't include keys directly — we check by matching market/triggerPrice
  // Instead, use DataStore order list approach. For simplicity, check if the order
  // was NOT executed/cancelled by checking events.
  return orders.length > 0;
}

// ============================================================
// Test Cases
// ============================================================

/**
 * Test 1: LimitIncrease Long
 * Condition: price.max <= triggerPrice
 * Strategy: Set triggerPrice = currentPrice * 1.01 (above market), should execute immediately
 */
async function testLimitIncreaseLong(): Promise<TestResult> {
  const testName = "LimitIncrease Long";
  const startTime = Date.now();
  console.log(`\n[${testName}]`);

  try {
    const price = await getCurrentPrice(WETH_MARKET.indexToken);
    console.log(`  Current WETH price: $${formatUnits(price.max, 30)}`);

    // triggerPrice slightly above current → condition price.max <= triggerPrice is met
    const triggerPrice = (price.max * 101n) / 100n;
    console.log(`  Trigger price: $${formatUnits(triggerPrice, 30)} (1% above current)`);

    const { orderKey, txHash } = await submitTriggerOrder({
      marketAddress: WETH_MARKET.market,
      orderType: 3, // LimitIncrease
      isLong: true,
      triggerPrice,
      acceptablePrice: maxUint256, // accept any price for long
      sizeDeltaUsd: SIZE_DELTA_USD,
      collateralAmount: COLLATERAL_AMOUNT,
    });

    console.log(`  Order submitted: ${txHash}`);
    console.log(`  Order key: ${orderKey}`);
    console.log(`  Waiting for keeper execution (up to ${TRIGGER_TIMEOUT_MS / 1000}s)...`);

    const result = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      orderKey,
      "Order",
      TRIGGER_TIMEOUT_MS
    );

    if (result.status === "executed") {
      const duration = Date.now() - startTime;
      console.log(`  EXECUTED in ${(duration / 1000).toFixed(1)}s (tx: ${result.txHash})`);
      return { market: testName, status: "PASS", txHash, executionTxHash: result.txHash, operationKey: orderKey, duration };
    } else if (result.status === "cancelled") {
      console.log(`  CANCELLED (tx: ${result.txHash})`);
      return { market: testName, status: "FAIL", txHash, error: "Order was cancelled", duration: Date.now() - startTime };
    } else {
      console.log(`  TIMEOUT: Keeper did not execute within ${TRIGGER_TIMEOUT_MS / 1000}s`);
      return { market: testName, status: "FAIL", txHash, error: "Keeper timeout", duration: Date.now() - startTime };
    }
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 150) || "Unknown error";
    console.log(`  FAILED: ${msg}`);
    return { market: testName, status: "FAIL", error: msg, duration: Date.now() - startTime };
  }
}

/**
 * Test 2: StopLossDecrease Long
 * Condition: price.min <= triggerPrice
 * Strategy: Open long position, then set triggerPrice slightly above current price → condition met
 */
async function testStopLossDecreaseLong(): Promise<TestResult> {
  const testName = "StopLossDecrease Long";
  const startTime = Date.now();
  console.log(`\n[${testName}]`);

  try {
    // Step 1: Open a market long position
    console.log(`  Opening market long position...`);
    await openMarketPosition(WETH_MARKET.market, true);
    console.log(`  Position opened`);

    await sleep(3000); // wait for state to settle

    // Step 2: Read current price
    const price = await getCurrentPrice(WETH_MARKET.indexToken);
    console.log(`  Current WETH price: $${formatUnits(price.min, 30)}`);

    // triggerPrice above current → condition price.min <= triggerPrice is met immediately
    const triggerPrice = (price.max * 102n) / 100n;
    console.log(`  Trigger price: $${formatUnits(triggerPrice, 30)} (2% above current)`);

    // Step 3: Submit stop-loss decrease
    const { orderKey, txHash } = await submitTriggerOrder({
      marketAddress: WETH_MARKET.market,
      orderType: 6, // StopLossDecrease
      isLong: true,
      triggerPrice,
      acceptablePrice: 0n, // accept any price for long decrease
      sizeDeltaUsd: SIZE_DELTA_USD, // close full position
      collateralAmount: COLLATERAL_AMOUNT, // withdraw collateral
      isDecrease: true,
    });

    console.log(`  Stop-loss submitted: ${txHash}`);
    console.log(`  Order key: ${orderKey}`);
    console.log(`  Waiting for keeper execution...`);

    const result = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      orderKey,
      "Order",
      TRIGGER_TIMEOUT_MS
    );

    if (result.status === "executed") {
      const duration = Date.now() - startTime;
      console.log(`  EXECUTED in ${(duration / 1000).toFixed(1)}s (tx: ${result.txHash})`);
      return { market: testName, status: "PASS", txHash, executionTxHash: result.txHash, operationKey: orderKey, duration };
    } else if (result.status === "cancelled") {
      console.log(`  CANCELLED (tx: ${result.txHash})`);
      return { market: testName, status: "FAIL", txHash, error: "Order was cancelled", duration: Date.now() - startTime };
    } else {
      console.log(`  TIMEOUT`);
      return { market: testName, status: "FAIL", txHash, error: "Keeper timeout", duration: Date.now() - startTime };
    }
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 150) || "Unknown error";
    console.log(`  FAILED: ${msg}`);
    return { market: testName, status: "FAIL", error: msg, duration: Date.now() - startTime };
  }
}

/**
 * Test 3: LimitDecrease Long (take-profit)
 * Condition: price.min >= triggerPrice
 * Strategy: Open long position, set triggerPrice slightly below current → condition met
 */
async function testLimitDecreaseLong(): Promise<TestResult> {
  const testName = "LimitDecrease Long (Take-Profit)";
  const startTime = Date.now();
  console.log(`\n[${testName}]`);

  try {
    // Step 1: Open a market long position
    console.log(`  Opening market long position...`);
    await openMarketPosition(WETH_MARKET.market, true);
    console.log(`  Position opened`);

    await sleep(3000);

    // Step 2: Read current price
    const price = await getCurrentPrice(WETH_MARKET.indexToken);
    console.log(`  Current WETH price: $${formatUnits(price.min, 30)}`);

    // triggerPrice below current → condition price.min >= triggerPrice is met immediately
    const triggerPrice = (price.min * 98n) / 100n;
    console.log(`  Trigger price: $${formatUnits(triggerPrice, 30)} (2% below current)`);

    // Step 3: Submit limit decrease (take-profit)
    const { orderKey, txHash } = await submitTriggerOrder({
      marketAddress: WETH_MARKET.market,
      orderType: 5, // LimitDecrease
      isLong: true,
      triggerPrice,
      acceptablePrice: 0n,
      sizeDeltaUsd: SIZE_DELTA_USD,
      collateralAmount: COLLATERAL_AMOUNT,
      isDecrease: true,
    });

    console.log(`  Take-profit submitted: ${txHash}`);
    console.log(`  Order key: ${orderKey}`);
    console.log(`  Waiting for keeper execution...`);

    const result = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      orderKey,
      "Order",
      TRIGGER_TIMEOUT_MS
    );

    if (result.status === "executed") {
      const duration = Date.now() - startTime;
      console.log(`  EXECUTED in ${(duration / 1000).toFixed(1)}s (tx: ${result.txHash})`);
      return { market: testName, status: "PASS", txHash, executionTxHash: result.txHash, operationKey: orderKey, duration };
    } else if (result.status === "cancelled") {
      console.log(`  CANCELLED (tx: ${result.txHash})`);
      return { market: testName, status: "FAIL", txHash, error: "Order was cancelled", duration: Date.now() - startTime };
    } else {
      console.log(`  TIMEOUT`);
      return { market: testName, status: "FAIL", txHash, error: "Keeper timeout", duration: Date.now() - startTime };
    }
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 150) || "Unknown error";
    console.log(`  FAILED: ${msg}`);
    return { market: testName, status: "FAIL", error: msg, duration: Date.now() - startTime };
  }
}

/**
 * Test 4: Pending Order Stays Pending
 * Submit a LimitIncrease with triggerPrice far below current → should NOT execute
 * Verify it stays in pending orders, then cancel it for cleanup
 */
async function testPendingOrderStaysPending(): Promise<TestResult> {
  const testName = "Pending Order (Not Triggered)";
  const startTime = Date.now();
  console.log(`\n[${testName}]`);

  try {
    const price = await getCurrentPrice(WETH_MARKET.indexToken);
    console.log(`  Current WETH price: $${formatUnits(price.max, 30)}`);

    // triggerPrice at 50% of current → condition price.max <= triggerPrice is NOT met
    const triggerPrice = price.max / 2n;
    console.log(`  Trigger price: $${formatUnits(triggerPrice, 30)} (50% of current — should NOT trigger)`);

    const { orderKey, txHash } = await submitTriggerOrder({
      marketAddress: WETH_MARKET.market,
      orderType: 3, // LimitIncrease
      isLong: true,
      triggerPrice,
      acceptablePrice: maxUint256,
      sizeDeltaUsd: SIZE_DELTA_USD,
      collateralAmount: COLLATERAL_AMOUNT,
    });

    console.log(`  Order submitted: ${txHash}`);
    console.log(`  Order key: ${orderKey}`);

    // Wait 30s and verify order was NOT executed
    console.log(`  Waiting 30s to confirm order stays pending...`);
    const result = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      orderKey,
      "Order",
      30_000 // short timeout — we EXPECT timeout
    );

    if (result.status === "timeout") {
      console.log(`  CORRECT: Order stayed pending (not executed within 30s)`);

      // Cleanup: cancel the order
      console.log(`  Cancelling order for cleanup...`);
      try {
        await cancelOrder(orderKey);
        console.log(`  Order cancelled successfully`);
      } catch (cancelErr) {
        console.log(`  Warning: cancel failed (${(cancelErr as Error).message?.slice(0, 80)})`);
      }

      return { market: testName, status: "PASS", txHash, operationKey: orderKey, duration: Date.now() - startTime };
    } else if (result.status === "executed") {
      console.log(`  UNEXPECTED: Order was executed (should have stayed pending)`);
      return { market: testName, status: "FAIL", txHash, error: "Order executed when it should have stayed pending", duration: Date.now() - startTime };
    } else {
      console.log(`  UNEXPECTED: Order was cancelled`);
      return { market: testName, status: "FAIL", txHash, error: "Order was cancelled unexpectedly", duration: Date.now() - startTime };
    }
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 150) || "Unknown error";
    console.log(`  FAILED: ${msg}`);
    return { market: testName, status: "FAIL", error: msg, duration: Date.now() - startTime };
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== E2E Test: TRIGGER ORDERS (Limit / Stop-Loss) ===");
  console.log(`Wallet: ${config.walletAddress}`);
  console.log(`Market: WETH/USD (${WETH_MARKET.market})`);

  // Print balances
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [config.walletAddress as Address],
  });
  const ethBalance = await publicClient.getBalance({
    address: config.walletAddress as Address,
  });
  console.log(`USDC balance: ${formatUnits(usdcBalance, 6)}`);
  console.log(`ETH balance: ${formatEther(ethBalance)}`);

  // Ensure approvals
  console.log("\nChecking approvals...");
  await ensureApprovals(walletClient, publicClient, CONTRACTS.SyntheticsRouter);

  // Read oracle price to confirm it's working
  const price = await getCurrentPrice(WETH_MARKET.indexToken);
  console.log(`\nOracle WETH price: $${formatUnits(price.min, 30)} - $${formatUnits(price.max, 30)}`);

  // Run which tests based on TEST env var
  const testFilter = process.env.TEST;
  const allTests = [
    { name: "limit-increase", fn: testLimitIncreaseLong },
    { name: "stop-loss", fn: testStopLossDecreaseLong },
    { name: "limit-decrease", fn: testLimitDecreaseLong },
    { name: "pending", fn: testPendingOrderStaysPending },
  ];

  const testsToRun = testFilter
    ? allTests.filter((t) => t.name === testFilter)
    : allTests;

  if (testFilter && testsToRun.length === 0) {
    console.error(`Test "${testFilter}" not found. Available: ${allTests.map((t) => t.name).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nRunning ${testsToRun.length} test(s)...`);

  const results: TestResult[] = [];

  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i];
    console.log(`\n--- [${i + 1}/${testsToRun.length}] ${test.name} ---`);

    const result = await test.fn();
    results.push(result);

    // Delay between tests
    if (i < testsToRun.length - 1) {
      console.log("  Waiting 5s before next test...");
      await sleep(5000);
    }
  }

  // Print summary
  formatResults(results);

  const allPassed = results.every((r) => r.status === "PASS" || r.status === "SKIP");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
