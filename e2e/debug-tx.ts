import { publicClient, CONTRACTS } from "./config.js";
import { keccak256, toBytes, decodeAbiParameters, type Address } from "viem";

// Check an execution TX to see what events were emitted
// This will help us understand why positions have zero size after execution

const EXECUTION_TX = "0x1c9fdc8675b2bcb8bd4728d80a00b9728119d4fe6457d145158c7bcd0c6d9159" as `0x${string}`;

// Known event name hashes
const EVENT_NAMES = [
  "OrderExecuted",
  "OrderCancelled",
  "PositionIncrease",
  "PositionDecrease",
  "OrderFrozen",
  "InsufficientFundingFeePayment",
  "PositionFeesCollected",
  "PositionFeesInfo",
  "OrderSizeDeltaAutoUpdated",
];

const nameHashes: Record<string, string> = {};
for (const name of EVENT_NAMES) {
  nameHashes[keccak256(toBytes(name))] = name;
}

async function main() {
  const receipt = await publicClient.getTransactionReceipt({ hash: EXECUTION_TX });
  console.log(`TX: ${EXECUTION_TX}`);
  console.log(`Status: ${receipt.status}`);
  console.log(`Logs: ${receipt.logs.length}`);
  console.log();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONTRACTS.EventEmitter.toLowerCase()) continue;

    const eventNameHash = log.topics[1];
    const eventName = eventNameHash ? nameHashes[eventNameHash] || "UNKNOWN" : "N/A";
    console.log(`Event: ${eventName} (hash: ${eventNameHash?.slice(0, 18)}...)`);
    console.log(`  topic2 (key): ${log.topics[2]?.slice(0, 18)}...`);
    console.log(`  topic3 (acct): ${log.topics[3]?.slice(0, 18)}...`);

    // Try to decode the data for some context
    if (log.data && log.data.length > 2) {
      console.log(`  data length: ${(log.data.length - 2) / 2} bytes`);
    }
    console.log();
  }
}

main().catch(console.error);
