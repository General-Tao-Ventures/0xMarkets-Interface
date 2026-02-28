---
phase: 26-liquidation-hardening-and-performance
plan: 02
subsystem: keeper
tags: [multicall, viem, pino, observability, rpc-optimization]

# Dependency graph
requires:
  - phase: 26-01
    provides: "Dedup guard, revert tracking, dead code cleanup in scanner/executor"
provides:
  - "Multicall batching for position discovery (N serial calls -> 1 per batch of 100)"
  - "Position data reuse from scanner to executor (eliminates redundant fetchPositionByKey RPC)"
  - "Per-stage timing instrumentation across scanner, executor, and confirmator"
affects: [liquidation-pipeline, keeper-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [multicall-batching, position-data-pipeline, structured-timing-logs]

key-files:
  created: []
  modified:
    - keeper-service/src/core/positionFetcher.ts
    - keeper-service/src/core/scanner.ts
    - keeper-service/src/core/executor.ts
    - keeper-service/src/core/confirmator.ts

key-decisions:
  - "Kept allowFailure:true on multicall so individual position failures don't break the batch"
  - "Preserved fetchPositionByKey fallback in executor for independent calls (not via scanner)"
  - "Timing logged as structured pino fields (not string interpolation) for machine-parseable observability"

patterns-established:
  - "Multicall batching: use publicClient.multicall() with allowFailure:true for batch RPC calls"
  - "Data pipeline: pass computed data through call chain instead of re-fetching from chain"
  - "Structured timing: capture Date.now() at stage boundaries and log durations as numeric pino fields"

requirements-completed: [LHARD-04, LPERF-01, LPERF-02]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 26 Plan 02: Performance & Observability Summary

**Multicall batching for position discovery, position data reuse eliminating redundant RPC fetch, and per-stage timing instrumentation across all pipeline stages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T17:51:44Z
- **Completed:** 2026-02-28T17:54:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Position discovery now uses a single multicall RPC request per batch of 100 instead of N serial getPosition() calls
- Executor reads collateralToken and isLong from scanner-provided data, falling back to on-chain fetch only when called independently
- All three pipeline stages (scanner, executor, confirmator) log timing durations as structured pino fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add multicall batching to positionFetcher and timing instrumentation to scanner** - `13c8893` (perf)
2. **Task 2: Eliminate redundant RPC fetch in executor and add timing to executor + confirmator** - `34e46f3` (perf)

## Files Created/Modified
- `keeper-service/src/core/positionFetcher.ts` - Replaced serial getPosition loop with publicClient.multicall() in discoverAccountsWithPositions()
- `keeper-service/src/core/scanner.ts` - Added per-stage timing (price, discovery, fetch, check, total) and position data passthrough to executor
- `keeper-service/src/core/executor.ts` - Added optional positionData parameter and submitDurationMs timing log
- `keeper-service/src/core/confirmator.ts` - Added confirmDurationMs timing log to handleEvent()

## Decisions Made
- Kept `allowFailure: true` on multicall so individual position key failures log a warning but don't break the entire batch
- Preserved `fetchPositionByKey` as a fallback in executor for cases where it is called independently (not via scanner pipeline)
- All timing values logged as numeric pino fields (`totalDurationMs`, `submitDurationMs`, `confirmDurationMs`) for structured log queries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 26 (Liquidation Hardening and Performance) is fully complete
- All LHARD and LPERF requirements addressed across Plans 01 and 02
- LIQ-03/LIQ-04 (testnet liquidation execution) remain deferred until pool has sufficient liquidity (>$5000)

## Self-Check: PASSED

All files found, all commits verified.

---
*Phase: 26-liquidation-hardening-and-performance*
*Completed: 2026-02-28*
