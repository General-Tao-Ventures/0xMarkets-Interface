---
phase: 02-keeper-resilience
plan: 01
subsystem: api
tags: [prisma, retry, backoff, error-handling, keeper, viem]

# Dependency graph
requires:
  - phase: 01-core-execution
    provides: "DepositExecutor with execute() method and Prisma schema with DepositRequest model"
provides:
  - "Retry loop with exponential backoff on deposit execution"
  - "Error classification (permanent vs transient) for deposit failures"
  - "errorReason and retryCount fields on DepositRequest for debugging"
  - "LIFE-04 documentation on sequential execution preventing nonce collisions"
affects: [02-keeper-resilience, withdrawal-executor, order-executor]

# Tech tracking
tech-stack:
  added: []
  patterns: [retry-with-backoff, error-classification, fail-fast-permanent-errors]

key-files:
  created:
    - "order-execution-keeper-service/prisma/migrations/20260220172547_add_error_reason_retry_count/migration.sql"
  modified:
    - "order-execution-keeper-service/prisma/schema.prisma"
    - "order-execution-keeper-service/src/core/executors/depositExecutor.ts"
    - "order-execution-keeper-service/src/index.ts"

key-decisions:
  - "Unknown errors (neither permanent nor transient) are retried — safer to retry than to fail-fast on unclassified errors"
  - "recordFailure wraps DB update in try/catch to avoid masking original error if DB write itself fails"
  - "CANCELLED status writes for ghost/stale deposits stay in executeOnce as early returns (not thrown errors)"

patterns-established:
  - "Retry pattern: for-loop wrapper with isPermanentError check, exponential backoff, recordFailure on exhaustion"
  - "Error classification: isPermanentError for contract-level errors, isTransientError for network/RPC errors"

requirements-completed: [EXEC-03, EXEC-04, LIFE-04]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 2 Plan 1: Deposit Retry with Backoff Summary

**Exponential backoff retry loop (3 attempts, 2s/4s) on deposit execution with error classification and errorReason recording in Prisma**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T17:25:13Z
- **Completed:** 2026-02-20T17:27:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `errorReason` (String?) and `retryCount` (Int, default 0) fields to DepositRequest Prisma schema with generated migration
- Refactored depositExecutor.ts with retry wrapper: transient errors retry up to 3 times with 2s/4s exponential backoff; permanent errors (EmptyDeposit, contract revert, oracle expiry) fail immediately
- Error reason truncated to 500 chars and stored in DB on final failure for debugging without Docker logs
- Added LIFE-04 comment in index.ts documenting sequential execution loop as intentional nonce-collision prevention

## Task Commits

Each task was committed atomically:

1. **Task 1: Add errorReason and retryCount fields to Prisma schema + generate migration** - `cb6cbff` (feat)
2. **Task 2: Add retry loop with backoff, error classification, and error recording to depositExecutor.ts** - `3033305` (feat)

## Files Created/Modified
- `order-execution-keeper-service/prisma/schema.prisma` - Added errorReason and retryCount fields to DepositRequest model
- `order-execution-keeper-service/prisma/migrations/20260220172547_add_error_reason_retry_count/migration.sql` - ALTER TABLE adding two new columns
- `order-execution-keeper-service/src/core/executors/depositExecutor.ts` - Retry loop with backoff, error classification, error recording
- `order-execution-keeper-service/src/index.ts` - LIFE-04 documentation comment on sequential deposit execution

## Decisions Made
- Unknown errors (neither permanent nor transient) are retried rather than failed immediately — safer to assume retryable when unsure
- recordFailure wraps the DB update in try/catch so an error writing the failure reason does not mask the original execution error
- Ghost/stale deposit CANCELLED writes remain as early returns in executeOnce (not thrown), since they are not execution failures and should not trigger retry

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Migration will be applied on server during deployment.

## Next Phase Readiness
- Retry pattern established and ready to replicate for withdrawal and order executors
- errorReason field available for future monitoring/alerting integration
- LIFE-04 documented for future engineers working on concurrent execution

## Self-Check: PASSED

- All 4 modified/created files exist on disk
- Commit `cb6cbff` found in git log (Task 1)
- Commit `3033305` found in git log (Task 2)

---
*Phase: 02-keeper-resilience*
*Completed: 2026-02-20*
