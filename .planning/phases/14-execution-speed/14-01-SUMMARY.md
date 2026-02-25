---
phase: 14-execution-speed
plan: 01
subsystem: infra
tags: [flashblocks, viem, pyth-lazer, oracle, preconfirmation, rpc]

# Dependency graph
requires:
  - phase: 13-oracle-correctness
    provides: "Pyth Lazer oracle integration with background update loop and per-token entitlement"
provides:
  - "Flashblocks-enabled RPC configuration for ~200ms TX preconfirmations"
  - "5s background oracle update interval (halved from 10s)"
  - "30s safety margin for stored price freshness checks"
  - "Non-blocking execution path with Hermes fallback for stale prices"
affects: [order-execution-keeper-service, deployment]

# Tech tracking
tech-stack:
  added: [baseSepoliaPreconf]
  patterns: [flashblocks-preconfirmation, non-blocking-oracle-fallback]

key-files:
  modified:
    - order-execution-keeper-service/src/config.ts
    - order-execution-keeper-service/src/core/blockchain/client.ts
    - order-execution-keeper-service/src/core/executors/baseExecutor.ts
    - order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts
    - order-execution-keeper-service/.env.production.example

key-decisions:
  - "baseSepoliaPreconf chain provides automatic pending block tag for estimateGas/waitForTransactionReceipt"
  - "Stale Lazer prices fall back to Hermes rather than blocking — graceful degradation over correctness-at-cost"
  - "30s safety margin (up from 5s) accounts for 5s update interval with wide buffer"

patterns-established:
  - "Flashblocks fallback: config.flashblocksRpcUrl optional, falls back to config.rpcUrl when not set"
  - "Non-blocking oracle: execution path never calls updatePriceOnChain synchronously"

requirements-completed: [SPEED-01, SPEED-02, SPEED-03]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 14 Plan 01: Execution Speed Summary

**Flashblocks RPC with ~200ms preconfirmations, 5s oracle background updates, and non-blocking execution path eliminating 4-8s per-execution latency**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T00:52:52Z
- **Completed:** 2026-02-25T00:55:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Switched keeper to Flashblocks-enabled RPC via viem's baseSepoliaPreconf chain for ~200ms TX preconfirmations (down from 2-4s)
- Tightened background oracle update interval from 10s to 5s, keeping stored prices well within MAX_ORACLE_PRICE_AGE
- Eliminated synchronous updatePriceOnChain from the execution hot path -- stale Lazer tokens gracefully fall back to Hermes
- All changes are backward-compatible: FLASHBLOCKS_RPC_URL is optional, WebSocket client unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch to Flashblocks-enabled RPC via baseSepoliaPreconf** - `7dbee29` (feat)
2. **Task 2: Tighten background oracle interval and remove synchronous updatePriceOnChain from execution path** - `1544e6f` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/config.ts` - Added flashblocksRpcUrl config field
- `order-execution-keeper-service/src/core/blockchain/client.ts` - Flashblocks-aware chain and transport for public/wallet clients
- `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` - Changed BG_UPDATE_INTERVAL_MS from 10s to 5s
- `order-execution-keeper-service/src/core/executors/baseExecutor.ts` - Removed sync updatePriceOnChain, increased safety margin to 30s
- `order-execution-keeper-service/.env.production.example` - Documented FLASHBLOCKS_RPC_URL env var

## Decisions Made
- Used viem's built-in baseSepoliaPreconf chain which sets experimental_preconfirmationTime: 200 and uses pending block tag automatically
- Stale Lazer prices fall back to Hermes rather than blocking execution with a synchronous on-chain update -- prioritizes speed over guaranteed Lazer usage
- Safety margin increased from 5s to 30s to provide wide buffer with the tighter 5s update interval

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
To activate Flashblocks preconfirmations, set the FLASHBLOCKS_RPC_URL environment variable:
```
FLASHBLOCKS_RPC_URL=https://sepolia-preconf.base.org
```
Without this variable, the keeper falls back to the standard RPC_URL (no behavior change).

## Next Phase Readiness
- Flashblocks RPC and tighter oracle intervals are ready for production deployment
- Plan 14-02 can proceed with any remaining execution speed optimizations

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 14-execution-speed*
*Completed: 2026-02-24*
