---
phase: 18-event-detection-and-toast-feedback
plan: 03
subsystem: events
tags: [react, ethers, polling, useEffect, deposits, withdrawals, toast]

# Dependency graph
requires:
  - phase: 18-01
    provides: "Polling fallback infrastructure (useExecutionPolling, watchOrderTxn, Phase A/B)"
provides:
  - "watchOrderTxn wired into deposit and withdrawal transaction flows"
  - "Stable polling interval that does not churn on status state changes"
affects: [toast-feedback, event-detection]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Optional watchOrderTxn param for backward-compatible tx hash registration"]

key-files:
  created: []
  modified:
    - src/domain/synthetics/markets/createDepositTxn.ts
    - src/domain/synthetics/markets/createWithdrawalTxn.ts
    - src/components/GmSwap/GmSwapBox/GmDepositWithdrawalBox/useDepositWithdrawalTransactions.tsx
    - src/context/SyntheticsEvents/useExecutionPolling.ts

key-decisions:
  - "watchOrderTxn is optional param so GLV callers are unaffected"
  - "Removed status objects from useEffect deps; read via refs for stable interval"

patterns-established:
  - "Optional watchOrderTxn pattern: new tx creation functions accept watchOrderTxn? and call it after callContract resolves"
  - "Ref-based polling: status objects read through refs inside setInterval, only structural deps (hashes, chainId, setters) in useEffect array"

requirements-completed: [DET-01, DET-02, DET-03, FB-01, FB-02, FB-03]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 18 Plan 03: Gap Closure Summary

**Wired watchOrderTxn into deposit/withdrawal flows and stabilized polling interval to prevent churn on status changes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T17:45:14Z
- **Completed:** 2026-02-26T17:48:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Deposit transactions now call watchOrderTxn(txHash) after being sent, enabling polling loop Phase A to detect DepositCreated events from tx receipts
- Withdrawal transactions now call watchOrderTxn(txHash) after being sent, enabling polling loop Phase A to detect WithdrawalCreated events from tx receipts
- Polling interval remains stable across status changes -- no more teardown/recreation cycle that prevented orders from being detected

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire watchOrderTxn into deposit and withdrawal transaction flows** - `a5cb07970` (fix)
2. **Task 2: Fix useExecutionPolling useEffect dependency array to prevent interval churn** - `3599a8b3a` (fix)

## Files Created/Modified
- `src/domain/synthetics/markets/createDepositTxn.ts` - Added watchOrderTxn to CreateDepositParams, call it with res.hash in .then() callback
- `src/domain/synthetics/markets/createWithdrawalTxn.ts` - Added watchOrderTxn to CreateWithdrawalParams, call it with res.hash in .then() callback
- `src/components/GmSwap/GmSwapBox/GmDepositWithdrawalBox/useDepositWithdrawalTransactions.tsx` - Destructured watchOrderTxn from useSyntheticsEvents, passed to both createDepositTxn and createWithdrawalTxn
- `src/context/SyntheticsEvents/useExecutionPolling.ts` - Removed depositStatuses/withdrawalStatuses/orderStatuses from useEffect deps array

## Decisions Made
- Made watchOrderTxn optional in both CreateDepositParams and CreateWithdrawalParams so GLV deposit/withdrawal callers are unaffected (they don't pass it)
- Used res?.hash guard to handle edge cases where callContract might return undefined (e.g., Tenderly simulation mode)
- Removed status objects from useEffect deps because they are already read via refs inside the poll function; including them caused interval churn

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three operation types (deposit, withdrawal, order) now correctly trigger the polling loop
- Phase A detects Created events from tx receipts, Phase B polls for Executed events via eth_getLogs
- Polling interval is stable and does not churn on status changes
- Ready for UAT validation of full toast lifecycle

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 18-event-detection-and-toast-feedback*
*Completed: 2026-02-26*
