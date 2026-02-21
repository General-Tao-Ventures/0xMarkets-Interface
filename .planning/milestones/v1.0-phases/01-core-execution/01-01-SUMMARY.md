---
phase: 01-core-execution
plan: 01
subsystem: infra
tags: [viem, typescript, keeper, deposit, oracle, pyth-lazer, base-sepolia]

# Dependency graph
requires: []
provides:
  - "Standalone test-deposit.mjs script to submit createDeposit on Base Sepolia"
  - "Ghost deposit key guard (CANCELLED not FAILED for zeroed-on-chain deposits)"
  - "Empty oracle token guard in buildOracleParams (explicit error instead of silent empty params)"
  - "Post-execution success logging with txHash, duration, block number"
affects: [02-core-execution, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stale deposit detection: check deposit.addresses.account === ZERO_ADDRESS before gas estimation"
    - "Zero-token guard: throw before buildOracleParams if token set is empty"
    - "Success timing: record startTime at execute() entry, log duration on confirmation"

key-files:
  created:
    - "/Users/ken/Projects/0xM/order-execution-keeper-service/scripts/test-deposit.mjs"
  modified:
    - "/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/depositExecutor.ts"
    - "/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/baseExecutor.ts"

key-decisions:
  - "Ghost deposits marked CANCELLED not FAILED: EmptyDeposit() is not an execution failure, it means the deposit struct was already consumed on-chain"
  - "buildOracleParams throws on empty tokens instead of returning empty params silently: empty oracle params cause downstream contract reverts that are hard to debug"
  - "waitForTransactionReceipt added after executeDeposit submission: confirms execution success before marking EXECUTED status"
  - "WebSocket disconnect fails individual deposit execution, not whole keeper process: safer option per research spec"

patterns-established:
  - "CANCELLED status for ghost/stale deposit keys that are zeroed on-chain"
  - "FAILED status only for genuine execution failures (malformed deposits, contract reverts)"
  - "EXECUTED status written after receipt confirmation (not just tx submission)"

requirements-completed: [EXEC-01, EXEC-02]

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 1 Plan 01: Test Deposit Script and Ghost Key Guard Summary

**Standalone viem test-deposit script + ghost key CANCELLED guard + empty oracle token throw to unblock end-to-end deposit execution**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-20T10:28:20Z
- **Completed:** 2026-02-20T10:32:03Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created `scripts/test-deposit.mjs` that submits a real createDeposit multicall to Base Sepolia using viem, with full step-by-step reporting and 120s GM balance polling
- Fixed `depositExecutor.ts` to mark ghost/stale deposits as CANCELLED (not FAILED) preventing the "all deposits are FAILED, nothing to execute" treadmill
- Fixed `baseExecutor.ts` to throw explicitly when oracle token list is empty instead of silently returning empty params (which caused mysterious downstream contract reverts)
- Added post-confirmation logging: txHash, duration in seconds, block number on successful executeDeposit

## Task Commits

Each task was committed atomically:

1. **Task 1: Create standalone test deposit script** - `d7edd52` (feat)
2. **Task 2: Fix deposit executor to guard against ghost keys and ensure oracle params** - `b25da85` (fix)

**Plan metadata:** (committed with SUMMARY.md below)

## Files Created/Modified

- `/Users/ken/Projects/0xM/order-execution-keeper-service/scripts/test-deposit.mjs` - Standalone viem script: approve mUSDC, submit createDeposit multicall (sendWnt + sendTokens + createDeposit), poll GM balance 120s
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/depositExecutor.ts` - Added zero-address guard (CANCELLED), empty token guard (FAILED+throw), waitForTransactionReceipt, EXECUTED status update, duration logging
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/baseExecutor.ts` - Added getPublicClient() protected method, buildOracleParams throws on empty tokens (instead of returning empty params), re-throws errors instead of falling back silently

## Decisions Made

- Ghost deposits are CANCELLED not FAILED: the `EmptyDeposit()` error from gas estimation means the deposit struct was already zeroed on-chain — not a keeper failure. Using CANCELLED prevents the deposit from being retried and makes the logs clearly distinguish stale ghost keys from genuine execution failures.
- `buildOracleParams` throws on empty tokens rather than returning `{tokens:[], providers:[], data:[]}`: the silent empty-params return was masking the root cause of `executeDeposit` reverts. Throwing makes the error surface at the right level.
- WebSocket disconnect fails individual deposit, not whole keeper: if Pyth Lazer WebSocket is down and cache is stale, we fail that specific execution and let the scanner loop retry on the next 10s cycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added waitForTransactionReceipt and EXECUTED status update**
- **Found during:** Task 2 (depositExecutor fixes)
- **Issue:** Original code submitted the executeDeposit tx and immediately recorded a SUBMITTED execution row, but never waited for the receipt or updated the deposit status to EXECUTED. On success, the deposit remained PENDING indefinitely, causing infinite retry loops.
- **Fix:** Added `publicClient.waitForTransactionReceipt()` after submission. On success, update status to EXECUTED and log confirmation details. On revert, set FAILED and throw.
- **Files modified:** `src/core/executors/depositExecutor.ts`, `src/core/executors/baseExecutor.ts` (getPublicClient exposed)
- **Verification:** TypeScript compiles cleanly, logic verified by code review
- **Committed in:** b25da85 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed catch block setting FAILED unconditionally**
- **Found during:** Task 2 (depositExecutor fixes)
- **Issue:** The original catch block always set status to FAILED, even when the code had already explicitly set it to CANCELLED (for ghost keys) or FAILED (for empty tokens). This caused a race condition where CANCELLED deposits could be overwritten with FAILED.
- **Fix:** In catch block, first check current status; only set FAILED if status is still PENDING.
- **Files modified:** `src/core/executors/depositExecutor.ts`
- **Verification:** TypeScript compiles, logic is clear
- **Committed in:** b25da85 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both auto-fixes essential for correctness. No scope creep.

## Issues Encountered

None — plan executed smoothly. TypeScript compiled cleanly on first attempt.

## User Setup Required

None - no external service configuration required.

The test script requires `TEST_PRIVATE_KEY` env var when running, but this is documented inline in the script.

## Next Phase Readiness

- Test script is ready to run: `TEST_PRIVATE_KEY=0x... node scripts/test-deposit.mjs`
- Keeper code fixes are ready to deploy to DO server (Plan 02 handles deployment)
- Ghost key handling now correct — fresh deposits will be detected, oracle params built, and executeDeposit called without false FAILED states blocking the queue
- TypeScript compiles cleanly — no blockers for deployment

## Self-Check: PASSED

- FOUND: `/Users/ken/Projects/0xM/order-execution-keeper-service/scripts/test-deposit.mjs`
- FOUND: `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/depositExecutor.ts`
- FOUND: `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/baseExecutor.ts`
- FOUND: Commit `d7edd52` (feat: test deposit script)
- FOUND: Commit `b25da85` (fix: ghost key guard + oracle params)
- TypeScript: PASS (npx tsc --noEmit)

---
*Phase: 01-core-execution*
*Completed: 2026-02-20*
