# Feature Landscape: Liquidation Keeper Verification and Performance (v1.7)

**Domain:** GMX-style perpetual futures liquidation keeper — verification + optimization of existing pipeline
**Researched:** 2026-02-27
**Milestone:** v1.7 Liquidation Readiness
**Overall confidence:** HIGH (based on direct source code analysis of keeper-service, contract code, and prior phase research)

## Context: What Already Exists

The keeper-service already has a complete liquidation pipeline. This milestone is not about building it — it's about verifying it works, fixing known bugs, and optimizing the hot path.

**Existing components (all in `keeper-service/src/core/`):**

| Component | File | Current Status |
|-----------|------|----------------|
| Position scanner | `scanner.ts` | Auto-discovers via DataStore POSITION_LIST, calls `Reader.isPositionLiquidatable()`, creates LiquidationCandidate records |
| Risk engine | `riskEngine.ts` | Local MMR-based check — currently bypassed in scan loop; scanner delegates to contract Reader instead |
| Executor | `executor.ts` | Builds oracle params from Pyth Lazer cache, calls `LiquidationHandler.executeLiquidation()` |
| Confirmator | `confirmator.ts` | Watches EventLog2 for OrderExecuted events, marks executions MINED |
| Position fetcher | `positionFetcher.ts` | Paginates over `Reader.getAccountPositions()` and DataStore `getBytes32ValuesAt()` sequentially |
| Oracle service | `pythLazerOracle.ts` | WebSocket cache of Lazer price updates at 200ms cadence; 7 tokens registered |
| Audit store | `store.ts` | PostgreSQL audit trail of snapshots, candidates, signed decisions, executions |

**Critical external dependency:** The scanner reads stored on-chain prices via `PythLazerFeedProvider.getStoredPrice()`. These prices are pushed by the order-execution-keeper's background Lazer updater (every 5s). This cross-service dependency must be verified before any liquidation execution test.

---

## Table Stakes

Features that must work correctly. Missing = liquidation keeper is not functional for this milestone.

| Feature | Why Required | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| Contract role verification: `LIQUIDATION_KEEPER` role | `LiquidationHandler.executeLiquidation()` has `onlyLiquidationKeeper` modifier. If the keeper wallet doesn't have this role, every call reverts at the gate. | Low | Unknown — not verified yet | Must check RoleStore for keeper wallet address before any execution test |
| Stored price freshness from order-execution-keeper | Scanner's `getTokenPrice()` reads `PythLazerFeedProvider.getStoredPrice()`. If the order-execution-keeper hasn't pushed a price in the last 60s, scanner skips the position. Executor's oracle params also rely on stored prices. | Medium | Architecture correct; cross-service dependency not live-verified | Verify end-to-end: order-execution-keeper running → stored prices present → keeper-service can read them |
| `Reader.isPositionLiquidatable()` returning accurate results | The scanner calls this with constructed MarketPrices. It must return `true` for a genuinely underwater position. | Medium | Contract logic correct per code review; needs a live test position | Requires creating an underwater position on Base Sepolia to confirm the full detection path |
| `executeLiquidation` not reverting | The full contract call must succeed. Depends on: correct oracle params, valid `(account, market, collateralToken, isLong)` tuple, and fresh prices. | Medium | Architecture correct per code review; not live-verified | |
| Contract bug fix: reversed markets (JPY/USD) | Known `division-by-zero` in OrderHandler.sol when `triggerPrice=0` for reversed markets. Blocks testing JPY/USD liquidations and affects any reversed-market order. | Medium | Bug confirmed in PROJECT.md (Phase 24 reference) | Must guard `triggerPrice` before division in the contract; redeploy; update all service configs |
| Candidate deduplication: no double-execution on same position | Once an `executeLiquidation` TX is submitted, the position is closed. A second TX on the same position key reverts (position doesn't exist). Without a guard, if the scan runs while a TX is in-flight, the position is submitted twice. | Low | `scanRunning` flag prevents overlapping scan cycles, but no in-flight deduplication across the scan-to-execute gap | A 30s scan interval with Flashblocks 200ms confirmations means the position is confirmed closed before the next scan. But a dedup guard is cheap insurance. |

## Differentiators

Features that improve speed and operational confidence without being strictly required for correctness.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Per-stage timing instrumentation | `performance.now()` at: scan start, per-position liquidatability check, oracle param build, TX submit, TX confirmation. Matches pattern from order-execution-keeper (Phase 14). Identifies bottlenecks. | Low | Node.js built-in; pino already in use; no new dependencies |
| Position-key deduplication guard in executor | Track recently submitted position keys (in-memory Map with ~60s TTL) to prevent submitting two TXs for the same position within one confirmation window. Defense against scanner running while TX is in-flight. | Low | New Map in executor; no DB change; complements existing `scanRunning` flag |
| `REVERTED` status for failed executions | Confirmator currently only handles the success path. If a TX mines but reverts (e.g., position recovered between detection and execution), the execution stays in SUBMITTED status forever. Check `receipt.status` and update to REVERTED. | Low | `publicClient.getTransactionReceipt()` already called in confirmator; just check `.status` |
| Batched multicall for position key discovery | Current `discoverAccountsWithPositions()` fetches each position key individually (N separate `getPosition()` calls inside a loop). With multicall enabled on publicClient, batch these into single round-trips. Materially faster with >50 open positions. | Medium | viem multicall already enabled in publicClient (`batch: { multicall: true }`); Reader ABI already imported; requires restructuring the per-key loop |
| Configurable scan interval tuning | `SCAN_INTERVAL_SECONDS` is already config-driven (default 30s). Document recommended values: 30s for testnet, 5–15s for mainnet. For v1.7, verify the default is sufficient given 200ms Flashblocks confirmations. | Very Low | Already implemented; needs documentation and verification only |
| Scan-cycle counters in health endpoint | Add `candidatesDetected`, `candidatesExecuted`, `candidatesFailed` counters to `/health` response. Current health tracks `lastScanAt` but not outcome counters. | Low | `healthState.ts` already exists; extend with a few new exported counters |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Parallel scan execution | Running two scan cycles concurrently risks double-submission. The `scanRunning` flag exists for this reason. Parallel scanning does not improve throughput for single-wallet execution. | Keep sequential scan with `scanRunning` guard |
| On-chain price pushes from keeper-service during liquidation | keeper-service and order-execution-keeper share the same keeper wallet. Pushing prices from keeper-service creates nonce conflicts. The existing design — read stored prices that order-execution-keeper pushes — is correct. | Rely on order-execution-keeper's 5s background price pushes; never call `updatePriceOnChain()` from keeper-service executor |
| Local `riskEngine.ts` MMR check in the scan loop | `riskEngine.ts` duplicates what `Reader.isPositionLiquidatable()` already does on-chain with accurate parameters. Running both adds ~1 RPC round-trip per position for no benefit. The scanner correctly delegates to the contract. | Leave riskEngine unused; do not wire it into the scan loop |
| Liquidation reward tracking | This contract does not pay liquidation bots. There is no keeper incentive to track or claim. | Omit entirely |
| Building `previewLiquidation` flow | `PreviewResult` type exists in `types.ts` and `preview.ts` is a stub. The `Reader.isPositionLiquidatable()` call already answers "should we liquidate?" No preview flow is needed for the verification goal. | Use existing `isPositionLiquidatable` result; delete stub or leave as-is |
| Multi-wallet executor | Multiple wallets require nonce coordination. Single wallet sequential model is correct for testnet. | One keeper wallet; optimize within that constraint |
| Cross-chain liquidation support | Protocol is Base Sepolia only. | Ignore |

## Feature Dependencies

```
Phase A: Contract Fix (prerequisite for reversed-market tests)
  OrderHandler.sol triggerPrice=0 guard
    -> redeploy contracts
    -> update all service configs (keeper-service, order-execution-keeper, squid, docs)
    -> unlocks JPY/USD liquidation testing

Phase B: Verification (prove existing pipeline works)
  LIQUIDATION_KEEPER role on keeper wallet
    -> required before executeLiquidation() can succeed

  order-execution-keeper price pushes running
    -> stored prices present in PythLazerFeedProvider
    -> scanner.getTokenPrice() returns non-null
    -> executor oracle params built with real price data

  Test position created and goes underwater
    -> Reader.isPositionLiquidatable() returns true
    -> Candidate created in PostgreSQL
    -> executor.execute() called
    -> LiquidationHandler.executeLiquidation() succeeds on-chain
    -> Confirmator sees OrderExecuted event
    -> Execution marked MINED

Phase C: Performance and Reliability (independent of Phase B outcome)
  Position-key deduplication guard (executor Map)
    -> independent; can be added before Phase B
    -> complements existing scanRunning flag

  REVERTED status in confirmator
    -> independent; add receipt.status check alongside existing MINED logic

  Per-stage timing instrumentation
    -> independent; no dependencies; adds observability

  Batched multicall for position discovery
    -> depends on publicClient multicall (already enabled)
    -> independent of Phases A and B
    -> only matters at scale (>50 positions)
```

## MVP Recommendation for v1.7

**Phase A: Contract Bug Fix (do first — prerequisite)**
1. Add `triggerPrice=0` guard in OrderHandler.sol for reversed markets
2. Redeploy; update all service configs; re-run E2E tests (expect 18/18 pass)

**Phase B: End-to-End Verification (core goal)**
3. Verify LIQUIDATION_KEEPER role granted to keeper wallet address on LiquidationHandler
4. Verify order-execution-keeper is running and stored prices are fresh (`getStoredPrice()` returns non-null with age <60s)
5. Create a test long/short position, reduce collateral below liquidation threshold (or use extreme market movement), confirm: scanner detects → executor submits → confirmator confirms

**Phase C: Reliability Hardening (once Phase B passes)**
6. Add position-key deduplication guard in executor (Map with 60s TTL)
7. Add `REVERTED` status handling in confirmator (check `receipt.status`)
8. Add per-stage timing instrumentation matching order-execution-keeper pattern

**Defer:**
- Batched multicall position discovery: only matters when >50 positions open on testnet. Premature optimization.
- Scan-cycle counters in health endpoint: useful but not blocking any verification step.

## What Makes a Liquidation Keeper Fast and Reliable

Based on analysis of the existing keeper-service codebase and prior phase research:

**Speed levers (ordered by impact for this system):**

1. **Oracle freshness at execution time** — The largest single source of reverts. If `PythLazerFeedProvider.getStoredPrice()` returns stale data (>60s old per scanner check, or >MAX_ORACLE_PRICE_AGE per contract check), the call reverts. The cross-service dependency on order-execution-keeper's 5s update cadence must be operationally stable.

2. **Scan interval** — 30s default means a liquidatable position sits unaddressed for up to 30s. For testnet acceptability is fine. For mainnet competition, 5–10s is the right target. This is a single config change.

3. **Account discovery efficiency** — Current `discoverAccountsWithPositions()` does N serial `getPosition()` calls inside a `getBytes32ValuesAt()` batch. With multicall batching, N calls become N/batchSize round-trips. With 100 positions, this changes from ~100 serial calls to 1 multicall. Large throughput improvement at scale; negligible at testnet scale.

4. **Flashblocks RPC for TX submission** — order-execution-keeper already uses Flashblocks (~200ms preconfirmations). keeper-service could adopt the same for `executeLiquidation` submission. However, scan interval dominates latency here: even with Flashblocks, if the next scan is 30s away, confirmation speed doesn't matter. Adopt Flashblocks only after reducing scan interval.

**Reliability levers (ordered by risk):**

1. **Cross-service oracle dependency** — The keeper-service has no price feed of its own; it reads prices that order-execution-keeper writes. If the order-execution-keeper restarts or misconfigures, stored prices go stale within 60s and all liquidations fail silently. Operational monitoring of both services together is critical.

2. **Deduplication guard** — Without an in-flight guard on position keys, a scan running while a liquidation TX is in-flight could submit a second TX on the same position. The second TX reverts (position closed) and wastes gas. Given 30s scan intervals and <200ms Flashblocks confirmations, the actual risk window is tiny — but the guard is 5 lines and eliminates it entirely.

3. **REVERTED tracking** — Without `receipt.status` checking in the confirmator, a reverted liquidation TX permanently stalls its execution record in SUBMITTED status. The next scan cycle will re-detect the position (still liquidatable, since the TX reverted) and attempt again — but the stale execution record creates noise.

4. **Role verification at startup** — If the keeper wallet loses the LIQUIDATION_KEEPER role (e.g., contract redeployment without re-granting), all executions will revert with AccessControl errors. A startup check that verifies the role prevents silent failure for the full keeper lifetime.

## Sources

- Direct source code analysis (HIGH confidence):
  - `keeper-service/src/core/scanner.ts` — full scan loop, account discovery, liquidatability check, oracle price read
  - `keeper-service/src/core/executor.ts` — oracle param building, gas estimation, TX submission, status tracking
  - `keeper-service/src/core/confirmator.ts` — event watching, MINED status update
  - `keeper-service/src/core/positionFetcher.ts` — sequential position fetching loop
  - `keeper-service/src/core/pythLazerOracle.ts` — 200ms WebSocket price cache
  - `keeper-service/src/index.ts` — scan loop, scan interval, startup sequence
  - `keeper-service/src/config.ts` — SCAN_INTERVAL_SECONDS default (30)
- Contract source analysis (HIGH confidence):
  - `0xmarkets_contract/contracts/exchange/LiquidationHandler.sol` — `onlyLiquidationKeeper` modifier, `withOraclePrices` modifier confirmed
  - `0xmarkets_contract/contracts/liquidation/LiquidationUtils.sol` — `triggerPrice=0` in liquidation order creation (source of reversed-market bug)
- `.planning/PROJECT.md` — milestone scope, known issues, keeper infrastructure, Oracle mode
- `.planning/phases/14-execution-speed/14-RESEARCH.md` — Flashblocks RPC patterns, per-stage timing, oracle sync patterns (HIGH confidence, verified in that phase)

---
*Research completed: 2026-02-27*
*Replaces: v1.5 FEATURES.md (2026-02-25) — that covered the minimal keeper rewrite; this covers v1.7 liquidation verification scope*
