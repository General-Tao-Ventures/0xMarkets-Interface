---
phase: 32-event-decoder-router
plan: 02
subsystem: events
tags: [pg, sql, event-handler, insert-builder, router, vitest, typescript]

# Dependency graph
requires:
  - phase: 32-event-decoder-router
    plan: 01
    provides: DecodedEventData types, 52 event name constants, decoder helpers
  - phase: 31-event-schema
    provides: SQL table schemas for all 9 event namespaces
provides:
  - Generic buildHandler() for data-driven parameterized SQL inserts
  - 51 event insert handlers across 9 PG schema namespaces
  - Event router dispatching eventName to correct handler
  - getHandlerCount() diagnostic function
affects: [33-event-indexer-loop, event-processing-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-driven insert builder with ColumnSpec declarations, ON CONFLICT DO NOTHING idempotent inserts, parameterized queries for SQL injection prevention]

key-files:
  created:
    - data-verification-service/src/events/insertBuilder.ts
    - data-verification-service/src/events/handlers/orderHandlers.ts
    - data-verification-service/src/events/handlers/positionHandlers.ts
    - data-verification-service/src/events/handlers/depositHandlers.ts
    - data-verification-service/src/events/handlers/withdrawalHandlers.ts
    - data-verification-service/src/events/handlers/shiftHandlers.ts
    - data-verification-service/src/events/handlers/marketHandlers.ts
    - data-verification-service/src/events/handlers/glvHandlers.ts
    - data-verification-service/src/events/handlers/referralHandlers.ts
    - data-verification-service/src/events/handlers/oracleHandlers.ts
    - data-verification-service/src/events/router.ts
    - data-verification-service/src/events/router.test.ts
  modified: []

key-decisions:
  - "51 handlers (not 49/50) matching actual 52 event constants minus 1 DistributionCreated"
  - "All column names double-quoted in SQL for reserved word safety (handles oracle.timestamp)"
  - "Position fee handlers share column spec array (same _emitPositionFees Solidity function)"
  - "bigint to string conversion for NUMERIC columns in extractValue"

patterns-established:
  - "Handler files export Record<string, EventHandler> for easy router merging"
  - "ColumnSpec source.key uses exact camelCase/dot-separated Solidity field names"
  - "nullable: true on ColumnSpec for conditional contract emit fields"

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 32 Plan 02: Event Router Summary

**Data-driven insert builder with 51 event handlers across 9 PG schemas and a central router dispatching decoded events to parameterized SQL inserts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T21:58:13Z
- **Completed:** 2026-03-03T22:03:19Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Generic buildHandler() converts EventTableSpec declarations into parameterized INSERT queries with ON CONFLICT DO NOTHING
- 51 event insert handlers covering all active event types (orders, positions, deposits, withdrawals, shifts, market, GLV, referrals, oracle)
- Position fee handlers correctly mark 11 referral/pro/liquidation columns as nullable for conditional contract emits
- ClaimableFundingUpdated handler marks time_key and next_pool_value as nullable for two Solidity overloads
- Event router dispatches by eventName, logs warnings for unknown events, silently skips DistributionCreated
- 5 router unit tests passing with vitest

## Task Commits

Each task was committed atomically:

1. **Task 1: Create insert builder and all handler files** - `692f95e` (feat)
2. **Task 2: Create event router** - `208651f` (test: RED), `5a5bf2f` (feat: GREEN)

## Files Created/Modified
- `data-verification-service/src/events/insertBuilder.ts` - Generic SQL insert builder with ColumnSpec types and buildHandler()
- `data-verification-service/src/events/handlers/orderHandlers.ts` - 7 order event handlers
- `data-verification-service/src/events/handlers/positionHandlers.ts` - 6 position event handlers (with shared fee column specs)
- `data-verification-service/src/events/handlers/depositHandlers.ts` - 3 deposit event handlers
- `data-verification-service/src/events/handlers/withdrawalHandlers.ts` - 3 withdrawal event handlers
- `data-verification-service/src/events/handlers/shiftHandlers.ts` - 3 shift event handlers
- `data-verification-service/src/events/handlers/marketHandlers.ts` - 17 market event handlers
- `data-verification-service/src/events/handlers/glvHandlers.ts` - 9 GLV event handlers
- `data-verification-service/src/events/handlers/referralHandlers.ts` - 2 referral event handlers
- `data-verification-service/src/events/handlers/oracleHandlers.ts` - 1 oracle event handler
- `data-verification-service/src/events/router.ts` - Central router merging all handlers with unknown/DistributionCreated handling
- `data-verification-service/src/events/router.test.ts` - 5 router tests (dispatch, unknown event, DistributionCreated, handler count)

## Decisions Made
- 51 handlers rather than the plan's stated 49/50 -- matches the actual 52 event constants from 32-01 minus 1 DistributionCreated skip
- All SQL column names are double-quoted in generated INSERT statements for reserved word safety (handles oracle."timestamp" automatically)
- Position fee column specs shared between PositionFeesCollected and PositionFeesInfo handlers (identical schema from same Solidity emit function)
- CumulativeBorrowingFactorUpdated delta is uint (not int) based on the SQL schema column type being NOT NULL without sign requirement

## Deviations from Plan

None - plan executed exactly as written. The handler count difference (51 vs plan's stated 49) reflects the actual event constant count established in 32-01 (52 total), not a deviation from this plan.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Decoder (32-01) and router (32-02) form the complete event processing pipeline backbone
- Next phase will create the indexer loop that fetches logs from RPC, decodes them, and routes to insert handlers
- All 51 event types ready for production event ingestion

## Self-Check: PASSED

- All 12 created files exist on disk
- All 3 commits (692f95e, 208651f, 5a5bf2f) found in git history
- TypeScript compiles without errors (`npx tsc --noEmit`)
- All 5 vitest router tests pass

---
*Phase: 32-event-decoder-router*
*Completed: 2026-03-03*
