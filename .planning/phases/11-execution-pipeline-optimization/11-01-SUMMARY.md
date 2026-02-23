---
phase: 11-execution-pipeline-optimization
plan: 01
subsystem: oracle
tags: [pyth-lazer, oracle, background-updater, price-freshness, viem, nonce-coordination]

# Dependency graph
requires:
  - phase: 10-event-driven-detection
    provides: "Queue-driven execution architecture with drainQueue single-consumer loop"
provides:
  - "Background oracle price updater with enable/disable and per-token throttle"
  - "Conditional oracle freshness check in buildOracleParams (isStoredPriceFresh)"
  - "Nonce coordination between background updater and execution queue"
  - "MAX_ORACLE_PRICE_AGE_KEY for DataStore lookups"
affects: [11-02, execution-pipeline, oracle]

# Tech tracking
tech-stack:
  added: []
  patterns: ["background fire-and-forget update on WebSocket message", "conditional skip via on-chain freshness check", "disable/enable coordination for nonce safety"]

key-files:
  created: []
  modified:
    - order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts
    - order-execution-keeper-service/src/core/executors/baseExecutor.ts
    - order-execution-keeper-service/src/index.ts
    - order-execution-keeper-service/src/core/utils/keys.ts

key-decisions:
  - "10s per-token background update interval balances freshness vs gas cost"
  - "Nonce coordination via disable/enable pattern around drainQueue execution (simplest, zero-complexity)"
  - "5s safety margin on MAX_ORACLE_PRICE_AGE for block propagation delay"

patterns-established:
  - "Background updater: fire-and-forget triggerBackgroundUpdate on every WebSocket binary message"
  - "Nonce coordination: disable background updates in drainQueue try, re-enable in finally"
  - "Conditional oracle: isStoredPriceFresh reads on-chain stored price before deciding to send TX"

requirements-completed: [EXEC-03]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 11 Plan 01: Background Oracle Updater Summary

**Proactive background oracle price updates via Pyth Lazer WebSocket with conditional freshness check eliminating 2-8s synchronous TX per execution**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T22:41:05Z
- **Completed:** 2026-02-23T22:44:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PythLazerOracleService proactively updates on-chain stored prices every ~10s per token via background loop triggered by WebSocket messages
- BaseExecutor.buildOracleParams checks on-chain stored price freshness (~50ms readContract) before deciding to send a full updatePriceOnChain TX (2-8s)
- Nonce coordination in drainQueue ensures no collisions between background updater and execution transactions
- Falls back to synchronous update when stored price is stale (no regression from current behavior)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add background oracle updater and conditional freshness check** - `8ce7d46` (feat)
2. **Task 2: Wire background updater lifecycle and nonce coordination** - `698cead` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` - Background update fields, enable/disable/busy methods, triggerBackgroundUpdate hooked into handlePriceUpdate
- `order-execution-keeper-service/src/core/executors/baseExecutor.ts` - isStoredPriceFresh method, conditional oracle update in buildOracleParams, MAX_ORACLE_PRICE_AGE caching
- `order-execution-keeper-service/src/index.ts` - Background updater lifecycle (enable after init, disable during execution, disable on shutdown)
- `order-execution-keeper-service/src/core/utils/keys.ts` - MAX_ORACLE_PRICE_AGE_KEY constant

## Decisions Made
- 10s per-token background update interval: balances price freshness vs gas cost; with 7 tokens that is ~1 TX every 1.4s worst case
- Nonce coordination via disable/enable pattern: simplest approach, zero added complexity vs nonce locks or queue routing
- 5s safety margin on MAX_ORACLE_PRICE_AGE comparison: accounts for block propagation delay between keeper clock and chain timestamp
- MAX_ORACLE_PRICE_AGE cached once from DataStore (does not change frequently); avoids repeated on-chain reads

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Background oracle updater is functional and integrated into the execution pipeline
- Ready for Plan 02 (scanner data passthrough / redundant read elimination)

## Self-Check: PASSED

- All 4 modified files exist on disk
- Commit `8ce7d46` (Task 1) found in git log
- Commit `698cead` (Task 2) found in git log
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

---
*Phase: 11-execution-pipeline-optimization*
*Completed: 2026-02-23*
