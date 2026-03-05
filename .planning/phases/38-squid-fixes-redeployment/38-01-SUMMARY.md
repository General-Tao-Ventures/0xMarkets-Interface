---
phase: 38-squid-fixes-redeployment
plan: 01
subsystem: indexer
tags: [squid, subsquid, graphql, pnl, fees, leaderboard, trade-history]

requires:
  - phase: 31-squid-deployment
    provides: "Base squid indexer with trade action and position event handlers"
provides:
  - "pnlUsd populated on OrderExecuted trade actions for MarketDecrease"
  - "Fee data (positionFeeAmount, borrowingFeeAmount, fundingFeeAmount) from PositionFeesCollected events"
  - "Accurate maxCapital in periodAccountStats for leaderboard ranking"
  - "Accurate realizedFees in periodAccountStats"
affects: [39-frontend-verification, leaderboard, trade-history]

tech-stack:
  added: []
  patterns:
    - "PositionFeesCollected handler with cross-event fee data enrichment via feesByOrderKey map"
    - "Type-aware event field extraction (int256 vs uint256 for collateralDeltaAmount)"

key-files:
  created: []
  modified:
    - /Users/ken/Projects/0xM/0xMarkets-squid/src/handlers/orders.ts
    - /Users/ken/Projects/0xM/0xMarkets-squid/src/handlers/accountStats.ts
    - /Users/ken/Projects/0xM/0xMarkets-squid/src/main.ts
    - /Users/ken/Projects/0xM/0xMarkets-squid/schema.graphql
    - /Users/ken/Projects/0xM/0xMarkets-squid/src/processor.ts
    - /Users/ken/Projects/0xM/0xMarkets-squid/src/utils/ids.ts

key-decisions:
  - "pnlUsd = basePnlUsd for trade history display (matches GMX v2 subgraph approach)"
  - "Fee data sourced from PositionFeesCollected events (not PositionIncrease/Decrease which don't emit fee fields)"
  - "collateralDeltaAmount read from intItems (PositionIncrease) or uintItems (PositionDecrease) based on contract emit type"

patterns-established:
  - "Cross-event enrichment: feesByOrderKey map for merging PositionFeesCollected data into OrderExecuted"

requirements-completed: [TH-01, TH-02, LB-01, LB-02]

duration: 19min
completed: 2026-03-05
---

# Phase 38 Plan 01: Squid Fixes & Redeployment Summary

**Fixed pnlUsd enrichment, fee extraction from PositionFeesCollected events, and collateralDeltaAmount type mismatch for accurate trade history and leaderboard data**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-05T01:32:50Z
- **Completed:** 2026-03-05T01:52:02Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- OrderExecuted trade actions for MarketDecrease now have populated pnlUsd (= basePnlUsd)
- Fee fields (positionFeeAmount, borrowingFeeAmount, fundingFeeAmount) extracted from PositionFeesCollected events and merged into OrderExecuted via enrichment
- maxCapital now non-zero for all accounts with positions (was always 0 due to int256/uint256 type mismatch)
- realizedFees accurately accumulated from PositionFeesCollected event data
- Squid redeployed with --hard-reset, fully re-indexed, all GraphQL verifications passed

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose event field names and fix pnlUsd + fee extraction** - `e277918` (feat)
2. **Task 1 auto-fix: collateralDeltaAmount type mismatch** - `9fb8ab8` (fix)

Task 2 (deploy + verify) was a deployment/verification task with no code changes.

## Files Created/Modified

- `src/handlers/orders.ts` - Added pnlUsd field, PositionFeesCollected handler, removed incorrect fee reads from position events
- `src/handlers/accountStats.ts` - Fixed collateralDeltaAmount int256/uint256 type-aware extraction, accept fee data parameter
- `src/main.ts` - Added feesByOrderKey tracking map, PositionFeesCollected event routing, fee merge in enrichTradeActions
- `schema.graphql` - Added Position.accountStat relation
- `src/processor.ts` - Updated start block to 37,740,000
- `src/utils/ids.ts` - Added generateAllTimePeriodAccountStatsId helper

## Decisions Made

- **pnlUsd = basePnlUsd**: Matches GMX v2 subgraph approach where pnlUsd on TradeAction equals basePnlUsd (fees shown separately)
- **Fee data from PositionFeesCollected**: Contract emits fee fields in separate PositionFeesCollected events, not in PositionIncrease/Decrease events. Added dedicated handler and cross-event enrichment.
- **Type-aware collateralDeltaAmount**: PositionIncrease emits as int256 (intItems), PositionDecrease as uint256 (uintItems). Handler now checks both maps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] collateralDeltaAmount read from wrong event data type map**
- **Found during:** Task 2 (deployment verification)
- **Issue:** maxCapital was 0 for all accounts. Root cause: PositionIncrease emits collateralDeltaAmount as int256 (intItems) but handler used getUint() (uintItems), always returning undefined/0
- **Fix:** Read from intItems first (for PositionIncrease), fall back to uintItems (for PositionDecrease)
- **Files modified:** src/handlers/accountStats.ts, src/handlers/orders.ts
- **Verification:** After redeployment, maxCapital non-zero for all accounts with positions
- **Committed in:** 9fb8ab8

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for leaderboard maxCapital. No scope creep.

## Issues Encountered

- Discovered that PositionIncrease and PositionDecrease events do NOT contain fee fields (positionFeeAmount, borrowingFeeAmount, fundingFeeAmount). These are emitted in separate PositionFeesCollected events. Added a new handler and cross-event enrichment pattern.
- Required two deployments due to the collateralDeltaAmount bug discovered during first verification.

## User Setup Required

None - no external service configuration required.

## Verification Results

```
# pnlUsd on MarketDecrease OrderExecuted
PASS: pnlUsd = -345786025281529556442306400000 (non-null)

# Fee fields on OrderExecuted
PASS: positionFeeAmount = 495481 (non-null)
PASS: borrowingFeeAmount = 0 (populated)
PASS: fundingFeeAmount = 0 (populated)

# Account stats
PASS: maxCapital > 0 for all active accounts (e.g., 29822411677967817340000000000000000)
PASS: realizedFees > 0 for accounts with closed positions (e.g., 35417774240619280000000000000000)
PASS: wins/losses/closedCount populated correctly
```

## Next Phase Readiness

- Squid data is complete and verified -- ready for Phase 39 frontend verification
- Trade history should now show market order executions with PnL
- Leaderboard should show accurate maxCapital rankings

---
*Phase: 38-squid-fixes-redeployment*
*Completed: 2026-03-05*
