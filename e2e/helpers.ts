import {
  type Address,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
  type Log,
  decodeEventLog,
  formatEther,
  formatUnits,
  maxUint256,
} from "viem";
import { eventEmitterAbi, erc20Abi } from "./abis.js";
import { USDC_ADDRESS, WETH_ADDRESS, CONTRACTS } from "./config.js";

// ============================================================
// Types
// ============================================================

export type OpType = "Deposit" | "Withdrawal" | "Order";

export interface ExecutionResult {
  status: "executed" | "cancelled" | "timeout";
  blockNumber?: bigint;
  txHash?: `0x${string}`;
}

export interface TestResult {
  market: string;
  status: "PASS" | "FAIL";
  txHash?: string;
  executionTxHash?: string;
  operationKey?: string;
  error?: string;
  duration?: number;
}

// ============================================================
// ensureApprovals
// ============================================================

/**
 * Check USDC and WETH allowances against SyntheticsRouter. Approve max if needed.
 * Also mint 500 USDC if balance < 200 USDC (mUSDC has public mint).
 */
export async function ensureApprovals(
  walletClient: WalletClient,
  publicClient: PublicClient,
  routerAddress: Address
): Promise<void> {
  const walletAddress = walletClient.account!.address;

  // Check USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress],
  });

  console.log(`  USDC balance: ${formatUnits(usdcBalance, 6)}`);

  // Mint 500 USDC if balance < 200
  if (usdcBalance < 200_000_000n) {
    console.log("  Minting 500 USDC...");
    const mintHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "mint",
      args: [walletAddress, 500_000_000n], // 500 USDC
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    console.log("  Minted 500 USDC");
  }

  // Check USDC allowance against Router
  const usdcAllowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [walletAddress, routerAddress],
  });

  if (usdcAllowance < 1_000_000_000n) {
    console.log("  Approving USDC for Router...");
    const approveHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [routerAddress, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("  USDC approved");
  }

  // Check WETH allowance against Router
  const wethAllowance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [walletAddress, routerAddress],
  });

  if (wethAllowance < 1_000_000_000_000_000_000n) {
    console.log("  Approving WETH for Router...");
    const approveHash = await walletClient.writeContract({
      address: WETH_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [routerAddress, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("  WETH approved");
  }

  // Print ETH balance
  const ethBalance = await publicClient.getBalance({ address: walletAddress });
  console.log(`  ETH balance: ${formatEther(ethBalance)}`);
}

// ============================================================
// extractOperationKey
// ============================================================

/**
 * Parse transaction receipt logs to find the EventLog1 with eventName containing "Created"
 * (DepositCreated, WithdrawalCreated, OrderCreated) and extract topic1 (the operation key).
 */
export function extractOperationKey(
  receipt: TransactionReceipt,
  eventEmitterAddress: Address
): `0x${string}` | null {
  for (const log of receipt.logs) {
    // Only look at logs from the EventEmitter
    if (log.address.toLowerCase() !== eventEmitterAddress.toLowerCase()) {
      continue;
    }

    // EventLog1 has 3 indexed topics: msgSender, eventNameHash, topic1
    // Plus the event signature as topics[0]
    // topics: [eventSig, msgSender, eventNameHash, topic1]
    if (!log.topics || log.topics.length < 4) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: eventEmitterAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "EventLog1") {
        const args = decoded.args as {
          msgSender: Address;
          eventName: string;
          eventNameHash: string;
          topic1: `0x${string}`;
          eventData: `0x${string}`;
        };

        // Check if this is a "Created" event
        if (args.eventName.includes("Created")) {
          return args.topic1;
        }
      }
    } catch {
      // Not an EventLog1 log, skip
      continue;
    }
  }

  return null;
}

// ============================================================
// waitForExecution
// ============================================================

/**
 * Poll EventEmitter getLogs for EventLog1 events where topic1 matches the operation key
 * and eventName matches `{OpType}Executed` or `{OpType}Cancelled`.
 * Polls every 2 seconds until timeout.
 */
export async function waitForExecution(
  publicClient: PublicClient,
  eventEmitterAddress: Address,
  operationKey: `0x${string}`,
  opType: OpType,
  timeoutMs: number = 60_000
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const executedName = `${opType}Executed`;
  const cancelledName = `${opType}Cancelled`;

  // Get current block as starting point
  const currentBlock = await publicClient.getBlockNumber();
  // Look back a few blocks to not miss anything
  const fromBlock = currentBlock > 5n ? currentBlock - 5n : 0n;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const logs: Log[] = await publicClient.getLogs({
        address: eventEmitterAddress,
        event: {
          type: "event",
          name: "EventLog1",
          inputs: [
            { name: "msgSender", type: "address", indexed: true },
            { name: "eventName", type: "string", indexed: false },
            { name: "eventNameHash", type: "string", indexed: true },
            { name: "topic1", type: "bytes32", indexed: true },
            { name: "eventData", type: "bytes", indexed: false },
          ],
        },
        args: {
          topic1: operationKey,
        },
        fromBlock,
        toBlock: "latest",
      });

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: eventEmitterAbi,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "EventLog1") {
            const args = decoded.args as {
              eventName: string;
              topic1: `0x${string}`;
            };

            if (args.eventName === executedName) {
              return {
                status: "executed",
                blockNumber: log.blockNumber ?? undefined,
                txHash: log.transactionHash ?? undefined,
              };
            }

            if (args.eventName === cancelledName) {
              return {
                status: "cancelled",
                blockNumber: log.blockNumber ?? undefined,
                txHash: log.transactionHash ?? undefined,
              };
            }
          }
        } catch {
          // Decoding error, skip this log
          continue;
        }
      }
    } catch (err) {
      // getLogs failed, retry after delay
      console.log(`    getLogs error, retrying... (${(err as Error).message?.slice(0, 60)})`);
    }

    // Poll every 2 seconds
    await sleep(2000);
  }

  return { status: "timeout" };
}

// ============================================================
// formatResults
// ============================================================

/**
 * Print a clean summary table and return exit code info.
 */
export function formatResults(results: TestResult[]): void {
  console.log("\n=== RESULTS ===");

  const maxNameLen = Math.max(...results.map((r) => r.market.length));

  for (const r of results) {
    const name = r.market.padEnd(maxNameLen);
    const statusIcon = r.status === "PASS" ? "PASS" : "FAIL";
    const detail = r.error ? ` (${r.error})` : "";
    console.log(`  ${name}  ${statusIcon}${detail}`);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const total = results.length;
  console.log(`\n${passed}/${total} PASSED`);
}

// ============================================================
// Utility
// ============================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
