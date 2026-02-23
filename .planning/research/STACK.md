# Technology Stack: Keeper Execution Speed Optimization

**Project:** 0xMarkets Keeper Speed (v1.3)
**Researched:** 2026-02-23
**Scope:** Stack additions/changes needed for sub-10s keeper execution

## Current Stack (Validated, No Changes Needed)

These are already in place and correct for the task. Listed for context only.

| Technology | Version | Service | Purpose |
|------------|---------|---------|---------|
| viem | ^2.40.3 | Both | Blockchain interaction, tx submission |
| pino | ^10.3.1 | Both | Structured JSON logging |
| Prisma | ^7.2.0 / ^5.22.0 | order-exec / keeper | ORM for state management |
| Express | ^5.1.0 | Both | Health endpoint HTTP server |
| Pyth Lazer SDK | ^5.2.0 | Both | Binary WebSocket price feeds |
| PostgreSQL 14 | Docker | Both | Persistence layer |
| TypeScript | ^5.9.3 | Both | Language |

## Recommended Stack Changes

### 1. WebSocket Transport for viem (CRITICAL)

**What:** Add a `webSocket` transport to both services' viem `PublicClient` so `watchContractEvent` uses real `eth_subscribe` push subscriptions instead of HTTP polling.

**Why this is the single highest-impact change:**
- Current state: Both services use `http()` transport. The keeper-service's `EventConfirmator` already calls `publicClient.watchContractEvent()`, but because the client uses HTTP transport, viem silently falls back to `eth_getFilterChanges` polling (default ~4s interval). The order-execution-keeper doesn't use event watching at all -- it polls DataStore every `scanIntervalSeconds` (default 10s).
- With WebSocket: `watchContractEvent` with a `webSocket()` transport and `poll: false` uses `eth_subscribe` for real-time push. Events arrive within ~200-500ms of block inclusion on Base Sepolia (2s block time). This eliminates the 10s polling delay entirely.
- The gap between "user submits createDeposit" and "keeper starts executing" drops from 0-10s (polling lottery) to ~2-3s (next block + WebSocket push).

**What to install:** Nothing new. `webSocket` transport is built into `viem` -- it's `import { webSocket } from 'viem'`. Already available at ^2.40.3.

**Configuration:**

```typescript
import { createPublicClient, webSocket, http, fallback } from 'viem'

// WebSocket primary, HTTP fallback for resilience
const publicClient = createPublicClient({
  chain: customChain,
  transport: fallback([
    webSocket(config.wsRpcUrl, {
      reconnect: {
        attempts: 10,
        delay: 1_000,
      },
    }),
    http(config.rpcUrl),
  ]),
  batch: { multicall: true },
})
```

**New env var needed:** `WS_RPC_URL` (e.g., `wss://base-sepolia.g.alchemy.com/v2/<key>`)

**RPC Provider for WebSocket on Base Sepolia:**

| Provider | WSS Endpoint | Free Tier | Notes |
|----------|-------------|-----------|-------|
| Alchemy | `wss://base-sepolia.g.alchemy.com/v2/<key>` | Yes (300M CU/mo) | Best choice -- reliable WebSocket, Base Sepolia supported |
| QuickNode | `wss://...quiknode.pro/<key>` | Limited free | Good alternative |
| Ankr | `wss://rpc.ankr.com/base_sepolia/...` | Yes | Less reliable reconnection |

**Recommendation:** Use Alchemy. Free tier is sufficient for testnet keeper traffic. Their WebSocket implementation is stable with proper reconnection support.

**Confidence:** HIGH -- viem's `webSocket` transport, `fallback` transport, and `watchContractEvent` with `poll: false` are well-documented stable features at v2.x. The keeper-service already uses `watchContractEvent` (just over HTTP polling currently).

---

### 2. Event-Driven Operation Detection for order-execution-keeper (CRITICAL)

**What:** Replace the `setInterval` polling loop in `order-execution-keeper-service/src/index.ts` with `watchContractEvent` listeners on the EventEmitter contract for `DepositCreated`, `WithdrawalCreated`, and `OrderCreated` events.

**Why:** The current architecture:
1. User submits `createDeposit` tx (creates request on-chain)
2. Keeper waits for next `setInterval` tick (0-10s delay)
3. Keeper calls `DataStore.getBytes32Count` + `getBytes32ValuesAt` (1-2 RPC calls)
4. Keeper calls `Reader.getDeposits` for new keys (1 RPC call)
5. Keeper stores in Prisma, then executes

With event-driven detection:
1. User submits `createDeposit` tx (creates request on-chain)
2. EventEmitter emits `EventLog1`/`EventLog2` with eventName `DepositCreated` (~200ms after block)
3. Keeper immediately starts execution

This eliminates steps 2-4 entirely for new requests. The DataStore polling should remain as a **fallback** (reduced to every 30-60s) to catch any events missed during WebSocket reconnection.

**What to install:** Nothing new. Uses existing `viem` `watchContractEvent` + the EventEmitter ABI that already exists in the keeper-service. The order-execution-keeper needs its own copy of the EventEmitter ABI.

**EventEmitter events to watch:**

| Event Name (in eventData) | Purpose | Maps to Scanner |
|----------------------------|---------|-----------------|
| `DepositCreated` | New deposit request | DepositScanner |
| `WithdrawalCreated` | New withdrawal request | WithdrawalScanner |
| `OrderCreated` | New order (market/limit) | OrderScanner |

All emitted via `EventLog1` or `EventLog2` on the EventEmitter contract (address already in config: `EVENT_EMITTER_ADDRESS`).

**Confidence:** HIGH -- The keeper-service's `EventConfirmator` already does exactly this pattern for `OrderExecuted` events. The order-execution-keeper needs the same pattern for creation events.

---

### 3. Reduced Scan Interval as Fallback (LOW EFFORT)

**What:** Keep the `setInterval` polling loop but reduce `SCAN_INTERVAL_SECONDS` from `10` to `3` as an immediate improvement, even before WebSocket migration.

**Why:** Base Sepolia has 2s block times. A 10s polling interval means 0-10s latency for detection. Reducing to 3s means 0-3s latency. Combined with the WebSocket event listener (which handles the fast path), the polling becomes a reliable catch-all fallback.

**After WebSocket migration:** Increase fallback polling interval to 30-60s. The polling path only needs to catch missed events, not be the primary detection mechanism.

**What to install:** Nothing. Config change only.

**Confidence:** HIGH -- Trivial change, no new dependencies.

---

### 4. Parallel Oracle Price Updates (MEDIUM IMPACT)

**What:** Use `Promise.all` for oracle price updates when multiple tokens need pricing, instead of the current sequential loop.

**Why:** In `baseExecutor.ts`, the `buildOracleParams` method updates Pyth Lazer prices sequentially:

```typescript
// Current: sequential
for (const token of tokensToPrice) {
  await pythLazerOracle.updatePriceOnChain(token);
}
```

Each `updatePriceOnChain` is an on-chain transaction that takes ~2-4s. With 2-3 tokens per deposit, this adds 4-12s of serial oracle updates. However, these updates use the same keeper wallet, so parallelization creates nonce conflicts.

**Actual fix:** Batch oracle updates into a single multicall transaction, or use viem's `writeContract` with explicit nonce management for parallel submission.

**Realistic approach for single-wallet constraint:** The oracle price updates are the bottleneck, not the detection. Two strategies:

1. **Pre-cache oracle prices:** Update all token prices on-chain on every new Pyth Lazer WebSocket message (proactively), not just when a deposit is detected. This makes `buildOracleParams` a no-op read instead of a write.
2. **Skip redundant updates:** Track the last on-chain update timestamp per token. If the price was updated within the last N seconds, skip the update.

**What to install:** Nothing new. Architecture change using existing viem + Pyth Lazer SDK.

**Confidence:** MEDIUM -- The single-wallet nonce constraint is real and limits true parallelism. Pre-caching is the correct pattern but needs careful implementation to avoid wasting gas on unnecessary updates.

---

## What NOT to Add

### Message Queues (Redis, RabbitMQ, BullMQ)

**Why not:** Overengineering. Both keepers are single-process Node.js services with one wallet. There is no fan-out, no multi-consumer pattern, no horizontal scaling need. The "queue" is already the on-chain DataStore list + Prisma status tracking. Adding a message queue adds operational complexity (another Docker service, failure modes, monitoring) for zero latency benefit.

**When it would matter:** If you had multiple keeper wallets executing in parallel, a queue would coordinate work distribution. That's not the v1.3 scope.

### Worker Threads (node:worker_threads)

**Why not:** The keeper workload is I/O-bound (RPC calls, WebSocket messages, database queries), not CPU-bound. Node.js's event loop handles I/O concurrency natively. Worker threads help with CPU-intensive work (heavy crypto computation, data transformation). The keeper does none of that -- it waits for network responses.

**When it would matter:** If oracle price validation involved heavy cryptographic verification (e.g., verifying ZK proofs), worker threads would prevent blocking the event loop. Pyth Lazer SDK handles this internally already.

### ethers.js WebSocketProvider

**Why not:** The project already uses viem exclusively. viem's `webSocket` transport provides identical WebSocket subscription functionality (`eth_subscribe`). Adding ethers.js would mean maintaining two blockchain libraries for the same feature. viem's TypeScript-first design is also better for this codebase.

### Separate Event Indexer Service (Squid, Ponder, custom)

**Why not:** There's already a Squid indexer (`0xMarkets-squid`) for historical data. The keeper needs real-time event detection, not indexed historical data. An indexer adds latency (sync delay) rather than reducing it. Direct `watchContractEvent` on the EventEmitter is the fastest path.

### Custom WebSocket Reconnection Library (ws, reconnecting-websocket)

**Why not:** viem's `webSocket` transport has built-in reconnection with configurable `attempts` and `delay`. The `fallback` transport adds HTTP as an automatic backup. No need for a custom reconnection layer.

---

## Recommended Stack (Changes Only)

### New Configuration

| Setting | Value | Service | Purpose |
|---------|-------|---------|---------|
| `WS_RPC_URL` | `wss://base-sepolia.g.alchemy.com/v2/<key>` | Both | WebSocket RPC for event subscriptions |
| `SCAN_INTERVAL_SECONDS` | `3` (immediate) / `30` (after WS) | order-exec | Reduced polling interval |

### Code Changes (No New Packages)

| Change | Service | File(s) | Impact |
|--------|---------|---------|--------|
| Add `webSocket` + `fallback` transport | order-exec | `src/core/blockchain/client.ts` | WebSocket event subscription support |
| Add `webSocket` + `fallback` transport | keeper | `src/core/contract.ts` | WebSocket event subscription support |
| Add EventEmitter ABI | order-exec | `src/core/blockchain/contracts/abis/event-emitter.ts` | Event decoding for creation events |
| Add event listener for DepositCreated/WithdrawalCreated/OrderCreated | order-exec | `src/index.ts` (new event watcher module) | Event-driven detection |
| Proactive oracle price caching | order-exec | `src/core/oracle/` | Eliminate per-execution oracle update latency |
| Reduce SCAN_INTERVAL_SECONDS default | order-exec | `src/config.ts` | Faster fallback polling |

### Installation

```bash
# No new packages needed. All capabilities exist in viem ^2.40.3.
# Only configuration changes:

# 1. Get Alchemy API key for Base Sepolia (free tier)
# 2. Add to .env files:
WS_RPC_URL=wss://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# 3. Reduce scan interval (immediate win):
SCAN_INTERVAL_SECONDS=3
```

## Latency Budget Analysis

**Current (polling at 10s interval):**

| Step | Time | Cumulative |
|------|------|------------|
| User tx mined | 0s | 0s |
| Wait for next poll tick | 0-10s (avg 5s) | 5s |
| DataStore RPC calls (count + values) | ~1s | 6s |
| Reader.getDeposits | ~0.5s | 6.5s |
| Prisma store | ~0.1s | 6.6s |
| Oracle price update(s) | 2-8s | 10-14s |
| Gas estimation | ~0.5s | ~12s |
| TX submission + confirmation | 2-4s | ~15s |
| **Total** | | **10-18s** |

**Target (event-driven with WebSocket):**

| Step | Time | Cumulative |
|------|------|------------|
| User tx mined | 0s | 0s |
| WebSocket event push | ~0.3s | 0.3s |
| Extract key from event (no RPC) | ~0s | 0.3s |
| Reader.getDeposit (single key) | ~0.3s | 0.6s |
| Prisma store | ~0.1s | 0.7s |
| Oracle price (pre-cached) | ~0s | 0.7s |
| Gas estimation | ~0.5s | 1.2s |
| TX submission | ~0.3s | 1.5s |
| TX confirmation (next block) | 2s | 3.5s |
| **Total** | | **3-5s** |

The two biggest latency wins:
1. **Polling delay eliminated:** 5s average -> 0.3s (WebSocket push)
2. **Oracle update eliminated:** 2-8s -> 0s (pre-cached prices)

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Event detection | viem `watchContractEvent` + WebSocket | ethers.js `WebSocketProvider` | Already using viem; identical capability |
| Event detection | viem `watchContractEvent` + WebSocket | Squid/Ponder indexer | Adds latency, not reduces it |
| Transport | viem `fallback([webSocket, http])` | WebSocket only | HTTP fallback prevents total failure on WS disconnect |
| Concurrency | Single event loop, sequential TX | Worker threads | I/O-bound workload, not CPU-bound |
| Work distribution | Direct execution on event | Message queue (Redis/BullMQ) | Single wallet, single process -- no fan-out needed |
| Oracle optimization | Proactive price caching | Parallel price updates | Single wallet nonce constraint prevents true parallelism |

## Sources

- [viem watchContractEvent documentation](https://viem.sh/docs/contract/watchContractEvent) -- WebSocket subscription behavior, poll configuration
- [viem WebSocket Transport documentation](https://viem.sh/docs/clients/transports/websocket) -- reconnect configuration, transport setup
- [viem Fallback Transport documentation](https://v1.viem.sh/docs/clients/transports/fallback.html) -- multi-transport resilience, ranking
- [viem Discussion #503: eth_subscribe vs eth_getFilterChanges](https://github.com/wevm/viem/discussions/503) -- polling vs subscription internals
- [Alchemy Base Sepolia RPC](https://www.alchemy.com/chain-connect/chain/base-sepolia-testnet) -- WSS endpoint availability
- [GMX Synthetics EventEmitter.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/event/EventEmitter.sol) -- Event architecture reference
- [GMX Synthetics documentation](https://github.com/gmx-io/gmx-synthetics) -- Keeper architecture (keepers listen for events, bundle oracle prices, execute)
- Codebase analysis: `keeper-service/src/core/confirmator.ts` already uses `watchContractEvent` pattern (lines 50-58)
- Codebase analysis: `order-execution-keeper-service/src/core/blockchain/client.ts` uses `http()` transport only (line 31)
- Codebase analysis: `order-execution-keeper-service/src/index.ts` uses `setInterval` at `scanIntervalSeconds` (line 180-184)
