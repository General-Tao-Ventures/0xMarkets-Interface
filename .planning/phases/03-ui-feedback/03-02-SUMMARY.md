---
phase: 03-ui-feedback
plan: 02
subsystem: ui
tags: [react, hooks, ethers, i18n, lingui, notification, deposit-lifecycle]

# Dependency graph
requires:
  - phase: 03-ui-feedback/03-01
    provides: "Keeper deposit status API endpoint with CORS for fetching error reasons"
  - phase: 02-keeper-resilience
    provides: "Error recording in DB, expired deposit cancellation"
provides:
  - "useDepositElapsed hook for real-time elapsed time tracking in notifications"
  - "cancelDepositTxn function for user-initiated on-chain deposit cancellation"
  - "Enhanced GmStatusNotification with dynamic status, timeout warnings, cancel button, and actionable errors"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Elapsed time hook pattern: useState + useEffect + setInterval for live counters"
    - "Cancel transaction pattern: mirrors cancelOrdersTxn for ExchangeRouter.cancelDeposit"
    - "Keeper API integration: fetch error reason from keeper on cancellation event"

key-files:
  created:
    - src/components/StatusNotification/useDepositTimeout.ts
    - src/domain/synthetics/markets/cancelDepositTxn.ts
  modified:
    - src/components/StatusNotification/GmStatusNotification.tsx
    - src/locales/en/messages.po (+ 8 other locale catalogs)

key-decisions:
  - "Elapsed time thresholds: 0-15s silent wait, 15-60s show counter, 60-120s warning, 120s+ cancel button"
  - "Cancel button uses ExchangeRouter.cancelDeposit(key) via user's wallet signer"
  - "Keeper error reason fetched client-side from keeper API on cancelledTxnHash event"
  - "getActionableMessage maps raw error strings to user-friendly messages"

patterns-established:
  - "Timeout-based UI escalation: progressive disclosure of warnings and actions based on elapsed time"
  - "On-chain cancellation from UI: user can cancel stuck deposits directly from toast notification"

requirements-completed: [LIFE-02, UI-01, UI-03]

# Metrics
duration: 8min
completed: 2026-02-20
---

# Phase 3 Plan 2: Enhanced Deposit Notification Summary

**Dynamic deposit status with elapsed time counter, 60s/120s timeout escalation, user-initiated cancel via ExchangeRouter, and keeper error reason display**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-20T18:00:00Z
- **Completed:** 2026-02-20T18:08:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 12 (3 source + 9 locale catalogs)

## Accomplishments

- Replaced static "Fulfilling buy request" spinner with dynamic elapsed time status messages that update every second
- Added progressive timeout escalation: warning text at 60s, cancel button at 120s
- Created cancelDepositTxn function enabling users to cancel stuck deposits on-chain from the toast notification
- Integrated keeper API to fetch and display actionable error reasons when deposits are cancelled
- All i18n strings extracted and compiled for all 9 locale catalogs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create elapsed time hook, cancel deposit function, and enhance GmStatusNotification** - `fe5e39c5b` (feat)
2. **Task 2: Verify deposit status UI in browser** - checkpoint, user approved

## Files Created/Modified

- `src/components/StatusNotification/useDepositTimeout.ts` - Elapsed time hook (useDepositElapsed) with 1s interval
- `src/domain/synthetics/markets/cancelDepositTxn.ts` - Cancel deposit transaction via ExchangeRouter
- `src/components/StatusNotification/GmStatusNotification.tsx` - Enhanced notification with timer, warnings, cancel button, error messages
- `src/locales/*/messages.po` - Updated locale catalogs (9 languages)

## Decisions Made

- **Elapsed time thresholds:** 0-15s shows "Waiting for keeper to execute..." (no counter to avoid anxiety), 15-60s shows counter, 60-120s shows warning, 120s+ shows cancel button. These thresholds were chosen based on the 13s typical keeper execution time observed in Phase 1 E2E testing.
- **Cancel via user wallet:** cancelDepositTxn sends the transaction from the user's connected wallet (not the keeper). The contract enforces msg.sender == deposit.account, so only the depositor can cancel.
- **Keeper API for error reasons:** On cancellation, the component fetches the error reason from the keeper's /api/deposits/:key endpoint (built in plan 03-01). This provides context like "expired before keeper could execute" vs generic "cancelled."
- **getActionableMessage helper:** Maps raw error strings (OracleTimestamps, EmptyDeposit, execution reverted) to user-friendly messages with clear next steps.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This completes Phase 3 (UI Feedback) and the entire "Fix Buy GM Flow" milestone. All 11 v1 requirements are now satisfied:
- Phase 1: Core deposit execution works end-to-end (EXEC-01, EXEC-02)
- Phase 2: Keeper handles failures, restarts, concurrency, expiry (EXEC-03, EXEC-04, LIFE-01, LIFE-03, LIFE-04)
- Phase 3: Users see dynamic status, actionable errors, and can cancel stuck deposits (LIFE-02, UI-01, UI-02, UI-03)

Remaining from Phase 3 Plan 01: Keeper service deployment deferred due to SSH auth gate. The deposit status API code is committed but needs manual deployment to the DigitalOcean server.

## Self-Check: PASSED

- FOUND: src/components/StatusNotification/useDepositTimeout.ts
- FOUND: src/domain/synthetics/markets/cancelDepositTxn.ts
- FOUND: src/components/StatusNotification/GmStatusNotification.tsx
- FOUND: commit fe5e39c5b

---
*Phase: 03-ui-feedback*
*Completed: 2026-02-20*
