---
phase: 34-deploy-verify
plan: 02
subsystem: infra
tags: [docker, deployment, digitalocean, event-indexer, websocket, postgres, verification]

# Dependency graph
requires:
  - phase: 34-deploy-verify-01
    provides: "Docker-compose WS_RPC_URL passthrough and health endpoint eventsPerMinute metric"
  - phase: 33-event-listener
    provides: "Event indexer with cursor recovery, historical replay, and real-time WebSocket subscription"
provides:
  - "Production-deployed event indexer on DO droplet (142.93.203.222:37019)"
  - "All 10 SQL migrations executed, 50 event tables created across 9 PG schemas"
  - "Real-time event indexing from Base Sepolia EventEmitter contract"
  - "Verified three-collector pipeline: market snapshotter + price recorder + event indexer"
affects: [monitoring, data-verification-service, backfill]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Production deployment via scp + docker compose rebuild"]

key-files:
  created: []
  modified:
    - data-verification-service/docker-compose.yml (parent, WS_RPC_URL env addition on droplet)

key-decisions:
  - "Used scp file sync instead of git pull for deployment (local code is source of truth)"
  - "Added WS_RPC_URL to parent docker-compose.yml on droplet for env passthrough"
  - "Rebuilt container with --no-cache to ensure clean image with all new event indexer code"

patterns-established:
  - "Deployment verification: health endpoint check + DB table inspection for all collectors"

requirements-completed: [DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04]

# Metrics
duration: 20min
completed: 2026-03-03
---

# Phase 34 Plan 02: Deploy and Verify Summary

**Event indexer deployed to DO droplet with all 3 collectors verified: market snapshotter, price recorder, and event indexer with real-time WebSocket subscription and 50-table schema**

## Performance

- **Duration:** ~20 min (human deployment + verification)
- **Started:** 2026-03-03T22:35:00Z
- **Completed:** 2026-03-03T22:55:00Z
- **Tasks:** 2
- **Files modified:** 1 (parent docker-compose.yml on droplet)

## Accomplishments
- Deployed updated data-verification-service to DO droplet via scp and Docker rebuild
- All 10 SQL migrations executed successfully, creating event tables across 9 PG schemas (orders, positions, deposits, withdrawals, shifts, market, glv, referrals, oracle)
- Event indexer started, cursor set to block 38405019, real-time WebSocket subscription active
- Health endpoint confirmed all metrics: lastIndexedBlock=38405038, indexedEvents=0, eventsPerMinute=0
- Market snapshotter verified: processing blocks with 6 snapshots per block (unchanged)
- Price recorder verified: subscribed to 7 Pyth Lazer feeds with recent lastPriceTick (unchanged)

## Task Commits

Both tasks were human-action/human-verify checkpoints (no code commits from executor):

1. **Task 1: Deploy to DO droplet** - Human action (scp, docker compose rebuild)
2. **Task 2: Verify all collectors working** - Human verification (health endpoint + DB queries)

## Files Created/Modified
- `docker-compose.yml` (on DO droplet) - Added WS_RPC_URL environment variable to data-verification service

## Decisions Made
- Used scp for file deployment instead of git pull -- local code is the canonical source
- Rebuilt with --no-cache flag to ensure completely fresh Docker image
- Set cursor to current block on first run (no historical backfill on initial deploy, as designed in 33-01)

## Deviations from Plan

None - plan executed exactly as written. Both checkpoint tasks completed successfully by the user.

## Issues Encountered
- indexedEvents=0 and eventsPerMinute=0 at verification time -- expected since Base Sepolia has low contract activity and the indexer was just started. The cursor is advancing (lastIndexedBlock matches lastBlock), confirming the indexer is polling/subscribed correctly.

## User Setup Required

None - deployment is complete. No further manual configuration needed.

## Next Phase Readiness
- v1.9 Event Indexer milestone is COMPLETE -- all 4 phases (31-34) executed successfully
- All 19 requirements verified and marked complete
- Future work: BACKFILL-01/02 (historical replay) and API-01/02 (query endpoints) are documented in REQUIREMENTS.md as future requirements
- GOLD feed (346/XAUUSD) still recording 0 prices -- pre-existing issue, documented in STATE.md

## Self-Check: PASSED

- 34-02-SUMMARY.md: FOUND
- No code commits expected (human-action + human-verify checkpoint tasks)

---
*Phase: 34-deploy-verify*
*Completed: 2026-03-03*
