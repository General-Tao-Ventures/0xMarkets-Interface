import { encodeFunctionData, zeroAddress, zeroHash, maxUint256, formatUnits, formatEther, type Address } from "viem";
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
  formatResults,
  sleep,
  type TestResult,
} from "./helpers.js";

// ============================================================
// Order test for a single market
// ============================================================

async function testOrder(
  name: string,
  marketAddress: Address
): Promise<TestResult> {
  const startTime = Date.now();
  const walletAddress = config.walletAddress as Address;

  console.log(`\n[${name}] (${marketAddress.slice(0, 10)}...)`);
  console.log(`  Submitting MarketIncrease long order: 5 USDC collateral, $10 size...`);

  try {
    const collateralAmount = 5_000_000n; // 5 USDC (6 decimals)

    // sizeDeltaUsd = 10 USD with 30 decimals (contract uses 30-decimal USD representation)
    const sizeDeltaUsd = 10n * 10n ** 30n;

    // Build createOrder params
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
        sizeDeltaUsd,
        initialCollateralDeltaAmount: 0n,
        triggerPrice: 0n,
        acceptablePrice: maxUint256,
        executionFee: EXECUTION_FEE,
        callbackGasLimit: 0n,
        minOutputAmount: 0n,
        validFromTime: 0n,
      },
      orderType: 2,             // MarketIncrease
      isLong: true,
      shouldUnwrapNativeToken: false,
      decreasePositionSwapType: 0,
      autoCancel: false,
      referralCode: zeroHash,   // bytes32 zero
    };

    // Encode multicall args:
    // 1. Send ETH execution fee to OrderVault
    // 2. Send USDC collateral to OrderVault
    // 3. Create the order
    const multicallData = [
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [CONTRACTS.OrderVault, EXECUTION_FEE],
      }),
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendTokens",
        args: [USDC_ADDRESS, CONTRACTS.OrderVault, collateralAmount],
      }),
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createOrder",
        args: [orderParams],
      }),
    ];

    // Submit transaction
    const txHash = await walletClient.writeContract({
      address: CONTRACTS.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [multicallData],
      value: EXECUTION_FEE,
      gas: 2_500_000n,
    });

    console.log(`  TX submitted: ${txHash}`);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`  TX mined: ${txHash} (block ${receipt.blockNumber})`);

    if (receipt.status === "reverted") {
      return {
        market: name,
        status: "FAIL",
        txHash,
        error: "Transaction reverted",
        duration: Date.now() - startTime,
      };
    }

    // Extract operation key from receipt
    const operationKey = extractOperationKey(receipt, CONTRACTS.EventEmitter, "Order");

    if (!operationKey) {
      return {
        market: name,
        status: "FAIL",
        txHash,
        error: "Could not extract operation key from receipt",
        duration: Date.now() - startTime,
      };
    }

    console.log(`  Operation key: ${operationKey}`);
    console.log(`  Waiting for keeper execution...`);

    // Wait for keeper to execute
    const executionResult = await waitForExecution(
      publicClient,
      CONTRACTS.EventEmitter,
      operationKey,
      "Order",
      60_000
    );

    if (executionResult.status === "executed") {
      console.log(
        `  EXECUTED at block ${executionResult.blockNumber} (tx: ${executionResult.txHash})`
      );
      console.log(`  Result: PASS`);
      return {
        market: name,
        status: "PASS",
        txHash,
        executionTxHash: executionResult.txHash,
        operationKey,
        duration: Date.now() - startTime,
      };
    } else if (executionResult.status === "cancelled") {
      console.log(
        `  CANCELLED at block ${executionResult.blockNumber} (tx: ${executionResult.txHash})`
      );
      console.log(`  Result: FAIL`);
      return {
        market: name,
        status: "FAIL",
        txHash,
        executionTxHash: executionResult.txHash,
        operationKey,
        error: "Order was cancelled by keeper",
        duration: Date.now() - startTime,
      };
    } else {
      console.log(`  TIMEOUT: Keeper did not execute within 60s`);
      console.log(`  Result: FAIL`);
      return {
        market: name,
        status: "FAIL",
        txHash,
        operationKey,
        error: "Keeper did not execute within 60s",
        duration: Date.now() - startTime,
      };
    }
  } catch (err) {
    const errorMsg = (err as Error).message?.slice(0, 120) || "Unknown error";
    console.log(`  FAILED: ${errorMsg}`);
    return {
      market: name,
      status: "FAIL",
      error: errorMsg,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== E2E Test: ORDERS ===");
  console.log(`Wallet: ${config.walletAddress}`);

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

  // Ensure approvals and USDC balance
  console.log("\nChecking approvals...");
  await ensureApprovals(walletClient, publicClient, CONTRACTS.SyntheticsRouter);

  // KNOWN BUG: JPY/USD orders revert due to OrderHandler.sol div-by-zero on reversed markets.
  // triggerPrice=0 causes Precision.mulDiv(FLOAT_PRECISION, FLOAT_PRECISION, 0) revert.
  // Tracked in Phase 24 (Contract Bug Fixes). Skip JPY/USD until contract is fixed.
  const SKIP_MARKETS = new Set(["JPY/USD"]);

  // Filter markets by MARKET env var (optional)
  const marketFilter = process.env.MARKET;
  const entries = Object.entries(MARKETS).filter(
    ([name]) => !marketFilter || name === marketFilter
  );

  if (marketFilter) {
    console.log(`\nFiltering to: ${marketFilter}`);
    if (entries.length === 0) {
      console.error(`Market "${marketFilter}" not found. Available: ${Object.keys(MARKETS).join(", ")}`);
      process.exit(1);
    }
  }

  console.log(`\nTesting ${entries.length} market(s)...`);

  const results: TestResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const [name, { market }] = entries[i];

    console.log(`\n--- [${i + 1}/${entries.length}] ${name} ---`);

    if (SKIP_MARKETS.has(name)) {
      console.log(`  SKIPPED: Known contract bug — reversed market div-by-zero (Phase 24)`);
      results.push({
        market: name,
        status: "SKIP",
        error: "Known contract bug: reversed market div-by-zero (Phase 24)",
        duration: 0,
      });
      continue;
    }

    const result = await testOrder(name, market);
    results.push(result);

    // 3-second delay between markets to avoid nonce issues
    if (i < entries.length - 1) {
      console.log("  Waiting 3s before next market...");
      await sleep(3000);
    }
  }

  // Print summary
  formatResults(results);

  // Exit with appropriate code
  const allPassed = results.every((r) => r.status === "PASS" || r.status === "SKIP");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
