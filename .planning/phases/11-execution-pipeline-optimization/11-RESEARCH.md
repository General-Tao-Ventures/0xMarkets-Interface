# Phase 11: Execution Pipeline Optimization - Research

**Researched:** 2026-02-23
**Domain:** Oracle price pipeline optimization and redundant chain-read elimination for DeFi keeper execution
**Confidence:** HIGH

## Summary

Phase 11 targets the two remaining latency bottlenecks in the order-execution-keeper-service after Phase 10's event-driven detection eliminated the polling delay. The first bottleneck is the oracle price update: in Pyth Lazer mode, `buildOracleParams()` calls `pythLazerOracle.updatePriceOnChain(token)` which sends a separate `updatePrice` transaction to the `PythLazerFeedProvider` contract and waits for its receipt before the main execution transaction (deposit/withdrawal/order) is submitted. This sequential two-transaction pattern adds 2-8 seconds per operation. The second bottleneck is redundant on-chain data reads: each executor re-reads the full deposit/withdrawal/order struct and market data from on-chain that the scanner already fetched during detection.

The critical finding from on-chain contract analysis is that `PythLazerFeedProvider.getOraclePrice()` reads from an in-contract `storedPrices` mapping that must be populated by a prior `updatePrice()` call. The `executeDeposit` function's `withOraclePrices` modifier calls `oracle.setPrices()` which calls `IOracleProvider(provider).getOraclePrice(token, data)` -- and for the Pyth Lazer provider, this reads the stored price rather than accepting inline data. **This means the separate `updatePriceOnChain()` transaction IS required for Pyth Lazer mode** -- it cannot be eliminated entirely. However, it can be moved from per-execution (synchronous, blocking) to proactive background caching: the keeper can call `updatePriceOnChain()` whenever the Pyth Lazer WebSocket delivers a fresh price, ensuring the on-chain stored price is always recent. When execution time comes, no additional oracle TX is needed because the stored price is already fresh.

For Hermes mode, the flow is different: `buildSetPricesParams()` fetches fresh data from the Hermes HTTP API and encodes it into the `data[]` array of `SetPricesParams`. The Hermes oracle provider reads inline data, not stored state. This path's latency is the HTTP fetch (~200-500ms), which is acceptable.

The redundant read elimination is straightforward: scanners already fetch deposit/withdrawal/order structs and market data during the scan phase. Currently this data is discarded -- only the key is passed to the executor, which re-reads everything. By extending the `QueueItem` to carry the operation data, executors can skip the redundant reads.

**Primary recommendation:** Implement proactive oracle price updates in a background loop driven by Pyth Lazer WebSocket messages, and extend the queue to pass scanned operation data through to executors. Together these eliminate 2-8 seconds of oracle TX wait and ~300ms of redundant chain reads per operation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-02 | Scanner passes operation data directly to executor without redundant on-chain re-reads | Extend `QueueItem` to include optional operation data (`deposit`, `withdrawal`, `order` structs + market info). Scanners already read this data; pass it through the queue. Executors check for attached data before calling `reader.getDeposit()`/`getWithdrawal()`/`getOrder()` and `reader.getMarket()`. Event-sourced items won't have attached data (only a key) and will fall back to reading chain -- this is acceptable since events arrive in <2s and the read adds only ~300ms. |
| EXEC-03 | Oracle prices are pre-cached from Pyth Lazer WebSocket stream and used directly in execution | Move `updatePriceOnChain()` from per-execution (synchronous blocking in `buildOracleParams()`) to a proactive background updater that fires whenever the Pyth Lazer WebSocket delivers a fresh binary update. The on-chain `PythLazerFeedProvider.storedPrices` mapping stays fresh. At execution time, `buildOracleParams()` checks on-chain stored price timestamp; if fresh (within MAX_ORACLE_PRICE_AGE), skips the update TX entirely. If stale (WebSocket was disconnected), falls back to synchronous update. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.40.3 | Chain reads, TX submission, contract interaction | Already installed; all features needed are stable |
| @pythnetwork/pyth-lazer-sdk | (installed) | WebSocket price feed subscription | Already installed and connected; message listener pattern established |
| prisma | ^7.2.0 | DB access for request records | Already installed; used by scanners and executors |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.3.1 | Structured logging | Already installed; child logger pattern established |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Background proactive updates | ExchangeRouter.multicall (batch updatePrice + execute) | Multicall would combine both TXs into one, but requires a different contract interface and is explicitly out of scope per REQUIREMENTS.md |
| In-memory operation data passthrough | Redis cache for scanned data | Adds infrastructure dependency for single-process workload; out of scope per REQUIREMENTS.md |
| Proactive on-chain price updates | Inline Pyth Lazer price data in oracleParams.data[] | PythLazerFeedProvider.getOraclePrice() ignores the `data` parameter and reads from storedPrices -- inline data is not supported by this oracle provider |

**Installation:**
```bash
# No new packages needed. All capabilities exist in current dependencies.
```

## Architecture Patterns

### Recommended Project Structure
```
order-execution-keeper-service/src/
  core/
    oracle/
      pythLazerOracle.ts      # MODIFIED: add proactive background updater
      pythOracle.ts            # UNCHANGED
      index.ts                 # UNCHANGED
    cache/
      marketCache.ts           # NEW: in-memory cache for immutable market data
    executors/
      baseExecutor.ts          # MODIFIED: skip updatePriceOnChain if stored price is fresh
      depositExecutor.ts       # MODIFIED: accept optional pre-fetched operation data
      withdrawalExecutor.ts    # MODIFIED: accept optional pre-fetched operation data
      orderExecutor.ts         # MODIFIED: accept optional pre-fetched operation data
    queue/
      executionQueue.ts        # MODIFIED: QueueItem gains optional operationData field
    scanners/
      depositScanner.ts        # MODIFIED: attach operation data to scan results
      withdrawalScanner.ts     # MODIFIED: attach operation data to scan results
      orderScanner.ts          # MODIFIED: attach operation data to scan results
      types.ts                 # MODIFIED: add OperationData union type
  index.ts                     # MODIFIED: scanAndEnqueue passes operation data; start background oracle updater
```

### Pattern 1: Proactive Oracle Price Updater
**What:** A background loop that listens to Pyth Lazer WebSocket messages and proactively calls `updatePriceOnChain()` for all registered tokens. Runs independently of the execution pipeline. The on-chain `PythLazerFeedProvider.storedPrices` mapping stays perpetually fresh.
**When to use:** Always when oracle mode is "lazer" or "both". Started after Pyth Lazer WebSocket connects.
**Why this works:** The `PythLazerFeedProvider` contract stores prices in a `storedPrices` mapping. `getOraclePrice()` (called by the Oracle contract during `executeDeposit`) reads from this mapping. If the stored price is recent (within `MAX_ORACLE_PRICE_AGE`), execution succeeds without any additional oracle TX.

```typescript
// Pattern: proactive background oracle updater
class ProactiveOracleUpdater {
  private updating: boolean = false;
  private lastUpdateTimestamps: Map<Address, number> = new Map();
  private readonly MIN_UPDATE_INTERVAL_MS = 5_000; // Don't update more often than every 5s

  /**
   * Called by Pyth Lazer message listener whenever a new price arrives.
   * Batches all registered tokens into a single update cycle.
   */
  async onPriceUpdate(): Promise<void> {
    if (this.updating) return; // Skip if already updating
    this.updating = true;
    try {
      for (const [token, config] of this.registeredTokens) {
        const lastUpdate = this.lastUpdateTimestamps.get(token) ?? 0;
        if (Date.now() - lastUpdate < this.MIN_UPDATE_INTERVAL_MS) continue;

        try {
          await pythLazerOracle.updatePriceOnChain(token);
          this.lastUpdateTimestamps.set(token, Date.now());
        } catch (err) {
          // Log but don't throw -- one token failure shouldn't stop others
          log.warn({ err, token }, "background price update failed");
        }
      }
    } finally {
      this.updating = false;
    }
  }
}
```

### Pattern 2: Conditional Oracle Update in buildOracleParams
**What:** Before calling `updatePriceOnChain()`, check if the on-chain stored price is already fresh by reading `PythLazerFeedProvider.getStoredPrice(token)`. If the stored price timestamp is within acceptable bounds, skip the update TX entirely.
**When to use:** In `BaseExecutor.buildOracleParams()` to avoid redundant oracle TXs when the background updater has already populated the stored price.

```typescript
// Pattern: conditional oracle update (skip if fresh)
protected async buildOracleParams(market: Address, tokens: Address[]): Promise<OracleParams> {
  if (config.oracleMode === "lazer" || config.oracleMode === "both") {
    const pythLazerOracle = getPythLazerOracle();
    if (pythLazerOracle) {
      for (const token of tokens) {
        if (!pythLazerOracle.hasFeed(token)) continue;

        // Check if on-chain stored price is fresh enough
        const isFresh = await this.isStoredPriceFresh(token);
        if (isFresh) {
          log.info({ token }, "stored price is fresh, skipping updatePriceOnChain");
          continue;
        }

        // Fallback: synchronous update (background updater may be behind)
        log.info({ token }, "stored price stale, updating synchronously");
        await pythLazerOracle.updatePriceOnChain(token);
      }
    }
  }
  // ... rest of oracle params building
}

private async isStoredPriceFresh(token: Address): Promise<boolean> {
  const publicClient = getPublicClient();
  const [ok, storedPrice] = await publicClient.readContract({
    address: config.pythLazerFeedProviderAddress,
    abi: pythLazerFeedProviderAbi,
    functionName: "getStoredPrice",
    args: [token],
  });
  if (!ok) return false;

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const maxAge = 30n; // seconds -- conservative; MAX_ORACLE_PRICE_AGE on-chain may be larger
  return (nowSeconds - storedPrice.timestamp) < maxAge;
}
```

### Pattern 3: Operation Data Passthrough via Queue
**What:** Extend `QueueItem` to carry optional operation data. Scanners attach the data they already read. Executors check for attached data before making redundant chain reads.
**When to use:** Always. Poll-sourced items carry data (scanners already read it). Event-sourced items don't (only key is known from the event) and fall back to chain reads.

```typescript
// Extended QueueItem with optional operation data
interface QueueItem {
  key: Hex;
  type: OperationType;
  detectedAt: number;
  source: "event" | "poll";
  operationData?: OperationData; // NEW: optional pre-fetched data
}

type OperationData =
  | { type: "deposit"; deposit: DepositProps; market: MarketInfo }
  | { type: "withdrawal"; withdrawal: WithdrawalProps; market: MarketInfo }
  | { type: "order"; order: OrderProps; market: MarketInfo };

// Executor uses attached data if available
async executeOnce(key: Hex, attempt: number, prefetchedData?: OperationData): Promise<void> {
  // Use prefetched data or read from chain
  const deposit = prefetchedData?.type === "deposit"
    ? prefetchedData.deposit
    : await reader.getDeposit(key);

  const market = prefetchedData?.type === "deposit"
    ? prefetchedData.market
    : await reader.getMarket(deposit.addresses.market);
  // ... rest of execution
}
```

### Pattern 4: MarketCache for Immutable Market Data
**What:** In-memory cache for `reader.getMarket()` results. Market data (indexToken, longToken, shortToken) is immutable once created. Cache keyed by market address, populated on first access, never invalidated.
**When to use:** Everywhere `reader.getMarket()` is called. Saves ~150ms per call (one RPC round-trip eliminated).

```typescript
// MarketCache: process-lifetime cache for immutable market data
class MarketCache {
  private cache: Map<Address, MarketInfo> = new Map();
  private reader: ReaderContract;

  async getMarket(marketAddress: Address): Promise<MarketInfo> {
    const cached = this.cache.get(marketAddress.toLowerCase() as Address);
    if (cached) return cached;

    const market = await this.reader.getMarket(marketAddress);
    this.cache.set(marketAddress.toLowerCase() as Address, market);
    return market;
  }
}
```

### Anti-Patterns to Avoid
- **Removing `updatePriceOnChain()` entirely:** The `PythLazerFeedProvider` contract's `getOraclePrice()` reads from `storedPrices` -- if no price has been stored, execution reverts with `MaxPriceAgeExceeded`. The update TX is required; the optimization is making it proactive rather than synchronous.
- **Using `createNonceManager` for parallel oracle+execution TXs:** viem Issue #3142 documents a nonce gap bug when gas estimation fails with `createNonceManager`. The sequential execution queue from Phase 10 must remain the execution serialization mechanism.
- **Caching operation data indefinitely:** Deposit/withdrawal/order data can change on-chain (e.g., zeroed out after execution). Cached data should only be used within the same execution cycle -- never persisted across scan cycles. The queue's TTL (3600s) provides the outer bound.
- **Updating all token prices in parallel:** The background updater must update prices sequentially (one TX at a time) to avoid nonce collisions. The keeper uses a single wallet; concurrent TXs from the same wallet race for the same nonce.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Oracle price freshness check | Custom timestamp comparison logic | `PythLazerFeedProvider.getStoredPrice()` contract call | On-chain contract is the source of truth for what Oracle.setPrices() will read; local timestamp estimates may drift |
| Nonce serialization for background updates | Manual nonce tracking | Existing `BaseExecutor.submitTransaction()` pattern with pending nonce + retry | Already handles nonce-too-low retries with gas bumping; tested in production |
| Market data caching | LRU cache with TTL | Simple `Map<Address, MarketInfo>` with no eviction | Market data is immutable; LRU/TTL adds complexity for data that never changes |
| Operation data types | Ad-hoc property bags | Existing `DepositProps`/`WithdrawalProps`/`OrderProps` from `types.ts` | Already typed and used by scanners; no new types needed for the data itself |

**Key insight:** The oracle optimization is not about changing the contract interface -- it's about changing WHEN the existing `updatePriceOnChain()` call happens. Move it from "just before execution" to "continuously in the background" and the per-execution cost drops to a single `readContract` freshness check (~50ms).

## Common Pitfalls

### Pitfall 1: Nonce Collision Between Background Updater and Executor
**What goes wrong:** The background oracle updater sends an `updatePriceOnChain()` TX while the executor is also sending an `executeDeposit()` TX. Both read the same pending nonce, and the second TX fails with "nonce too low" or "replacement transaction underpriced."
**Why it happens:** The keeper uses a single wallet. Two independent code paths (background updater and execution queue consumer) both call `walletClient.writeContract()`. Without coordination, they race for nonces.
**How to avoid:** The background updater must be paused or gated while the execution queue is actively processing items. Simplest approach: the `drainQueue()` loop sets a flag `isExecuting = true` while processing; the background updater checks this flag and skips updates. Alternatively, route background updates through the same execution queue as a low-priority item type.
**Warning signs:** Intermittent "nonce too low" errors that only appear when operations arrive during background update cycles.

### Pitfall 2: Stale Prefetched Data Causing Execution Failures
**What goes wrong:** Scanner fetches deposit data, enqueues it with the prefetched data. By the time the executor processes it (could be seconds later if queue has items ahead), the deposit has been cancelled or the market state has changed. Executor uses stale data and either reverts on-chain or makes incorrect oracle param decisions.
**Why it happens:** Time passes between scan and execution. On-chain state can change in that window.
**How to avoid:** Prefetched data is used ONLY for building oracle params (token addresses needed for pricing -- these don't change) and for the initial staleness check (zeroed account address). The executor should still read fresh deposit data from chain for the `executeDeposit` call itself if the operation data is more than a few seconds old. For the token list extraction (which is the main value of prefetching), the data is safe to cache because token addresses in a deposit struct are immutable once created.
**Warning signs:** `EmptyDeposit` errors on operations that the scanner found as valid.

### Pitfall 3: Background Updater Overwhelming RPC with Price Updates
**What goes wrong:** Pyth Lazer WebSocket sends price updates at 200ms intervals (5x/second). Each update triggers `updatePriceOnChain()` for all 7 tokens. That's 35 TXs/second, which exceeds any reasonable RPC rate limit and wastes gas.
**Why it happens:** Naively calling `updatePriceOnChain()` on every WebSocket message without throttling.
**How to avoid:** Throttle background updates with a minimum interval per token (e.g., 5-10 seconds). Only update if the cached binary update is actually newer than the on-chain stored price. Use the in-memory `updateCache` timestamp to decide.
**Warning signs:** RPC rate limit errors. Wallet balance draining from excessive 1 wei updatePrice fees. Gas estimation failures from pending TX backlog.

### Pitfall 4: getStoredPrice() Returning Stale Price Under MAX_ORACLE_PRICE_AGE
**What goes wrong:** The `isStoredPriceFresh()` check uses a conservative local threshold (e.g., 30s) but the on-chain `MAX_ORACLE_PRICE_AGE` is larger (e.g., 300s). The keeper thinks the price is stale and does a synchronous update when it's not needed. Or worse: the keeper thinks the price is fresh but the on-chain validation uses a different threshold and rejects it.
**Why it happens:** The freshness threshold is defined on-chain in DataStore as `MAX_ORACLE_PRICE_AGE`. The keeper's local check must use the same or a more conservative value.
**How to avoid:** Read `MAX_ORACLE_PRICE_AGE` from DataStore once at startup and use it as the freshness threshold (minus a safety margin of ~5 seconds for block propagation delay). Cache this value -- it doesn't change frequently.
**Warning signs:** Execution reverts with `MaxPriceAgeExceeded` despite the keeper believing the stored price was fresh.

### Pitfall 5: Event-Sourced Items Missing Oracle Update
**What goes wrong:** An event-sourced queue item arrives. The background updater hasn't run recently (e.g., WebSocket just reconnected). The executor checks `isStoredPriceFresh()`, finds a stale price, falls back to synchronous update. But the synchronous update path sends a TX and waits for receipt (2-8s), negating the Phase 11 optimization for this item.
**Why it happens:** The background updater is best-effort. During WebSocket disconnection gaps, no updates happen. The first execution after reconnection pays the full synchronous price.
**How to avoid:** This is expected behavior and acceptable. The optimization is for the steady-state case (background updater running, prices always fresh). The fallback path (synchronous update) is the same as current behavior -- no regression. Log when fallback occurs so it's observable.
**Warning signs:** Occasional executions taking 5+ seconds in logs, correlating with WebSocket reconnection events.

## Code Examples

### Background Oracle Updater Integration Point
```typescript
// Source: codebase analysis of pythLazerOracle.ts handlePriceUpdate()
// The existing handlePriceUpdate() already caches binary updates in updateCache.
// Add a hook that triggers proactive on-chain updates.

// In PythLazerOracleService, add to constructor:
private backgroundUpdateEnabled: boolean = false;
private backgroundUpdateBusy: boolean = false;
private lastOnChainUpdate: Map<Address, number> = new Map();
private readonly BG_UPDATE_INTERVAL_MS = 10_000; // 10s minimum between on-chain updates per token

enableBackgroundUpdates(): void {
  this.backgroundUpdateEnabled = true;
}

disableBackgroundUpdates(): void {
  this.backgroundUpdateEnabled = false;
}

// Add to end of handlePriceUpdate() method:
private async triggerBackgroundUpdate(): Promise<void> {
  if (!this.backgroundUpdateEnabled || this.backgroundUpdateBusy) return;
  this.backgroundUpdateBusy = true;

  try {
    const now = Date.now();
    for (const [tokenKey, config] of this.pythLazerConfigs) {
      const lastUpdate = this.lastOnChainUpdate.get(tokenKey) ?? 0;
      if (now - lastUpdate < this.BG_UPDATE_INTERVAL_MS) continue;

      const cachedUpdate = this.getLatestUpdate(tokenKey);
      if (!cachedUpdate) continue;

      try {
        await this.updatePriceOnChain(tokenKey);
        this.lastOnChainUpdate.set(tokenKey, now);
      } catch (err) {
        log.warn({ err, token: tokenKey }, "background oracle update failed");
      }
    }
  } finally {
    this.backgroundUpdateBusy = false;
  }
}
```

### Conditional Oracle Update in BaseExecutor
```typescript
// Source: codebase analysis of baseExecutor.ts buildOracleParams()
// Modified buildOracleParams to check stored price freshness first

// Read MAX_ORACLE_PRICE_AGE once at startup
let maxOraclePriceAge: bigint | null = null;

async function getMaxOraclePriceAge(): Promise<bigint> {
  if (maxOraclePriceAge !== null) return maxOraclePriceAge;
  const dataStore = new DataStoreContract();
  // Keys.MAX_ORACLE_PRICE_AGE key hash
  maxOraclePriceAge = await dataStore.getUint(MAX_ORACLE_PRICE_AGE_KEY);
  return maxOraclePriceAge;
}

// In buildOracleParams, replace the for-loop that calls updatePriceOnChain:
for (const token of tokensToPrice) {
  if (!pythLazerOracle.hasFeed(token)) continue;

  // Check if on-chain stored price is already fresh (background updater may have handled it)
  const publicClient = getPublicClient();
  const [ok, storedPrice] = await publicClient.readContract({
    address: config.pythLazerFeedProviderAddress,
    abi: pythLazerFeedProviderAbi,
    functionName: "getStoredPrice",
    args: [token],
  }) as [boolean, { timestamp: bigint }];

  if (ok) {
    const maxAge = await getMaxOraclePriceAge();
    const safetyMargin = 5n; // 5 seconds buffer
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const isFresh = (nowSeconds - storedPrice.timestamp) < (maxAge - safetyMargin);

    if (isFresh) {
      log.info({ token, storedAge: (nowSeconds - storedPrice.timestamp).toString() },
        "on-chain price is fresh, skipping updatePriceOnChain");
      continue;
    }
  }

  // Fallback: synchronous update
  log.info({ token }, "stored price stale or missing, updating synchronously");
  await pythLazerOracle.updatePriceOnChain(token);
}
```

### Extended QueueItem with Operation Data
```typescript
// Source: codebase analysis of executionQueue.ts and scanners/types.ts

// In types.ts, add:
export interface MarketInfo {
  marketToken: Address;
  indexToken: Address;
  longToken: Address;
  shortToken: Address;
}

export type OperationData =
  | { type: "deposit"; deposit: DepositProps; market: MarketInfo; tokens: Address[] }
  | { type: "withdrawal"; withdrawal: WithdrawalProps; market: MarketInfo; tokens: Address[] }
  | { type: "order"; order: OrderProps; market: MarketInfo; tokens: Address[] };

// In executionQueue.ts, extend QueueItem:
export interface QueueItem {
  key: Hex;
  type: OperationType;
  detectedAt: number;
  source: "event" | "poll";
  operationData?: OperationData; // Optional: attached by scanner, used by executor
}
```

### Scanner Data Attachment
```typescript
// Source: codebase analysis of depositScanner.ts scan() method
// In the scan() loop where deposits are processed, attach the data:

for (const [key, deposit] of deposits) {
  if (!deposit) continue;

  try {
    const scannedDeposit = this.processDeposit(key, deposit);
    await this.storeDeposit(scannedDeposit);

    // Build token list and market info for passthrough
    const market = await marketCache.getMarket(deposit.addresses.market);
    const tokens = this.extractTokens(deposit, market);

    result.depositKeys.push(key);
    result.operationDataMap.set(key, {
      type: "deposit",
      deposit,
      market,
      tokens,
    });
  } catch (error) {
    log.error({ err: error, key }, "failed to store deposit");
  }
}

// In index.ts scanAndEnqueue():
const result = await depositScanner.scan();
for (const key of result.depositKeys) {
  const operationData = result.operationDataMap?.get(key);
  queue.enqueue({
    key, type: "deposit", detectedAt: Date.now(), source: "poll",
    operationData,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous `updatePriceOnChain()` per execution (2-8s) | Proactive background updates; skip if stored price is fresh | This phase | Oracle overhead: 2-8s -> ~50ms (readContract check) in steady state |
| Executor re-reads deposit/withdrawal/order from chain | Scanner passes data through queue to executor | This phase | Eliminates 1-3 redundant RPC calls per execution (~300-500ms) |
| No market data caching | MarketCache with process-lifetime entries | This phase | Eliminates repeated `getMarket()` calls (~150ms each) |
| Scanner returns only keys | Scanner returns keys + operation data | This phase | Data flows through pipeline instead of being read twice |

**Deprecated/outdated:**
- The current `buildOracleParams()` always calls `updatePriceOnChain()` synchronously for every token. After this phase, it becomes conditional: check stored price first, only update if stale.

## Open Questions

1. **Background updater nonce coordination with executor**
   - What we know: Both the background updater and executor use the same wallet. Sequential execution through the queue prevents executor nonce collisions. The background updater runs independently.
   - What's unclear: The best coordination mechanism. Options: (a) pause background updates during execution, (b) route updates through the queue as low-priority items, (c) use a shared nonce lock.
   - Recommendation: Option (a) is simplest. The background updater checks an `isExecuting` flag set by the drain loop. When the queue is actively processing, background updates are paused. This avoids any nonce collision possibility with zero added complexity. The drain loop's 100ms idle wait is fast enough that pauses are brief.

2. **Optimal background update interval per token**
   - What we know: Pyth Lazer sends updates at 200ms (5x/second). On-chain `MAX_ORACLE_PRICE_AGE` determines how often updates MUST happen. Base Sepolia has 2s block times. Gas cost per `updatePrice` is 1 wei verification fee plus gas.
   - What's unclear: The ideal balance between freshness and gas cost.
   - Recommendation: Start with 10-second intervals per token. With 7 tokens, that's ~1 TX every 1.4 seconds in the worst case. This keeps prices always within 10s of real-time, well within any reasonable `MAX_ORACLE_PRICE_AGE`. Monitor gas spend and adjust. On testnet, gas is free -- err on the side of frequent updates.

3. **MarketCache invalidation for market configuration changes**
   - What we know: Market data (indexToken, longToken, shortToken) is set at market creation and does not change in normal operation.
   - What's unclear: Whether admin operations could modify market token assignments.
   - Recommendation: No invalidation needed. If market config changes (admin operation), the keeper can be restarted. Process-lifetime cache is sufficient. Log cache hits at debug level for observability.

## Sources

### Primary (HIGH confidence)
- Codebase: `0xmarkets_contract/contracts/oracle/PythLazerFeedProvider.sol` -- `getOraclePrice()` reads from `storedPrices` mapping, `updatePrice()` writes to it. The `data` parameter in `getOraclePrice()` is ignored (marked `/* data */`). This confirms the separate `updatePriceOnChain()` TX is required for Pyth Lazer mode.
- Codebase: `0xmarkets_contract/contracts/oracle/Oracle.sol` -- `setPrices()` calls `_validatePrices()` which calls `IOracleProvider(provider).getOraclePrice(token, data)` for each token. The Oracle contract does not store prices itself; it delegates to the provider.
- Codebase: `0xmarkets_contract/contracts/oracle/OracleModule.sol` -- `withOraclePrices` modifier calls `oracle.setPrices(params)` before execution, then `oracle.clearAllPrices()` after. Prices are transient within a single TX.
- Codebase: `0xmarkets_contract/contracts/exchange/DepositHandler.sol` -- `executeDeposit()` uses `withOraclePrices(oracleParams)` modifier, confirming the oracle flow.
- Codebase: `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` -- `updatePriceOnChain()` sends a separate TX and waits for receipt (lines 262-287). `handlePriceUpdate()` caches binary data in `updateCache` (lines 151-158).
- Codebase: `order-execution-keeper-service/src/core/executors/baseExecutor.ts` -- `buildOracleParams()` calls `updatePriceOnChain()` synchronously per token (lines 173-208).
- Codebase: `order-execution-keeper-service/src/core/executors/depositExecutor.ts` -- `executeOnce()` reads deposit from chain (line 81), reads market from chain (line 114), both of which the scanner already fetched.
- Codebase: `order-execution-keeper-service/src/core/scanners/depositScanner.ts` -- `scan()` calls `reader.getDeposits(newKeys)` (line 82) but only stores the key in DB, discarding the full deposit data.

### Secondary (MEDIUM confidence)
- Codebase: `0xmarkets_contract/contracts/oracle/OracleUtils.sol` -- `SetPricesParams` struct: `{ tokens: address[], providers: address[], data: bytes[] }`. Confirmed that `data[]` is passed to provider's `getOraclePrice()`.
- Project research: `.planning/research/SUMMARY.md` -- Oracle price contract behavior flagged as key unknown; now resolved through contract analysis.
- Phase 10 research: `.planning/phases/10-event-driven-detection/10-RESEARCH.md` -- Queue architecture and execution patterns confirmed implemented.

### Tertiary (LOW confidence)
- On-chain `MAX_ORACLE_PRICE_AGE` value: not verified directly (requires DataStore read). The keeper must read this at startup. Assumed to be a reasonable value (30-300 seconds) based on DeFi conventions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; all features exist in current dependencies; verified from codebase analysis
- Architecture: HIGH - on-chain contract source code confirms the oracle price flow definitively; the "inline data" hypothesis is disproven; proactive update pattern is the correct optimization
- Pitfalls: HIGH - nonce collision risk is well-understood from Phase 10; throttling requirements derived from Pyth Lazer WebSocket 200ms update frequency; stored price freshness check verified against PythLazerFeedProvider contract

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain -- contract interfaces are immutable; viem APIs unlikely to change)
