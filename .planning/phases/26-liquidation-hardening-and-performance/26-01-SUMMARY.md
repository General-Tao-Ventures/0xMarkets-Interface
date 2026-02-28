---
phase: 26-liquidation-hardening-and-performance
plan: 01
subsystem: infra
tags: [viem, liquidation, dedup, revert-tracking, keeper]

# Dependency graph
requires:
  - phase: 25-liquidation-pipeline-verification
    provides: Scanner with on-chain Reader.isPositionLiquidatable and executor with gas estimation
provides:
  - Deduplication guard preventing double-submission within 60s TTL
  - Receipt watcher detecting reverted TXs and recording REVERTED status
  - Dead code cleanup (riskEngine.ts removed)
affects: [26-02-PLAN, liquidation-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget receipt watching, in-memory dedup with TTL]

key-files:
  created: []
  modified:
    - keeper-service/src/core/scanner.ts
    - keeper-service/src/core/executor.ts
  deleted:
    - keeper-service/src/core/riskEngine.ts

key-decisions:
  - "Dedup guard is separate from failedCooldown -- different purpose (60s submission window vs 5min gas-estimation failure)"
  - "Receipt watcher uses fire-and-forget pattern to not block executor from processing other candidates"
  - "Timeout errors in receipt watcher are logged but do not update status (defer to stuck detection in future phase)"

patterns-established:
  - "In-memory TTL Map for deduplication: submissionDedup with isDuplicate() check"
  - "Fire-and-forget receipt watcher: watchReceipt() called with .catch() after execution recording"

requirements-completed: [LHARD-01, LHARD-02, LHARD-03]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 26 Plan 01: Liquidation Hardening Summary

**Deduplication guard preventing double-submission and receipt watcher tracking reverted TXs in the liquidation pipeline**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T17:47:04Z
- **Completed:** 2026-02-28T17:48:58Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 deleted)

## Accomplishments
- Added in-memory deduplication guard to scanner with 60-second TTL preventing same position from being submitted twice in consecutive scan cycles
- Added non-blocking receipt watcher to executor that detects reverted transactions and updates DB status to REVERTED
- Removed dead code riskEngine.ts (superseded by on-chain Reader.isPositionLiquidatable in Phase 25)
- TypeScript compilation passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deduplication guard to scanner and delete riskEngine.ts** - `762b576` (feat)
2. **Task 2: Add revert tracking to executor via receipt watcher** - `af79c95` (feat)

## Files Created/Modified
- `keeper-service/src/core/scanner.ts` - Added submissionDedup Map, isDuplicate() method, DEDUP_TTL_MS constant, dedup check before market lookup, submission recording after execute
- `keeper-service/src/core/executor.ts` - Added watchReceipt() method with 120s timeout, WaitForTransactionReceiptTimeoutError handling, fire-and-forget call after execution recording
- `keeper-service/src/core/riskEngine.ts` - DELETED (dead code, zero imports)

## Decisions Made
- Dedup guard is intentionally separate from failedCooldown (different lifecycle: 60s for successful submissions vs 5min for gas-estimation failures)
- Receipt watcher is fire-and-forget to avoid blocking the executor loop for other candidates
- WaitForTransactionReceiptTimeoutError is logged but does not update status (stuck detection is deferred to a future phase)
- Revert reason is kept simple (block number only) -- debug_traceTransaction is unreliable for revert reason extraction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hardened scanner and executor ready for Phase 26 Plan 02 (multicall batching and performance)
- LIQ-03/LIQ-04 E2E retry still blocked on pool liquidity (>$5000 needed)

## Self-Check: PASSED

All artifacts verified:
- scanner.ts: FOUND (with submissionDedup, isDuplicate, DEDUP_TTL_MS)
- executor.ts: FOUND (with watchReceipt, waitForTransactionReceipt, REVERTED)
- riskEngine.ts: CONFIRMED DELETED
- SUMMARY.md: FOUND
- Commit 762b576: FOUND
- Commit af79c95: FOUND

---
*Phase: 26-liquidation-hardening-and-performance*
*Completed: 2026-02-28*
