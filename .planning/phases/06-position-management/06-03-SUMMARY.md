---
phase: 06-position-management
plan: 03
subsystem: ui
tags: [react, tradebox, limit-orders, sltp, sidecar-orders, tailwind]

# Dependency graph
requires:
  - phase: 06-01
    provides: market order submission, TradeBox state, useTradeboxState
provides:
  - Limit price percentage shortcut buttons (-5%, -1%, +1%, +5%) in TradeBox
  - SL/TP price percentage shortcut buttons (-10%, -5% for SL; +5%, +10% for TP)
  - priceShortcuts/referencePrice props on SideOrderEntries component
affects:
  - 06-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BigInt basis-points math for percentage price calculations (10000 + bps) / 10000
    - Optional priceShortcuts prop pattern for context-aware price shortcuts in sidecar entries

key-files:
  created: []
  modified:
    - src/components/TradeBox/TradeBox.tsx
    - src/components/TradeBox/components/SideOrderEntries.tsx
    - src/components/TradeBox/TradeBoxRows/LimitAndTPSLRows.tsx

key-decisions:
  - "06-03: Limit price shortcuts use BigInt basis-point math (markPrice * (10000 + bps) / 10000) to avoid float precision errors"
  - "06-03: SL price shortcuts are [-10%, -5%], TP price shortcuts are [+5%, +10%] from mark price"
  - "06-03: Limit price shortcuts shown only in TradeMode.Limit (not Trigger/StopMarket modes)"
  - "06-03: SideOrderEntries receives referencePrice via selectTradeboxMarkPrice selector — no prop drilling from parent"

patterns-established:
  - "Percentage price shortcut buttons: small pill buttons in a row below the price input, consistent styling across TradeBox and SideOrderEntries"
  - "BigInt math pattern for percentage calculations: bps = BigInt(Math.round(pct * 100)); adjusted = (price * (10000n + bps)) / 10000n"

requirements-completed:
  - POS-03
  - POS-04

# Metrics
duration: 7min
completed: 2026-02-21
---

# Phase 6 Plan 03: Limit Orders and SL/TP Summary

**Limit price %-shortcut buttons and SL/TP price shortcuts added to TradeBox; existing limit/SL/TP order placement and display infrastructure verified as fully functional from GMX fork**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-21T10:37:02Z
- **Completed:** 2026-02-21T10:43:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added -5%, -1%, +1%, +5% limit price shortcut buttons below the limit price input in TradeBox — appear only in Limit trade mode
- Added -10%, -5% price shortcuts for stop-loss entries and +5%, +10% for take-profit entries in SideOrderEntries
- Verified all core limit order, SL/TP, and order cancellation flows already fully implemented by GMX fork code

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable limit order placement and pending order display** - `bc231971b` (feat)
2. **Task 2: Enable SL/TP order attachment on new and existing positions** - `b3cbd39a8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/TradeBox/TradeBox.tsx` - Added `handleLimitPricePercentageShortcut` callback and `renderLimitPriceShortcuts()` function; renders shortcuts below trigger price input in Limit mode
- `src/components/TradeBox/components/SideOrderEntries.tsx` - Added `priceShortcuts` and `referencePrice` props; `handlePriceShortcut` callback; shortcut button row below price input; imports for calculateDisplayDecimals, formatAmount, USD_DECIMALS, selectTradeboxMarkPrice
- `src/components/TradeBox/TradeBoxRows/LimitAndTPSLRows.tsx` - Passes `priceShortcuts={[-10, -5]}` for stopLoss and `priceShortcuts={[5, 10]}` for takeProfit to SideOrderEntries

## Decisions Made
- Limit price shortcuts use BigInt basis-point math to avoid float precision: `markPrice * (10000n + bps) / 10000n`
- SL price shortcuts at -10% and -5% from mark price; TP at +5% and +10% (from plan spec)
- Limit shortcuts only shown when `tradeMode === TradeMode.Limit` (not in Trigger/StopMarket modes)
- `referencePrice` is obtained via `selectTradeboxMarkPrice` inside `SideOrderEntries` — no prop-drilling from LimitAndTPSLRows

## Deviations from Plan

None - plan executed exactly as written. The core limit order and SL/TP infrastructure (order placement, batch submission, order display, cancellation, position row SL/TP button) was already fully implemented by the GMX fork. This plan added the percentage shortcut buttons that were the remaining user-decision deliverables.

## Issues Encountered
- Pre-existing TypeScript error in `useOrders.ts` (OrderInfoStructOutput export mismatch) confirmed as unrelated to this work — documented in STATE.md

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Limit orders and SL/TP fully functional with price shortcuts
- Limit order: select Limit mode in TradeBox, enter price or use -5%/-1%/+1%/+5% shortcuts, submit
- SL/TP: expand TP/SL section in TradeBox, use shortcut buttons or enter price manually, submit with order
- Pending orders appear in Orders tab with cancel support
- Ready for 06-04 (position management final features)

---
*Phase: 06-position-management*
*Completed: 2026-02-21*
