import { ethers } from "ethers";
import { useEffect, useRef } from "react";

import { getContract } from "config/contracts";
import { updateByKey } from "lib/objects";
import { getProvider } from "lib/rpc";
import { abis } from "sdk/abis";
import type { ContractsChainId } from "sdk/configs/chains";

import type { DepositStatuses, OrderStatuses, WithdrawalStatuses, MultiTransactionStatus } from "./types";
import { EXECUTION_TIMEOUT_HASH } from "./types";

// --- Constants ---

const POLL_INTERVAL_MS = 5_000; // Poll every 5 seconds
const POLL_DELAY_MS = 10_000; // Wait 10s before first poll (give WS a chance)
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes max before timeout

// Event name hashes for execution/cancellation events
const DEPOSIT_EXECUTED_HASH = ethers.id("DepositExecuted");
const DEPOSIT_CANCELLED_HASH = ethers.id("DepositCancelled");
const WITHDRAWAL_EXECUTED_HASH = ethers.id("WithdrawalExecuted");
const WITHDRAWAL_CANCELLED_HASH = ethers.id("WithdrawalCancelled");
const ORDER_EXECUTED_HASH = ethers.id("OrderExecuted");
const ORDER_CANCELLED_HASH = ethers.id("OrderCancelled");

// --- Types ---

type StatusSetter<T> = React.Dispatch<React.SetStateAction<T>>;

interface ExecutionPollingParams {
  chainId: number;
  depositStatuses: DepositStatuses;
  withdrawalStatuses: WithdrawalStatuses;
  orderStatuses: OrderStatuses;
  setDepositStatuses: StatusSetter<DepositStatuses>;
  setWithdrawalStatuses: StatusSetter<WithdrawalStatuses>;
  setOrderStatuses: StatusSetter<OrderStatuses>;
}

interface StuckOperation {
  key: string;
  createdAt: number;
  createdTxnHash: string;
}

// --- Helpers ---

function isStuckOperation(status: MultiTransactionStatus<unknown>): status is MultiTransactionStatus<unknown> & {
  createdTxnHash: string;
} {
  return Boolean(
    status.createdTxnHash &&
      !status.executedTxnHash &&
      !status.cancelledTxnHash &&
      Date.now() - status.createdAt > POLL_DELAY_MS
  );
}

function getStuckOperations(statuses: Record<string, MultiTransactionStatus<unknown>>): StuckOperation[] {
  return Object.values(statuses)
    .filter(isStuckOperation)
    .map((s) => ({
      key: s.key,
      createdAt: s.createdAt,
      createdTxnHash: s.createdTxnHash,
    }));
}

// --- Hook ---

export function useExecutionPolling({
  chainId,
  depositStatuses,
  withdrawalStatuses,
  orderStatuses,
  setDepositStatuses,
  setWithdrawalStatuses,
  setOrderStatuses,
}: ExecutionPollingParams) {
  // Use refs to avoid re-creating intervals on every status change
  const depositStatusesRef = useRef(depositStatuses);
  depositStatusesRef.current = depositStatuses;

  const withdrawalStatusesRef = useRef(withdrawalStatuses);
  withdrawalStatusesRef.current = withdrawalStatuses;

  const orderStatusesRef = useRef(orderStatuses);
  orderStatusesRef.current = orderStatuses;

  const chainIdRef = useRef(chainId);
  chainIdRef.current = chainId;

  useEffect(() => {
    // Check if there are any stuck operations across all status types
    const hasStuckOps = () => {
      const stuckDeposits = getStuckOperations(depositStatusesRef.current);
      const stuckWithdrawals = getStuckOperations(withdrawalStatusesRef.current);
      const stuckOrders = getStuckOperations(orderStatusesRef.current);
      return stuckDeposits.length > 0 || stuckWithdrawals.length > 0 || stuckOrders.length > 0;
    };

    // Don't start interval if nothing is stuck right now
    // The effect will re-run when statuses change (via the dependency on hasAnyPending)
    if (!hasStuckOps()) return;

    const poll = async () => {
      const currentChainId = chainIdRef.current;

      let provider: ethers.JsonRpcProvider;
      try {
        provider = getProvider(undefined, currentChainId);
      } catch (_e) {
        return;
      }

      let eventEmitterAddress: string;
      try {
        eventEmitterAddress = getContract(currentChainId as ContractsChainId, "EventEmitter");
      } catch (_e) {
        return;
      }

      const eventEmitter = new ethers.Contract(eventEmitterAddress, abis.EventEmitter, provider);
      const EVENT_LOG_TOPIC = eventEmitter.interface.getEvent("EventLog")?.topicHash ?? null;
      const EVENT_LOG1_TOPIC = eventEmitter.interface.getEvent("EventLog1")?.topicHash ?? null;
      const EVENT_LOG2_TOPIC = eventEmitter.interface.getEvent("EventLog2")?.topicHash ?? null;

      const now = Date.now();

      // Poll for stuck deposits
      const stuckDeposits = getStuckOperations(depositStatusesRef.current);
      for (const stuck of stuckDeposits) {
        if (now - stuck.createdAt > MAX_WAIT_MS) {
          setDepositStatuses((old) => updateByKey(old, stuck.key, { cancelledTxnHash: EXECUTION_TIMEOUT_HASH }));
          continue;
        }

        try {
          await pollForEvents(
            provider,
            eventEmitterAddress,
            [EVENT_LOG_TOPIC, EVENT_LOG1_TOPIC, EVENT_LOG2_TOPIC],
            [DEPOSIT_EXECUTED_HASH, DEPOSIT_CANCELLED_HASH],
            eventEmitter,
            stuck.key,
            (key, txnHash, isExecuted) => {
              if (isExecuted) {
                setDepositStatuses((old) => updateByKey(old, key, { executedTxnHash: txnHash }));
              } else {
                setDepositStatuses((old) => updateByKey(old, key, { cancelledTxnHash: txnHash }));
              }
            }
          );
        } catch (_e) {
          // Silently ignore polling errors -- will retry on next interval
        }
      }

      // Poll for stuck withdrawals
      const stuckWithdrawals = getStuckOperations(withdrawalStatusesRef.current);
      for (const stuck of stuckWithdrawals) {
        if (now - stuck.createdAt > MAX_WAIT_MS) {
          setWithdrawalStatuses((old) => updateByKey(old, stuck.key, { cancelledTxnHash: EXECUTION_TIMEOUT_HASH }));
          continue;
        }

        try {
          await pollForEvents(
            provider,
            eventEmitterAddress,
            [EVENT_LOG_TOPIC, EVENT_LOG1_TOPIC, EVENT_LOG2_TOPIC],
            [WITHDRAWAL_EXECUTED_HASH, WITHDRAWAL_CANCELLED_HASH],
            eventEmitter,
            stuck.key,
            (key, txnHash, isExecuted) => {
              if (isExecuted) {
                setWithdrawalStatuses((old) => updateByKey(old, key, { executedTxnHash: txnHash }));
              } else {
                setWithdrawalStatuses((old) => updateByKey(old, key, { cancelledTxnHash: txnHash }));
              }
            }
          );
        } catch (_e) {
          // Silently ignore polling errors
        }
      }

      // Poll for stuck orders
      const stuckOrders = getStuckOperations(orderStatusesRef.current);
      for (const stuck of stuckOrders) {
        if (now - stuck.createdAt > MAX_WAIT_MS) {
          setOrderStatuses((old) => updateByKey(old, stuck.key, { cancelledTxnHash: EXECUTION_TIMEOUT_HASH }));
          continue;
        }

        try {
          await pollForEvents(
            provider,
            eventEmitterAddress,
            [EVENT_LOG_TOPIC, EVENT_LOG1_TOPIC, EVENT_LOG2_TOPIC],
            [ORDER_EXECUTED_HASH, ORDER_CANCELLED_HASH],
            eventEmitter,
            stuck.key,
            (key, txnHash, isExecuted) => {
              if (isExecuted) {
                setOrderStatuses((old) => updateByKey(old, key, { executedTxnHash: txnHash }));
              } else {
                setOrderStatuses((old) => updateByKey(old, key, { cancelledTxnHash: txnHash }));
              }
            }
          );
        } catch (_e) {
          // Silently ignore polling errors
        }
      }
    };

    // Run immediately then on interval
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // Re-evaluate when any status object identity changes (new entries added)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    depositStatuses,
    withdrawalStatuses,
    orderStatuses,
    chainId,
    setDepositStatuses,
    setWithdrawalStatuses,
    setOrderStatuses,
  ]);
}

/**
 * Poll eth_getLogs on the EventEmitter contract for execution/cancellation events
 * matching a specific operation key.
 */
async function pollForEvents(
  provider: ethers.JsonRpcProvider,
  eventEmitterAddress: string,
  eventLogTopics: (string | null)[],
  eventNameHashes: string[],
  eventEmitter: ethers.Contract,
  operationKey: string,
  onFound: (key: string, txnHash: string, isExecuted: boolean) => void
) {
  // Query recent blocks -- use a reasonable lookback (last ~500 blocks, ~15 min on Base)
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 500);

  // Filter for EventLog/EventLog1/EventLog2 events with the execution/cancellation event name hashes
  const validTopics = eventLogTopics.filter(Boolean) as string[];

  const logs = await provider.getLogs({
    address: eventEmitterAddress,
    fromBlock,
    toBlock: "latest",
    topics: [validTopics, eventNameHashes],
  });

  for (const log of logs) {
    try {
      const parsed = eventEmitter.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (!parsed) continue;

      // Extract eventData from parsed args based on event type
      let eventData: unknown;
      if (parsed.name === "EventLog") {
        eventData = parsed.args[3]; // (sender, eventName, eventNameHash, eventData)
      } else if (parsed.name === "EventLog1") {
        eventData = parsed.args[4]; // (sender, eventName, eventNameHash, topic1, eventData)
      } else if (parsed.name === "EventLog2") {
        eventData = parsed.args[5]; // (sender, eventName, eventNameHash, topic1, topic2, eventData)
      } else {
        continue;
      }

      // Extract the key from bytes32Items.items
      const eventLogData = eventData as {
        bytes32Items?: { items?: Array<{ key: string; value: string }> };
      };

      const keyItem = eventLogData?.bytes32Items?.items?.find((item) => item.key === "key");
      if (!keyItem || keyItem.value !== operationKey) continue;

      // Determine the event name hash (topic[1] in the log)
      const eventNameHash = log.topics[1];

      // Determine if this is an execution or cancellation
      const isExecuted = eventNameHash === eventNameHashes[0]; // First hash is always the Executed variant

      onFound(operationKey, log.transactionHash, isExecuted);
      return; // Found a match, stop searching
    } catch (_e) {
      // Skip unparseable logs
      continue;
    }
  }
}
