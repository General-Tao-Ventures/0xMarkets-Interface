import {
  type Address,
  type PublicClient,
  type TransactionReceipt,
  formatEther,
  formatUnits,
  keccak256,
  maxUint256,
  toBytes,
} from "viem";
import { erc20Abi } from "./abis.js";
import { USDC_ADDRESS, WETH_ADDRESS } from "./config.js";

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
  status: "PASS" | "FAIL" | "SKIP";
  txHash?: string;
  executionTxHash?: string;
  operationKey?: string;
  error?: string;
  duration?: number;
}

// Use a loose type for walletClient to avoid chain generic issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWalletClient = any;

// ============================================================
// Event signature constants
// ============================================================

// EventLog2 is the event emitted by the EventEmitter contract for
// DepositCreated, DepositExecuted, DepositCancelled, etc.
// The contract uses emitEventLog2() which emits:
//   EventLog2(address msgSender, string eventName, string indexed eventNameHash,
//             bytes32 indexed topic1, bytes32 indexed topic2, EventUtils.EventLogData eventData)
// Topics layout: [eventSig, eventNameHash, topic1(=operationKey), topic2(=account)]

// Pre-computed keccak256 of event name strings (used as indexed eventNameHash)
const EVENT_NAME_HASHES: Record<string, `0x${string}`> = {
  DepositCreated: keccak256(toBytes("DepositCreated")),
  DepositExecuted: keccak256(toBytes("DepositExecuted")),
  DepositCancelled: keccak256(toBytes("DepositCancelled")),
  WithdrawalCreated: keccak256(toBytes("WithdrawalCreated")),
  WithdrawalExecuted: keccak256(toBytes("WithdrawalExecuted")),
  WithdrawalCancelled: keccak256(toBytes("WithdrawalCancelled")),
  OrderCreated: keccak256(toBytes("OrderCreated")),
  OrderExecuted: keccak256(toBytes("OrderExecuted")),
  OrderCancelled: keccak256(toBytes("OrderCancelled")),
};

// ============================================================
// ensureApprovals
// ============================================================

/**
 * Check USDC and WETH allowances against SyntheticsRouter. Approve max if needed.
 * Also mint 500 USDC if balance < 200 USDC (mUSDC has public mint).
 */
export async function ensureApprovals(
  walletClient: AnyWalletClient,
  publicClient: PublicClient,
  routerAddress: Address
): Promise<void> {
  const walletAddress: Address = walletClient.account!.address;

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
 * Parse transaction receipt logs to find the EventLog2 event with eventNameHash
 * matching "{OpType}Created" and extract topic1 (the operation key).
 *
 * EventLog2 topics layout:
 *   topics[0] = event signature hash
 *   topics[1] = keccak256(eventName) -- e.g. keccak256("DepositCreated")
 *   topics[2] = topic1 (operation key = bytes32)
 *   topics[3] = topic2 (account address padded to bytes32)
 */
export function extractOperationKey(
  receipt: TransactionReceipt,
  eventEmitterAddress: Address,
  opType: OpType = "Deposit"
): `0x${string}` | null {
  const createdHash = EVENT_NAME_HASHES[`${opType}Created`];
  if (!createdHash) return null;

  for (const log of receipt.logs) {
    // Only look at logs from the EventEmitter
    if (log.address.toLowerCase() !== eventEmitterAddress.toLowerCase()) {
      continue;
    }

    // EventLog2 has 3 indexed params + event sig = 4 topics
    if (!log.topics || log.topics.length < 4) {
      continue;
    }

    // Check if topics[1] (eventNameHash) matches our "{OpType}Created" hash
    if (log.topics[1]?.toLowerCase() === createdHash.toLowerCase()) {
      // topics[2] is topic1 = the operation key
      return log.topics[2] as `0x${string}`;
    }
  }

  return null;
}

// ============================================================
// waitForExecution
// ============================================================

/**
 * Poll EventEmitter getLogs for EventLog2 events where topic1 (topics[2])
 * matches the operation key and eventNameHash (topics[1]) matches
 * `{OpType}Executed` or `{OpType}Cancelled`.
 *
 * Polls every 2 seconds until timeout.
 */
export async function waitForExecution(
  publicClient: PublicClient,
  eventEmitterAddress: Address,
  operationKey: `0x${string}`,
  opType: OpType,
  timeoutMs: number = 60_000,
  startFromBlock?: bigint
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const executedHash = EVENT_NAME_HASHES[`${opType}Executed`];
  const cancelledHash = EVENT_NAME_HASHES[`${opType}Cancelled`];

  // Use provided block or look back a few blocks from current
  const fromBlock =
    startFromBlock ??
    (await publicClient.getBlockNumber().then((b) => (b > 5n ? b - 5n : 0n)));

  while (Date.now() - startTime < timeoutMs) {
    try {
      const logs = await publicClient.getLogs({
        address: eventEmitterAddress,
        topics: [null, null, operationKey],
        fromBlock,
        toBlock: "latest",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      for (const log of logs) {
        if (!log.topics || log.topics.length < 3) continue;

        // Verify topics[2] matches our operation key (RPC may not filter correctly)
        if (log.topics[2]?.toLowerCase() !== operationKey.toLowerCase()) continue;

        const eventNameHash = log.topics[1];

        if (eventNameHash?.toLowerCase() === executedHash?.toLowerCase()) {
          return {
            status: "executed",
            blockNumber: log.blockNumber ?? undefined,
            txHash: log.transactionHash ?? undefined,
          };
        }

        if (eventNameHash?.toLowerCase() === cancelledHash?.toLowerCase()) {
          return {
            status: "cancelled",
            blockNumber: log.blockNumber ?? undefined,
            txHash: log.transactionHash ?? undefined,
          };
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
    const statusIcon = r.status === "SKIP" ? "SKIP" : r.status === "PASS" ? "PASS" : "FAIL";
    const detail = r.error ? ` (${r.error})` : "";
    console.log(`  ${name}  ${statusIcon}${detail}`);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  const total = results.length;
  console.log(`\n${passed}/${total} PASSED${skipped > 0 ? ` (${skipped} skipped)` : ""}`);
}

// ============================================================
// Utility
// ============================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
