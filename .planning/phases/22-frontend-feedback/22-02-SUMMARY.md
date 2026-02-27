---
phase: 22-frontend-feedback
plan: 02
subsystem: ui
tags: [swr, react, event-driven, auto-refresh, debounce]

# Dependency graph
requires:
  - phase: 18-event-detection-and-toast-feedback
    provides: "SyntheticsEventsProvider event detection infrastructure (DepositExecuted, WithdrawalExecuted, OrderExecuted, etc.)"
  - phase: 22-frontend-feedback-01
    provides: "Toast polish (auto-dismiss, error reasons, max 3 toasts)"
provides:
  - "Page-aware SWR revalidation on execution/cancellation events in SyntheticsEventsProvider"
  - "Debounced data refresh (300ms) preventing UI flicker on rapid events"
  - "Universal token balance revalidation on all event types"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Page-aware SWR revalidation via pathname guard + globalMutate key matcher", "Debounced event-driven cache invalidation with useRef timers"]

key-files:
  created: []
  modified:
    - src/context/SyntheticsEvents/SyntheticsEventsProvider.tsx

key-decisions:
  - "Page-aware refresh: pool data only revalidated on /pools, positions only on /trade, token balances universal"
  - "300ms debounce per refresh type prevents flicker from rapid event bursts"
  - "Used SWR globalMutate key matcher (key[1] check) for targeted cache invalidation"

patterns-established:
  - "Event-driven SWR revalidation: execution events trigger targeted globalMutate with key matcher functions"
  - "Page-aware data refresh: useLocation pathname guards prevent unnecessary background fetching"

requirements-completed: [FB-07, FB-08]

# Metrics
duration: 12min
completed: 2026-02-27
---

# Phase 22 Plan 02: SWR Auto-Refresh Summary

**Page-aware SWR revalidation on execution/cancellation events with 300ms debounce -- pool data refreshes on pools page, positions refresh on trade page, token balances refresh universally**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-27T06:30:00Z
- **Completed:** 2026-02-27T06:42:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Wired SWR globalMutate revalidation into all 10 execution/cancellation event handlers in SyntheticsEventsProvider
- Pool data (useMarketTokensData) revalidates on deposit/withdrawal events only when user is on pools page
- Positions data (usePositionsData) revalidates on order events only when user is on trade page
- Token balances (useTokenBalances) revalidate universally on all event types
- 300ms debounce per refresh type prevents UI flicker from rapid event bursts
- Human verified on live testnet: order submitted, OrderExecuted detected, SWR revalidation triggered, position appeared without page refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire SWR revalidation into execution and cancellation event handlers** - `b3054ebcf` (feat)
2. **Task 2: Verify auto-refresh behavior on live testnet** - N/A (human verification checkpoint, approved)

## Files Created/Modified
- `src/context/SyntheticsEvents/SyntheticsEventsProvider.tsx` - Added page-aware SWR revalidation (triggerPoolRefresh, triggerPositionsRefresh, triggerBalanceRefresh) into all execution/cancellation event handlers with 300ms debounce

## Decisions Made
- Page-aware refresh guards: pool data only revalidated when pathname starts with /pools, positions only when pathname starts with /trade, token balances have no page guard (universal)
- 300ms debounce chosen to batch rapid events without noticeable delay
- Used SWR globalMutate key matcher pattern (checking key[1] for hook name) for targeted cache invalidation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 22 (Frontend Feedback) is now complete: toast polish (22-01) + auto-refresh (22-02)
- Full feedback loop verified: submit -> Pending toast -> Executed toast + data refreshes silently
- Ready for any remaining phases in v1.6 E2E Reliability milestone

---
*Phase: 22-frontend-feedback*
*Completed: 2026-02-27*

## Self-Check: PASSED

All files and commits verified.
