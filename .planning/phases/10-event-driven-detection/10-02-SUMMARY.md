---
phase: 10-event-driven-detection
plan: 02
subsystem: infra
tags: [viem, websocket, event-driven, queue, blockchain, event-listener]

# Dependency graph
requires:
  - phase: 10-event-driven-detection/01
    provides: "ExecutionQueue, WebSocket PublicClient factory, EventEmitter ABI, KeeperState Prisma model"
provides:
  - "EventListener class with WebSocket event watching for DepositCreated/WithdrawalCreated/OrderCreated"
  - "Block-number backfill on startup and reconnect (DETECT-03)"
  - "Queue-driven main loop with single-consumer drainQueue()"
  - "30s polling safety net (reduced from 10s)"
  - "WebSocket health status tracking in healthState"
affects: [10-event-driven-detection]

# Tech tracking
tech-stack:
  added: []
  patterns: [event-driven-detection, queue-consumer-loop, backfill-on-startup, scan-enqueue-separation]

key-files:
  created:
    - order-execution-keeper-service/src/core/listeners/eventListener.ts
  modified:
    - order-execution-keeper-service/src/index.ts
    - order-execution-keeper-service/src/utils/healthState.ts

key-decisions:
  - "Moved healthState wsConnected/setWsStatus to Task 1 commit (blocking dependency for EventListener compilation)"
  - "Polling interval hardcoded to 30_000ms instead of using config.scanIntervalSeconds (event-driven is primary)"
  - "Block persistence every 10 events or 5-block gap to avoid DB write per event"
  - "Backfill uses getPublicClient (HTTP) for getLogs, not WebSocket client"

patterns-established:
  - "Event-to-queue pattern: EventListener only enqueues, never executes directly"
  - "Single-consumer drain loop: drainQueue() replaces isExecuting mutex for sequential execution (LIFE-04)"
  - "Scan-enqueue separation: scanAndEnqueue() only enqueues, drainQueue() only executes"
  - "Dual-source dedup: event and poll sources both use queue.enqueue() which deduplicates via allKnown"

requirements-completed: [DETECT-01, DETECT-02, DETECT-03]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 10 Plan 02: Event Listener + Main Loop Rewire Summary

**WebSocket EventListener for sub-2s event detection with block-number backfill, queue-driven drainQueue() consumer, and 30s polling safety net**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T22:16:00Z
- **Completed:** 2026-02-23T22:19:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created EventListener class that watches EventLog1 + EventLog2 on EventEmitter contract via WebSocket for sub-2s detection (DETECT-01)
- Implemented block-number backfill from persisted KeeperState on startup and after reconnect to recover missed events (DETECT-03)
- Rewired main loop: replaced direct execution with scanAndEnqueue() + drainQueue() single-consumer architecture
- Reduced polling from 10s to 30s safety net while events provide primary detection (DETECT-02)
- Added wsConnected/lastEventTime tracking and setWsStatus/recordEvent exports to healthState
- Clean shutdown sequence: stop event listener, destroy WebSocket, disconnect DB

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EventListener with WebSocket event watching and block-number backfill** - `35a2751` (feat)
2. **Task 2: Rewire main loop to queue-driven execution with event listener and reduced polling** - `7fbdf66` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/core/listeners/eventListener.ts` - EventListener class with WebSocket watching, log decoding, backfill, and block persistence
- `order-execution-keeper-service/src/index.ts` - Queue-driven main loop with drainQueue(), scanAndEnqueue(), event listener startup, 30s polling
- `order-execution-keeper-service/src/utils/healthState.ts` - Added wsConnected, lastEventTime fields and setWsStatus(), recordEvent() exports

## Decisions Made
- Moved healthState WebSocket status tracking (wsConnected, setWsStatus) into Task 1 commit because EventListener imports setWsStatus -- without it, Task 1 compilation fails (Rule 3: auto-fix blocking issue)
- Hardcoded 30_000ms polling interval instead of using config.scanIntervalSeconds to make event-driven primary detection explicit in the code
- Block persistence uses periodic batching (every 10 events or 5-block gap) rather than persisting after every event to avoid excessive DB writes
- Backfill uses HTTP client (getPublicClient) for getLogs since getLogs is a request-response pattern, not a subscription

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved healthState changes to Task 1**
- **Found during:** Task 1 (EventListener creation)
- **Issue:** EventListener imports `setWsStatus` from healthState.ts, but the plan schedules that export for Task 2. Task 1 verify runs `tsc --noEmit` which would fail without it.
- **Fix:** Added wsConnected, lastEventTime, setWsStatus(), and recordEvent() to healthState.ts as part of Task 1 instead of Task 2
- **Files modified:** order-execution-keeper-service/src/utils/healthState.ts
- **Verification:** `npx tsc --noEmit` passes after Task 1
- **Committed in:** 35a2751 (Task 1 commit)

**2. [Rule 1 - Bug] Used getOrCreatePrismaClient() instead of store.prisma**
- **Found during:** Task 1 (EventListener creation)
- **Issue:** Plan references `store.prisma.keeperState` but the store module does not expose a `.prisma` property. The codebase pattern (used by all scanners) is `getOrCreatePrismaClient()`.
- **Fix:** Used `getOrCreatePrismaClient()` from `../store.js` (matching existing codebase pattern in scanners)
- **Files modified:** order-execution-keeper-service/src/core/listeners/eventListener.ts
- **Verification:** `npx tsc --noEmit` passes, matches pattern in depositScanner.ts, withdrawalScanner.ts, orderScanner.ts
- **Committed in:** 35a2751 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - WS_RPC_URL environment variable was already added in Plan 01. When set, the event listener activates automatically. Without it, the keeper gracefully falls back to polling-only mode.

## Next Phase Readiness
- Phase 10 Event-Driven Detection is complete (Plans 01 + 02)
- All three detection requirements met: DETECT-01 (sub-2s events), DETECT-02 (30s polling fallback), DETECT-03 (startup backfill)
- Ready for Phase 11 planning

## Self-Check: PASSED

All 3 files verified present. Both task commits (35a2751, 7fbdf66) confirmed in git log.

---
*Phase: 10-event-driven-detection*
*Completed: 2026-02-23*
