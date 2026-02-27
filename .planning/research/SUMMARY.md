# Project Research Summary

**Project:** 0xMarkets v1.7 — Liquidation Readiness
**Domain:** GMX-style perpetual futures keeper service — contract bug fix + liquidation pipeline verification and optimization
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

v1.7 is a purely additive milestone on an otherwise operational system. The protocol stack (Hardhat 2.x + Foundry, TypeScript 5.x, viem 2.x, Prisma 5.x, Pyth Lazer) is fully in place and requires zero new dependencies. The work divides into three sequential, dependency-ordered streams: (1) fix a confirmed Solidity division-by-zero in `BaseOrderUtils.sol` for reversed markets (JPY/USD), redeploy `OrderHandler` and `ExchangeRouter`, and propagate addresses to all five services; (2) verify the existing liquidation pipeline end-to-end on Base Sepolia — roles, oracle freshness, a real underwater position, and DB state transitions; (3) harden reliability with deduplication guards, REVERTED status tracking, and timing instrumentation.

The recommended approach is strict sequential ordering: contract fix first, then verification, then optimization. Reversing this order is the primary anti-pattern. If multicall batching is applied before basic pipeline verification passes, any new failure is ambiguous. The codebase has a ready-made testnet test scaffold (`src/test/testnet/integration.test.ts`) that just needs its stub assertions filled in. Using this — not a separate test harness — is the right implementation path.

The dominant risk is not code complexity; it is integration surface. The liquidation keeper depends on the order-execution-keeper staying alive to push oracle prices on-chain. If `ORACLE_MODE` is left at the default `hermes` in docker-compose.yml, the keeper silently degrades the moment the order-execution-keeper restarts. Additionally, both keepers share a single wallet, creating a nonce race condition when a liquidation TX fires simultaneously with a deposit or order TX. For testnet verification, this is an acceptable documented risk. For production, separate wallets are mandatory. The contract redeploy also has a non-obvious trap: `ExchangeRouter` stores `OrderHandler` as an immutable constructor arg, so redeploying only `OrderHandler` silently leaves users broken while the keeper continues working.

---

## Key Findings

### Recommended Stack

No new dependencies are required for v1.7. The existing stack handles every work stream: viem `^2.40.3` already exposes `publicClient.multicall()` using Multicall3 (deployed at `0xcA11bde05977b3631167028862bE2a173976CA11` on Base Sepolia); vitest `^4.0.16` runs all testnet integration tests; Hardhat `^2.22.8` with `hardhat-deploy` and `hardhat-verify` handles the contract compile/deploy/verify cycle.

**Core technologies:**
- **TypeScript 5.x / Node 22 (Docker: node:22-slim):** Keeper service runtime — unchanged
- **viem `^2.40.3`:** Ethereum client with built-in multicall3 support — use `publicClient.multicall()` for batched position discovery; no extra library needed
- **Hardhat `^2.22.8` + hardhat-deploy + Foundry forge:** Contract compile, deploy, verify — existing scripts cover the full redeploy cycle
- **Solidity 0.8.24:** Contract language — fix targets `BaseOrderUtils.sol`; guard `sizeDeltaInTokens == 0` before the division
- **Prisma `^5.22.0` + PostgreSQL 16:** Audit trail for liquidation candidates/executions — schema unchanged for v1.7
- **@pythnetwork/pyth-lazer-sdk `^5.2.0`:** Oracle price cache — set `ORACLE_MODE=lazer` in keeper-service docker-compose.yml for independent oracle operation
- **pino `^10.3.1` + `performance.now()`:** Per-stage timing instrumentation — no new tooling needed

**What NOT to add:** Do not add ethers-multicall, BullMQ, clinic.js, Hardhat Ignition, or any separate profiling daemon. The bottleneck is network round-trips (RPC), not CPU, and viem already solves it.

### Expected Features

The pipeline is built. v1.7 is about proving it works and hardening it.

**Must have (table stakes — blocking for this milestone):**
- `LIQUIDATION_KEEPER` role granted to keeper wallet on `LiquidationHandler` — role may never have been verified; all executions revert without it
- `ORDER_HANDLER_ADDRESS` + `EXCHANGE_ROUTER_ADDRESS` propagated to all five services after redeploy — stale addresses cause silent partial failures
- Stored price freshness verified end-to-end: `order-execution-keeper` running, `getStoredPrice()` returning fresh data, scanner not skipping all positions
- `ORACLE_MODE=lazer` set in keeper-service docker-compose.yml — default `hermes` creates silent oracle dependency on order-execution-keeper uptime
- `Reader.isPositionLiquidatable()` returning `true` on a real underwater position, followed by `executeLiquidation` succeeding on-chain

**Should have (reliability hardening):**
- Position-key deduplication guard in executor (in-memory Map with 60s TTL) — prevents double-submission race within confirmation window
- `REVERTED` status in confirmator (`receipt.status` check) — eliminates permanently-stuck SUBMITTED records when a TX reverts
- Per-stage timing instrumentation with `performance.now()` — identifies bottlenecks, matches order-execution-keeper pattern from Phase 14

**Defer (post-v1.7):**
- Batched multicall for position discovery — correct optimization, negligible at testnet scale (<20 positions), matters only at 100+ open positions
- Event-based account registry via `PositionIncrease` events — eliminates the O(N) discovery scan entirely; premature until scale is demonstrated
- Separate wallets for keeper-service and order-execution-keeper — mandatory for production, acceptable documented risk for testnet
- `collateralUsd` calculation fix in `positionFetcher.ts` — data quality bug in risk scores but non-blocking for execution correctness
- Scan interval reduction to 5-10s — production requirement, unnecessary for verification

### Architecture Approach

The system is two Docker containers on a DigitalOcean droplet (`142.93.203.222`) sharing a PostgreSQL 16 database and a single Ethereum wallet. The keeper-service (port 37017) runs a 30-second scan loop: discover accounts via DataStore POSITION_LIST, batch-read positions, call `Reader.isPositionLiquidatable()` on-chain, build oracle params from Pyth Lazer cache, call `LiquidationHandler.executeLiquidation()`, then watch EventLog2 for confirmation. The order-execution-keeper (port 37018) handles deposits/withdrawals/orders and — critically — pushes Pyth prices on-chain every 5 seconds, which the liquidation scanner reads back via `PythLazerFeedProvider.getStoredPrice()`. This cross-service oracle dependency is the biggest operational risk.

**Major components:**
1. **`scanner.ts`** — Periodic scan loop; calls `Reader.isPositionLiquidatable()` directly (authoritative on-chain check); `riskEngine.ts` is dead code, do not wire it in
2. **`positionFetcher.ts`** — Account discovery via DataStore POSITION_LIST; current O(N) serial `getPosition()` calls per position key is the primary scale bottleneck; viem multicall fixes this
3. **`executor.ts`** — Builds oracle params from Pyth Lazer cache; calls `LiquidationHandler.executeLiquidation()`; has a redundant `fetchAccountPositions()` call that should use data already in the snapshot; lacks nonce management (risk when sharing wallet)
4. **`confirmator.ts`** — Watches EventLog2 via HTTP long-polling; updates execution status to MINED; needs `receipt.status` check for REVERTED handling
5. **`order-execution-keeper oracle.ts`** — Pushes prices to `PythLazerFeedProvider` every 5s; liquidation scanner's 60s staleness guard depends on this staying alive
6. **`BaseOrderUtils.sol`** — Bug site: `sizeDeltaInTokens == 0` for reversed markets causes division-by-zero; fix with a guard before the division
7. **`ExchangeRouter.sol`** — Immutable `orderHandler` constructor arg; MUST be redeployed atomically with OrderHandler or users remain broken

### Critical Pitfalls

1. **ExchangeRouter immutable constructor — redeploying OrderHandler alone silently fails users.** ExchangeRouter stores `orderHandler` as an `immutable` field baked into bytecode at construction time. If only `OrderHandler` is redeployed, the ExchangeRouter still routes to the old buggy contract. JPY orders continue to revert. Prevention: always deploy `ExchangeRouter` immediately after `OrderHandler` in a single atomic step; verify with `cast call <EXCHANGE_ROUTER> "orderHandler()(address)"`.

2. **CONTROLLER/ROUTER_PLUGIN roles not granted to new contracts after redeploy.** The `afterDeploy` hook in `deployOrderHandler.ts` calls `grantRoleIfNotGranted` — if this throws or is skipped (gas hiccup, nonce conflict), the new contract is deployed but non-functional. Prevention: explicitly verify all three roles with `cast call <ROLE_STORE> "hasRole(bytes32,address)(bool)"` after every redeploy.

3. **Stale addresses on the DO droplet live `.env` files.** Local config updates do not automatically reach `142.93.203.222`. If the droplet's `.env` is not updated and both keepers restarted, they continue calling old contracts. If old contract roles are revoked, all keeper TXs revert. Prevention: SSH to droplet immediately after local config update; restart both keeper containers.

4. **`ORACLE_MODE=hermes` (default) makes liquidation oracle silently dependent on order-execution-keeper uptime.** In Hermes mode, `pythLazerOracle` is null; executor passes `"0x"` as oracle data; liquidation handler reads from on-chain stored prices that order-execution-keeper pushes. If order-execution-keeper restarts, stored prices go stale within 60s and all liquidation scans silently skip every position. Prevention: set `ORACLE_MODE=lazer` in docker-compose.yml for keeper-service.

5. **Shared wallet nonce conflict between keeper-service and order-execution-keeper.** Both processes share the same `PRIVATE_KEY`. The order-execution-keeper has nonce recovery (`extractExpectedNonce`); the liquidation executor does not. A simultaneous liquidation TX + deposit TX causes one to fail with `nonce too low`. Prevention for v1.7: document as a known testnet risk. Full fix: give keeper-service its own funded wallet with `LIQUIDATION_KEEPER` role — zero code changes, just a new `.env` var and one `grantRole` transaction.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase A: Contract Bug Fix
**Rationale:** Unblocks JPY/USD liquidation testing and resolves the last known E2E test failure (1 skipped test from Phase 23). Must be first — downstream verification phases need a clean contract surface and a complete 18/18 E2E suite.
**Delivers:** Fixed `BaseOrderUtils.sol`; redeployed `OrderHandler` + `ExchangeRouter`; updated addresses across all five services and the DO droplet; 18/18 E2E tests passing.
**Addresses:** Table-stakes feature — contract bug fix for reversed markets.
**Avoids:** Pitfalls 1 (ExchangeRouter immutable), 2 (role grants), 3 (address propagation to droplet), and the SKIP_HANDLER_DEPLOYMENTS env var trap.
**Research flag:** Skip research-phase — patterns are fully documented in PITFALLS.md and the Phase 20 address audit protocol. Standard Hardhat deploy + verify cycle.

### Phase B: Liquidation Pipeline Verification
**Rationale:** Before any optimization, the basic pipeline must work end-to-end. Verification is a prerequisite so that optimizations fix performance, not correctness. The testnet integration test scaffold already exists; fill in the stub assertions rather than building a new test harness.
**Delivers:** Confirmed `LIQUIDATION_KEEPER` role on keeper wallet; confirmed oracle freshness end-to-end; a real underwater test position detected → executor submits → confirmator updates DB to EXECUTED; `ORACLE_MODE=lazer` set in docker-compose.yml.
**Addresses:** All table-stakes features; Pitfall 12 (LIQUIDATION_KEEPER role check); Pitfall 4 (oracle independence via `ORACLE_MODE=lazer`).
**Research flag:** Needs live testnet execution — Pitfall 11 (oracle timestamp drift in `withOraclePrices`) cannot be verified without an actual `executeLiquidation` TX on Basescan. No pre-planning research needed; the work IS the research.

### Phase C: Reliability Hardening
**Rationale:** Once Phase B proves correctness, add three low-cost reliability features that eliminate edge-case failure modes. Independent of Phase A/B in terms of code but should be deployed after Phase B confirms the pipeline works.
**Delivers:** Position-key deduplication guard in executor (in-memory Map, 60s TTL); REVERTED status handling in confirmator (`receipt.status` check); per-stage timing instrumentation (`performance.now()` at scan/check/submit/confirm boundaries).
**Addresses:** Differentiator features from FEATURES.md; reduces DB noise from benign FAILED candidates when position closes before execution.
**Research flag:** Skip research-phase — all three changes are small, well-understood TypeScript modifications. No external API or library research required.

### Phase D: Performance Optimization (defer post-v1.7 unless scale demands it)
**Rationale:** The O(N) serial `getPosition()` scan is a scale bottleneck, not a correctness issue. At testnet scale (5-20 open positions), it is immaterial. Defer until production scan cycle durations in logs exceed 10 seconds.
**Delivers:** Batched `multicall` in `discoverAccountsWithPositions()` (N serial calls → 1 RPC round-trip); eliminated redundant `fetchAccountPositions()` in executor; event-based account registry via `PositionIncrease` events (longer-term).
**Research flag:** Skip research-phase — viem multicall API is fully documented and already used in the codebase. The optimization is mechanical.

### Phase Ordering Rationale

- **A before B:** You cannot verify liquidation of JPY/USD positions if the contract panics on reversed-market orders. The E2E suite must be green before adding new verification tests — a mixed failure signal obscures which layer broke.
- **B before C:** Reliability hardening on a pipeline that has not been proven correct adds diagnostic noise. If the dedup guard is in place but the role check fails, the failure is harder to isolate.
- **B before D:** Multicall optimization changes the scan loop structure. If the unoptimized pipeline works, any regression from multicall is immediately attributable.
- **C and D can overlap in development** but C ships first because it has lower risk; D should wait for demonstrated scale need.

### Research Flags

Phases needing deeper investigation during planning or live execution:
- **Phase B (oracle timestamp validation):** Pitfall 11 requires live testnet execution to verify. If `executeLiquidation` reverts due to oracle timestamp drift, the fix path is not fully defined in current research. Plan to inspect the first execution TX on Basescan before declaring Phase B complete.
- **Phase A (ExchangeRouter address checklist):** Confirm which services reference `EXCHANGE_ROUTER_ADDRESS` (vs just `ORDER_HANDLER_ADDRESS`) before executing the address update checklist. The `.claude/contract-address-update-guide.md` may predate the ExchangeRouter as a tracked address.

Phases with standard, well-documented patterns (skip `/gsd:research-phase`):
- **Phase A (contract fix + redeploy):** Existing Hardhat pipeline; established post-deploy verification pattern from Phase 20.
- **Phase C (reliability hardening):** Pure TypeScript additions; no external APIs or library integration.
- **Phase D (multicall optimization):** viem multicall is stable API, already in use in the existing codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies confirmed from `package.json` files in both repos; no version gaps or conflicts identified |
| Features | HIGH | All features derived from direct source code analysis of scanner, executor, confirmator, positionFetcher |
| Architecture | HIGH | All integration points verified from actual source files; data flow traced end-to-end from scan loop to confirmator |
| Pitfalls | HIGH | Critical pitfalls 1-4 confirmed from deploy scripts and contract source; pitfalls 5-8 confirmed from keeper-service source |

**Overall confidence:** HIGH

### Gaps to Address

- **LIQUIDATION_KEEPER role status:** Unknown whether the keeper wallet currently has this role on `LiquidationHandler`. Must be checked with `cast call` before Phase B begins. If not granted, requires a `grantRole` transaction from the RoleStore admin key.
- **Oracle timestamp drift (Pitfall 11):** The `withOraclePrices` timestamp validation is a known risk but its real-world behavior on Base Sepolia is unverified. Treat Phase B's first successful `executeLiquidation` TX as the validation event. If it reverts with an oracle error, investigate timestamp fields in the stored price struct.
- **ExchangeRouter in the address checklist:** `.claude/contract-address-update-guide.md` may list `ORDER_HANDLER_ADDRESS` but not `EXCHANGE_ROUTER_ADDRESS` for all services. Confirm coverage before Phase A address propagation.
- **SKIP_HANDLER_DEPLOYMENTS in CI/shell:** If anyone has this env var set in their local shell from prior work, the Phase A redeploy will silently no-op. Add an explicit `echo $SKIP_HANDLER_DEPLOYMENTS` pre-flight check to the phase plan.

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `keeper-service/package.json` — confirmed Prisma 5.22.0, vitest 4.0.16, viem 2.40.3
- `keeper-service/src/core/scanner.ts` — full scan loop; riskEngine confirmed bypassed; O(N) serial RPC pattern confirmed
- `keeper-service/src/core/executor.ts` — no nonce management; double-fetch pattern; gas estimation flow
- `keeper-service/src/core/positionFetcher.ts` — O(N) serial `getPosition()` calls; `collateralUsd` = raw token amount bug
- `keeper-service/src/core/confirmator.ts` — HTTP long-poll; success-path only (no REVERTED handling)
- `keeper-service/src/core/pythLazerOracle.ts` — 200ms WebSocket cache; 4-connection pool
- `keeper-service/src/index.ts` — scan loop, ORACLE_MODE handling, startup sequence
- `keeper-service/src/config.ts` — ORACLE_MODE defaults to "hermes"; SCAN_INTERVAL_SECONDS defaults to 30
- `order-execution-keeper-service/src/executor.ts` — `extractExpectedNonce`, sequential execution, nonce recovery pattern
- `order-execution-keeper-service/src/oracle.ts` — 5s background price push cadence
- `0xmarkets_contract/package.json` — hardhat ^2.22.8, hardhat-deploy ^0.11.25, hardhat-verify ^2.0.11
- `0xmarkets_contract/hardhat.config.ts` — baseSepolia network config, Solidity 0.8.24, optimizer runs: 10
- `0xmarkets_contract/deploy/deployOrderHandler.ts` — `SKIP_HANDLER_DEPLOYMENTS` skip logic, afterDeploy role grants
- `0xmarkets_contract/deploy/deployExchangeRouter.ts` — immutable OrderHandler constructor arg confirmed
- `0xmarkets_contract/contracts/exchange/LiquidationHandler.sol` — `onlyLiquidationKeeper` modifier, `executeLiquidation` signature
- `0xmarkets_contract/contracts/order/BaseOrderUtils.sol` — division-by-zero bug location confirmed
- `docker-compose.yml` — two-container deployment, shared postgres, shared wallet
- `.planning/PROJECT.md` — v1.7 milestone scope, single-wallet decision, pending liquidation verification note

### Secondary (MEDIUM confidence)
- viem documentation: `publicClient.multicall()` — stable API since viem 1.x; Multicall3 auto-detected on Base Sepolia
- Multicall3 canonical address `0xcA11bde05977b3631167028862bE2a173976CA11` — standard EVM deployment confirmed on Base Sepolia
- `.planning/phases/14-execution-speed/14-RESEARCH.md` — Flashblocks RPC patterns, per-stage timing; patterns reused for Phase C instrumentation

---
*Research completed: 2026-02-27*
*Replaces: v1.5 SUMMARY.md (2026-02-25) — that covered the minimal keeper rewrite; this covers v1.7 liquidation readiness scope*
*Ready for roadmap: yes*
