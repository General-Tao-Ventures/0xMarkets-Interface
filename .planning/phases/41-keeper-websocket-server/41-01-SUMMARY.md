---
phase: 41-keeper-websocket-server
plan: 01
subsystem: infra
tags: [websocket, ws, real-time, broadcast, keeper-service, heartbeat, backpressure]

# Dependency graph
requires:
  - phase: 40-infrastructure-keeper-hermes-sse
    provides: SSE-fed priceCache and candleCollector with exported getAllPrices/currentCandles
provides:
  - WebSocket broadcast server on port 37017 (shared with Express)
  - broadcastTickers() function called on each SSE price update
  - 200ms candle broadcast interval from currentCandles map
  - Heartbeat ping/pong for dead connection detection
  - Backpressure protection skipping slow clients
affects: [42-frontend-websocket-client]

# Tech tracking
tech-stack:
  added: [ws 8.19.0, @types/ws 8.18.1]
  patterns: [WebSocketServer attached to http.Server via { server } option, pre-serialized broadcast, bufferedAmount backpressure check]

key-files:
  created:
    - keeper-service/src/core/wsBroadcast.ts
    - keeper-service/src/core/wsBroadcast.test.ts
  modified:
    - keeper-service/src/server/httpServer.ts
    - keeper-service/src/core/hermesStream.ts
    - keeper-service/src/index.ts
    - keeper-service/src/utils/healthState.ts
    - keeper-service/package.json
    - keeper-service/pnpm-lock.yaml

key-decisions:
  - "Duplicated normalizePythPrice in wsBroadcast rather than extracting shared utility (5-line pure function, avoids refactoring pricesController)"
  - "Used ws { server } constructor to share port 37017 with Express (no additional port/firewall changes)"

patterns-established:
  - "WebSocket broadcast: serialize message once, iterate wss.clients, skip non-OPEN and high-bufferedAmount clients"
  - "30s heartbeat interval with isAlive flag on ws object for dead connection detection"

requirements-completed: [KWS-01, KWS-02, KWS-03, KWS-04, KWS-05]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 41 Plan 01: Keeper WebSocket Server Summary

**WebSocket broadcast server on keeper-service pushing real-time ticker and candle data to connected clients via ws library with heartbeat and backpressure protection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T03:12:52Z
- **Completed:** 2026-03-06T03:16:17Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- WebSocket server module with startWsBroadcast, broadcastTickers, broadcastCandles, stopWsBroadcast, getWsClientCount exports
- Unit tests covering all 5 KWS requirements (9 tests passing)
- Full wiring into keeper lifecycle: httpServer returns http.Server, hermesStream broadcasts tickers on each SSE update, index.ts manages start/stop
- Health endpoint reports wsBroadcastActive status and wsClients count

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wsBroadcast module with unit tests** - `1b80432` (feat)
2. **Task 2: Wire WebSocket server into keeper startup and SSE stream** - `20d32f1` (feat)

## Files Created/Modified
- `keeper-service/src/core/wsBroadcast.ts` - WebSocket server, heartbeat, ticker/candle broadcast, backpressure
- `keeper-service/src/core/wsBroadcast.test.ts` - 9 unit tests covering KWS-01 through KWS-05
- `keeper-service/src/server/httpServer.ts` - Refactored to http.createServer(app), added wsClients/wsBroadcastActive to health
- `keeper-service/src/core/hermesStream.ts` - Calls broadcastTickers() after each SSE price update
- `keeper-service/src/index.ts` - Starts/stops wsBroadcast in lifecycle
- `keeper-service/src/utils/healthState.ts` - Added wsBroadcastActive field and setter
- `keeper-service/package.json` - Added ws dependency
- `keeper-service/pnpm-lock.yaml` - Lockfile update

## Decisions Made
- Duplicated normalizePythPrice (5-line pure function) in wsBroadcast.ts rather than extracting a shared utility, avoiding pricesController refactoring
- Used ws `{ server }` constructor option to share port 37017 with Express, no firewall or Cloudflare changes needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript build error in pythLazerOracle.ts (ErrorEvent type mismatch) -- unrelated to this plan, not introduced by changes
- Pre-existing test failures in positionFetcher.integration.test.ts -- unrelated to this plan

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- WebSocket server is ready for frontend integration (Phase 42)
- Deployment: keeper-service needs restart on DO droplet to activate WebSocket server
- Cloudflare already proxies WebSocket connections through keeper.0xmarkets.io (configured in Phase 40)
- Manual verification available: `npx wscat -c wss://keeper.0xmarkets.io` after deployment

---
*Phase: 41-keeper-websocket-server*
*Completed: 2026-03-06*
