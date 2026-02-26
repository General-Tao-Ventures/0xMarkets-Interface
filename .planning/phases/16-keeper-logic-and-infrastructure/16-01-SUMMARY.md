---
phase: 16-keeper-logic-and-infrastructure
plan: 01
subsystem: infra
tags: [viem, websocket, keeper, executor, dedup, typescript]

# Dependency graph
requires:
  - phase: 15-01-project-skeleton
    provides: "config.ts, keys.ts, abis.ts, package.json with all dependencies"
  - phase: 15-02-oracle-module
    provides: "oracle.ts with buildOracleParams, isOracleStale, getCachedTokenCount"
provides:
  - "WebSocket event watcher detecting DepositCreated/WithdrawalCreated/OrderCreated via EventLog1"
  - "DataStore poller reading all three operation lists as safety net"
  - "Sequential executor with dedup Set, manual nonce, per-type token extraction, and error classification"
affects: [16-02-wiring-health-shutdown, 17-deploy-and-verify]

# Tech tracking
tech-stack:
  added: []
  patterns: [event-driven-wake, dedup-set-forever, manual-nonce, permanent-vs-transient-error]

key-files:
  created:
    - "order-execution-keeper-service/src/watcher.ts"
    - "order-execution-keeper-service/src/poller.ts"
    - "order-execution-keeper-service/src/executor.ts"
  modified: []

key-decisions:
  - "Used watchContractEvent (not raw watchEvent) for auto-decoded EventLog1 args avoiding encoding bugs"
  - "HTTP client for poller (not WebSocket) since polling is request-response, not streaming"
  - "Event-driven wake pattern with Promise resolver for idle-efficient executor loop"
  - "Permanent errors include generic 'execution reverted' to catch all on-chain reverts"

patterns-established:
  - "Event watcher: watchContractEvent on EventLog1, read eventName (non-indexed string), map to OpType"
  - "Poller: getBytes32Count + getBytes32ValuesAt for DataStore list reads"
  - "Executor: createExecutor factory returning { enqueue, start, shutdown, getQueueLength, getSeenCount }"
  - "Token extraction: read struct -> check zero address -> read market -> build token Set"
  - "Error classification: isPermanentError checks selectors, transient retries with exponential backoff"

requirements-completed: [DET-01, DET-02, DET-03, EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 16 Plan 01: Core Keeper Modules Summary

**WebSocket event watcher, DataStore poller, and sequential executor with dedup Set, manual nonce, and permanent/transient error classification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T06:24:40Z
- **Completed:** 2026-02-26T06:27:16Z
- **Tasks:** 3
- **Files modified:** 3 (3 created)

## Accomplishments
- Created watcher.ts using viem watchContractEvent on EventLog1 with auto-decoded args, mapping eventName (non-indexed string) to OpType via EVENT_MAP
- Created poller.ts reading all three DataStore lists (DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST) via getBytes32Count + getBytes32ValuesAt with parallel Promise.all
- Created executor.ts with createExecutor factory: dedup Set (keys stay forever), sequential FIFO queue, event-driven wake, manual nonce via getTransactionCount, per-type token extraction (deposits/withdrawals/orders), zero-address struct detection, and permanent/transient error classification with exponential backoff retry (1s, 2s, 4s)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create watcher.ts -- WebSocket event detection** - `41d253e` (feat)
2. **Task 2: Create poller.ts -- DataStore polling safety net** - `360253c` (feat)
3. **Task 3: Create executor.ts -- Sequential execution with dedup, retry, and token extraction** - `3fc07e0` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/watcher.ts` - WebSocket event watcher using watchContractEvent on EventLog1; exports startWatcher and OpType
- `order-execution-keeper-service/src/poller.ts` - DataStore polling safety net reading all three operation lists; exports pollDataStore
- `order-execution-keeper-service/src/executor.ts` - Sequential execution engine with dedup Set, manual nonce, per-type token extraction, permanent/transient error classification; exports createExecutor

## Decisions Made
- Used watchContractEvent (not raw watchEvent) to get auto-decoded EventLog1 args, avoiding the indexed/non-indexed data decoding bug documented in Pitfall 1
- HTTP client for poller rather than WebSocket since polling is request-response pattern
- Event-driven wake pattern with Promise resolver instead of polling with setTimeout for idle efficiency
- Permanent errors include generic "execution reverted" to catch all on-chain contract reverts (conservative -- any revert is treated as permanent)
- 2,500,000n static gas limit for all operation types on testnet (generous, avoids extra estimateGas RPC call)
- Orders check isFrozen flag before execution to avoid wasting gas on frozen orders

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three core modules compile cleanly with pnpm build
- watcher.ts, poller.ts, executor.ts are ready to be wired together in Plan 02
- Plan 02 will add: health endpoint, index.ts wiring, graceful shutdown, and Dockerfile verification
- Executor's enqueue function is the shared callback for both watcher and poller

## Self-Check: PASSED

All 3 created files verified on disk (watcher.ts, poller.ts, executor.ts). All 3 task commits (41d253e, 360253c, 3fc07e0) verified in git log. SUMMARY.md exists.

---
*Phase: 16-keeper-logic-and-infrastructure*
*Completed: 2026-02-26*
