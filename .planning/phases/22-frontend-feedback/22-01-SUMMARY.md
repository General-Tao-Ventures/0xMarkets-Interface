---
phase: 22-frontend-feedback
plan: 01
subsystem: ui
tags: [react-toastify, toast-notifications, keeper-api, error-messages, ux]

# Dependency graph
requires:
  - phase: 18-event-detection-and-toast-feedback
    provides: polling infrastructure, event detection, toast lifecycle for deposits/withdrawals/orders
provides:
  - 5-second auto-dismiss on executed toasts (was 7 seconds)
  - Human-readable order cancellation error messages fetched from keeper API
  - Max 3 visible toasts at once (was 1)
  - Error/cancellation toasts require manual dismissal
affects: [22-frontend-feedback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keeper API error reason fetching pattern (same as deposits/withdrawals) now applied to orders"
    - "getOrderActionableMessage() maps raw error strings to user-friendly messages"

key-files:
  created: []
  modified:
    - src/components/StatusNotification/OrderStatusNotification.tsx
    - src/config/ui.ts
    - src/App/AppRoutes.tsx

key-decisions:
  - "TOAST_AUTO_CLOSE_TIME set to 5000ms (user decision: executed toasts dismiss after 5 seconds)"
  - "ToastContainer limit changed from 1 to 3 (user decision: max 3 visible toasts)"
  - "Order cancellation error reasons fetched from /api/order-keeper/api/orders/{key} endpoint"

patterns-established:
  - "All three operation types (deposit, withdrawal, order) now have consistent keeper error reason fetching"

requirements-completed: [FB-01, FB-02, FB-03, FB-04, FB-05, FB-06]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 22 Plan 01: Toast Polish Summary

**5-second auto-dismiss on success, human-readable order cancellation errors from keeper API, max 3 toasts visible, error toasts require manual dismiss**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T06:29:07Z
- **Completed:** 2026-02-27T06:31:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Reduced toast auto-dismiss from 7 seconds to 5 seconds for executed/success toasts
- Added keeper API error reason fetching for order cancellations with human-readable messages (matching existing deposit/withdrawal pattern)
- Increased max visible toasts from 1 to 3
- Verified error/cancellation toasts never auto-close (only executedTxnHash triggers auto-close)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add order cancellation error reasons and update auto-close timing** - `f44ff84cb` (feat)
2. **Task 2: Limit visible toasts to 3 and verify error toast manual dismiss** - `a8172e4ee` (feat)

## Files Created/Modified
- `src/config/ui.ts` - TOAST_AUTO_CLOSE_TIME changed from 7000 to 5000
- `src/components/StatusNotification/OrderStatusNotification.tsx` - Added KEEPER_API_URL, getOrderActionableMessage(), keeperErrorReason state, keeper API fetch useEffect, human-readable cancellation messages
- `src/App/AppRoutes.tsx` - ToastContainer limit changed from 1 to 3

## Decisions Made
- TOAST_AUTO_CLOSE_TIME set to 5000ms (user-specified decision)
- ToastContainer limit set to 3 (user-specified decision)
- Order cancellation errors follow the exact same keeper API fetch pattern as GmStatusNotification deposits/withdrawals
- User-initiated cancellations (txnType === "cancel") still show generic "Order cancelled" (not an error scenario)
- Only keeper-initiated cancellations (txnType !== "cancel") fetch and display human-readable error reasons

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All toast polish changes complete; Plan 22-02 can proceed independently
- Consistent UX now across all three operation types (deposit, withdrawal, order)
- Keeper API endpoint `/api/order-keeper/api/orders/{key}` must return `errorReason` field for order error messages to display

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits verified in git log (f44ff84cb, a8172e4ee)
- TypeScript compiles with 0 errors
- All 7 plan verification checks pass

---
*Phase: 22-frontend-feedback*
*Completed: 2026-02-27*
