---
phase: 40-infrastructure-keeper-hermes-sse
plan: 02
subsystem: infra
tags: [pyth, hermes, sse, eventsource, price-cache, keeper]

requires:
  - phase: none
    provides: n/a
provides:
  - Shared in-memory price cache fed by Hermes SSE stream
  - Consolidated Pyth price feed ID config (single source of truth)
  - SSE stream manager with exponential backoff reconnect
  - All /prices/* endpoints reading from cache instead of per-request HTTP
affects: [41-websocket-server, 42-frontend-ws]

tech-stack:
  added: []
  patterns: [SSE stream manager with reconnect wrapper, module-level singleton cache]

key-files:
  created:
    - keeper-service/src/config/priceFeedIds.ts
    - keeper-service/src/core/priceCache.ts
    - keeper-service/src/core/priceCache.test.ts
    - keeper-service/src/core/hermesStream.ts
    - keeper-service/src/core/hermesStream.test.ts
  modified:
    - keeper-service/src/core/candleCollector.ts
    - keeper-service/src/server/controllers/pricesController.ts
    - keeper-service/src/utils/healthState.ts
    - keeper-service/src/index.ts

key-decisions:
  - "Used module-level Map singleton for price cache instead of class instance"
  - "Kept 2s candle collector interval sampling from cache rather than event-driven"

patterns-established:
  - "Price cache singleton: all price consumers read from priceCache.ts, only SSE stream writes"
  - "Consolidated config: feed IDs, decimals, precision constants in config/priceFeedIds.ts"

requirements-completed: [KSTR-01, KSTR-02, KSTR-03]

duration: 5min
completed: 2026-03-06
---

# Phase 40 Plan 02: Keeper Hermes SSE Summary

**Pyth Hermes SSE streaming replacing 2s HTTP polling, with shared price cache consumed by all /prices/* endpoints and candle collector**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T02:03:24Z
- **Completed:** 2026-03-06T02:08:39Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- SSE stream connects to Pyth Hermes and populates shared in-memory price cache
- All /prices/* endpoints (getTickers, get24hPrices, getPriceBySymbol) serve from cache -- zero per-request Hermes HTTP calls
- Candle collector builds OHLC from cache data instead of polling Hermes
- SSE reconnects automatically with exponential backoff (1s to 30s cap)
- Health state tracks SSE connection status
- PYTH_PRICE_FEED_IDS consolidated into single source of truth

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared config, price cache, and SSE stream manager with tests** - `28f822d` (feat)
2. **Task 2: Rewire candleCollector and pricesController to use shared cache** - `47f275e` (feat)

## Files Created/Modified
- `keeper-service/src/config/priceFeedIds.ts` - Consolidated Pyth feed IDs, feedIdToSymbol reverse map, TOKEN_DECIMALS, GMX_PRICE_PRECISION
- `keeper-service/src/core/priceCache.ts` - In-memory price cache singleton (updatePrice, getPrice, getAllPrices, getLastUpdateTime, clearCache)
- `keeper-service/src/core/priceCache.test.ts` - 6 unit tests for price cache operations
- `keeper-service/src/core/hermesStream.ts` - SSE stream manager with exponential backoff reconnect
- `keeper-service/src/core/hermesStream.test.ts` - 6 unit tests for SSE stream lifecycle and reconnect
- `keeper-service/src/core/candleCollector.ts` - Rewired to read from priceCache instead of Hermes HTTP
- `keeper-service/src/server/controllers/pricesController.ts` - Rewired all 3 endpoints to read from priceCache
- `keeper-service/src/utils/healthState.ts` - Added sseConnected field and setSseStatus()
- `keeper-service/src/index.ts` - Start SSE stream before candle collector, cleanup on shutdown

## Decisions Made
- Used module-level Map singleton for price cache (simplest pattern, matches existing healthState style)
- Kept 2s candle collector interval sampling from cache rather than making it event-driven (cache is fed continuously by SSE, collector samples on its own cadence for candle building)
- Used `any` type for EventSource in hermesStream.ts to avoid importing eventsource types (transitive dependency)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest 4 does not support `-x` flag (plan's verify command uses it) -- used `--bail 1` instead
- Pre-existing integration test failures (DB access denied, position key mismatch) unrelated to changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SSE-fed price cache is ready for Phase 41 (WebSocket server) to broadcast to frontend clients
- Health endpoint reports SSE connection status for monitoring
- All existing unit tests pass (pre-existing integration failures documented as out of scope)

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (28f822d, 47f275e) verified in git log.

---
*Phase: 40-infrastructure-keeper-hermes-sse*
*Completed: 2026-03-06*
