---
phase: 14-execution-speed
plan: 02
subsystem: infra
tags: [performance, timing, instrumentation, pino, observability]

# Dependency graph
requires:
  - phase: 14-execution-speed
    provides: "Flashblocks RPC and tighter oracle intervals from Plan 01"
provides:
  - "Per-stage execution timing instrumentation (oracleBuildMs, gasEstimateMs, txSubmitMs, txConfirmMs, totalMs) on all three executors"
  - "orderExecutor now waits for TX confirmation and updates status to EXECUTED (aligned with deposit/withdrawal)"
affects: [order-execution-keeper-service, monitoring, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-timing-log, performance-now-instrumentation]

key-files:
  modified:
    - order-execution-keeper-service/src/core/executors/depositExecutor.ts
    - order-execution-keeper-service/src/core/executors/withdrawalExecutor.ts
    - order-execution-keeper-service/src/core/executors/orderExecutor.ts

key-decisions:
  - "performance.now() for all timing (monotonic, sub-ms precision) instead of Date.now()"
  - "Consistent timing field names across all three executors for unified log parsing"
  - "orderExecutor now waits for TX confirmation matching deposit/withdrawal behavior"

patterns-established:
  - "Structured timing log: every successful execution logs { timing: { oracleBuildMs, gasEstimateMs, txSubmitMs, txConfirmMs, totalMs } }"
  - "Values rounded to 1 decimal place via +(value).toFixed(1) for clean log output"

requirements-completed: [SPEED-04]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 14 Plan 02: Execution Timing Instrumentation Summary

**Per-stage performance.now() timing instrumentation on all three executors logging oracleBuildMs, gasEstimateMs, txSubmitMs, txConfirmMs, and totalMs on every successful execution**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T00:57:52Z
- **Completed:** 2026-02-25T00:59:37Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Added per-stage `performance.now()` timing instrumentation to depositExecutor, withdrawalExecutor, and orderExecutor
- Every successful execution now logs a structured `timing` object with 5 fields: oracleBuildMs, gasEstimateMs, txSubmitMs, txConfirmMs, totalMs
- Replaced `Date.now()` with monotonic `performance.now()` in depositExecutor for sub-millisecond precision
- Added `waitForTransactionReceipt` to orderExecutor (previously only submitted without waiting), aligning all three executors
- Added EXECUTED status update to orderExecutor after TX confirmation (previously missing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-stage performance.now() timing to all three executors** - `dfc9eb8` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/core/executors/depositExecutor.ts` - Replaced Date.now() with performance.now(), wrapped 4 stages with timing, enriched success log with timing breakdown
- `order-execution-keeper-service/src/core/executors/withdrawalExecutor.ts` - Added execStart timing, wrapped 4 stages, enriched success log with timing breakdown
- `order-execution-keeper-service/src/core/executors/orderExecutor.ts` - Added execStart timing, wrapped 3 stages, added waitForTransactionReceipt + EXECUTED status update, enriched success log

## Decisions Made
- Used `performance.now()` for all execution timing -- monotonic clock with sub-millisecond precision, immune to system clock adjustments
- Consistent field names (`oracleBuildMs`, `gasEstimateMs`, `txSubmitMs`, `txConfirmMs`, `totalMs`) across all three executors for unified log parsing and alerting
- Added `waitForTransactionReceipt` to orderExecutor to align with deposit/withdrawal executors -- enables measuring confirmation latency for orders too
- Added missing `orderRequest.update({ status: "EXECUTED" })` after order TX confirmation -- orderExecutor was the only executor that didn't mark requests as EXECUTED

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three executors now produce structured timing logs enabling latency regression detection
- Log output can be parsed by monitoring tools to track per-stage latency over time
- Phase 14 (Execution Speed) is now complete with both plans delivered

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 14-execution-speed*
*Completed: 2026-02-24*
