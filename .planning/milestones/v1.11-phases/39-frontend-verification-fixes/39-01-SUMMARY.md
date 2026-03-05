---
phase: 39-frontend-verification-fixes
plan: 01
subsystem: ui
tags: [leaderboard, graphql, squid, trade-history]

requires:
  - phase: 38-squid-fixes-redeployment
    provides: Fixed squid with pnlUsd enrichment, fee extraction, maxCapital calculation
provides:
  - Leaderboard all-time query sends periodEnd_eq: 0 matching squid storage
  - Verified trade history and leaderboard data integrity against live squid
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/domain/synthetics/leaderboard/constants.ts

key-decisions:
  - "Keep LeaderboardTimeframe.to as number|undefined -- all-time uses 0, period uses undefined"

patterns-established: []

requirements-completed: [TH-03, LB-03]

duration: 1min
completed: 2026-03-05
---

# Phase 39 Plan 01: Frontend Verification & Fixes Summary

**Fixed leaderboard all-time query to send periodEnd_eq: 0 and verified trade history pnlUsd + leaderboard maxCapital against live squid**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T02:19:20Z
- **Completed:** 2026-03-05T02:20:43Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Fixed leaderboard all-time timeframe to send `to: 0` instead of `to: undefined`, ensuring GraphQL query matches squid's `periodEnd: 0` storage
- Verified trade history returns MarketDecrease OrderExecuted entries with non-null pnlUsd
- Verified leaderboard returns periodAccountStats with non-zero maxCapital and realizedFees when queried with correct params

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix leaderboard all-time period query params** - `466c0f318` (fix)
2. **Task 2: Verify trade history and leaderboard against live squid data** - no commit (verification-only, no file changes)

## Files Created/Modified
- `src/domain/synthetics/leaderboard/constants.ts` - Changed timeframe.to from undefined to 0 for all-time leaderboard

## Decisions Made
- Kept `LeaderboardTimeframe.to` type as `number | undefined` since 7d/30d periods legitimately use `undefined` (meaning "now"), while all-time uses `0` to match squid storage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Leaderboard and trade history frontend fixes complete
- Ready for any remaining Phase 39 plans

---
*Phase: 39-frontend-verification-fixes*
*Completed: 2026-03-05*
