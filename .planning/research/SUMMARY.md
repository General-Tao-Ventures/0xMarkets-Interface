# Project Research Summary

**Project:** 0xMarkets Keeper Speed Optimization (v1.3)
**Domain:** DeFi keeper/executor latency reduction — GMX-style two-phase perpetual futures
**Researched:** 2026-02-23
**Confidence:** HIGH

## Executive Summary

The order-execution-keeper-service currently executes deposits, withdrawals, and orders in 10-18 seconds end-to-end. The dominant bottleneck is not network speed or block time — it is polling architecture: a `setInterval` loop fires every 10 seconds, meaning detection alone adds 0-10s (average 5s) of dead time before execution begins. The secondary bottleneck is the oracle price update, which sends a full separate transaction and waits for its receipt before execution begins, adding another 2-8s per operation. Combined, these two wastes account for the majority of the total pipeline time. All other steps (reads, gas estimation, actual TX submission) are fast.

The recommended approach is a hybrid event-driven architecture: replace the 10s polling loop with a `watchContractEvent` listener on the EventEmitter contract using a dedicated WebSocket viem PublicClient, while retaining a reduced-frequency polling fallback (30s) as a safety net. An `ExecutionQueue` class handles deduplication between the two detection paths and preserves sequential nonce ordering. In parallel, the oracle price update path should be optimized by proactively caching prices from the existing Pyth Lazer WebSocket stream so that per-execution oracle updates are either eliminated or pre-staged. With these two changes, average execution time drops from ~13s to ~3-5s. No new npm packages are needed — all capabilities exist in viem v2.40.3.

The primary risk is architectural complexity introduced by mixing event-driven and polling paths without proper coordination. Four pitfalls must be designed in from the start: nonce collision prevention via a sequential ExecutionQueue, in-flight key deduplication to prevent double-execution from event+poll race conditions, block-number persistence for restart recovery via `getLogs` backfill, and a heartbeat-based health model to avoid false alerts during idle periods. Critically, viem's `watchContractEvent` silently falls back to HTTP polling when used with an `http()` transport — the event listener will compile and appear to work but deliver no latency improvement unless a dedicated `webSocket()` transport client is used and verified at startup.

## Key Findings

### Recommended Stack

No new packages are required. The entire optimization is achievable with viem's existing `webSocket` transport, `watchContractEvent`, and `fallback` transport — all stable, documented features at viem v2.40.3. The only external dependency change is a WebSocket-capable RPC endpoint; Alchemy's free tier for Base Sepolia (`wss://base-sepolia.g.alchemy.com/v2/<key>`) is the recommended choice based on reliability, rate limits, and free tier sufficiency for testnet traffic.

A critical implementation note from PITFALLS research: the `fallback([webSocket(), http()])` transport pattern does NOT produce a WebSocket-type client — viem Issue #776 confirms that the fallback transport type is "fallback," not "webSocket," and `watchContractEvent` falls back to HTTP polling. The correct approach is a dedicated WebSocket-only `PublicClient` for event subscriptions, kept separate from the existing HTTP client used for TX submission.

**Core technologies:**
- `viem webSocket()` transport — provides `eth_subscribe` push subscriptions for `watchContractEvent`; eliminates polling delay; built into viem ^2.40.3
- Dedicated WebSocket `PublicClient` (separate from HTTP client) — required for true `eth_subscribe` behavior; HTTP client unchanged for TX submission
- Alchemy Base Sepolia WSS endpoint — managed provider; reliable reconnection; known rate limits; free tier sufficient
- Pyth Lazer WebSocket `updateCache` (already in use) — existing price cache from the SDK; proactive caching strategy builds on this

**New configuration (no new packages):**
- `WS_RPC_URL=wss://base-sepolia.g.alchemy.com/v2/<key>` — both services
- `SCAN_INTERVAL_SECONDS=5` immediately (before WebSocket); `30` after WebSocket is live

### Expected Features

**Must have (table stakes — sub-10s target):**
- Event-driven detection via `watchContractEvent` on EventEmitter for `DepositCreated`, `WithdrawalCreated`, `OrderCreated` — eliminates the 0-10s polling lottery; saves 5s average
- `ExecutionQueue` with in-flight `Set<Hex>` deduplication — prevents nonce collisions and double-execution when event + polling both detect the same operation
- Reduced polling fallback (5s immediate; 30s post-WebSocket) — catches operations missed during WebSocket gaps; never remove entirely
- Block number persistence (`lastProcessedBlock` to DB) + `getLogs` backfill on startup — recovers missed events after restart
- Heartbeat-based health check — replaces execution-time staleness; fires unconditionally every 10s; health is liveness, not activity

**Should have (push below 5s average):**
- Oracle price pre-caching — proactive `updatePriceOnChain` on Pyth Lazer WebSocket messages instead of per-execution; eliminates 2-8s serial oracle TX
- `MarketCache` for immutable market data — caches `reader.getMarket()` results; saves ~300ms per execution
- Parallel scanning with `Promise.all()` across operation types — scan deposits, withdrawals, orders simultaneously
- Eliminate redundant executor chain reads — pass scanned data through to executor; stop re-reading what the scanner already read

**Defer (v2+):**
- Multi-wallet keeper with wallet pool — unnecessary for testnet volume; massive operational complexity
- Flashblocks-aware RPC (~200ms confirmations) — Base Sepolia testnet feature; verify availability from specific providers before planning
- Custom multicall contract for price+execution batching — high audit risk; verify if inline `oracleParams` already handles price freshness natively
- Mempool monitoring / frontrunning protection — no competition on own testnet contracts

### Architecture Approach

The target architecture introduces two new components (`EventListener`, `ExecutionQueue`) and modifies five existing components (`BaseExecutor`, three typed executors, `index.ts`). The `keeper-service` (port 37017) is explicitly out of scope for v1.3 — its liquidation scanning is a fundamentally different pattern requiring continuous position evaluation, not reaction to creation events. All changes target `order-execution-keeper-service` exclusively.

The build order follows dependency chains: `ExecutionQueue` first (no deps, pure in-memory data structure), then `WsPublicClient`, then `EventListener` (depends on both), then oracle optimization, then wire everything into `index.ts` drain loop, then health check overhaul. Each step is independently testable.

**Major components:**
1. `EventListener` (`core/listeners/eventListener.ts`) — watches EventEmitter via WebSocket `eth_subscribe`; extracts request key from event topic1; enqueues immediately; modeled on existing `confirmator.ts` pattern
2. `ExecutionQueue` (`core/queue/executionQueue.ts`) — in-memory FIFO with `pending: Map<Hex, ...>` and `processing: Set<Hex>`; single consumer preserves nonce ordering; `enqueue()` returns false if key already tracked
3. `MarketCache` (`core/cache/marketCache.ts`) — caches immutable `MarketInfo` keyed by market address; `getMarket()` reads chain once per market per process lifetime
4. `WsPublicClient` (`core/blockchain/wsClient.ts`) — dedicated WebSocket-only viem `PublicClient`; only created if `WS_RPC_URL` is set; falls back gracefully to HTTP polling if absent
5. Modified `index.ts` main loop — replaces `setInterval` + `isExecuting` boolean mutex with a queue drain loop; both `EventListener` and polling `Scanner` feed into shared `ExecutionQueue`

### Critical Pitfalls

1. **`watchContractEvent` silently uses HTTP polling with `http()` transport** — viem compiles and "works" but delivers no latency improvement; the existing `confirmator.ts` in keeper-service already exhibits this unknowingly. Fix: dedicated WebSocket-only `PublicClient`; verify `client.transport.type === "webSocket"` at startup.

2. **Nonce collision when event + poll execute concurrently** — `isExecuting` mutex protects the polling loop but event-triggered executions bypass it; two in-flight executions fetch the same pending nonce and collide. Fix: all executions (event or poll triggered) go through the single-consumer `ExecutionQueue`; never allow concurrent `executeItem()` calls.

3. **Double execution from event + polling race condition** — both paths detect the same pending operation within the same polling window; first execution succeeds, second wastes gas and logs misleading "EmptyDeposit" errors. Fix: `ExecutionQueue` in-flight `Set<Hex>`; scanner checks set before enqueueing.

4. **Silent WebSocket death without backfill** — WebSocket connections die silently (no error event); event listener stops receiving events; health endpoint still reports "ok." Fix: track `lastEventBlockSeen`; if delta from current block exceeds threshold, backfill via `getLogs`; keep 30s polling fallback.

5. **Health check false alerts during idle periods** — `lastExecutionTime` goes stale with no user activity; BetterStack alerts on a healthy but idle keeper. Fix: unconditional 10s heartbeat timer replaces `recordScanCycle()`; health = heartbeat liveness + event stream block delta, not execution activity.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Event-Driven Detection Foundation
**Rationale:** Detection latency (0-10s, avg 5s) is the single largest contributor to total execution time. All five architectural safety requirements (queue, deduplication, backfill, transport verification, heartbeat) must be built together — adding event listeners without these guards creates nonce collision and double-execution bugs that are worse than the original polling. This phase must ship as a complete unit.
**Delivers:** Sub-2s detection latency; hybrid event+polling architecture; nonce-safe sequential execution queue; restart recovery via block backfill; false-alert-free health monitoring
**Addresses:** Event-driven detection (table stakes #1), ExecutionQueue, in-flight deduplication, block persistence, heartbeat health model
**Avoids:** Pitfalls 1, 2, 3, 4, 6, 7 — all architectural safety pitfalls must be addressed here
**Build order within phase:** ExecutionQueue (no deps) → WsPublicClient → EventListener → reduce `SCAN_INTERVAL_SECONDS` to 5 → wire queue drain into `index.ts` → heartbeat health model

### Phase 2: Oracle Price Pipeline Optimization
**Rationale:** After detection is fast (<2s), the oracle price update (2-8s sequential TX + receipt wait) becomes the dominant bottleneck. This phase addresses it. The gating question — whether `executeDeposit` with inline oracle params already handles price freshness, making the separate `updatePriceOnChain()` TX unnecessary — must be investigated first; it determines whether this phase is "remove a TX" or "pipeline two TXs."
**Delivers:** Oracle price overhead reduced from 2-8s to 0-200ms; MarketCache eliminates repeated `reader.getMarket()` calls; redundant executor chain reads eliminated
**Uses:** Existing Pyth Lazer `updateCache` (already populated from WebSocket stream); viem `createNonceManager` if two-TX pipelining is required
**Implements:** Modified `BaseExecutor.buildOracleParams()` using cached prices; `MarketCache`; pass-through of scanned data to executor
**Avoids:** Gas waste from over-eager oracle updates; nonce gaps from `createNonceManager` on gas estimation failures (Pitfall 2 corollary — known viem Issue #3142)
**Research flag:** Investigate on-chain contract whether `oracleParams` struct passed to `executeDeposit` makes separate `updatePriceOnChain()` TX redundant. This is the largest unknown.

### Phase 3: Execution Pipeline Polish
**Rationale:** After the two dominant latency sources are addressed (polling delay in Phase 1, oracle TX in Phase 2), this phase removes remaining minor inefficiencies, adds observability, and tunes production configuration.
**Delivers:** Parallel scanning across all three operation types; latency percentiles (p50, p95) in health endpoint; polling fallback tuned to 30s; `SCAN_INTERVAL_SECONDS` doc updated
**Uses:** `Promise.all()` for scan phase; reduced fallback interval now that events handle fast path
**Implements:** Scanner reduced to key-only results; health endpoint enhanced with latency metrics

### Phase Ordering Rationale

- Phase 1 before Phase 2 because the queue infrastructure must exist before oracle pipelining adds concurrent TX submission complexity; also, oracle caching is less impactful if detection still takes 5s
- Phase 2 before Phase 3 because it delivers the second-largest absolute latency saving; Phase 3 is incremental
- The "Looks Done But Isn't" checklist from PITFALLS.md is the Phase 1 acceptance criteria: verify WebSocket transport type at startup, test gap backfill (stop event listener 60s → deposit → restart → verify caught by polling), test nonce under 3 concurrent deposits, test health idle for 5 minutes, test deduplication (event + poll detect same key → only one execution)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Oracle price contract behavior is the key unknown. Requires reading the deployed on-chain Pyth Lazer oracle handler to determine if `SetPricesParams.data` in `executeDeposit` accepts inline price data, making the separate `updatePriceOnChain()` TX redundant. Cannot be determined from keeper codebase alone — check contract source or test directly.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Fully documented viem patterns; `confirmator.ts` in keeper-service is the reference implementation; architecture is unambiguous.
- **Phase 3:** All changes are code restructuring; no new APIs; standard async Node.js patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against viem v2.40.3 docs; all features confirmed in current dependency; no new packages required |
| Features | HIGH | Derived from direct codebase analysis + GMX architecture + viem/Pyth official docs |
| Architecture | HIGH | Build order and component boundaries derived from existing `confirmator.ts` reference in codebase; component contracts are clear |
| Pitfalls | HIGH | Seven pitfalls with specific codebase line references; verified against viem issue tracker (Issues #776, #3142, #2325) and Chainstack guides |

**Overall confidence:** HIGH

### Gaps to Address

- **Oracle contract inline price support (Phase 2 gating):** Whether `executeDeposit` with inline Pyth Lazer oracle params makes the separate `updatePriceOnChain()` TX unnecessary. If supported: Phase 2 eliminates an entire transaction. If not: Phase 2 requires pipelining two TXs with explicit nonce management — more complex, must avoid the `createNonceManager` estimateGas gap bug (Issue #3142) by keeping the sequential queue for execution while only pipelining the oracle+exec TX pair.
- **viem fallback transport + eth_subscribe:** Issue #776 confirms that `fallback([webSocket, http])` transport type is "fallback" not "webSocket," causing `watchContractEvent` to fall back to HTTP polling. The implementation must use a dedicated WebSocket-only client for events. Verify this behavior in the actual viem version (2.40.3) before writing code.
- **Flashblocks RPC availability (potential Phase 3 enhancement):** If Alchemy or Chainstack supports Base Sepolia Flashblocks at the chosen tier, every `waitForTransactionReceipt` call drops from ~2s to ~200ms with a URL swap — potentially the highest ROI config change. Verify before finalizing Phase 3 scope.
- **EventEmitter event topic format:** The `test-deposit.mjs` file confirms `DepositCreated(bytes32,address)` with topic1 as the deposit key. Verify that `WithdrawalCreated` and `OrderCreated` follow the same pattern before implementing the EventListener.

## Sources

### Primary (HIGH confidence)
- [viem watchContractEvent documentation](https://viem.sh/docs/contract/watchContractEvent) — WebSocket subscription behavior, poll configuration
- [viem WebSocket Transport documentation](https://viem.sh/docs/clients/transports/websocket) — reconnect, keepAlive, transport setup
- [viem createNonceManager docs](https://viem.sh/docs/accounts/local/createNonceManager) — parallel nonce management API
- [GMX Synthetics architecture](https://github.com/gmx-io/gmx-synthetics) — keeper execution patterns, EventEmitter contract design
- [Pyth pull oracle documentation](https://docs.pyth.network/price-feeds/core/pull-updates) — inline oracle update pattern ("package update with transaction")
- [Base chain documentation](https://docs.base.org/base-chain/network-information/transaction-finality) — 2s block time confirmed
- Codebase analysis: `order-execution-keeper-service/src/` (all scanner, executor, oracle, config, health files)
- Codebase analysis: `keeper-service/src/core/confirmator.ts` — reference implementation for `watchContractEvent`

### Secondary (MEDIUM confidence)
- [Chainstack: Redundant Ethereum Event Listener](https://docs.chainstack.com/docs/ethereum-redundant-event-llstener-ethers-web3js) — backfill and gap detection strategies
- [viem fallback transport WebSocket bug (Issue #776)](https://github.com/wevm/viem/issues/776) — confirmed: fallback transport does not use `eth_subscribe`
- [viem nonceManager estimateGas bug (Issue #3142)](https://github.com/wevm/viem/issues/3142) — nonce gap risk with `createNonceManager` on gas estimation failure
- [viem WebSocket reconnect issues (Issues #2325, #877, #2563)](https://github.com/wevm/viem/issues/2325) — silent connection death patterns
- [Alchemy Base Sepolia RPC](https://www.alchemy.com/chain-connect/chain/base-sepolia-testnet) — WSS endpoint availability and free tier

### Tertiary (LOW confidence / needs validation)
- [Base Flashblocks documentation](https://docs.base.org/base-chain/flashblocks/apps) — 200ms preconfirmation feature; testnet-only; RPC provider support needs direct verification

---
*Research completed: 2026-02-23*
*Ready for roadmap: yes*
