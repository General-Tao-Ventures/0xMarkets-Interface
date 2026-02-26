# Feature Landscape: Minimal Keeper Rewrite (v1.5)

**Domain:** DeFi order execution keeper -- replacing 3,000+ line over-engineered keeper with ~300 line minimal equivalent
**Researched:** 2026-02-25
**Overall confidence:** HIGH (based on direct codebase analysis of existing keeper, GMX synthetics keeper spec, Chainlink Automation patterns, and MEV bot architectural principles)

## Context: What the Keeper Actually Does

The GMX-style two-step execution model is simple: users create requests on-chain (deposits, withdrawals, orders), and a keeper detects them, bundles oracle prices, and calls the corresponding handler contract to execute them. The on-chain DataStore is the source of truth for all pending operations. The keeper's only job is to:

1. Detect pending operations (event or poll)
2. Read operation details from chain
3. Get fresh oracle prices
4. Call `executeDeposit` / `executeWithdrawal` / `executeOrder` with oracle params
5. Confirm the TX landed

Everything else is optional infrastructure.

## Table Stakes

Features the minimal keeper MUST have. Without any of these, operations will not execute or the keeper will silently fail.

| Feature | Why Expected | Complexity | Existing State | Notes |
|---------|--------------|------------|----------------|-------|
| EventEmitter WebSocket watcher | Primary detection path. Without it, keeper relies entirely on polling and adds 15s latency to every operation. Users expect sub-second detection. | Low | `EventListener` class exists (327 lines), but coupled to Prisma for block persistence. Rewrite needs only the `watchEvent` + `decodeEventName` + enqueue logic (~50 lines). | GMX keepers "listen for user transactions" via events. This is the standard pattern. |
| DataStore polling safety net | WebSocket connections drop. RPC providers flap. Events can be missed during reconnect windows. A periodic poll of DataStore's DEPOSIT_LIST / WITHDRAWAL_LIST / ORDER_LIST catches anything the event watcher missed. | Low | Scanner classes exist (deposit: 328 lines, withdrawal: 232 lines, order: 210 lines) but 60%+ is DB operations. Minimal version: `dataStore.getAllBytes32Values(key)` -> dedup against in-memory set -> enqueue. ~30 lines per type. | Chainlink Automation calls this "checkUpkeep" -- the off-chain check that determines if work needs doing. Polling interval of 10-15s is standard. |
| Sequential single-consumer execution loop | Single keeper wallet means a single nonce. Parallel execution causes "replacement transaction underpriced" and "nonce too low" errors. The architecture must enforce one-TX-at-a-time. | Very Low | `drainQueue()` + `TxMutex` in index.ts (~70 lines). The queue+mutex pattern is solid. Minimal version: simple `while(true)` loop pulling from a Set, no mutex needed if there is only one consumer and no competing cleanup path. | This is the consensus pattern. MEV bots, GMX keepers, and all single-wallet execution bots use sequential execution. There is no alternative. |
| In-memory dedup set | Without dedup, the same operation key gets executed twice -- once from the event, once from the poll. The on-chain contract may revert (good case) or double-charge gas (bad case). | Very Low | `ExecutionQueue` class (151 lines) with pending/processing/allKnown Maps, fail counts, TTL cleanup. Minimal version: a `Set<Hex>` cleared after key completion + a TTL eviction. ~15 lines. | Standard pattern. Every keeper implementation deduplicates. |
| Pyth Lazer WebSocket price cache | Oracle prices must be included with every execution call. Lazer streams prices via WebSocket into an in-memory cache. Executors read cached prices at execution time -- zero HTTP round-trips. | Medium | `PythLazerOracleService` (full file not shown but estimated ~200 lines) with `updateCache` Map, `getLatestUpdate()`, feed registration. This is already well-designed and cache-only. Minimal version can reuse this largely as-is. | GMX spec: "Keepers listen for transactions, include the prices for the request then send a transaction." Pyth Lazer's streaming model is ideal -- prices are always ready. |
| Per-token oracle routing (Lazer/Hermes) | Crypto tokens (WETH, WBTC, USDC) use Lazer. FX tokens (EUR, GBP, JPY, GOLD) use Hermes. A global mode breaks one group or the other. This was shipped in v1.4 and must be preserved. | Low | `buildOracleParams()` in `baseExecutor.ts` already partitions tokens into `lazerTokens` and `hermesTokens` per-token. ~80 lines of oracle routing logic. | Proven pattern from v1.4. No changes needed to the routing logic itself. |
| Fixed gas limit (skip estimateGas) | `estimateGas` adds an RPC round-trip per execution. GMX handler contracts have predictable gas usage. A generous fixed limit (2M) avoids the round-trip while only charging gas actually used. | Very Low | `DEFAULT_GAS_LIMIT = 2_000_000n` in `baseExecutor.ts`. Already proven. | GMX docs: "order keepers are expected to validate whether a transaction will revert before sending the transaction to minimize gas wastage." But for a single-operator testnet keeper, a fixed generous gas limit is simpler and equally effective. |
| Nonce-aware TX submission with retry | Nonce conflicts happen from RPC lag, stale pending TX state, or WS reconnects. The keeper must get explicit nonce (`getTransactionCount({ blockTag: "pending" })`) and retry on nonce errors. | Low | `submitTransaction()` in `baseExecutor.ts` (40 lines) with 3 retries, gas bumping, nonce-error detection. Well-designed and minimal already. | Every blockchain bot needs this. The existing implementation is already close to minimal. |
| Health endpoint | BetterStack pings the keeper every 5 minutes. Without a health endpoint, there is no monitoring. A keeper that crashes silently means operations queue up forever. | Very Low | `healthState.ts` (81 lines) + HTTP server. Minimal version: single `GET /health` returning JSON with uptime, last heartbeat, oracle status, WS status. ~20 lines of Bun.serve or similar. | Table stakes for any production service. The existing health state tracking is simple enough to keep. |
| Graceful shutdown (SIGINT/SIGTERM) | Docker sends SIGTERM on restart/redeploy. Without graceful shutdown, in-flight transactions may be abandoned, WebSocket connections leak, and the process hangs. | Very Low | `shutdown()` handler in index.ts (~15 lines): stop intervals, unwatch events, destroy WS client, close server. | Standard for any long-running process. |
| Structured logging | JSON logs are essential for debugging production issues via SSH. Without structured logging, diagnosing "why did this order fail?" requires grep through unstructured output. | Very Low | Pino logger already configured. Minimal version: keep pino, keep child loggers per module. ~5 lines of setup. | The existing keeper replaced 278 console calls with pino. That was the right call. Keep it. |

## Differentiators

Features that go beyond "it works" into "it works well." These are worth including in the rewrite if they remain simple, but should not inflate the line count.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Expired request cancellation | Operations that sit unclaimed past `REQUEST_EXPIRATION_TIME` (currently 3600s on testnet) should be cancelled on-chain. Returns stuck user funds. | Low | DataStore read for expiration time, cancel TX per expired request. ~30 lines. | Currently runs every 5 minutes in existing keeper. Important for UX -- a user whose deposit expired should get their tokens back without manual admin intervention. |
| Stale request cleanup | If a request key appears in the in-memory dedup set but no longer exists on-chain (already executed by another keeper or manually), clear it so the set does not grow unbounded. | Very Low | Poll-based comparison: on-chain keys vs. in-memory set. ~10 lines. | Without this, the in-memory set grows monotonically. Not a real problem at testnet volume but good hygiene. |
| Execution timing instrumentation | Per-stage timing (oracle build, TX submit, TX confirm, total) logged with each execution. Enables identifying bottlenecks without a profiler. | Very Low | Already exists in current executors. ~5 lines per execution path using `performance.now()`. | Proven valuable in v1.3/v1.4 for diagnosing latency. Zero runtime cost. Keep it. |
| Startup oracle provider verification | Read `oracleProviderForToken` from DataStore for each configured token at boot. Log mismatches loudly. Prevents running with 100% execution failures for hours. | Low | `verifyOracleProviderConsistency()` already exists and is ~40 lines. Copy into minimal keeper. | Saved debugging time in v1.4. Worth the 40 lines. |
| Startup Lazer feed entitlement verification | After 10s warmup, verify that all expected Lazer feeds actually received data. Detects zero-entitlement API keys immediately instead of failing silently. | Low | `verifyLazerFeeds()` already exists and is ~30 lines. | This caught a real issue in v1.4 -- a crypto-only key that silently received zero FX data. |
| Hermes fallback for stale Lazer cache | If Lazer WS disconnects and cached price for a token goes stale, fall back to Hermes REST API for that specific token. Prevents Lazer outage from blocking all executions. | Low | Already built into `buildOracleParams()` -- stale tokens get moved from `lazerTokens` to `hermesTokens`. ~10 lines. | Resilience feature. Already proven. Keep it. |

## Anti-Features

Features to explicitly NOT build in the minimal rewrite. These are the primary sources of complexity in the existing 3,000+ line keeper.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **PostgreSQL database (Prisma/PG)** | The database is the single largest source of complexity. 6 Prisma models, 148 lines of schema, ~1,000 lines of DB operations across scanners/executors/monitors. It tracks request status (PENDING/EXECUTED/FAILED/CANCELLED), execution history, block numbers, gas costs. But the on-chain DataStore already IS the source of truth -- a request is pending if and only if its key exists in the DataStore list. The DB duplicates on-chain state, adds a failure mode (DB connection issues), requires migrations, and needs a PostgreSQL container. | Use the DataStore as the sole source of truth. If a key is in DEPOSIT_LIST, it needs executing. If it is not, it has been executed or cancelled. Log execution results to structured JSON logs for post-mortem analysis. No DB needed. |
| **TransactionMonitor** (240 lines) | Monitors submitted TXs by polling the DB for SUBMITTED status and checking receipts. Detects MINED/REVERTED/DROPPED. But the minimal keeper already calls `waitForTransactionReceipt()` inline after submission -- it knows the TX outcome immediately. The monitor exists only because the old architecture recorded TXs to DB and checked them later. | Call `waitForTransactionReceipt()` after each `writeContract()`. Handle success/revert inline. No separate monitoring loop. |
| **Block number persistence to DB** | `EventListener` persists `lastProcessedBlock` to Prisma for backfill on restart. But on a 2-second Base Sepolia block time, the safety-net polling (every 15s) catches anything missed during a restart gap. The window of vulnerability is at most 15 seconds -- during which DataStore polling will find the operation anyway. | Drop block persistence entirely. On restart, start watching events from current block. The very first safety-net poll (at startup) catches any operations created during downtime. |
| **Per-type Scanner/Executor class hierarchies** | Three scanner classes (deposit, withdrawal, order) with nearly identical logic. Three executor classes with a BaseExecutor abstract class. Total: ~1,200 lines across 6 files. The actual difference per type is: which handler address to call, which ABI function to invoke, and which DataStore list key to read. | Single `execute(key, type)` function that dispatches to the correct handler address and function name based on type. Single `scan(type)` function parameterized by DataStore key. ~50 lines total replaces ~1,200. |
| **Pre-fetched operation data passthrough** | Scanners pre-fetch deposit/order details and pass them to executors as `operationData` to avoid a second RPC call. Adds type complexity (`OperationData` union types, `ScannedDeposit`, market data caching) across scanner and executor code. | Read operation details at execution time. One extra RPC call per execution is negligible at testnet volume. The simpler code path is worth the ~50ms extra latency. |
| **Separate HTTP server with controllers** | The existing keeper has an Express/Fastify-style HTTP server with route controllers for deposits, health checks, and metrics. Most of these endpoints are unused -- only `/health` matters. | Use `Bun.serve()` or `http.createServer()` with a single route handler. ~15 lines for the entire HTTP server. |
| **Queue with fail counts, retry backoff, TTL cleanup** | `ExecutionQueue` tracks failure counts per key, implements exponential backoff on retries (2s * 2^attempt), has a 5-minute TTL for known entries, and runs periodic cleanup. This is sophisticated retry logic -- but the retry behavior is already handled by the execution loop: if an execution fails, the key remains in the DataStore and will be re-discovered on the next poll cycle (15s). | Drop the queue retry machinery. Use a simple `Set<Hex>` for dedup. Failed executions: log the error, remove from dedup set. The next poll cycle re-discovers and re-attempts. Max retries are effectively infinite but bounded by the on-chain expiration time. |
| **Configurable feature flags (enableDeposits/enableWithdrawals/enableOrders)** | The existing config has toggles for each operation type. This was useful during iterative development (v1.0: deposits only, v1.1: add orders). The minimal rewrite handles all three from day one. | No per-type flags. The keeper executes everything in the DataStore. If an operation type is not wanted, do not create those requests on the frontend. |
| **Hermes feed registration and REST fetch for ALL tokens** | The existing keeper registers Hermes feeds for all 7 tokens as universal fallback. But for crypto tokens, Lazer always has data (the keeper verifies this at startup). Hermes REST is only actually needed for FX tokens. | Register Hermes feeds only for FX tokens. Lazer covers crypto. If Lazer cache is stale for crypto (rare), skip execution and wait for the next poll cycle rather than falling back to slow Hermes. Keep Hermes fallback for FX only. |
| **Multiple WebSocket pool connections** | `PythLazerClient` is configured with `numConnections: 4` for redundancy. For a testnet keeper processing <100 operations/day, a single connection with auto-reconnect is sufficient. | `numConnections: 1`. The SDK handles reconnection. |

## Feature Dependencies

```
EventEmitter WebSocket watcher ---\
                                   +--> In-memory dedup Set --> Sequential execution loop
DataStore polling safety net -----/                                     |
                                                                        v
                                                           Pyth Lazer price cache
                                                                        |
                                                                        v
                                                              Per-token oracle routing
                                                                        |
                                                                        v
                                                              TX submission + receipt wait
                                                                        |
                                                                        v
                                                              Log result (structured JSON)

Health endpoint (independent) --------> BetterStack monitoring

Startup verification (independent):
  - Oracle provider consistency check
  - Lazer feed entitlement verification

Periodic maintenance:
  - Expired request cancellation (every 5 min)
  - Dedup set TTL cleanup (every 30 min)
```

**Critical path:** Lazer WS connect -> feed verification -> event watcher start -> initial DataStore scan -> execution loop ready.

**No dependency on:** Database, block persistence, transaction monitoring, class hierarchies.

## MVP Recommendation

The minimal keeper should ship with ALL table stakes features from the start. This is not a phased rollout -- it is a single ~300 line file that replaces 3,000+ lines.

**Include (table stakes -- all in the initial rewrite):**
1. EventEmitter WebSocket watcher for real-time detection
2. DataStore polling every 10-15s as safety net
3. Sequential execution loop with in-memory dedup Set
4. Pyth Lazer WebSocket price cache (reuse existing PythLazerOracleService)
5. Per-token oracle routing (Lazer for crypto, Hermes for FX)
6. Fixed gas limit TX submission with nonce retry
7. Health endpoint for BetterStack
8. Graceful shutdown handlers
9. Pino structured logging

**Include (differentiators -- worth the ~50 extra lines):**
10. Startup oracle provider + feed entitlement verification
11. Expired request cancellation (periodic)
12. Execution timing instrumentation

**Defer:**
- DB-backed state tracking: not needed, on-chain DataStore is source of truth
- Block persistence: safety-net polling covers restart gaps
- Pre-fetched operation data: extra RPC call is negligible at testnet volume
- Per-type class hierarchies: parameterized functions are simpler
- Transaction monitoring: inline `waitForTransactionReceipt` handles this

## Complexity Budget

| Feature | Lines (est.) | Risk | Impact |
|---------|-------------|------|--------|
| Main loop + signal handlers | 30 | Very Low | Critical -- the skeleton |
| Event watcher (WS) | 40 | Low | Critical -- real-time detection |
| DataStore poller | 30 | Very Low | Critical -- safety net |
| Execution function (all 3 types) | 60 | Low | Critical -- the core job |
| Oracle params builder (Lazer + Hermes routing) | 40 | Low | Critical -- prices for execution |
| Pyth Lazer WS cache (reuse existing) | ~150 (existing) | Very Low | Critical -- price source |
| Health endpoint | 20 | Very Low | Critical -- monitoring |
| Startup verification | 40 | Very Low | High -- diagnostic |
| Expired request cleanup | 30 | Low | Medium -- user funds |
| Execution timing | 10 | Very Low | Medium -- observability |
| **Total new code** | **~300** | | |
| **Reused from existing** | **~150** (PythLazerOracleService) | | |

## What Gets Deleted

| Component | Lines | Reason for Removal |
|-----------|-------|-------------------|
| Prisma schema + models | 148 | On-chain DataStore is source of truth |
| store.ts (DB connection) | 42 | No database |
| DepositScanner | 328 | Replaced by parameterized scan function |
| WithdrawalScanner | 232 | Replaced by parameterized scan function |
| OrderScanner | 210 | Replaced by parameterized scan function |
| DepositExecutor | 293 | Replaced by single execute function |
| WithdrawalExecutor | ~230 | Replaced by single execute function |
| OrderExecutor | 221 | Replaced by single execute function |
| BaseExecutor (abstract) | 228 | No class hierarchy needed |
| ExecutionQueue | 151 | Replaced by Set + TTL |
| TransactionMonitor | 240 | Inline receipt checking |
| EventListener (Prisma-coupled) | 326 | Replaced by minimal event watcher |
| HTTP server + controllers | ~200 | Replaced by 20-line health server |
| Config with feature flags | ~150 | Simplified config |
| Scanner/executor type definitions | ~80 | Inline types |
| Test files for above | ~500 | New tests for new code |
| **Total removed** | **~3,500+** | |

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `order-execution-keeper-service/src/` -- all scanner, executor, queue, listener, monitor, oracle, and config code read in full
- [GMX Synthetics README](https://github.com/gmx-io/gmx-synthetics/blob/main/README.md) -- two-step execution model, keeper responsibilities, oracle price bundling pattern
- [GMX Synthetics OrderHandler.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/exchange/OrderHandler.sol/) -- keeper calls `executeOrder(key, oracleParams)`
- [Cyfrin/chainlink-gmx-automation](https://github.com/Cyfrin/chainlink-gmx-automation) -- reference implementation of event-driven deposit/withdrawal/order automation for GMX
- [Chainlink Automation Best Practices](https://docs.chain.link/chainlink-automation/concepts/best-practice) -- idempotency, condition checking, testing patterns
- [Chainlink Automation Architecture](https://docs.chain.link/chainlink-automation/concepts/automation-architecture) -- checkUpkeep/performUpkeep pattern (analogous to scan/execute)

### Secondary (MEDIUM confidence)
- [Cyfrin GMX Perpetuals Trading Course](https://updraft.cyfrin.io/courses/gmx-perpetuals-trading/foundation/gmx-contract-architecture) -- keeper architecture explanation, two-step execution model
- [GMX V2 Trading Docs](https://docs.gmx.io/docs/trading/v2/) -- keeper compensation, execution fee model
- [MEV bot templates](https://github.com/solidquant/mev-templates) -- minimal bot architecture patterns in TypeScript/Python/Rust
- [Cadence Protocol Decentralized Keepers](https://cadenceprotocol.gitbook.io/cadence-protocol/trading-on-cadence-protocol/decentralized-keepers) -- centralized keeper EOA pattern is standard for early-stage protocols

### Design Principles (HIGH confidence -- derived from analysis)
- **On-chain state is the source of truth:** If a key exists in DataStore's list, it needs executing. If it does not, it has been handled. No DB mirror needed.
- **Sequential execution for single-wallet keepers:** Nonce management is trivial when there is exactly one consumer. No mutex, no queue -- just a loop.
- **Event-first, poll-second:** WebSocket events provide sub-second detection. Polling provides crash recovery. Both feed into the same dedup set.
- **Inline oracle prices:** Pyth Lazer streams prices into cache. Execution reads from cache. No background on-chain price updates needed (v1.4 already disabled these due to nonce conflicts).
- **Generous gas limit over estimateGas:** Fixed gas limit saves an RPC round-trip. Only gas used is charged. testnet gas is free.

---
*Research completed: 2026-02-25*
*Replaces: v1.4 FEATURES.md (2026-02-24) -- v1.4 features are now SHIPPED; this covers v1.5 scope*
