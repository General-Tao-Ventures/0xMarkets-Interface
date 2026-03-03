---
phase: 33-event-listener
plan: 01
subsystem: database
tags: [viem, websocket, event-indexer, postgres, cursor, pg]

# Dependency graph
requires:
  - phase: 32-event-decoder-router
    provides: "decodeEventLog function and routeEvent dispatcher with 51 insert handlers"
  - phase: 31-event-schema
    provides: "event_cursor table and 26 event tables with ON CONFLICT DO NOTHING"
provides:
  - "Event indexer collector with cursor-based crash recovery"
  - "Historical replay from cursor to current head in 2000-block chunks"
  - "Real-time WebSocket subscription via viem watchBlockNumber"
  - "Health endpoint integration with lastIndexedBlock and indexedEvents"
  - "WS_RPC_URL required config for WebSocket RPC endpoint"
affects: [deployment, data-verification-service]

# Tech tracking
tech-stack:
  added: []
  patterns: [cursor-based-recovery, chunk-replay, websocket-block-watcher, per-event-error-isolation]

key-files:
  created:
    - data-verification-service/src/abi/eventEmitter.ts
    - data-verification-service/src/collectors/eventIndexer.ts
  modified:
    - data-verification-service/src/config.ts
    - data-verification-service/src/index.ts

key-decisions:
  - "Used viem WebSocket auto-reconnect (no custom reconnect logic needed)"
  - "Block timestamps cached per-chunk to avoid redundant getBlock RPC calls"
  - "First run sets cursor to current block (no historical replay — backfill is future work)"
  - "Per-event error handling: log and continue, single bad event does not crash indexer"
  - "Used HTTP client for getBlock during real-time (more reliable than WS for point queries)"

patterns-established:
  - "Cursor recovery: read cursor on startup, replay missed blocks, then switch to real-time"
  - "Per-event error isolation: try/catch each event independently, log error with block/logIndex context"

requirements-completed: [LIST-01, LIST-02, LIST-03, LIST-04]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 33 Plan 01: Event Listener Summary

**Event indexer loop with cursor-based crash recovery, historical replay in 2000-block chunks, and real-time WebSocket subscription via viem**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T22:17:44Z
- **Completed:** 2026-03-03T22:20:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- EventEmitter ABI constants centralized (address, EVENT_LOG1_TOPIC, EVENT_LOG2_TOPIC)
- Event indexer collector with full crash recovery via event_cursor table persistence
- Historical replay fetches missed events in 2000-block chunks on startup
- Real-time WebSocket subscription using viem watchBlockNumber + getLogs batch approach
- Service lifecycle integration: start after price recorder, health endpoint, graceful shutdown
- WS_RPC_URL required env var added to config

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EventEmitter ABI and event indexer collector** - `1641717` (feat)
2. **Task 2: Wire event indexer into service lifecycle and health endpoint** - `d9f60af` (feat)

## Files Created/Modified
- `data-verification-service/src/abi/eventEmitter.ts` - EventEmitter address and topic constants
- `data-verification-service/src/collectors/eventIndexer.ts` - Event indexer with cursor recovery, replay, and real-time subscription
- `data-verification-service/src/config.ts` - Added wsRpcUrl (required WS_RPC_URL env var)
- `data-verification-service/src/index.ts` - Wired event indexer into startup, health, and shutdown

## Decisions Made
- Used viem's built-in WebSocket auto-reconnect instead of custom reconnect logic (LIST-02 satisfied by viem transport)
- Block timestamps cached per-chunk/batch in a Map to avoid redundant getBlock calls for co-located logs
- First-run cursor set to current block number (no backfill on initial deploy; BACKFILL-01/02 are future work)
- Per-event error isolation: one bad event logged at ERROR level and skipped, does not halt block processing
- HTTP client used for getBlock during real-time mode (more reliable than WebSocket for point queries)
- Dedicated pg Client created per indexer lifecycle (separate from Prisma and migration clients)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**WS_RPC_URL environment variable** must be set on the data-verification-service deployment:
- Value: `wss://` URL for Base Sepolia RPC provider (same provider as RPC_URL but WebSocket endpoint)
- Required before service restart after deployment
- Example: `WS_RPC_URL=wss://base-sepolia-rpc.publicnode.com`

## Next Phase Readiness
- Event indexer is complete and ready for deployment
- Requires WS_RPC_URL env var to be set on the DO droplet before restart
- The full pipeline is now connected: WebSocket -> getLogs -> decoder -> router -> insert handlers -> DB
- Historical replay will catch up any events missed during downtime on service restart

## Self-Check: PASSED

- FOUND: data-verification-service/src/abi/eventEmitter.ts
- FOUND: data-verification-service/src/collectors/eventIndexer.ts
- FOUND: .planning/phases/33-event-listener/33-01-SUMMARY.md
- FOUND: commit 1641717 (Task 1)
- FOUND: commit d9f60af (Task 2)

---
*Phase: 33-event-listener*
*Completed: 2026-03-03*
