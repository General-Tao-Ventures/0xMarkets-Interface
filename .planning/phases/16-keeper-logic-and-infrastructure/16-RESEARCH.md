# Phase 16: Keeper Logic and Infrastructure - Research

**Researched:** 2026-02-26
**Domain:** Blockchain keeper service — event detection, sequential execution, health monitoring
**Confidence:** HIGH

## Summary

Phase 16 builds the core keeper loop on top of Phase 15's skeleton (config, keys, ABIs, oracle). The work lives entirely in `/Users/ken/Projects/0xM/order-execution-keeper-service/src/` and adds: (1) WebSocket event watching for DepositCreated/WithdrawalCreated/OrderCreated, (2) DataStore polling as safety net, (3) a dedup-aware FIFO queue, (4) sequential executor with retry/skip logic, (5) Express health endpoint, and (6) graceful SIGTERM shutdown.

All libraries are already installed (viem, express, pino, pyth-lazer-sdk). No new dependencies needed. The existing `src/index.ts` has placeholder comments for Phase 16 additions. The existing `src/oracle.ts` provides synchronous `buildOracleParams()` and `isOracleStale()`. The existing `src/abis.ts` has all needed ABIs including Reader (getDeposit, getWithdrawal, getOrder, getMarket), DataStore (getBytes32Count, getBytes32ValuesAt), and handler ABIs (executeDeposit, executeWithdrawal, executeOrder). The existing `src/keys.ts` has DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST keys.

**Primary recommendation:** Use viem's `watchContractEvent` with the full eventEmitterAbi to get properly decoded event args (avoid manual data decoding). Use manual `getTransactionCount` for nonce management (NOT viem's `nonceManager`). Structure as 3-4 new files: `watcher.ts`, `poller.ts`, `executor.ts`, plus updates to `index.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Error Handling Strategy:** Permanent reverts (EmptyDeposit, expired, InvalidOracleProvider) log at WARN and skip permanently -- add bytes32 key to an ignored Set, never retry. Transient errors (network timeout, RPC failure) retry up to 3 times with exponential backoff (1s, 2s, 4s), then log ERROR and move to next operation. Permanently-skipped operations tracked forever in memory (simple Set). Categorize errors in logs: permanent errors at WARN, transient errors at ERROR, unexpected errors at ERROR with full stack trace. User funds are NOT lost on transient failure -- operations stay pending in DataStore, poller picks them up on next 15s cycle.
- **Execution Queue Behavior:** FIFO ordering -- process in order received, no priority by type. Plain Array as queue (push/shift) + Set of bytes32 keys for dedup. ~5 lines of code. No queue size limit. Event-driven wake -- executor sleeps when queue is empty, woken by event watcher or poller adding to queue.
- **Health Endpoint:** Core diagnostics at GET /health: status (ok/degraded), uptime, queue length, keeper address, oracle stale flag, cached token count. No authentication -- public endpoint, BetterStack needs unauthenticated access. Status is "degraded" when isOracleStale() returns true, "ok" otherwise. Express server (already in package.json, one route, 5 lines).
- **Event Watcher + Poller Overlap:** Startup sequence: DataStore full scan FIRST (catches pre-existing pending ops from before restart), THEN start event watcher for new ops. Dedup via Set of bytes32 operation keys -- before enqueuing, check Set. If key exists, skip. O(1) lookup. In-flight operations covered by dedup Set -- key stays in Set from first detection through execution, poller sees it and skips. After successful execution, key stays in dedup Set forever (prevents any double-execution). Clears on restart, rebuilt from DataStore scan.

### Specific Ideas (from User)
- Nonce management: use manual getTransactionCount, NOT viem's createNonceManager (documented production bug -- viem issue #3142)
- DataStore key encoding: already correctly implemented in keys.ts from Phase 15 using encodeAbiParameters
- Sequential execution means single wallet = single nonce = no contention (this was the root cause of v1.4 issues)
- Port the submitTransaction pattern from existing baseExecutor.ts for nonce-aware TX submission

### Claude's Discretion
- Exact implementation of exponential backoff (setTimeout vs loop)
- How to extract operation type (deposit/withdrawal/order) from event data
- Exact Express server setup and middleware
- SIGTERM handler implementation details
- How to structure the sequential executor (async loop vs recursive)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DET-01 | Keeper detects DepositCreated, WithdrawalCreated, and OrderCreated events via WebSocket in under 1 second | Use viem `watchContractEvent` with WebSocket transport on EventEmitter contract; decode `eventName` from non-indexed data to determine operation type; extract operation key from indexed `topic1` parameter |
| DET-02 | Keeper polls DataStore for pending deposits, withdrawals, and orders every 15 seconds as safety net | Read DataStore `getBytes32Count` + `getBytes32ValuesAt` for each of DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST keys; already have ABIs and key hashes from Phase 15 |
| DET-03 | Duplicate keys are deduplicated -- same operation is never executed twice | In-memory `Set<Hex>` of operation keys; check before enqueue; keys persist after execution (never removed); clears on restart |
| EXEC-01 | Keeper executes deposits by reading on-chain struct, building oracle params, and calling executeDeposit | Read deposit via Reader.getDeposit, extract market + tokens, call `buildOracleParams()` (synchronous from oracle cache), submit via DepositHandler.executeDeposit |
| EXEC-02 | Keeper executes withdrawals by reading on-chain struct, building oracle params, and calling executeWithdrawal | Same pattern as EXEC-01 but with Reader.getWithdrawal and WithdrawalHandler.executeWithdrawal |
| EXEC-03 | Keeper executes orders by reading on-chain struct, building oracle params, and calling executeOrder | Same pattern as EXEC-01 but with Reader.getOrder and OrderHandler.executeOrder |
| EXEC-04 | Execution is sequential -- one transaction at a time, no nonce conflicts | Single async while-loop drains queue one item at a time; manual getTransactionCount with blockTag "pending" for explicit nonce |
| EXEC-05 | Transient errors retry up to 3 times; permanent errors are logged and skipped | Classify errors by message/selector; permanent errors add key to ignored Set at WARN level; transient errors re-enqueue with exponential backoff (1s, 2s, 4s) |
| INFRA-01 | Health endpoint at GET /health returns JSON with status, uptime, queue length, and keeper address | Express 5 server, single route, returns JSON with status derived from `isOracleStale()`, plus uptime/queue/address/cachedTokenCount |
| INFRA-02 | All operations logged as structured JSON via pino | Already using pino (Phase 15); add child loggers per module; structured fields: key, type, txHash, block, ms, attempt |
| INFRA-03 | Graceful shutdown on SIGTERM -- completes in-flight TX, closes WebSocket, stops intervals | SIGTERM handler sets shutdown flag, executor checks flag after each TX, clears poll interval, calls unwatch on WebSocket subscription, then exits |
| INFRA-04 | Simplified Dockerfile with no database, no Prisma, 30s health check start-period | Dockerfile already exists from Phase 15 with correct structure; just verify health endpoint path matches |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.44.4 | Ethereum client -- public/wallet clients, ABI encoding, WebSocket transport, event watching | Already installed; type-safe; first-class WebSocket support with auto-reconnect |
| express | ^5.1.0 | Health endpoint HTTP server | Already installed; Express 5 is current stable |
| pino | ^10.3.1 | Structured JSON logging | Already installed; fastest Node.js logger |
| @pythnetwork/pyth-lazer-sdk | 5.2.0 (pinned) | Oracle price cache (Phase 15 -- consumed, not modified) | Already installed and working |
| dotenv | ^17.2.3 | Environment variable loading | Already installed |

### Supporting
No additional libraries needed. All dependencies were installed in Phase 15.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual nonce via getTransactionCount | viem's createNonceManager | User decision: manual nonce. createNonceManager has documented production bug (viem issue #3142) |
| Array + Set queue | bull/bullmq/bee-queue | Massive overkill for testnet -- adds Redis dependency for ~10 ops/day |
| watchContractEvent | watchEvent + manual decoding | watchContractEvent auto-decodes args; watchEvent requires manual ABI parameter decoding which is error-prone (see Pitfall 1) |

**Installation:**
```bash
# No installation needed -- all dependencies already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  config.ts       # [exists] Environment config
  keys.ts         # [exists] DataStore key hashes
  abis.ts         # [exists] Contract ABIs
  oracle.ts       # [exists] Pyth Lazer WebSocket cache
  watcher.ts      # [NEW] WebSocket event watcher
  poller.ts       # [NEW] DataStore polling safety net
  executor.ts     # [NEW] Sequential execution loop + token extraction + TX submission
  health.ts       # [NEW] Express health endpoint
  index.ts        # [MODIFY] Main entry -- wire everything together
```

### Pattern 1: Event Watcher with watchContractEvent
**What:** Use viem's `watchContractEvent` to subscribe to EventLog1 events on the EventEmitter contract. This provides type-safe decoded event args including the `eventName` string and `topic1` (operation key).
**When to use:** Always for the WebSocket event detection path.
**Example:**
```typescript
// Source: verified against viem docs (Context7 /wevm/viem) + existing abis.ts
import { createPublicClient, webSocket, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { eventEmitterAbi } from "./abis.js";
import { config } from "./config.js";

type OpType = "deposit" | "withdrawal" | "order";

const EVENT_MAP: Record<string, OpType> = {
  DepositCreated: "deposit",
  WithdrawalCreated: "withdrawal",
  OrderCreated: "order",
};

export function startWatcher(
  enqueue: (key: Hex, type: OpType) => void
): () => void {
  const wsClient = createPublicClient({
    chain: baseSepolia,
    transport: webSocket(config.wsRpcUrl, {
      reconnect: { attempts: Infinity, delay: 1_000 },
    }),
  });

  // watchContractEvent decodes args automatically from the ABI
  const unwatch = wsClient.watchContractEvent({
    address: config.eventEmitterAddress,
    abi: eventEmitterAbi,
    eventName: "EventLog1",
    onLogs: (logs) => {
      for (const log of logs) {
        const eventName = log.args.eventName;
        const opType = eventName ? EVENT_MAP[eventName] : undefined;
        if (!opType) continue;
        // topic1 is the operation key (bytes32)
        const key = log.args.topic1 as Hex;
        if (key) enqueue(key, opType);
      }
    },
    onError: (err) => {
      // viem WebSocket transport auto-reconnects; just log
      log.error({ err }, "watcher error");
    },
  });

  return unwatch; // call to stop watching
}
```

### Pattern 2: DataStore Polling
**What:** Read all three DataStore lists (DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST) via `getBytes32Count` + `getBytes32ValuesAt` and enqueue any keys not already in the dedup Set.
**When to use:** Every 15 seconds as safety net, plus once at startup before event watcher.
**Example:**
```typescript
// Source: verified against existing abis.ts + keys.ts
import { DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST } from "./keys.js";
import { dataStoreAbi } from "./abis.js";

async function getListKeys(listKey: Hex): Promise<Hex[]> {
  const count = await publicClient.readContract({
    address: config.dataStoreAddress,
    abi: dataStoreAbi,
    functionName: "getBytes32Count",
    args: [listKey],
  });
  if (count === 0n) return [];
  const keys = await publicClient.readContract({
    address: config.dataStoreAddress,
    abi: dataStoreAbi,
    functionName: "getBytes32ValuesAt",
    args: [listKey, 0n, count],
  });
  return [...keys] as Hex[];
}

async function poll(enqueue: (key: Hex, type: OpType) => void) {
  const [deposits, withdrawals, orders] = await Promise.all([
    getListKeys(DEPOSIT_LIST),
    getListKeys(WITHDRAWAL_LIST),
    getListKeys(ORDER_LIST),
  ]);
  for (const k of deposits) enqueue(k, "deposit");
  for (const k of withdrawals) enqueue(k, "withdrawal");
  for (const k of orders) enqueue(k, "order");
}
```

### Pattern 3: Sequential Executor with Manual Nonce
**What:** An async while-loop that processes one queue item at a time. Uses `getTransactionCount` with blockTag "pending" for explicit nonce management.
**When to use:** The core execution loop -- runs continuously.
**Example:**
```typescript
// Source: adapted from old baseExecutor.ts pattern (dist.bak/core/executors/baseExecutor.js)
async function submitTx(
  handlerAddress: Address,
  abi: any,
  functionName: string,
  args: any[],
): Promise<Hex> {
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  const txHash = await walletClient.writeContract({
    address: handlerAddress,
    abi,
    functionName,
    args,
    gas: 2_500_000n, // generous gas limit for testnet
    nonce,
  });

  return txHash;
}
```

### Pattern 4: Event-Driven Wake with Promise Resolution
**What:** Instead of polling the queue with setTimeout, use a Promise that resolves when new items are enqueued.
**When to use:** To implement the "executor sleeps when queue is empty, woken by enqueue" behavior.
**Example:**
```typescript
let wakeResolver: (() => void) | null = null;

function enqueue(key: Hex, type: OpType): void {
  if (seen.has(key)) return;
  seen.add(key);
  queue.push({ key, type, retries: 0 });
  // Wake the executor if it's sleeping
  if (wakeResolver) {
    wakeResolver();
    wakeResolver = null;
  }
}

async function waitForWork(): Promise<void> {
  if (queue.length > 0) return;
  return new Promise<void>((resolve) => {
    wakeResolver = resolve;
  });
}

// In executor loop:
while (!shuttingDown) {
  await waitForWork();
  if (queue.length === 0) continue;
  const item = queue.shift()!;
  // ... execute
}
```

### Pattern 5: Graceful Shutdown
**What:** On SIGTERM, set a flag, let the current TX complete, then clean up resources.
**When to use:** SIGTERM handler in index.ts.
**Example:**
```typescript
let shuttingDown = false;
let unwatchFn: (() => void) | null = null;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("shutting down -- completing in-flight TX...");

  // Stop accepting new work
  if (unwatchFn) unwatchFn();
  if (pollIntervalId) clearInterval(pollIntervalId);

  // Wake executor so it can see shuttingDown flag
  if (wakeResolver) {
    wakeResolver();
    wakeResolver = null;
  }

  // Executor loop checks `shuttingDown` after each TX and exits
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

### Anti-Patterns to Avoid
- **Using viem's nonceManager:** Documented production bug (viem issue #3142). Use manual `getTransactionCount` with blockTag "pending" instead.
- **Parallel transaction submission:** Even with nonceManager, parallel txs on a single wallet cause replacement transaction underpriced errors. Sequential-only by design.
- **Removing keys from dedup Set after execution:** Keys must stay in the Set forever (per user decision). The poller would re-enqueue them otherwise.
- **Using raw watchEvent instead of watchContractEvent:** Raw `watchEvent` returns undecoded logs. The plan doc's `handleLog` has a bug in data decoding (see Pitfall 1). Use `watchContractEvent` which auto-decodes.
- **Polling in executor loop with setTimeout:** Wastes CPU. Use event-driven wake pattern instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event decoding | Manual `decodeAbiParameters` on raw log data | viem `watchContractEvent` with eventEmitterAbi | Avoids encoding bugs; auto-handles indexed vs non-indexed params |
| WebSocket reconnection | Custom reconnect logic | viem WebSocket transport `reconnect` option | Built-in exponential backoff with configurable attempts/delay |
| Gas fee estimation | Manual gas price oracle | viem's default gas estimation in `writeContract` | Handles EIP-1559 base/priority fee correctly |
| JSON logging | Custom log formatter | pino (already installed) | Structured JSON out of the box, child loggers, fast |

**Key insight:** The old keeper had ~3,000 lines because it hand-rolled scanners, executors, a DB layer, a transaction monitor, and oracle management. All of those are eliminated by: (1) no database, (2) no per-type classes, (3) inline waitForTransactionReceipt, (4) Phase 15 oracle module.

## Common Pitfalls

### Pitfall 1: EventLog1 Data Decoding Bug
**What goes wrong:** The implementation plan (Task 4) decodes EventLog1 data as `(address msgSender, string eventName)` but `msgSender` is an **indexed** parameter -- it lives in `topics[1]`, not in `data`. The actual non-indexed data fields are `(string eventName, bytes eventData)`.
**Why it happens:** Confusion between indexed and non-indexed event parameters in Solidity. Indexed params go to topics, non-indexed go to data.
**How to avoid:** Use `watchContractEvent` with the full eventEmitterAbi. viem handles indexed vs non-indexed decoding automatically. The decoded log will have `log.args.eventName` (string) and `log.args.topic1` (bytes32 = operation key).
**Warning signs:** Events are detected but eventName is always gibberish or decoding throws.

### Pitfall 2: Dedup Set Key Removal After Execution
**What goes wrong:** If the dedup Set removes a key after execution but before the DataStore removes it (there's a delay between execution and on-chain state update), the poller will re-enqueue the same operation.
**Why it happens:** DataStore lists are updated asynchronously by the contract -- the key may still be in the list for a few blocks after execution.
**How to avoid:** User decision: keys stay in dedup Set **forever**. They are never removed. Set clears on restart and is rebuilt from the DataStore full scan.
**Warning signs:** Same operation executed twice; "already executed" contract revert.

### Pitfall 3: Oracle Cache Miss During Execution
**What goes wrong:** `buildOracleParams()` throws "No cached price for token X" if the Pyth Lazer WebSocket hasn't received an update for that token yet, or if the cache TTL (270s) has expired.
**Why it happens:** WebSocket disconnection, Pyth service outage, or initial startup before cache is populated.
**How to avoid:** Phase 15's `startOracle()` already gates on all 7 tokens being cached before returning. For mid-run stale cache, treat as transient error (retry with backoff). The `isOracleStale()` function from Phase 15 can be checked before attempting execution.
**Warning signs:** Health endpoint shows `status: "degraded"` or repeated "No cached price" errors in logs.

### Pitfall 4: Zero-Address Struct Detection
**What goes wrong:** The Reader contract returns a zeroed-out struct (account = 0x0000...0000) for operations that have already been executed or cancelled, but the key may still exist in the DataStore list.
**Why it happens:** DataStore list cleanup is eventual. The struct is zeroed when the handler executes it, but the bytes32 key may remain in the list until a separate cleanup.
**How to avoid:** Before building oracle params, check if `deposit.addresses.account === ZERO_ADDRESS` (or withdrawal/order equivalent). If zeroed, log and skip -- this is not an error. The old depositExecutor.js shows this exact pattern.
**Warning signs:** EmptyDeposit revert (selector 0x95b66fe9) on operations that "should" be valid.

### Pitfall 5: Nonce Stale After Revert
**What goes wrong:** After a reverted transaction, the nonce has been consumed. If using cached nonce, the next TX uses the same nonce and gets "nonce too low".
**Why it happens:** Reverted transactions still consume nonces on Base.
**How to avoid:** Always fetch fresh nonce with `getTransactionCount({ blockTag: "pending" })` before each TX. Never cache the nonce across transactions. Sequential execution means there's always exactly one TX in flight.
**Warning signs:** "nonce too low" errors after a revert.

### Pitfall 6: Express 5 Breaking Changes
**What goes wrong:** Express 5.x has breaking changes from 4.x. The package.json has `"express": "^5.1.0"`.
**Why it happens:** Express 5 changes: `res.send()` no longer accepts numbers as status codes, `app.del()` removed, path route matching is stricter.
**How to avoid:** For a single GET /health route, none of these matter. Just use `app.get("/health", handler)` and `res.json({...})` -- both work identically in Express 4 and 5. Do NOT use `app.listen()` callback with old patterns that might differ.
**Warning signs:** None for this use case -- single route is safe.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Token Extraction for Deposits
```typescript
// Source: dist.bak/core/executors/depositExecutor.js (verified working pattern)
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

async function getDepositTokens(key: Hex): Promise<Address[] | null> {
  const deposit = await publicClient.readContract({
    address: config.readerAddress,
    abi: readerAbi,
    functionName: "getDeposit",
    args: [config.dataStoreAddress, key],
  });

  // Zeroed struct = already executed
  if (deposit.addresses.account === ZERO_ADDRESS) return null;

  const market = deposit.addresses.market;
  const marketData = await publicClient.readContract({
    address: config.readerAddress,
    abi: readerAbi,
    functionName: "getMarket",
    args: [config.dataStoreAddress, market],
  });

  const tokenSet = new Set<Address>();
  // Index token always needed for pricing
  if (marketData.indexToken !== ZERO_ADDRESS) tokenSet.add(marketData.indexToken);
  // Collateral tokens (only if non-zero amount deposited)
  if (deposit.addresses.initialLongToken !== ZERO_ADDRESS &&
      deposit.numbers.initialLongTokenAmount > 0n) {
    tokenSet.add(deposit.addresses.initialLongToken);
  }
  if (deposit.addresses.initialShortToken !== ZERO_ADDRESS &&
      deposit.numbers.initialShortTokenAmount > 0n) {
    tokenSet.add(deposit.addresses.initialShortToken);
  }

  return [...tokenSet];
}
```

### Token Extraction for Withdrawals
```typescript
// Source: adapted from old withdrawalExecutor pattern
async function getWithdrawalTokens(key: Hex): Promise<Address[] | null> {
  const withdrawal = await publicClient.readContract({
    address: config.readerAddress,
    abi: readerAbi,
    functionName: "getWithdrawal",
    args: [config.dataStoreAddress, key],
  });

  if (withdrawal.addresses.account === ZERO_ADDRESS) return null;

  const market = withdrawal.addresses.market;
  const marketData = await publicClient.readContract({
    address: config.readerAddress,
    abi: readerAbi,
    functionName: "getMarket",
    args: [config.dataStoreAddress, market],
  });

  const tokenSet = new Set<Address>();
  if (marketData.indexToken !== ZERO_ADDRESS) tokenSet.add(marketData.indexToken);
  if (marketData.longToken !== ZERO_ADDRESS) tokenSet.add(marketData.longToken);
  if (marketData.shortToken !== ZERO_ADDRESS) tokenSet.add(marketData.shortToken);

  return [...tokenSet];
}
```

### Token Extraction for Orders
```typescript
// Source: adapted from old orderExecutor pattern
async function getOrderTokens(key: Hex): Promise<Address[] | null> {
  const order = await publicClient.readContract({
    address: config.readerAddress,
    abi: readerAbi,
    functionName: "getOrder",
    args: [config.dataStoreAddress, key],
  });

  if (order.addresses.account === ZERO_ADDRESS) return null;

  const market = order.addresses.market;
  const marketData = await publicClient.readContract({
    address: config.readerAddress,
    abi: readerAbi,
    functionName: "getMarket",
    args: [config.dataStoreAddress, market],
  });

  const tokenSet = new Set<Address>();
  if (marketData.indexToken !== ZERO_ADDRESS) tokenSet.add(marketData.indexToken);
  if (order.addresses.initialCollateralToken !== ZERO_ADDRESS) {
    tokenSet.add(order.addresses.initialCollateralToken);
  }

  return [...tokenSet];
}
```

### Permanent Error Classification
```typescript
// Source: dist.bak/core/executors/depositExecutor.js + CONTEXT.md decisions
function isPermanentError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("0x95b66fe9") ||       // EmptyDeposit() selector
    msg.includes("0xd84b8ee8") ||       // OracleTimestampsAreLargerThanRequestExpirationTime
    msg.includes("0x05d102a2") ||       // InvalidOracleProvider
    msg.includes("0x68b49e6c") ||       // InvalidOracleProviderForToken
    msg.includes("execution reverted")  // Generic contract revert
  );
}
```

### Express 5 Health Endpoint
```typescript
// Source: verified against Context7 Express 5.x API docs
import express from "express";

function startHealthServer(port: number, getStatus: () => object) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json(getStatus());
  });

  app.listen(port, () => {
    log.info({ port }, "health server listening");
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Old keeper: 3 Scanner + 3 Executor classes + DB | Single parameterized executor function | v1.5 redesign | ~3,000 lines -> ~250 lines |
| PostgreSQL + Prisma for request tracking | In-memory Set for dedup, on-chain DataStore as truth | v1.5 redesign | No DB dependency, no migrations |
| Pyth Lazer per-token updatePriceOnChain TX | Direct binary data in oracleParams from Lazer cache | v1.5 Phase 15 | No separate price update TX needed |
| viem nonceManager for auto nonce | Manual getTransactionCount per TX | v1.5 decision | Avoids viem issue #3142 |

**Deprecated/outdated:**
- Old baseExecutor's gas bumping retry pattern: Not needed with sequential execution (no concurrent nonce conflicts)
- TransactionMonitor: Replaced by inline waitForTransactionReceipt
- EventListener with block persistence: Replaced by stateless watchContractEvent + DataStore safety-net poll

## Open Questions

1. **EventLog1 ABI `eventNameHash` field type**
   - What we know: The ABI in `src/abis.ts` declares `eventNameHash` with `type: "string", indexed: true`. In Solidity, indexed strings are stored as their keccak256 hash in topics. viem's `watchContractEvent` will return the hash, not the original string, for this field.
   - What's unclear: Whether viem exposes the original string via the non-indexed `eventName` field or requires comparing topic hashes.
   - Recommendation: Use `log.args.eventName` (the non-indexed string in data) to determine event type, NOT `eventNameHash` (which is the keccak256 hash). This is confirmed by the ABI structure.

2. **Order struct `isFrozen` field handling**
   - What we know: The Reader ABI for getOrder includes `isFrozen: bool` in the flags tuple. Frozen orders should not be executed.
   - What's unclear: Whether we need to check this field or if it's handled on-chain.
   - Recommendation: Check `order.flags.isFrozen` before execution. If frozen, skip and log at INFO level. Low risk even if we don't check (contract would revert), but checking avoids wasting gas.

3. **Gas limit sizing for different operation types**
   - What we know: The plan doc uses 2,000,000n. The old keeper used dynamic gas estimation via `estimateContractGas`.
   - What's unclear: Whether a static gas limit is sufficient for all three operation types on testnet.
   - Recommendation: Use a generous static limit (2,500,000n) for testnet. If any TX runs out of gas, the error will be caught and the operation retried. Gas estimation adds an extra RPC call per execution which is unnecessary for testnet.

## Sources

### Primary (HIGH confidence)
- Context7 `/wevm/viem` -- watchContractEvent, WebSocket transport reconnect, writeContract nonce parameter, waitForTransactionReceipt
- Context7 `/pinojs/pino` -- child loggers, structured logging API
- Existing codebase at `/Users/ken/Projects/0xM/order-execution-keeper-service/src/` -- Phase 15 skeleton (config, keys, abis, oracle, index)
- Existing codebase at `/Users/ken/Projects/0xM/order-execution-keeper-service/dist.bak/` -- Old keeper patterns (baseExecutor, depositExecutor, depositScanner)
- Existing codebase at `/Users/ken/Projects/0xM/0xMarkets-squid/src/abi/EventEmitter.ts` -- Full EventEmitter event structure including EventLog1 topic hash (0x137a44...)
- Implementation plan at `/Users/ken/Projects/0xM/order-execution-keeper-service/docs/plans/2026-02-25-minimal-keeper-rewrite.md`

### Secondary (MEDIUM confidence)
- Context7 Express 5.x API docs -- minimal health endpoint pattern
- viem issue #3142 reference (user-reported production bug with createNonceManager) -- user cited, not independently verified

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified working in Phase 15
- Architecture: HIGH -- patterns derived from working old keeper code + verified viem/pino APIs via Context7
- Pitfalls: HIGH -- Pitfall 1 (event decoding bug) discovered by analyzing actual ABI structure against plan doc code; Pitfall 4 (zero-address detection) verified in old depositExecutor.js

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- no fast-moving dependencies)
