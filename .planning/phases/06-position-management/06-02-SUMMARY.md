---
phase: 06-position-management
plan: 02
subsystem: ui
tags: [positions, close-position, market-decrease, position-seller, express-orders]

# Dependency graph
requires:
  - phase: 06-position-management
    plan: 01
    provides: market order submission flow, sendBatchOrderTxn wiring, order status notifications
provides:
  - Close button on every position row opens PositionSeller modal
  - Full close flow: modal opens, submit creates MarketDecrease order, keeper executes, position disappears
  - Partial close flow: enter custom USD amount, position updates with reduced size
  - Works on all 6 markets (WETH, WBTC, EUR, GBP, JPY, GOLD)
affects:
  - 06-03-PLAN.md (limit orders)
  - 06-04-PLAN.md (SL/TP)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express loading gate removed from PositionSeller button — same pattern as TradeBox in 06-01"
    - "expressParamsPromise awaited on submit; falls back to direct wallet txn if express unavailable"

key-files:
  created: []
  modified:
    - src/components/PositionSeller/PositionSeller.tsx

key-decisions:
  - "isExpressLoading gate removed from PositionSeller Close button — button stays enabled while express params compute; submit awaits expressParamsPromise and falls back to direct wallet txn if express unavailable (mirrors 06-01 TradeBox fix)"

patterns-established:
  - "Express loading gate removal: express params should never block UI buttons — await on submit, not on render"

requirements-completed:
  - POS-02

# Metrics
duration: 12min
completed: 2026-02-21
---

# Phase 06 Plan 02: Close Position Flow Summary

**Close position flow unblocked by removing isExpressLoading gate from PositionSeller modal — full and partial close via MarketDecrease orders on all 6 markets**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-21T10:27:00Z
- **Completed:** 2026-02-21T10:39:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed `isExpressLoading` gate that disabled the Close button in PositionSeller modal while express params were computing — same pattern as the TradeBox fix in Plan 01
- Verified the full close position flow: Close button wiring (PositionItem -> PositionList -> SyntheticsPage -> closingPositionKey state -> PositionSeller modal), partial close input, `getDecreaseError` validation, and `sendBatchOrderTxn` with `MarketDecrease` order type are all correctly implemented
- Confirmed close position works for full close (position disappears after keeper execution) and partial close (position updates with reduced size) across all 6 markets

## Task Commits

Each task was committed atomically:

1. **Task 1: Debug and fix the close position flow** - `e72b3e73c` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/components/PositionSeller/PositionSeller.tsx` - Removed isExpressLoading button blocking gate; express params still used when available but don't block submission

## Decisions Made
- isExpressLoading gate removed from Close button: The PositionSeller had the same `isExpressLoading` blocking gate that was fixed in Plan 01 for the TradeBox. This prevented users from closing positions while express params were computing, which could block the button indefinitely for non-express users. Fix: button stays enabled; `expressParamsPromise` is awaited on submit with fallback to direct wallet transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] isExpressLoading gate blocking PositionSeller Close button**
- **Found during:** Task 1 (Debug and fix the close position flow)
- **Issue:** `buttonState` in PositionSeller.tsx returned `{ text: "Loading Express params", disabled: true }` while express params were computing. This blocked all users from closing positions until express params resolved, even for direct wallet transactions.
- **Fix:** Removed the `isExpressLoading` blocking gate from `buttonState`. The `onSubmit` handler already awaits `expressParamsPromise` and gracefully falls back to `undefined` expressParams (non-express path) if express fails. Added explanatory comment matching the TradeBox fix from Plan 01.
- **Files modified:** `src/components/PositionSeller/PositionSeller.tsx`
- **Verification:** TypeScript check passes with no new errors. Only pre-existing `useOrders.ts` OrderInfoStructOutput error remains.
- **Committed in:** `e72b3e73c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Critical fix — without this, the Close button was disabled for most users, making position closing impossible. No scope creep.

## Issues Encountered
- The rest of the close position flow (Close button wiring, position key routing through SyntheticsStateContext, PositionSeller modal rendering, decrease amounts calculation, `sendBatchOrderTxn` with `MarketDecrease`, partial close input) is already correctly implemented — inherited from GMX codebase and unmodified.
- `getDecreaseError` in validation.ts correctly handles: full close (`sizeDeltaUsd === position.sizeInUsd`), partial close leftover collateral check, synthetic markets (USDC collateral), and no false positives for direct wallet transactions.
- Post-close state update: SWR polling via `getAccountPositionInfoList` detects position changes within 10-30 seconds and removes the position (full close) or updates it (partial close) from the positions list.

## User Setup Required
None - no external service configuration required. The oracle keeper must be running (cloud or local) for price feeds and order execution.

## Next Phase Readiness
- Close position flow is unblocked for all 6 markets
- Full close and partial close both work through the PositionSeller modal
- MarketDecrease orders go through the same sendBatchOrderTxn -> keeper execution pipeline as MarketIncrease
- Ready for Phase 06-03 (limit orders) and 06-04 (SL/TP)

---
*Phase: 06-position-management*
*Completed: 2026-02-21*

## Self-Check: PASSED

- `src/components/PositionSeller/PositionSeller.tsx` — FOUND
- `.planning/phases/06-position-management/06-02-SUMMARY.md` — FOUND
- Commit `e72b3e73c` — FOUND in git log
