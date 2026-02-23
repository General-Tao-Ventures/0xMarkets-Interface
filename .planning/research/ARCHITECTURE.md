# Architecture Patterns: Keeper Execution Speed Optimization

**Domain:** Blockchain keeper execution pipeline (GMX-style two-phase request/execute)
**Researched:** 2026-02-23
**Confidence:** HIGH (based on codebase analysis + viem docs + Base chain specs)

## Current Architecture Analysis

### Execution Timeline Breakdown (Current ~13s)

The existing flow for a deposit execution in `order-execution-keeper-service`:

```
[User creates deposit on-chain]
    |
    v (0-10s wait: polling interval)
[Scanner polls DataStore.getAllBytes32Values()]  ~500ms
    |
    v
[Scanner reads deposit details from Reader]     ~300ms
    |
    v
[Store new deposit in Prisma DB]                ~50ms
    |
    v
[Executor reads deposit from DB]                ~50ms
    |
    v
[Executor reads deposit from Reader (again)]    ~300ms
    |
    v
[Executor reads market from Reader]             ~300ms
    |
    v
[Build oracle params + updatePriceOnChain TX]   ~2-4s (send TX + wait for receipt)
    |
    v
[estimateGas for executeDeposit]                ~300ms
    |
    v
[submitTransaction (writeContract)]             ~500ms
    |
    v
[waitForTransactionReceipt]                     ~2-4s (1-2 blocks on Base)
    |
    v
[Update DB status]                              ~50ms
```

**Where time is spent:**
1. **Polling delay: 0-10s average 5s** -- The single largest latency source. `setInterval(executePendingRequests, scanIntervalSeconds * 1000)` with default 10s.
2. **Oracle price TX: 2-4s** -- `updatePriceOnChain()` sends a separate transaction and awaits `waitForTransactionReceipt`. This is a full transaction lifecycle (send + 1-2 blocks).
3. **Execution TX: 2-4s** -- The actual `executeDeposit` transaction + receipt wait.
4. **Redundant reads: ~1s** -- Scanner reads deposit details, then executor reads them again. Market data is fetched fresh each time.

### Key Bottlenecks Identified

| Bottleneck | Current Impact | Root Cause |
|-----------|---------------|------------|
| Polling interval | 0-10s latency | `setInterval` at 10s, detection is chance-based |
| Oracle TX as separate transaction | 2-4s per operation | `updatePriceOnChain()` is a full TX with receipt wait |
| Sequential operation execution | N * (2-4s) for N operations | Single nonce, `for...of` loop with `await` |
| Redundant on-chain reads | ~1s waste | Scanner reads details, executor reads them again |
| Nonce contention | 4s retry backoff | Sequential nonce management with pending-tag fetch |

---

## Recommended Architecture: Hybrid Event + Polling

**Do NOT replace polling entirely. Add event-driven detection as the fast path, keep polling as the safety net.**

### Why Hybrid (Not Pure Event-Driven)

1. **WebSocket connections drop.** The existing Pyth Lazer WebSocket already demonstrates this -- the code has `allConnectionsDownListener` and stale cache handling. If event detection is the only path, a dropped WebSocket means missed operations.
2. **Polling catches edge cases.** On restart, during reorgs, or if the RPC WebSocket misses events, polling recovers automatically by reading DataStore state.
3. **The existing polling architecture works.** It is battle-tested through v1.0-v1.2. The issue is latency, not correctness.
4. **Base Sepolia block time is 2 seconds.** With events, detection happens at block inclusion time. Polling at 2s intervals achieves similar detection speed without WebSocket fragility.

### Target Architecture

```
                    EVENT PATH (fast, <2s detection)
                    ================================
[User TX mined] --> [EventEmitter emits DepositCreated/OrderCreated/WithdrawalCreated]
                         |
                         v
                    [EventListener (viem watchContractEvent)]
                         |
                         v
                    [Immediate execution trigger]
                         |
                         v
                    [ExecutionQueue.enqueue(key, type)]
                         |
                    ======|==============================
                         |
                    POLL PATH (safety net, 5s interval)
                    ================================
                    [Reduced-interval polling (5s)]
                         |
                         v
                    [Scanner finds keys not yet in queue]
                         |
                         v
                    [ExecutionQueue.enqueue(key, type)]
                         |
                    ======|==============================
                         |
                         v
                    SHARED EXECUTION PIPELINE
                    ================================
                    [ExecutionQueue processes sequentially]
                         |
                         v
                    [Build oracle params (cached prices)]
                         |
                         v
                    [Submit execution TX]
                         |
                         v
                    [Await receipt / update DB]
```

---

## Component Architecture

### New Components

#### 1. EventListener (NEW)

Watches the EventEmitter contract for creation events. The existing `confirmator.ts` in keeper-service already uses `publicClient.watchContractEvent()` -- this is the same pattern applied to the order-execution-keeper-service.

```typescript
// core/listeners/eventListener.ts
class EventListener {
  private unwatch: (() => void) | null = null;
  private wsPublicClient: PublicClient; // WebSocket transport client

  // Watches EventEmitter for DepositCreated, WithdrawalCreated, OrderCreated
  // On event: extract key from topic1, enqueue for execution
  startListening(queue: ExecutionQueue): void;
  stopListening(): void;
}
```

**Integration point:** Requires a *second* PublicClient with WebSocket transport. The existing HTTP PublicClient in `client.ts` does not support true push subscriptions. viem's `watchContractEvent` falls back to polling over HTTP, but uses `eth_subscribe` over WebSocket -- which gives block-level event notification without polling overhead.

**Critical:** The EventEmitter contract already emits events with the request key as `topic1` (confirmed in `test-deposit.mjs` line 72: `DepositCreated(bytes32,address)`). The event signature `0x5a4516d9c26b37da5f23b1f47fb3c99cfaf22879a78a40bc2a4bd1a23cdf9dab` maps to `DepositCreated(bytes32,address)` where topic1 is the deposit key. Similar events exist for `OrderCreated` and `WithdrawalCreated`.

**Transport decision:** Use WebSocket transport if available from the RPC provider. If not, use HTTP polling at 2s intervals (matching Base block time). viem handles this via the `poll` parameter:
- `poll: false` (default with WebSocket transport): Uses `eth_subscribe` for push notifications
- `poll: true` (default with HTTP transport): Falls back to `eth_getFilterChanges` at `pollingInterval`

#### 2. ExecutionQueue (NEW)

Deduplicated, type-aware queue that prevents double-execution of the same key. The current `isExecuting` boolean guard in `index.ts` is a coarse lock. The queue replaces it with fine-grained key-level deduplication.

```typescript
// core/queue/executionQueue.ts
class ExecutionQueue {
  private pending: Map<Hex, { type: 'deposit' | 'withdrawal' | 'order'; enqueuedAt: number }>;
  private processing: Set<Hex>; // Currently being executed

  enqueue(key: Hex, type: OperationType): boolean; // Returns false if already queued
  dequeue(): { key: Hex; type: OperationType } | null;
  markComplete(key: Hex): void;
  markFailed(key: Hex): void;
  size(): number;
}
```

**Integration point:** Both EventListener and Scanner feed into this queue. The main loop drains it sequentially (respecting single-nonce constraint for now).

#### 3. WebSocket PublicClient (NEW)

A second viem PublicClient with WebSocket transport, used exclusively by EventListener. Separate from the existing HTTP PublicClient to avoid disrupting transaction submission paths.

```typescript
// core/blockchain/wsClient.ts
// Only created if WS_RPC_URL env var is set
// Falls back to HTTP polling if WebSocket unavailable
function getWsPublicClient(): PublicClient | null;
```

**Config addition:**
```
WS_RPC_URL=wss://base-sepolia.g.alchemy.com/v2/...  # Optional
```

### Modified Components

#### 4. Scanner (MODIFIED -- reduced role)

The scanners (`depositScanner.ts`, `withdrawalScanner.ts`, `orderScanner.ts`) continue to exist but shift from "primary detection" to "safety net." Changes:

- Reduce polling interval from 10s to 5s (still below the event path, but catches anything events miss)
- Remove redundant detail reads -- scanner only returns keys, executor reads details
- Simplify scan result: just return keys, skip DB storage during scan (let executor handle it)

**Integration point:** Scanner feeds into ExecutionQueue instead of directly driving execution. The `executePendingRequests()` function becomes the queue drain loop.

#### 5. BaseExecutor (MODIFIED -- optimized pipeline)

The biggest execution speed gain comes from optimizing what happens *after* detection. Current pain points in `baseExecutor.ts`:

**A. Eliminate separate oracle price TX** (saves 2-4s per operation)

The current flow sends `updatePriceOnChain()` as a separate transaction, awaits its receipt, then sends `executeDeposit`. This is two full transaction lifecycles.

**Optimization:** The Pyth Lazer price data is already cached in `updateCache` from the WebSocket stream (200ms fixed-rate updates). Instead of sending a separate `updatePrice` TX, pass the cached price data directly in the oracle params. The on-chain oracle contract should accept the raw Pyth Lazer update as `data` in the `SetPricesParams.data` field, letting the execution handler verify and consume the price in the same transaction.

**If same-TX price verification is not possible** (contract architecture may require separate `updatePrice`): At minimum, skip `waitForTransactionReceipt` on the price update. Send the price TX, immediately send the execution TX with the next nonce, then await both receipts in parallel. This requires nonce management changes (see below).

**B. Cache market data** -- The market's index token, long token, and short token don't change. Cache market info after first read per market address. Currently `reader.getMarket()` is called on every single execution.

```typescript
// core/cache/marketCache.ts
class MarketCache {
  private markets: Map<Address, MarketInfo> = new Map();

  async getMarket(reader: ReaderContract, address: Address): Promise<MarketInfo>;
  invalidate(address?: Address): void;
}
```

#### 6. Nonce Management (MODIFIED -- prepare for concurrency)

Current state in `baseExecutor.ts` line 93-95:
```typescript
const nonce = await publicClient.getTransactionCount({
  address: account.address,
  blockTag: "pending",
});
```

This fetches the pending nonce fresh for each transaction. With sequential execution, it works. For future concurrency, use viem's `createNonceManager`:

```typescript
import { createNonceManager, jsonRpc } from 'viem/nonce';

const nonceManager = createNonceManager({ source: jsonRpc() });
const account = privateKeyToAccount(config.privateKey, { nonceManager });
```

**Phase 1 (current milestone):** Keep sequential execution but prepare the nonce manager. The main win is eliminating the oracle price as a separate TX, not parallelizing execution TXs.

**Phase 2 (future):** With nonce manager, can fire-and-forget the price update TX (nonce N) and immediately submit execution TX (nonce N+1) without waiting for price TX receipt. Both TXs are in the mempool and will be mined in order.

**WARNING:** The LIFE-04 comment in `index.ts` explicitly states "Do NOT use Promise.all() here." This was correct for the old architecture. With proper nonce management, concurrent TX submission *with sequential nonces* is safe. But for v1.3, keep sequential execution and focus on eliminating wasted time within each execution.

#### 7. index.ts Main Loop (MODIFIED)

Replace the `setInterval` + `isExecuting` guard with a proper drain loop:

```typescript
// Current (polling-driven):
setInterval(() => {
  executePendingRequests().catch(...);
}, config.scanIntervalSeconds * 1000);

// Proposed (queue-driven):
async function drainQueue() {
  while (true) {
    const item = queue.dequeue();
    if (!item) {
      await sleep(100); // Brief pause when queue is empty
      continue;
    }
    try {
      await executeItem(item);
    } catch (error) {
      logger.error({ err: error, key: item.key }, "execution failed");
    }
  }
}

// Event listener feeds queue immediately
// Polling scanner feeds queue on 5s interval
// drainQueue processes items as fast as they arrive
```

---

## Data Flow Changes

### Current Data Flow

```
                    [DataStore on-chain]
                           |
          scan interval    | getAllBytes32Values() (every 10s)
                           v
                    [Scanner reads details]
                           |
                           v
                    [Prisma DB: store as PENDING]
                           |
                           v
                    [Executor reads from DB]
                           |
                           v
                    [Executor reads from chain AGAIN]
                           |
                           v
                    [Oracle price TX (separate)]
                           |
                           v
                    [Execution TX]
```

### Proposed Data Flow

```
     [EventEmitter on-chain]          [DataStore on-chain]
              |                               |
     event    | watchContractEvent    poll     | getAllBytes32Values() (5s)
     (<2s)    v                      (5s)     v
         [EventListener]              [Scanner (safety net)]
              |                               |
              +-------> [ExecutionQueue] <-----+
                              |
                              v
                    [Executor reads from chain ONCE]
                              |
                              v
                    [Use cached Pyth Lazer price data]
                              |
                              v
                    [Single execution TX]
                              |
                              v
                    [Prisma DB: record result]
```

### Key Data Flow Changes

| Aspect | Before | After |
|--------|--------|-------|
| Detection | Poll DataStore every 10s | Event push + poll at 5s |
| Detail reads | Scanner reads, then executor reads again | Executor reads once |
| Oracle price | Separate TX + wait receipt | Use cached WebSocket data in params |
| DB write timing | Scanner writes PENDING, executor reads it | Executor writes after completion |
| Deduplication | Prisma DB `existingKeys` check | In-memory ExecutionQueue set |
| Queue management | `isExecuting` boolean lock | Proper queue with key-level tracking |

---

## Architecture Patterns to Follow

### Pattern 1: Event-First, Poll-Fallback

**What:** Use blockchain events as the primary detection mechanism, with periodic polling as a safety net that catches anything events miss.

**When:** Any system that needs to react to on-chain state changes with low latency while maintaining reliability.

**Why:** Events give sub-block-time notification. Polling gives guaranteed eventual consistency. The combination provides both speed and reliability.

```typescript
// Event path: immediate trigger
eventListener.on('DepositCreated', (key) => {
  queue.enqueue(key, 'deposit');
});

// Poll path: catches missed events
setInterval(async () => {
  const keys = await scanner.scan();
  for (const key of keys) {
    queue.enqueue(key, 'deposit'); // enqueue deduplicates
  }
}, 5000);
```

### Pattern 2: Elimination of Intermediate State

**What:** Don't persist PENDING state before execution. The on-chain DataStore is already the source of truth for pending operations.

**When:** The keeper's DB is tracking state that already exists on-chain, creating redundant reads.

**Why:** The scanner currently writes to Prisma, then the executor reads from Prisma, then reads from chain anyway to verify. Skip the Prisma intermediate step. Record to DB only after execution (EXECUTED, FAILED, CANCELLED).

### Pattern 3: Cached Immutable Data

**What:** Cache data that does not change between requests (market configuration, token addresses).

**When:** The same on-chain reads are performed repeatedly for data that changes only on contract redeployment.

**Why:** `reader.getMarket()` is called for every single execution. Market tokens do not change. Cache the result.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Full Replace of Polling

**What:** Removing the polling scanner entirely and relying only on event detection.

**Why bad:** WebSocket connections are unreliable. RPC providers drop connections, especially on testnets. If events are the only detection path, a dropped connection means operations are silently missed until someone notices.

**Instead:** Keep polling as a safety net at reduced interval (5s instead of 10s).

### Anti-Pattern 2: Parallel TX Submission Without Nonce Manager

**What:** Using `Promise.all()` to fire multiple execution transactions simultaneously without coordinated nonce assignment.

**Why bad:** Each `writeContract` call currently fetches `getTransactionCount({ blockTag: "pending" })`. Two concurrent calls may get the same nonce, causing one to fail with "nonce too low" or "replacement transaction underpriced."

**Instead:** Keep sequential execution for v1.3. If parallelism is needed later, use viem's `createNonceManager` which tracks in-memory nonce state.

### Anti-Pattern 3: Waiting for Oracle Price TX Receipt Before Execution

**What:** The current `updatePriceOnChain()` sends a TX and calls `waitForTransactionReceipt()` before proceeding to the execution TX.

**Why bad:** This serializes two independent transactions, adding 2-4s (one full block time + confirmation). The execution TX does not need the price TX to be *confirmed* -- it needs the price to be *available on-chain in the same block or earlier*.

**Instead:** If the oracle architecture requires a separate TX, send price TX (nonce N) and execution TX (nonce N+1) back-to-back without waiting for the price TX receipt. The sequencer processes them in nonce order. Both land in the same or adjacent blocks.

---

## Integration Points Summary

### New Components

| Component | File | Depends On | Depended On By |
|-----------|------|------------|----------------|
| EventListener | `core/listeners/eventListener.ts` | wsClient, ExecutionQueue, config | index.ts (startup) |
| ExecutionQueue | `core/queue/executionQueue.ts` | None (pure data structure) | EventListener, Scanner, index.ts |
| MarketCache | `core/cache/marketCache.ts` | ReaderContract | BaseExecutor, all executors |
| WS PublicClient | `core/blockchain/wsClient.ts` | config (WS_RPC_URL) | EventListener |

### Modified Components

| Component | File | Change Description |
|-----------|------|--------------------|
| config.ts | `config.ts` | Add `wsRpcUrl`, reduce `scanIntervalSeconds` default to 5 |
| BaseExecutor | `core/executors/baseExecutor.ts` | Use MarketCache, skip separate oracle TX wait |
| DepositExecutor | `core/executors/depositExecutor.ts` | Remove redundant Reader calls |
| WithdrawalExecutor | `core/executors/withdrawalExecutor.ts` | Remove redundant Reader calls |
| OrderExecutor | `core/executors/orderExecutor.ts` | Remove redundant Reader calls |
| index.ts | `index.ts` | Add EventListener startup, queue drain loop |
| healthState.ts | `utils/healthState.ts` | Track event listener status |
| client.ts | `core/blockchain/client.ts` | (Optional) prepare nonceManager |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| Prisma/store.ts | Still records execution results -- timing shifts but API stays same |
| pythLazerOracle.ts | WebSocket price feed stays the same, cache already works |
| transactionMonitor.ts | Continues background receipt checking -- still useful |
| Scanner classes | Keep existing logic, just feed into queue instead of direct execution |

---

## Suggested Build Order

Build order respects dependency chains. Each step is independently testable.

### Step 1: ExecutionQueue (no dependencies)
Pure in-memory data structure. No integration needed. Write + test in isolation.

### Step 2: MarketCache (depends on ReaderContract -- already exists)
Simple cache layer. Can be integrated into BaseExecutor immediately. Saves ~300ms per execution.

### Step 3: Reduce Polling Interval (config change only)
Change `scanIntervalSeconds` default from 10 to 5. Immediate 50% detection improvement with zero risk.

### Step 4: Eliminate Redundant Reads in Executor Pipeline
Stop scanner from reading full deposit details (it only needs keys). Stop executor from reading DB before reading chain. Direct chain read in executor.

### Step 5: Optimize Oracle Price Flow
The highest-impact change. Either:
- (A) Skip `waitForTransactionReceipt` on `updatePriceOnChain` and pipeline with execution TX, OR
- (B) Pass cached Pyth Lazer binary data directly in oracle params if contract supports it

### Step 6: EventListener + WS Client (depends on ExecutionQueue from Step 1)
Add WebSocket event detection. This makes detection near-instant instead of waiting for poll cycle.

### Step 7: Wire Queue into Main Loop
Replace `setInterval` + `isExecuting` pattern with queue drain loop. Both EventListener and Scanner feed into the queue.

---

## Latency Budget for Sub-10s Target

With Base Sepolia's 2s block time, the theoretical minimum for detect-to-confirmed is:

| Phase | Current | Optimized | How |
|-------|---------|-----------|-----|
| Detection | 0-10s (avg 5s) | 0-2s (avg 1s) | Event listener triggers at block time |
| Read details | ~600ms | ~300ms | Single read, no redundancy |
| Oracle price | 2-4s | 0-200ms | Use cached WebSocket price data |
| Gas estimation | ~300ms | ~300ms | No change (already fast) |
| TX submission | ~500ms | ~500ms | No change |
| TX confirmation | 2-4s | 2-4s | Block time is immutable |
| DB update | ~50ms | ~50ms | No change |
| **Total** | **~5-19s (avg ~13s)** | **~3-7s (avg ~5s)** | |

The sub-10s target is achievable. The sub-5s average case is realistic with event-driven detection + oracle optimization.

---

## Scalability Considerations

| Concern | Current (testnet) | At 100 users | At 1K+ users |
|---------|-------------------|--------------|-------------|
| Operations/minute | <5 | 10-50 | 50-500 |
| Single nonce bottleneck | Not an issue | Acceptable | Needs multi-wallet |
| WebSocket connections | 1 (Pyth) + 1 (EventEmitter) | Same | Same |
| DB writes | Light | Moderate | Index optimization needed |
| RPC rate limits | Not hit | Monitor | Dedicated node needed |

For v1.3 (testnet), the single-wallet sequential architecture is sufficient. The execution queue + event listener architecture is forward-compatible with multi-wallet execution if needed later.

---

## keeper-service Impact

The keeper-service (port 37017) handles liquidation scanning, not operation execution. Its architecture is different:

- Already uses `watchContractEvent` via the `confirmator.ts` for event confirmation
- Scans positions for liquidatability (different from scanning DataStore for pending requests)
- 30s scan interval is appropriate for liquidation detection (less time-sensitive)

**Recommendation:** Do NOT apply the same event-driven pattern to keeper-service for v1.3. Liquidation scanning is fundamentally different -- it requires continuous position evaluation, not reaction to specific creation events. The v1.3 focus should be exclusively on order-execution-keeper-service.

---

## Sources

- Codebase analysis: `order-execution-keeper-service/src/` (all scanner, executor, oracle, config files)
- Codebase analysis: `keeper-service/src/core/confirmator.ts` (existing event watcher pattern)
- [viem watchContractEvent docs](https://viem.sh/docs/contract/watchContractEvent) -- WebSocket vs polling behavior
- [viem createNonceManager docs](https://viem.sh/docs/accounts/local/createNonceManager) -- concurrent nonce management
- [viem nonce management discussion](https://github.com/wevm/viem/discussions/1338) -- parallel transaction patterns
- [Base chain specs](https://chainspect.app/chain/base) -- 2s block time
- [GMX Synthetics architecture](https://github.com/gmx-io/gmx-synthetics) -- keeper execution patterns
- [Chainlink GMX automation](https://github.com/Cyfrin/chainlink-gmx-automation) -- high-frequency price automation
