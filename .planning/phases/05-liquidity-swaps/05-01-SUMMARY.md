---
phase: 05-liquidity-swaps
plan: 01
subsystem: ui
tags: [react, tailwind, ethers, gm-tokens, withdrawal, pools]

# Dependency graph
requires:
  - phase: 03-deposit-ux
    provides: GmStatusNotification with deposit elapsed time tracking and cancel pattern
  - phase: 02-deposit-execution
    provides: createWithdrawalTxn, ExchangeRouter contract interaction pattern
provides:
  - "Buy GM and Sell GM action buttons on every pool row (desktop and mobile)"
  - "cancelWithdrawalTxn.ts — on-chain withdrawal cancellation function"
  - "Enhanced withdrawal notification with elapsed time, progressive warnings, and cancel button"
affects: [future-swap-features, pools-page, gm-list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cancelWithdrawalTxn follows cancelDepositTxn pattern exactly (ExchangeRouter ABI + callContract)"
    - "useDepositElapsed hook called twice for deposit and withdrawal in same component"
    - "operation=Withdrawal query param drives PoolsDetailsContext initial state via useEffect on searchParams"

key-files:
  created:
    - src/domain/synthetics/markets/cancelWithdrawalTxn.ts
  modified:
    - src/components/GmList/GmListItem.tsx
    - src/components/StatusNotification/GmStatusNotification.tsx
    - src/domain/synthetics/markets/index.ts

key-decisions:
  - "Sell GM buttons use operation=Withdrawal query param — PoolsDetailsContext already reads this via useEffect on searchParams"
  - "useDepositElapsed called twice (once for deposit, once for withdrawal) — hook is generic enough to reuse"
  - "withdrawalElapsedSeconds thresholds match deposit: 15s/60s/120s for progressive disclosure"
  - "Withdrawal error reason fetch wraps keeper API gracefully — degrades silently if endpoint doesn't exist yet"

patterns-established:
  - "Pattern: Progressive status disclosure at 15s/60s/120s thresholds for async keeper operations"
  - "Pattern: Cancel button renders after 120s with isCancelling guard state and try/catch reset"
  - "Pattern: getActionableMessage and getWithdrawalActionableMessage for contextual cancelled-state copy"

requirements-completed: [LIQ-01]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 5 Plan 01: Sell GM Flow (Withdrawal UX) Summary

**Buy GM / Sell GM action buttons on pool rows, cancelWithdrawalTxn.ts on-chain cancellation, and enhanced withdrawal notification with progressive elapsed time and Cancel Withdrawal button at 120s**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T09:27:33Z
- **Completed:** 2026-02-21T09:30:20Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Every pool row now shows "Buy GM" (green primary) and "Sell GM" (red-tinted secondary) action buttons in both desktop table and mobile card layouts
- `cancelWithdrawalTxn.ts` created following exact `cancelDepositTxn` pattern — calls `ExchangeRouter.cancelWithdrawal` with proper sentMsg/successMsg/failMsg
- Withdrawal notification enhanced to match deposit UX: progressive disclosure at 15s/60s/120s, yellow warning at 60s, "Cancel Withdrawal" button at 120s
- `getWithdrawalActionableMessage` added for contextual copy when withdrawal is cancelled by keeper

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Buy GM and Sell GM action buttons to pool list items** - `98e793e5b` (feat)
2. **Task 2: Create cancelWithdrawalTxn and enhance withdrawal notification UX** - `95935b296` (feat)

**Plan metadata:** (docs commit following)

## Files Created/Modified
- `src/components/GmList/GmListItem.tsx` - Added Buy GM + Sell GM buttons replacing single Details button; removed unused MenuDotsIcon import
- `src/domain/synthetics/markets/cancelWithdrawalTxn.ts` - New file: ExchangeRouter.cancelWithdrawal wrapper
- `src/domain/synthetics/markets/index.ts` - Added export for cancelWithdrawalTxn
- `src/components/StatusNotification/GmStatusNotification.tsx` - Added withdrawalElapsedSeconds, handleCancelWithdrawal, enhanced executionStatus branch, withdrawal warning/cancel JSX, withdrawal error fetch

## Decisions Made
- `useDepositElapsed` called twice in `GmStatusNotification` — the hook is generic (takes a `createdAt: number | undefined`) so it works cleanly for both deposit and withdrawal elapsed tracking without modification
- Operation=Withdrawal query param works directly — `PoolsDetailsContext` already has a `useEffect` that reads `searchParams.get("operation")` and calls `setOperation` on mount, so no context changes needed
- Removed `MenuDotsIcon` import from `GmListItem.tsx` (Rule 1 auto-fix: unused import after removing the ghost Details button)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused MenuDotsIcon import**
- **Found during:** Task 1 (Add Buy GM and Sell GM buttons)
- **Issue:** Replacing the "Details" ghost button removed the only usage of `MenuDotsIcon`, leaving a stale import that would cause lint errors
- **Fix:** Removed the `import MenuDotsIcon from "img/ic_menu_dots.svg?react"` line
- **Files modified:** `src/components/GmList/GmListItem.tsx`
- **Verification:** `npx tsc --noEmit` passes with no new errors
- **Committed in:** `98e793e5b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused import)
**Impact on plan:** Minimal cleanup required, no scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `src/domain/synthetics/orders/useOrders.ts` (`OrderInfoStructOutput` export mismatch) — unrelated to this plan's changes, pre-existed before and after our edits. Excluded from verification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sell GM flow is now end-to-end: users can click "Sell GM" from pools list, land on withdrawal form, submit, and see enhanced status feedback with cancel capability
- The withdrawal form pre-selection works via `?operation=Withdrawal` query param which PoolsDetailsContext already handles
- Future: Swap flow (Phase 5 Plan 02+) can follow same button pattern established here

---
*Phase: 05-liquidity-swaps*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: src/components/GmList/GmListItem.tsx
- FOUND: src/domain/synthetics/markets/cancelWithdrawalTxn.ts
- FOUND: src/components/StatusNotification/GmStatusNotification.tsx
- FOUND: .planning/phases/05-liquidity-swaps/05-01-SUMMARY.md
- FOUND commit: 98e793e5b (Task 1 - Buy GM / Sell GM buttons)
- FOUND commit: 95935b296 (Task 2 - cancelWithdrawalTxn + notification UX)
