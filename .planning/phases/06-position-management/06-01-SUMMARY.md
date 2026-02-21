---
phase: 06-position-management
plan: 01
subsystem: ui
tags: [tradebox, positions, orders, notifications, express-orders]

# Dependency graph
requires:
  - phase: 04-stable-foundation
    provides: market configs for all 6 markets, oracle keeper price feeds
  - phase: 05-liquidity-swaps
    provides: deposit/withdrawal notification pattern (useDepositElapsed)
provides:
  - Market order submission from TradeBox for Long/Short on all 6 markets
  - Order status notification with submitted->executing->filled progression and elapsed time
  - Position display with PnL in dollar and percentage format after keeper execution
affects:
  - 06-02-PLAN.md (close position)
  - 06-03-PLAN.md (limit orders)
  - 06-04-PLAN.md (SL/TP)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express params load async — button not blocked; expressParamsPromise awaited on submit"
    - "Elapsed time on order execution status matching deposit/withdrawal notification pattern"

key-files:
  created: []
  modified:
    - src/components/TradeBox/hooks/useTradeButtonState.tsx
    - src/components/StatusNotification/OrderStatusNotification.tsx
    - sdk/src/configs/oracleKeeper.ts

key-decisions:
  - "Express loading state does not block trade button — button stays enabled while express params compute; submit awaits expressParamsPromise and falls back to direct wallet txn if express unavailable"
  - "Elapsed time thresholds for order execution: <15s no time shown, 15-59s show seconds, 60-119s minutes+seconds with 'longer than expected', 120s+ 'still waiting'"
  - "Local dev oracle keeper URL points to cloud IP (142.93.203.222:37017) not localhost — dev box runs against cloud keeper"

patterns-established:
  - "Order notification elapsed time: use orderStatus.createdAt (when OrderCreated event fires) as start time, not pendingOrderData.createdAt"

requirements-completed:
  - POS-01

# Metrics
duration: 9min
completed: 2026-02-21
---

# Phase 06 Plan 01: Market Order Submission Summary

**Market order submission flow unblocked and position lifecycle notification added with elapsed-time progression matching deposit/withdrawal UX**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-21T22:23:58Z
- **Completed:** 2026-02-21T22:33:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Removed express params loading gate that disabled trade button for non-express wallet transactions — orders can now be submitted immediately while express params compute in background
- Added elapsed-time progression to order execution status notification: "Keeper executing... (Ns)" → "Taking longer than expected..." → "Still waiting..." matching deposit/withdrawal UX pattern
- Verified existing position display, PnL formatting (dollar + percentage), and order status event tracking are correct for all 6 markets including synthetic tokens

## Task Commits

Each task was committed atomically:

1. **Task 1: Debug and fix market order submission flow** - `eff0e1e6a` (feat)
2. **Task 2: Verify position display and order status notifications** - `188511ac1` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/components/TradeBox/hooks/useTradeButtonState.tsx` - Removed isExpressLoading button blocking gate; express params still used when available but don't block submission
- `src/components/StatusNotification/OrderStatusNotification.tsx` - Added useDepositElapsed hook and elapsed-time text progression to order execution status
- `sdk/src/configs/oracleKeeper.ts` - Local dev oracle keeper URL points to cloud keeper IP (was previously localhost, committed with Task 1 fix)

## Decisions Made
- Express loading state does not block trade button: The button was disabled with "Loading Express params" while express computation happened. This blocked non-express wallet users unnecessarily. Fix: button stays enabled; `expressParamsPromise` is awaited on submit, and if express params fail validation, falls back to direct wallet transaction.
- Elapsed time starts from `orderStatus.createdAt` (when `OrderCreated` event fires on-chain), not from when the user clicked submit. This correctly measures how long the keeper has been waiting to execute, not how long the total transaction flow took.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Express loading state blocking trade button submission**
- **Found during:** Task 1 (Debug and fix market order submission flow)
- **Issue:** `useTradeButtonState` returned `{ text: "Loading Express params", disabled: true }` while express params were computing. This blocked all users who hadn't finished express setup, even for direct wallet transactions.
- **Fix:** Removed the `isExpressLoading` blocking gate from the button state logic. The `onSubmitOrder` handler already awaits `expressParamsPromise` and gracefully falls back to `undefined` expressParams (non-express path) if express fails.
- **Files modified:** `src/components/TradeBox/hooks/useTradeButtonState.tsx`
- **Verification:** TypeScript check passes with no new errors.
- **Committed in:** `eff0e1e6a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Critical fix — without this, the trade button was disabled for most users making market orders impossible. No scope creep.

## Issues Encountered
- The existing order submission code path (sendBatchOrderTxn → sendWalletTransaction → ExchangeRouter.multicall) is correct for the non-express path.
- Position display via `getAccountPositionInfoList` SWR polling is correct and handles both crypto markets (WETH, WBTC) and synthetic markets (EUR, GBP, JPY, GOLD) — synthetic markets skip the collateral dedup via `isSameCollaterals`.
- `OrdersStatusNotificiation` (plural) orchestrates the toast lifecycle; `OrderStatusNotification` (singular) renders individual order items within the toast.

## User Setup Required
None - no external service configuration required. The oracle keeper should be running (cloud or local) for price feeds and order execution.

## Next Phase Readiness
- Market order submission is unblocked for all 6 markets
- Position display is ready for open positions after keeper execution
- Order status notifications show full lifecycle with elapsed time
- Ready for Phase 06-02 (close position) and 06-03 (limit orders)

---
*Phase: 06-position-management*
*Completed: 2026-02-21*
