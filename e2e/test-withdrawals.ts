import { encodeFunctionData, zeroAddress, maxUint256, formatUnits, formatEther, type Address } from "viem";
import {
  config,
  publicClient,
  walletClient,
  CONTRACTS,
  MARKETS,
  EXECUTION_FEE,
} from "./config.js";
import { exchangeRouterAbi, erc20Abi } from "./abis.js";
import {
  extractOperationKey,
  waitForExecution,
  formatResults,
  sleep,
  type TestResult,
} from "./helpers.js";

// ============================================================
// Withdrawal test for a single market
// ============================================================

async function testWithdrawal(
  name: string,
  marketAddress: Address
): Promise<TestResult> {
  const startTime = Date.now();
  const walletAddress = config.walletAddress as Address;

  console.log(`\n[${name}] (${marketAddress.slice(0, 10)}...)`);

  try {
    // Check market token balance (the market address IS the GM token ERC20)
    const marketTokenBalance = await publicClient.readContract({
      address: marketAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    console.log(`  Market token balance: ${formatUnits(marketTokenBalance, 18)}`);

    if (marketTokenBalance === 0n) {
      console.log(`  SKIP: No market tokens -- run deposits first`);
      return {
        market: name,
        status: "FAIL",
        error: "No market tokens -- run deposits first",
        duration: Date.now() - startTime,
      };
    }

    // Withdraw half of balance (or all if small)
    const withdrawAmount = marketTokenBalance / 2n > 0n ? marketTokenBalance / 2n : marketTokenBalance;
    console.log(`  Withdrawing ${formatUnits(withdrawAmount, 18)} market tokens...`);

    // Approve market token against SyntheticsRouter (NOT ExchangeRouter)
    const allowance = await publicClient.readContract({
      address: marketAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [walletAddress, CONTRACTS.SyntheticsRouter],
    });

    if (allowance < withdrawAmount) {
      console.log(`  Approving market token for SyntheticsRouter...`);
      const approveHash = await walletClient.writeContract({
        address: marketAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.SyntheticsRouter, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log(`  Market token approved`);
    }

    // Build createWithdrawal params
    const withdrawalParams = {
      receiver: walletAddress,
      callbackContract: zeroAddress,
      uiFeeReceiver: zeroAddress,
      market: marketAddress,
      longTokenSwapPath: [] as Address[],
      shortTokenSwapPath: [] as Address[],
      minLongTokenAmount: 0n,
      minShortTokenAmount: 0n,
      shouldUnwrapNativeToken: false,
      executionFee: EXECUTION_FEE,
      callbackGasLimit: 0n,
    };

    // Encode multicall args:
    // 1. Send ETH execution fee to WithdrawalVault
    // 2. Send market tokens to WithdrawalVault
    // 3. Create the withdrawal
    const multicallData = [
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [CONTRACTS.WithdrawalVault, EXECUTION_FEE],
      }),
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendTokens",
        args: [marketAddress, CONTRACTS.WithdrawalVault, withdrawAmount],
      }),
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createWithdrawal",
        args: [withdrawalParams],
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
    const operationKey = extractOperationKey(receipt, CONTRACTS.EventEmitter, "Withdrawal");

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
      "Withdrawal",
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
        error: "Withdrawal was cancelled by keeper",
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
  console.log("=== E2E Test: WITHDRAWALS ===");
  console.log(`Wallet: ${config.walletAddress}`);

  // Print balances
  const ethBalance = await publicClient.getBalance({
    address: config.walletAddress as Address,
  });
  console.log(`ETH balance: ${formatEther(ethBalance)}`);

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
    const result = await testWithdrawal(name, market);
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
