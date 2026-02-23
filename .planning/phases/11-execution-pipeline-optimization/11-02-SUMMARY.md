---
phase: 11-execution-pipeline-optimization
plan: 02
subsystem: execution-pipeline
tags: [scanner-passthrough, operation-data, redundant-reads, queue, executor, rpc-optimization]

# Dependency graph
requires:
  - phase: 11-execution-pipeline-optimization
    plan: 01
    provides: "Background oracle updater with nonce coordination and drainQueue single-consumer loop"
provides:
  - "OperationData union type and MarketTokens interface for scanner-to-executor data passthrough"
  - "Extended QueueItem with optional operationData field"
  - "Scanners attach pre-fetched deposit/withdrawal/order + market + token data to scan results"
  - "Executors skip redundant chain reads when pre-fetched data is available"
  - "Graceful fallback to chain reads for event-sourced items (no regression)"
affects: [12, execution-pipeline, keeper-performance]

# Tech tracking
tech-stack:
  added: []
  patterns: ["scanner-data-passthrough via operationDataMap on scan results", "optional pre-fetched data in executor with type-narrowed fallback", "try/catch isolation so scanner never fails due to data attachment errors"]

key-files:
  created: []
  modified:
    - order-execution-keeper-service/src/core/scanners/types.ts
    - order-execution-keeper-service/src/core/queue/executionQueue.ts
    - order-execution-keeper-service/src/core/scanners/depositScanner.ts
    - order-execution-keeper-service/src/core/scanners/withdrawalScanner.ts
    - order-execution-keeper-service/src/core/scanners/orderScanner.ts
    - order-execution-keeper-service/src/core/executors/depositExecutor.ts
    - order-execution-keeper-service/src/core/executors/withdrawalExecutor.ts
    - order-execution-keeper-service/src/core/executors/orderExecutor.ts
    - order-execution-keeper-service/src/index.ts

key-decisions:
  - "Scanner attaches operation data per-item with try/catch so market read failure never blocks scan completion"
  - "Executors use type-narrowed optional parameter (operationData?.type === 'deposit') for safe pre-fetched data access"
  - "Event-sourced items carry no operationData — executor falls back to chain reads with zero regression"

patterns-established:
  - "Scanner data passthrough: operationDataMap on scan results, passed through queue.enqueue() to executor.execute()"
  - "Optional pre-fetched data: executor checks operationData type first, falls back to reader.get*() if absent"

requirements-completed: [EXEC-02]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 11 Plan 02: Scanner Data Passthrough Summary

**Eliminated redundant on-chain reads by passing pre-fetched deposit/withdrawal/order + market + token data from scanners through execution queue to executors**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T22:46:54Z
- **Completed:** 2026-02-23T22:50:51Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Defined OperationData union type and MarketTokens interface for type-safe scanner-to-executor data passthrough
- Extended QueueItem with optional operationData field, enabling poll-sourced items to carry pre-fetched chain data
- All three scanners (deposit, withdrawal, order) attach pre-fetched operation data + market tokens + token list to scan results
- All three executors skip redundant reader.getDeposit()/getWithdrawal()/getOrder() and reader.getMarket() calls when pre-fetched data is available
- Event-sourced items (from EventListener) degrade gracefully to existing chain read behavior with zero regression
- Scanner data attachment failures are isolated per-item (try/catch) and never block scan completion

## Task Commits

Each task was committed atomically:

1. **Task 1: Add OperationData types, extend QueueItem, and update scanners to attach data** - `171f949` (feat)
2. **Task 2: Update executors to accept pre-fetched data, wire passthrough in index.ts drainQueue** - `0a8148e` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/core/scanners/types.ts` - Added MarketTokens interface, OperationData union type, operationDataMap on all scan result types
- `order-execution-keeper-service/src/core/queue/executionQueue.ts` - Extended QueueItem with optional operationData field
- `order-execution-keeper-service/src/core/scanners/depositScanner.ts` - Attaches deposit + market + tokens data to operationDataMap per scanned deposit
- `order-execution-keeper-service/src/core/scanners/withdrawalScanner.ts` - Attaches withdrawal + market + tokens data to operationDataMap per scanned withdrawal
- `order-execution-keeper-service/src/core/scanners/orderScanner.ts` - Attaches order + market + tokens data to operationDataMap per scanned order
- `order-execution-keeper-service/src/core/executors/depositExecutor.ts` - Accepts optional OperationData, uses pre-fetched deposit and tokens, falls back to chain read
- `order-execution-keeper-service/src/core/executors/withdrawalExecutor.ts` - Accepts optional OperationData, uses pre-fetched withdrawal and tokens, falls back to chain read
- `order-execution-keeper-service/src/core/executors/orderExecutor.ts` - Accepts optional OperationData, uses pre-fetched order and tokens, falls back to chain read
- `order-execution-keeper-service/src/index.ts` - scanAndEnqueue passes operationDataMap to queue, drainQueue passes item.operationData to executors

## Decisions Made
- Scanner attaches operation data per-item with try/catch so market read failure never blocks scan completion
- Executors use type-narrowed optional parameter (operationData?.type === 'deposit') for safe pre-fetched data access
- Event-sourced items carry no operationData -- executor falls back to chain reads with zero regression

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 (Execution Pipeline Optimization) is now complete with both plans delivered
- Background oracle updater (Plan 01) eliminates 2-8s synchronous oracle TX per execution
- Scanner data passthrough (Plan 02) eliminates ~300-500ms of redundant RPC calls per execution
- Ready for Phase 12

## Self-Check: PASSED

- All 9 modified files exist on disk
- Commit `171f949` (Task 1) found in git log
- Commit `0a8148e` (Task 2) found in git log
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

---
*Phase: 11-execution-pipeline-optimization*
*Completed: 2026-02-23*
