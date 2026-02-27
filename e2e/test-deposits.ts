import { encodeFunctionData, zeroAddress, formatUnits, formatEther, type Address } from "viem";
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
// Deposit test for a single market
// ============================================================

async function testDeposit(
  name: string,
  marketAddress: Address
): Promise<TestResult> {
  const startTime = Date.now();

  console.log(`\n[${name}] (${marketAddress.slice(0, 10)}...)`);
  console.log(`  Submitting deposit of 20 USDC (10+10)...`);

  try {
    const depositAmount = 10_000_000n; // 10 USDC (6 decimals)

    // Build createDeposit params
    const depositParams = {
      receiver: config.walletAddress as Address,
      callbackContract: zeroAddress,
      uiFeeReceiver: zeroAddress,
      market: marketAddress,
      initialLongToken: USDC_ADDRESS,
      initialShortToken: USDC_ADDRESS,
      longTokenSwapPath: [] as Address[],
      shortTokenSwapPath: [] as Address[],
      minMarketTokens: 0n,
      shouldUnwrapNativeToken: false,
      executionFee: EXECUTION_FEE,
      callbackGasLimit: 0n,
    };

    // Encode multicall args
    const multicallData = [
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [CONTRACTS.DepositVault, EXECUTION_FEE],
      }),
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendTokens",
        args: [USDC_ADDRESS, CONTRACTS.DepositVault, depositAmount],
      }),
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendTokens",
        args: [USDC_ADDRESS, CONTRACTS.DepositVault, depositAmount],
      }),
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createDeposit",
        args: [depositParams],
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
    const operationKey = extractOperationKey(receipt, CONTRACTS.EventEmitter);

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
      "Deposit",
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
        error: "Deposit was cancelled by keeper",
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
  console.log("=== E2E Test: DEPOSITS ===");
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
    const result = await testDeposit(name, market);
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
  const allPassed = results.every((r) => r.status === "PASS");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
