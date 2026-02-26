---
phase: 18-event-detection-and-toast-feedback
plan: 01
subsystem: ui
tags: [ethers, rpc, polling, websocket, toast, events, react-hooks]

# Dependency graph
requires:
  - phase: 17-deploy-and-verify
    provides: deployed keeper and EventEmitter contract on Base Sepolia
provides:
  - useExecutionPolling hook for RPC-based event detection fallback
  - EXECUTION_TIMEOUT_HASH constant for timeout state identification
  - Timeout-aware toast messages in GmStatusNotification and OrderStatusNotification
affects: [19-toast-ux-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [RPC polling fallback for WebSocket reliability, timeout sentinel values for stuck operations]

key-files:
  created:
    - src/context/SyntheticsEvents/useExecutionPolling.ts
  modified:
    - src/context/SyntheticsEvents/types.ts
    - src/context/SyntheticsEvents/SyntheticsEventsProvider.tsx
    - src/components/StatusNotification/GmStatusNotification.tsx
    - src/components/StatusNotification/OrderStatusNotification.tsx

key-decisions:
  - "Used refs for status objects in polling hook to avoid re-creating intervals on every render"
  - "500-block lookback window for getLogs to cover ~15 minutes of Base block history"
  - "5-minute timeout before marking operations as timed out with sentinel hash"
  - "Timeout sentinel 'timeout' string instead of null/undefined to trigger existing cancelledTxnHash error paths"

patterns-established:
  - "RPC polling fallback: poll eth_getLogs as safety net when WebSocket drops silently"
  - "Timeout sentinel: use EXECUTION_TIMEOUT_HASH constant to mark timed-out operations"

requirements-completed: [DET-01, DET-02, DET-03, FB-03]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 18 Plan 01: Event Detection Polling Fallback Summary

**RPC-based eth_getLogs polling fallback for missed WebSocket events with 5-minute timeout and user-friendly toast messages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T07:44:09Z
- **Completed:** 2026-02-26T07:48:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created useExecutionPolling hook that detects stuck deposits, withdrawals, and orders via RPC eth_getLogs when WebSocket misses events
- Added 5-minute timeout mechanism so toasts never stay stuck on "Pending..." forever
- Integrated timeout-specific messages in GmStatusNotification and OrderStatusNotification
- Guarded keeper API error-reason fetches and BaseScan links for timeout errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useExecutionPolling hook with RPC log fallback** - `0e1e2deb5` (feat)
2. **Task 2: Integrate polling fallback into SyntheticsEventsProvider and handle timeout in toasts** - `4ea7c806a` (feat)

## Files Created/Modified
- `src/context/SyntheticsEvents/useExecutionPolling.ts` - New hook: polls eth_getLogs for stuck operations, updates statuses, handles timeout
- `src/context/SyntheticsEvents/types.ts` - Added EXECUTION_TIMEOUT_HASH constant
- `src/context/SyntheticsEvents/SyntheticsEventsProvider.tsx` - Wired useExecutionPolling after WS subscription
- `src/components/StatusNotification/GmStatusNotification.tsx` - Timeout-specific messages for deposits/withdrawals, guarded keeper API fetches
- `src/components/StatusNotification/OrderStatusNotification.tsx` - Timeout-specific message for orders, suppressed BaseScan link for timeouts

## Decisions Made
- Used useRef pattern to store current statuses in refs, preventing interval recreation on every status change while keeping fresh data in polling callbacks
- Set 500-block lookback for getLogs queries (covers ~15 min on Base at 2s blocks)
- 10-second delay before first poll gives WebSocket a fair chance to deliver events first
- Reused existing cancelledTxnHash field with sentinel value "timeout" rather than adding new fields, since existing toast components already handle cancelledTxnHash as error state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed lint errors for optional catch binding**
- **Found during:** Task 2 (verification)
- **Issue:** Project ESLint config forbids ES2019 optional catch binding (`catch {`); requires explicit parameter
- **Fix:** Changed all `catch {` to `catch (_e) {` in useExecutionPolling.ts
- **Files modified:** src/context/SyntheticsEvents/useExecutionPolling.ts
- **Verification:** eslint passes with 0 errors on new file
- **Committed in:** 4ea7c806a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor lint compliance fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Polling fallback is active and additive (does not replace WebSocket subscription)
- Ready for Phase 18 Plan 02 (toast UX refinements) or Phase 19
- Manual E2E testing deferred: submit a deposit and verify toast updates from pending to executed

---
*Phase: 18-event-detection-and-toast-feedback*
*Completed: 2026-02-26*
