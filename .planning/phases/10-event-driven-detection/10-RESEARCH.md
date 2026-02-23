# Phase 10: Event-Driven Detection - Research

**Researched:** 2026-02-23
**Domain:** WebSocket event-driven architecture for DeFi keeper operation detection
**Confidence:** HIGH

## Summary

Phase 10 replaces the `order-execution-keeper-service`'s 10-second polling loop with WebSocket event subscriptions on the EventEmitter contract, adds a serialized execution queue to prevent nonce collisions, and implements automatic event backfill for restart recovery. The current architecture (in `src/index.ts`) uses `setInterval(executePendingRequests, 10_000)` with an `isExecuting` boolean mutex. Detection latency is 0-10 seconds (average 5s) from the polling lottery alone, before any execution even starts. The WebSocket approach delivers events within one block time (2 seconds on Base Sepolia), cutting average detection from 5s to under 2s.

All required capabilities exist in viem v2.40.3 (already installed): `webSocket()` transport, `watchContractEvent()`, and `getLogs()` for backfill. No new npm packages are needed. The only infrastructure addition is a WebSocket-capable RPC endpoint (`WS_RPC_URL` env var). The EventEmitter contract ABI and event structure are fully documented in the existing codebase (SDK ABI at `sdk/src/abis/EventEmitter.json`, frontend usage in `src/context/WebsocketContext/subscribeToEvents.ts`, reference implementation in `keeper-service/src/core/confirmator.ts`).

**Primary recommendation:** Build an `ExecutionQueue` (FIFO + dedup Set) first, then a dedicated WebSocket `PublicClient` for event subscriptions, then an `EventListener` that watches `EventLog1` and `EventLog2` events on EventEmitter filtering for `DepositCreated`/`WithdrawalCreated`/`OrderCreated` event names. Retain reduced-frequency polling (30s) as a safety net. All execution -- event-triggered and poll-triggered -- must flow through the single-consumer queue.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DETECT-01 | Keeper detects new deposits/withdrawals/orders via WebSocket event listeners within 2 seconds of on-chain creation | `watchContractEvent` on dedicated WebSocket `PublicClient` subscribes to EventEmitter `EventLog1`/`EventLog2` events; Base Sepolia 2s block time means detection within one block. Event structure verified from SDK ABI and `subscribeToEvents.ts`. |
| DETECT-02 | Polling fallback continues scanning at reduced interval when WebSocket connection drops | Existing `setInterval` scanner loop retained at 30s interval; both paths feed into shared `ExecutionQueue`; viem WebSocket transport has built-in reconnect (configurable `maxAttempts` and `delay`). |
| DETECT-03 | Keeper backfills missed events on WebSocket reconnection using persisted block numbers | `getLogs({ fromBlock, toBlock })` on HTTP client fetches historical events since `lastProcessedBlock`; block number persisted to Prisma DB; backfill runs at startup and on reconnect. |
| INFRA-01 | Both keeper services use WebSocket RPC transport for Base Sepolia event subscriptions | Dedicated WebSocket-only `PublicClient` created with `webSocket(WS_RPC_URL)` transport; HTTP client unchanged for TX submission; transport type verified at startup via `client.transport.type === "webSocket"`. Note: only order-execution-keeper-service needs this for Phase 10; keeper-service confirmator can be upgraded as a follow-on. |
| EXEC-01 | All keeper transactions flow through a serialized execution queue that prevents nonce collisions | `ExecutionQueue` class with `pending: Map<Hex, QueueItem>`, `processing: Set<Hex>`, single async consumer loop; both EventListener and Scanner enqueue items; `enqueue()` returns false if key already tracked (deduplication). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.40.3 | WebSocket transport, watchContractEvent, getLogs | Already installed; all features stable and documented in Context7 |
| prisma | ^7.2.0 | Block number persistence for backfill | Already installed; existing schema supports new fields |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.3.1 | Structured logging for event listener | Already installed; child logger pattern established |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory queue | Redis/BullMQ | Adds infrastructure dependency for single-process I/O workload; out of scope per REQUIREMENTS.md |
| viem watchContractEvent | ethers.js provider.on() | Would require adding ethers as dependency; viem already in use |
| Prisma for block persistence | File-based JSON | Fragile on container restart; Prisma DB already exists |

**Installation:**
```bash
# No new packages needed. All capabilities exist in current dependencies.
```

## Architecture Patterns

### Recommended Project Structure
```
order-execution-keeper-service/src/
  core/
    queue/
      executionQueue.ts       # NEW: FIFO queue with dedup Set
    listeners/
      eventListener.ts        # NEW: WebSocket event watcher
    blockchain/
      client.ts               # MODIFIED: add getWsPublicClient()
      contracts/
        abis/
          eventEmitter.ts      # NEW: EventEmitter ABI (from SDK)
    scanners/                  # EXISTING: unchanged scanner classes
    executors/                 # EXISTING: unchanged executor classes
  config.ts                    # MODIFIED: add WS_RPC_URL
  index.ts                     # MODIFIED: wire queue drain loop
  utils/
    healthState.ts             # MODIFIED: add heartbeat timer
```

### Pattern 1: Dedicated WebSocket PublicClient
**What:** Create a separate `PublicClient` using `webSocket()` transport exclusively for event subscriptions. Keep the existing HTTP `PublicClient` for reads and TX submission.
**When to use:** Always -- `fallback([webSocket(), http()])` does NOT produce a WebSocket-type client (viem Issue #776). `watchContractEvent` silently falls back to HTTP polling if the transport is not `"webSocket"` type.
**Example:**
```typescript
// Source: viem docs - https://viem.sh/docs/clients/transports/websocket
import { createPublicClient, webSocket, type PublicClient } from "viem";

let wsClient: PublicClient | null = null;

export function getWsPublicClient(): PublicClient | null {
  if (wsClient) return wsClient;

  const wsUrl = config.wsRpcUrl;
  if (!wsUrl) return null; // graceful degradation to polling-only

  wsClient = createPublicClient({
    chain: customChain,
    transport: webSocket(wsUrl, {
      keepAlive: { interval: 10_000 },
      reconnect: { maxAttempts: Infinity, delay: 2_000 },
    }),
  });

  // CRITICAL: verify transport type at startup
  if (wsClient.transport.type !== "webSocket") {
    throw new Error(
      `Expected WebSocket transport but got "${wsClient.transport.type}". ` +
      `Check WS_RPC_URL: ${wsUrl}`
    );
  }

  return wsClient;
}
```

### Pattern 2: ExecutionQueue with Deduplication
**What:** In-memory FIFO queue with a `Set<Hex>` tracking all known keys (pending + processing). Single async consumer drains items sequentially. Both event listener and polling scanner feed into this queue.
**When to use:** All execution paths. Never call executors directly.
**Example:**
```typescript
// Source: project research - combining viem nonce behavior with queue pattern
type OperationType = "deposit" | "withdrawal" | "order";

interface QueueItem {
  key: Hex;
  type: OperationType;
  detectedAt: number;
  source: "event" | "poll";
}

class ExecutionQueue {
  private pending: Map<Hex, QueueItem> = new Map(); // preserves insertion order
  private processing: Set<Hex> = new Set();
  private allKnown: Set<Hex> = new Set(); // dedup across event + poll

  enqueue(item: QueueItem): boolean {
    if (this.allKnown.has(item.key)) return false; // already tracked
    this.allKnown.set(item.key);
    this.pending.set(item.key, item);
    return true;
  }

  dequeue(): QueueItem | undefined {
    const first = this.pending.entries().next();
    if (first.done) return undefined;
    const [key, item] = first.value;
    this.pending.delete(key);
    this.processing.add(key);
    return item;
  }

  complete(key: Hex): void {
    this.processing.delete(key);
    // Keep in allKnown to prevent re-enqueue within same session
  }

  get size(): number { return this.pending.size; }
}
```

### Pattern 3: Event Listening with Topic-Based Filtering
**What:** Watch EventEmitter for `EventLog1` (used for some event types) and `EventLog2` (used for DepositCreated, WithdrawalCreated, OrderCreated) events, filtering by `eventNameHash` topic.
**When to use:** Primary detection path when WebSocket is connected.
**Example:**
```typescript
// Source: codebase analysis of subscribeToEvents.ts + confirmator.ts
import { keccak256, toHex, parseAbi } from "viem";

// Event name hashes (keccak256 of the event name string)
const DEPOSIT_CREATED_HASH = keccak256(toHex("DepositCreated"));
const WITHDRAWAL_CREATED_HASH = keccak256(toHex("WithdrawalCreated"));
const ORDER_CREATED_HASH = keccak256(toHex("OrderCreated"));

// EventEmitter ABI (minimal for watching)
const eventEmitterAbi = parseAbi([
  "event EventLog1(address indexed msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, bytes eventData)",
  "event EventLog2(address indexed msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, bytes32 indexed topic2, bytes eventData)",
]);

// Watch for creation events
const unwatch = wsClient.watchContractEvent({
  address: config.eventEmitterAddress,
  abi: eventEmitterAbi,
  eventName: "EventLog2", // DepositCreated uses EventLog2
  onLogs: (logs) => {
    for (const log of logs) {
      const { eventName, topic1 } = log.args;
      if (eventName === "DepositCreated") {
        queue.enqueue({ key: topic1, type: "deposit", detectedAt: Date.now(), source: "event" });
      }
      // ... similar for WithdrawalCreated, OrderCreated
    }
  },
});
```

### Pattern 4: Block-Number Backfill on Startup
**What:** Persist the block number of the last processed event to the database. On startup, use `getLogs()` to fetch any events emitted between the last processed block and the current block.
**When to use:** Every startup; also on WebSocket reconnect if gap detected.
**Example:**
```typescript
// Source: viem docs - https://viem.sh/docs/actions/public/getLogs
async function backfillEvents(fromBlock: bigint): Promise<void> {
  const currentBlock = await httpClient.getBlockNumber();

  if (fromBlock >= currentBlock) return; // no gap

  const logs = await httpClient.getLogs({
    address: config.eventEmitterAddress,
    fromBlock,
    toBlock: currentBlock,
    // Filter for EventLog2 topic + creation event name hashes
    topics: [
      eventLog2TopicHash,
      [DEPOSIT_CREATED_HASH, WITHDRAWAL_CREATED_HASH, ORDER_CREATED_HASH],
    ],
  });

  for (const log of logs) {
    // Parse and enqueue each event
    const decoded = decodeEventLog({ abi: eventEmitterAbi, ...log });
    queue.enqueue({
      key: decoded.args.topic1,
      type: classifyEventName(decoded.args.eventName),
      detectedAt: Date.now(),
      source: "event",
    });
  }

  await persistLastProcessedBlock(currentBlock);
}
```

### Anti-Patterns to Avoid
- **Using `fallback([webSocket(), http()])` for event subscriptions:** Transport type will be `"fallback"`, not `"webSocket"`. `watchContractEvent` silently falls back to HTTP polling. Use a dedicated WebSocket-only client.
- **Calling executors directly from event callbacks:** Bypasses the queue, creating nonce collision risk. Always enqueue, never execute inline.
- **Removing the polling fallback entirely:** WebSocket connections die silently. The 30s polling fallback catches any events missed during WS gaps.
- **Using `Promise.all()` for concurrent execution:** The current `LIFE-04` comment in `index.ts` explicitly warns against this. Sequential execution through the queue consumer preserves nonce ordering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom reconnect loop | viem `webSocket()` transport `reconnect` option | Built-in exponential backoff; handles ping/pong; tested across providers |
| Event subscription | Raw `eth_subscribe` calls | viem `watchContractEvent()` | ABI-aware decoding; automatic topic hashing; cleanup via returned `unwatch()` |
| Historical event fetch | Manual block iteration | viem `getLogs({ fromBlock, toBlock })` | Handles pagination; respects provider limits; typed return |
| Nonce management | Manual `getTransactionCount` | Existing `BaseExecutor.submitTransaction()` | Already handles nonce-too-low retries with gas bumping |

**Key insight:** The entire event-driven infrastructure is implementable with viem's existing API surface. The complexity is in the coordination layer (queue, dedup, backfill) -- not in the RPC interactions.

## Common Pitfalls

### Pitfall 1: Silent WebSocket Fallback to HTTP Polling
**What goes wrong:** `watchContractEvent` compiles and "works" with an HTTP transport, but internally uses `eth_getFilterChanges` polling instead of `eth_subscribe` push. Detection latency remains at polling intervals, not block-level.
**Why it happens:** viem's `watchContractEvent` auto-detects transport type. With `http()` or `fallback()` transport, it uses polling. Only `webSocket()` transport triggers real `eth_subscribe`.
**How to avoid:** Create a dedicated `PublicClient` with `webSocket()` transport. Verify at startup: `assert(wsClient.transport.type === "webSocket")`. Log the transport type to confirm.
**Warning signs:** Detection latency stays at 5-10s despite event listener being "active". No `eth_subscribe` calls visible in RPC provider logs.

### Pitfall 2: Nonce Collision from Event + Poll Race
**What goes wrong:** Both the event listener and the polling scanner detect the same pending operation within the same cycle. Two executors start concurrently, fetch the same pending nonce, and the second TX fails with "nonce too low" or "replacement transaction underpriced."
**Why it happens:** The current `isExecuting` boolean mutex only protects the polling path. Event callbacks bypass it. Without a shared queue, there's no coordination.
**How to avoid:** All execution (event-triggered or poll-triggered) flows through the single-consumer `ExecutionQueue`. The queue consumer processes one item at a time. Never call `executor.execute()` directly from an event callback.
**Warning signs:** "nonce too low" errors in logs shortly after adding event listeners. Works fine with low traffic but breaks under rapid concurrent operations.

### Pitfall 3: Double Execution from Deduplication Failure
**What goes wrong:** The event listener enqueues a deposit key. Before execution completes, the 30s polling scanner also discovers the same key in DEPOSIT_LIST and enqueues it again. The executor runs twice: first succeeds, second gets `EmptyDeposit` revert or wastes gas.
**Why it happens:** Without a shared `allKnown` Set, each detection path has no visibility into what the other already found.
**How to avoid:** `ExecutionQueue.enqueue()` checks `allKnown` Set before accepting. Scanner should also check the queue's known set before even reading chain data for a key.
**Warning signs:** `EmptyDeposit` errors in logs. Gas wasted on already-executed operations. Misleading FAILED status in DB.

### Pitfall 4: Silent WebSocket Death Without Recovery
**What goes wrong:** The WebSocket connection dies (provider drops it, network blip, idle timeout) without emitting an error event. The event listener stops receiving events. The keeper appears healthy but misses all operations.
**Why it happens:** WebSocket connections can die silently (TCP FIN not received). viem's `reconnect` option handles some cases but not all (e.g., half-open connections where keepAlive pings succeed but data stops flowing).
**How to avoid:** Track `lastEventBlockNumber` in the event listener. Compare against `httpClient.getBlockNumber()` periodically. If the gap exceeds a threshold (e.g., 10 blocks = 20s), trigger a backfill and restart the WebSocket listener. The 30s polling fallback is the ultimate safety net.
**Warning signs:** No events received for extended periods despite on-chain activity. Health endpoint reports OK but operations are not executing.

### Pitfall 5: Backfill Gap on Restart
**What goes wrong:** Keeper restarts. Events emitted during downtime are missed. The polling scanner eventually picks them up from DataStore, but there's a latency gap. If the operations expire before the scanner's next cycle, they're lost.
**Why it happens:** Without persisted block numbers, the keeper has no knowledge of what it already processed. It can't distinguish "no events happened" from "events happened but I wasn't listening."
**How to avoid:** Persist `lastProcessedBlock` to Prisma DB. On startup, run `getLogs({ fromBlock: lastProcessedBlock + 1n })` to fetch all events since last known position. Process them through the queue before starting the event listener.
**Warning signs:** Operations created during keeper restarts take longer to execute. REQUEST_EXPIRATION_TIME exceeded for operations created during downtime.

### Pitfall 6: EventEmitter Event Structure Mismatch
**What goes wrong:** Code watches for `EventLog2` but the event is actually emitted as `EventLog1`, or vice versa. The request key is extracted from the wrong topic position.
**Why it happens:** The EventEmitter contract uses different event variants (`EventLog`, `EventLog1`, `EventLog2`) depending on how many indexed topics are needed. The mapping of event names to variants must be verified.
**How to avoid:** The frontend's `subscribeToEvents.ts` (lines 465-515) is the authoritative reference. `DepositCreated`, `WithdrawalCreated`, and `OrderCreated` all use `EventLog2` with topics `[EVENT_LOG2_TOPIC, eventNameHash, null, accountHash]`. For the keeper (not filtering by account), watch `EventLog2` with `eventNameHash` filter. The request key is in `topic1` (second indexed param after eventNameHash).
**Warning signs:** Event listener receives events but decoded data doesn't contain expected fields. Key extraction returns account address instead of request key.

## Code Examples

### WebSocket Client Creation with Startup Verification
```typescript
// Source: viem docs + project-specific customChain pattern from client.ts
import { createPublicClient, webSocket, type PublicClient } from "viem";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";

const log = logger.child({ module: "wsClient" });

let wsClient: PublicClient | null = null;

const customChain = {
  id: config.chainId,
  name: "Custom",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl!] } },
};

export function getWsPublicClient(): PublicClient | null {
  if (wsClient) return wsClient;
  if (!config.wsRpcUrl) {
    log.warn("WS_RPC_URL not set, event listener will not start");
    return null;
  }

  wsClient = createPublicClient({
    chain: customChain,
    transport: webSocket(config.wsRpcUrl, {
      keepAlive: { interval: 10_000 },
      reconnect: { maxAttempts: Infinity, delay: 2_000 },
    }),
  });

  // CRITICAL: verify WebSocket transport (prevents silent HTTP fallback)
  if (wsClient.transport.type !== "webSocket") {
    log.error(
      { transportType: wsClient.transport.type, wsRpcUrl: config.wsRpcUrl },
      "WebSocket client has wrong transport type"
    );
    wsClient = null;
    return null;
  }

  log.info({ wsRpcUrl: config.wsRpcUrl }, "WebSocket client created");
  return wsClient;
}
```

### EventEmitter ABI for watchContractEvent
```typescript
// Source: sdk/src/abis/EventEmitter.json + keeper-service/src/abi/event-emitter.ts
// Minimal ABI for watching EventLog1 and EventLog2 events
import { parseAbi } from "viem";

export const eventEmitterAbi = parseAbi([
  "event EventLog1(address indexed msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, bytes eventData)",
  "event EventLog2(address indexed msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, bytes32 indexed topic2, bytes eventData)",
]);
```

### Main Loop Transformation
```typescript
// BEFORE (current index.ts): setInterval + isExecuting mutex
scanInterval = setInterval(() => {
  executePendingRequests().catch(/* ... */);
}, config.scanIntervalSeconds * 1000);

// AFTER: Queue drain loop + event listener + reduced polling
const queue = new ExecutionQueue();

// Start event listener (fast path)
const eventListener = new EventListener(queue);
await eventListener.start();

// Start reduced polling (safety net)
setInterval(async () => {
  const keys = await scanAllTypes();
  for (const item of keys) {
    queue.enqueue(item); // dedup handles overlap with events
  }
}, 30_000);

// Queue drain loop (single consumer)
async function drainQueue() {
  while (true) {
    const item = queue.dequeue();
    if (!item) {
      await new Promise(r => setTimeout(r, 100)); // idle wait
      continue;
    }
    try {
      await executeItem(item);
      queue.complete(item.key);
      recordExecution(item.type);
    } catch (error) {
      queue.complete(item.key); // remove from processing, allow re-enqueue
      log.error({ err: error, key: item.key }, "execution failed");
    }
  }
}
```

### Prisma Schema Addition for Block Persistence
```prisma
// Addition to schema.prisma
model KeeperState {
  id                  String   @id @default("singleton")
  lastProcessedBlock  BigInt   @default(0)
  updatedAt           DateTime @default(now()) @updatedAt @db.Timestamptz

  @@map("keeper_state")
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setInterval` polling every 10s | `watchContractEvent` with WebSocket + 30s polling fallback | This phase | Detection latency 5s avg -> <2s |
| `isExecuting` boolean mutex | `ExecutionQueue` with dedup Set and single consumer | This phase | Prevents nonce collisions under concurrent load |
| No restart recovery | `lastProcessedBlock` persistence + `getLogs` backfill | This phase | Zero missed events after restart |
| Health = `lastExecutionTime` freshness | Heartbeat timer + event stream liveness | This phase (health aspects) | No false alerts during idle |

**Deprecated/outdated:**
- The existing `confirmator.ts` in `keeper-service` uses `watchContractEvent` with an HTTP transport (`publicClient` created with `http()` in `contract.ts`). This means it's silently using HTTP polling, not real WebSocket subscriptions. The new implementation must avoid this pattern.

## Open Questions

1. **EventLog1 vs EventLog2 for all three operation types**
   - What we know: The frontend `subscribeToEvents.ts` uses `EventLog2` for `DepositCreated`, `WithdrawalCreated`, and `OrderCreated` (lines 467-506). The `confirmator.ts` in keeper-service watches `EventLog2` for `OrderExecuted`.
   - What's unclear: Whether some creation events might use `EventLog1` in edge cases. The `test-deposit.mjs` uses a simplified topic hash `keccak256("DepositCreated(bytes32,address)")` which matches `EventLog1` pattern (only topic1), not `EventLog2` (topic1 + topic2).
   - Recommendation: Watch BOTH `EventLog1` and `EventLog2` for all three event names. The decoded `eventName` string field (non-indexed) tells you which event it is. Extract request key from `topic1` for both variants. Test with a real deposit to confirm which variant is emitted.

2. **Alchemy Base Sepolia WSS endpoint availability and free tier limits**
   - What we know: Alchemy provides WSS endpoints for Base Sepolia. The project research SUMMARY.md recommends `wss://base-sepolia.g.alchemy.com/v2/<key>`.
   - What's unclear: Whether the free tier WebSocket rate limits are sufficient for continuous subscriptions. Whether the project already has an Alchemy API key configured.
   - Recommendation: Use the `WS_RPC_URL` env var pattern so any WSS provider works. Test with Alchemy free tier first. Fallback: Base Sepolia public RPC at `wss://base-sepolia.publicnode.com` (check if WSS is supported).

3. **`allKnown` Set memory growth over long-running sessions**
   - What we know: The dedup Set grows monotonically as keys are added but never removed (to prevent re-enqueue of completed items).
   - What's unclear: How many unique request keys accumulate over weeks of operation.
   - Recommendation: Add a periodic cleanup that removes keys older than `REQUEST_EXPIRATION_TIME` (currently 3600s). Use a `Map<Hex, number>` instead of `Set<Hex>` to track enqueue timestamps. Clean up every 30 minutes.

## Sources

### Primary (HIGH confidence)
- [viem watchContractEvent](https://viem.sh/docs/contract/watchContractEvent) - WebSocket vs polling behavior confirmed via Context7 query
- [viem WebSocket Transport](https://viem.sh/docs/clients/transports/websocket) - reconnect, keepAlive configuration confirmed via Context7 query
- [viem getLogs](https://viem.sh/docs/actions/public/getLogs) - fromBlock/toBlock backfill pattern confirmed via Context7 query
- Codebase: `order-execution-keeper-service/src/index.ts` - current polling architecture (setInterval + isExecuting mutex)
- Codebase: `order-execution-keeper-service/src/core/blockchain/client.ts` - HTTP-only PublicClient
- Codebase: `order-execution-keeper-service/src/config.ts` - current config structure (no WS_RPC_URL)
- Codebase: `order-execution-keeper-service/src/core/executors/baseExecutor.ts` - nonce handling with pending tag + retry
- Codebase: `keeper-service/src/core/confirmator.ts` - reference watchContractEvent implementation (HTTP-only, needs upgrade)
- Codebase: `sdk/src/abis/EventEmitter.json` - full EventEmitter ABI (EventLog, EventLog1, EventLog2)
- Codebase: `src/context/WebsocketContext/subscribeToEvents.ts` - frontend event subscription patterns confirming EventLog2 for DepositCreated/WithdrawalCreated/OrderCreated
- Codebase: `scripts/test-deposit.mjs` - DepositCreated topic hash and structure confirmed

### Secondary (MEDIUM confidence)
- [viem Issue #776](https://github.com/wevm/viem/issues/776) - fallback transport does not use eth_subscribe (referenced in project SUMMARY.md)
- [Base Sepolia network info](https://docs.base.org/base-chain/network-information/transaction-finality) - 2s block time (referenced in project SUMMARY.md)
- Project research: `.planning/research/SUMMARY.md` - architecture approach, pitfalls, confirmed findings

### Tertiary (LOW confidence)
- Alchemy Base Sepolia WSS endpoint availability at free tier - needs direct verification with provider

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all viem features verified via Context7; no new packages needed; versions confirmed from package.json
- Architecture: HIGH - existing codebase patterns (confirmator.ts, subscribeToEvents.ts) provide reference implementations; component boundaries clear from file structure
- Pitfalls: HIGH - six pitfalls identified with specific codebase line references; WebSocket fallback bug confirmed via viem Issue #776 and cross-referenced against confirmator.ts HTTP client usage

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain - viem APIs unlikely to change within 30 days)
