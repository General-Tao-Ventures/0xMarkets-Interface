import { ethers } from "ethers";
import { useEffect, useRef } from "react";

import { getContract } from "config/contracts";
import { updateByKey } from "lib/objects";
import { getProvider } from "lib/rpc";
import { abis } from "sdk/abis";
import type { ContractsChainId } from "sdk/configs/chains";

import { parseEventLogData } from "context/WebsocketContext/subscribeToEvents";

import type { DepositStatuses, EventLogData, EventTxnParams, OrderStatuses, WithdrawalStatuses, MultiTransactionStatus } from "./types";
import { EXECUTION_TIMEOUT_HASH } from "./types";

// --- Constants ---

const POLL_INTERVAL_MS = 3_000; // Poll every 3 seconds
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

type EventLogHandler = (eventData: EventLogData, txnParams: EventTxnParams) => void;

interface ExecutionPollingParams {
  chainId: number;
  depositStatuses: DepositStatuses;
  withdrawalStatuses: WithdrawalStatuses;
  orderStatuses: OrderStatuses;
  setDepositStatuses: StatusSetter<DepositStatuses>;
  setWithdrawalStatuses: StatusSetter<WithdrawalStatuses>;
  setOrderStatuses: StatusSetter<OrderStatuses>;
  watchedTxnHashes: Set<string>;
  setWatchedTxnHashes: React.Dispatch<React.SetStateAction<Set<string>>>;
  eventLogHandlers: React.MutableRefObject<Record<string, EventLogHandler>>;
}

interface PendingOperation {
  key: string;
  createdAt: number;
  createdTxnHash: string;
}

// --- Helpers ---

function isPendingOperation(status: MultiTransactionStatus<unknown>): status is MultiTransactionStatus<unknown> & {
  createdTxnHash: string;
} {
  return Boolean(
    status.createdTxnHash &&
      !status.executedTxnHash &&
      !status.cancelledTxnHash
  );
}

function getPendingOperations(statuses: Record<string, MultiTransactionStatus<unknown>>): PendingOperation[] {
  return Object.values(statuses)
    .filter(isPendingOperation)
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
  watchedTxnHashes,
  setWatchedTxnHashes,
  eventLogHandlers,
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

  const watchedTxnHashesRef = useRef(watchedTxnHashes);
  watchedTxnHashesRef.current = watchedTxnHashes;

  const eventLogHandlersRef = useRef(eventLogHandlers);
  eventLogHandlersRef.current = eventLogHandlers;

  useEffect(() => {
    const hasPendingOps =
      Object.values(depositStatusesRef.current).some(isPendingOperation) ||
      Object.values(withdrawalStatusesRef.current).some(isPendingOperation) ||
      Object.values(orderStatusesRef.current).some(isPendingOperation);

    const hasWatchedTxns = watchedTxnHashes.size > 0;

    // Don't start interval if nothing needs polling
    if (!hasPendingOps && !hasWatchedTxns) return;

    console.warn(
      "[execution-polling] Starting unified poll loop.",
      "watchedTxns:", watchedTxnHashes.size,
      "pendingOps:", hasPendingOps
    );

    const poll = async () => {
      const currentChainId = chainIdRef.current;

      let provider: ethers.JsonRpcProvider;
      try {
        provider = getProvider(undefined, currentChainId);
      } catch {
        return;
      }

      let eventEmitterAddress: string;
      try {
        eventEmitterAddress = getContract(currentChainId as ContractsChainId, "EventEmitter");
      } catch {
        return;
      }

      const eventEmitter = new ethers.Contract(eventEmitterAddress, abis.EventEmitter, provider);
      const EVENT_LOG_TOPIC = eventEmitter.interface.getEvent("EventLog")?.topicHash ?? null;
      const EVENT_LOG1_TOPIC = eventEmitter.interface.getEvent("EventLog1")?.topicHash ?? null;
      const EVENT_LOG2_TOPIC = eventEmitter.interface.getEvent("EventLog2")?.topicHash ?? null;

      // --- Phase A: Receipt detection for watched TX hashes ---
      const currentWatched = watchedTxnHashesRef.current;
      for (const txnHash of currentWatched) {
        try {
          const receipt = await provider.getTransactionReceipt(txnHash);
          if (!receipt) continue;

          console.warn("[execution-polling] Receipt found for TX:", txnHash, "logs:", receipt.logs.length);

          // Remove from watch list
          setWatchedTxnHashes((prev) => {
            const next = new Set(prev);
            next.delete(txnHash);
            return next;
          });

          // Parse logs and feed through event handlers (triggers OrderCreated → sets createdTxnHash)
          for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== eventEmitterAddress.toLowerCase()) continue;

            try {
              const parsed = eventEmitter.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });

              if (!parsed) continue;

              const txnOpts: EventTxnParams = {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
              };

              let eventName: string;
              let rawEventData: unknown;

              if (parsed.name === "EventLog") {
                eventName = parsed.args[1];
                rawEventData = parsed.args[3];
              } else if (parsed.name === "EventLog1") {
                eventName = parsed.args[1];
                rawEventData = parsed.args[4];
              } else if (parsed.name === "EventLog2") {
                eventName = parsed.args[1];
                rawEventData = parsed.args[5];
              } else {
                continue;
              }

              console.warn("[execution-polling] Parsed event:", eventName, "from TX:", txnHash);
              const parsedData = parseEventLogData(rawEventData);
              eventLogHandlersRef.current.current[eventName]?.(parsedData, txnOpts);
            } catch {
              // Skip unparseable logs
            }
          }
        } catch {
          // Receipt not available yet, will retry on next poll
        }
      }

      // --- Phase B: Execution detection for pending operations ---
      const now = Date.now();

      // Poll for pending deposits
      const pendingDeposits = getPendingOperations(depositStatusesRef.current);
      for (const pending of pendingDeposits) {
        console.warn("[execution-polling] Polling for pending operation:", pending.key, "type:", "deposit", "elapsed:", now - pending.createdAt, "ms");
      }
      for (const pending of pendingDeposits) {
        if (now - pending.createdAt > MAX_WAIT_MS) {
          console.warn("[execution-polling] Operation timed out:", pending.key, "after", now - pending.createdAt, "ms");
          setDepositStatuses((old) => updateByKey(old, pending.key, { cancelledTxnHash: EXECUTION_TIMEOUT_HASH }));
          continue;
        }

        try {
          await pollForEvents(
            provider,
            eventEmitterAddress,
            [EVENT_LOG_TOPIC, EVENT_LOG1_TOPIC, EVENT_LOG2_TOPIC],
            [DEPOSIT_EXECUTED_HASH, DEPOSIT_CANCELLED_HASH],
            eventEmitter,
            pending.key,
            (key, txnHash, isExecuted) => {
              console.warn("[execution-polling] Found event via RPC poll:", isExecuted ? "executed" : "cancelled", "key:", key, "txnHash:", txnHash);
              if (isExecuted) {
                setDepositStatuses((old) => updateByKey(old, key, { executedTxnHash: txnHash }));
              } else {
                setDepositStatuses((old) => updateByKey(old, key, { cancelledTxnHash: txnHash }));
              }
            }
          );
        } catch {
          // Will retry on next interval
        }
      }

      // Poll for pending withdrawals
      const pendingWithdrawals = getPendingOperations(withdrawalStatusesRef.current);
      for (const pending of pendingWithdrawals) {
        console.warn("[execution-polling] Polling for pending operation:", pending.key, "type:", "withdrawal", "elapsed:", now - pending.createdAt, "ms");
      }
      for (const pending of pendingWithdrawals) {
        if (now - pending.createdAt > MAX_WAIT_MS) {
          console.warn("[execution-polling] Operation timed out:", pending.key, "after", now - pending.createdAt, "ms");
          setWithdrawalStatuses((old) => updateByKey(old, pending.key, { cancelledTxnHash: EXECUTION_TIMEOUT_HASH }));
          continue;
        }

        try {
          await pollForEvents(
            provider,
            eventEmitterAddress,
            [EVENT_LOG_TOPIC, EVENT_LOG1_TOPIC, EVENT_LOG2_TOPIC],
            [WITHDRAWAL_EXECUTED_HASH, WITHDRAWAL_CANCELLED_HASH],
            eventEmitter,
            pending.key,
            (key, txnHash, isExecuted) => {
              console.warn("[execution-polling] Found event via RPC poll:", isExecuted ? "executed" : "cancelled", "key:", key, "txnHash:", txnHash);
              if (isExecuted) {
                setWithdrawalStatuses((old) => updateByKey(old, key, { executedTxnHash: txnHash }));
              } else {
                setWithdrawalStatuses((old) => updateByKey(old, key, { cancelledTxnHash: txnHash }));
              }
            }
          );
        } catch {
          // Will retry on next interval
        }
      }

      // Poll for pending orders
      const pendingOrders = getPendingOperations(orderStatusesRef.current);
      for (const pending of pendingOrders) {
        console.warn("[execution-polling] Polling for pending operation:", pending.key, "type:", "order", "elapsed:", now - pending.createdAt, "ms");
      }
      for (const pending of pendingOrders) {
        if (now - pending.createdAt > MAX_WAIT_MS) {
          console.warn("[execution-polling] Operation timed out:", pending.key, "after", now - pending.createdAt, "ms");
          setOrderStatuses((old) => updateByKey(old, pending.key, { cancelledTxnHash: EXECUTION_TIMEOUT_HASH }));
          continue;
        }

        try {
          await pollForEvents(
            provider,
            eventEmitterAddress,
            [EVENT_LOG_TOPIC, EVENT_LOG1_TOPIC, EVENT_LOG2_TOPIC],
            [ORDER_EXECUTED_HASH, ORDER_CANCELLED_HASH],
            eventEmitter,
            pending.key,
            (key, txnHash, isExecuted) => {
              console.warn("[execution-polling] Found event via RPC poll:", isExecuted ? "executed" : "cancelled", "key:", key, "txnHash:", txnHash);
              if (isExecuted) {
                setOrderStatuses((old) => updateByKey(old, key, { executedTxnHash: txnHash }));
              } else {
                setOrderStatuses((old) => updateByKey(old, key, { cancelledTxnHash: txnHash }));
              }
            }
          );
        } catch {
          // Will retry on next interval
        }
      }
    };

    // Run immediately then on interval
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watchedTxnHashes,
    chainId,
    setDepositStatuses,
    setWithdrawalStatuses,
    setOrderStatuses,
    setWatchedTxnHashes,
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
    } catch {
      // Skip unparseable logs
      continue;
    }
  }
}
