---
phase: 05-liquidity-swaps
plan: 02
subsystem: ui
tags: [react, pools, gm-tokens, liquidity, tabs, utilization, pnl]

# Dependency graph
requires:
  - phase: 05-liquidity-swaps
    provides: "Plan 01 — Buy GM / Sell GM buttons in GmListItem.tsx"
provides:
  - "All Pools / My Pools tab switcher on Pools page"
  - "My Pools tab filters to pools where user has GM token balance > 0"
  - "PnL display (green/red) in My Pools tab using useUserEarnings hook"
  - "Utilization % column (longInterestUsd + shortInterestUsd) / poolValueMax"
  - "Empty states: 'Connect wallet' and 'You have no pool positions'"
affects: [future-pools-features, liquidity-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [tabs-drive-list-filtering, utilization-from-market-info, pnl-from-user-earnings]

key-files:
  created: []
  modified:
    - src/pages/Pools/Pools.tsx
    - src/components/GmList/GmList.tsx
    - src/components/GmList/GmListItem.tsx

key-decisions:
  - "Utilization = (longInterestUsd + shortInterestUsd) / poolValueMax — uses USD values already on MarketInfo, avoids token-to-USD conversion"
  - "GLV markets show '—' for utilization (no longInterestUsd/shortInterestUsd fields)"
  - "My Pools filter applied post-sorting in GmList (not in useFilterSortPools) to keep sort/search logic unmodified"
  - "showPnl prop on GmListItem (not activeTab) — cleaner interface, single boolean controls PnL visibility"

patterns-established:
  - "Tabs component used in Pools page drives GmList via activeTab prop"
  - "computeUtilization() as standalone function in GmListItem — pure, testable"

requirements-completed: [LIQ-02]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 5 Plan 02: All Pools / My Pools Tabs with PnL and Utilization Summary

**All Pools / My Pools tab switcher with GM balance filtering, PnL display from earnings history, and utilization % column calculated from market open interest vs pool value**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-21T09:35:02Z
- **Completed:** 2026-02-21T09:39:13Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 3

## Accomplishments
- All Pools / My Pools tabs added to Pools page using existing Tabs component
- My Pools tab filters pool list to tokens where user balance > 0, with empty states
- Utilization percentage column added (desktop) and row (mobile) using MarketInfo.longInterestUsd + shortInterestUsd / poolValueMax
- PnL display (green positive, red negative) in My Pools tab using existing useUserEarnings hook
- GLV markets gracefully show "—" for utilization (isGlvInfo check)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add All Pools / My Pools tabs, utilization, and PnL** - `38f6ec461` (feat)

2. **Task 2: Human verification (checkpoint approved)** — user verified pools tabs, My Pools PnL, and utilization display

## Files Created/Modified
- `src/pages/Pools/Pools.tsx` - Added poolsTab state, Tabs component, activeTab prop passed to GmList
- `src/components/GmList/GmList.tsx` - Added activeTab prop, displayTokens filtering, empty states, UTIL column header
- `src/components/GmList/GmListItem.tsx` - Added computeUtilization(), showPnl prop, PnL display, utilization display

## Decisions Made
- Utilization uses `poolValueMax` (in USD with 30-decimal precision) as denominator — consistent with how pool capacity is displayed elsewhere
- `bigMath.mulDiv(totalInterest, 10000n, poolValue)` avoids floating point until final display
- GLV markets show "—" for utilization since they aggregate multiple markets and don't have direct interest fields
- `showPnl` boolean prop on GmListItem rather than passing `activeTab` — cleaner interface

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Pre-existing TypeScript error in `useOrders.ts` (OrderInfoStructOutput export mismatch) is unrelated and documented in STATE.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pools page now has full tab switching, My Pools view with PnL, and utilization metrics
- Human verification passed — user approved all features
- Phase 5 is fully complete; Phase 6 (Swaps) can begin

---
*Phase: 05-liquidity-swaps*
*Completed: 2026-02-21*
