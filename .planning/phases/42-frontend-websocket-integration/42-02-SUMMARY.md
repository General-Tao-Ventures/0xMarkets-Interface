---
phase: 42-frontend-websocket-integration
plan: 02
subsystem: ui
tags: [websocket, react, tradingview, swr, adaptive-polling, real-time]

requires:
  - phase: 42-frontend-websocket-integration
    plan: 01
    provides: KeeperWebSocketManager, useKeeperWebSocket hooks, types, and event system
  - phase: 41-keeper-websocket-server
    provides: WebSocket server broadcasting ticker and candle data over wss://keeper.0xmarkets.io
provides:
  - Real-time mark price updates via WebSocket ticker injection into SWR price pipeline
  - Real-time TradingView chart candle updates via WebSocket candle subscription
  - WebSocket connection status indicator in KeeperStatusBanner
  - Adaptive HTTP polling (10s when WS connected, 1s fallback)
affects: []

tech-stack:
  added: []
  patterns:
    - "Ref-based WS data injection into SWR fetcher (avoids cache semantics issues)"
    - "Module-level eager WebSocket connect (avoids React StrictMode double-mount)"
    - "SWR mutate with data+revalidate:false to avoid triggering HTTP refetch on WS message"
    - "Timestamp gating to prevent stale HTTP from overwriting fresher WS data"

key-files:
  created: []
  modified:
    - src/domain/synthetics/tokens/useTokenRecentPricesData.ts
    - src/domain/tradingview/DataFeed.ts
    - src/components/KeeperStatusBanner/KeeperStatusBanner.tsx
    - src/components/KeeperStatusBanner/KeeperStatusBanner.scss
    - src/lib/keeperWebSocket/KeeperWebSocketManager.ts
    - src/lib/keeperWebSocket/useKeeperWebSocket.ts
    - src/lib/keeperWebSocket/index.ts

key-decisions:
  - "Always use wss://keeper.0xmarkets.io (Cloudflare-proxied) instead of direct IP"
  - "Eager module-level WebSocket connect to avoid React StrictMode double-mount killing connections"
  - "SWR mutate with data+revalidate:false to prevent WS messages triggering HTTP refetch loops"

patterns-established:
  - "WebSocket-to-SWR bridge: WS writes to ref, SWR fetcher reads ref, timestamp gating decides winner"
  - "Adaptive polling: reduce HTTP interval when real-time transport is active"

requirements-completed: [FWS-02, FWS-03, FWS-06]

duration: ~45min
completed: 2026-03-06
---

# Phase 42 Plan 02: Wire WebSocket Integration Summary

**Real-time mark prices and TradingView candles via WebSocket push, reducing HTTP polling from 204 req/15s to 1 req/15s with adaptive fallback**

## Performance

- **Duration:** ~45 min (across checkpoint)
- **Started:** 2026-03-06T04:00:00Z
- **Completed:** 2026-03-06T04:31:48Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments
- Mark prices update in real-time via WebSocket ticker injection into the SWR price pipeline, with timestamp gating to prevent stale HTTP overwrites
- TradingView chart receives real-time candle bar updates via WebSocket subscription in DataFeed.subscribeBars
- HTTP polling reduced from 1s to 10s when WebSocket is connected, automatically restored on disconnect
- Connection status banner shows "Reconnecting to live price feed..." during WebSocket reconnection
- Verified end-to-end: 6 tickers and 13 candles received in 3 seconds, HTTP requests dropped from 204/15s to 1/15s

## Task Commits

Each task was committed atomically:

1. **Task 1: Inject WebSocket tickers into price pipeline with adaptive polling** - `1926874de` (feat)
2. **Task 2: Wire WebSocket candles into TradingView DataFeed** - `59599e380` (feat)
3. **Task 3: Add WebSocket connection status to KeeperStatusBanner** - `fabd128a2` (feat)
4. **Task 4: Verify WebSocket integration end-to-end** - checkpoint approved (no commit)

Post-verification fix commits:
- `593ff5021` - fix: WS URL, eager module-level connect, SWR revalidate:false
- `590465c65` - fix: wrap WS mutate data in SWR sequential wrapper format {result, start}

## Files Created/Modified
- `src/domain/synthetics/tokens/useTokenRecentPricesData.ts` - WebSocket ticker injection with ref-based SWR bridge and adaptive polling interval
- `src/domain/tradingview/DataFeed.ts` - WebSocket candle subscription replacing PauseableInterval for V2 non-stable tokens
- `src/components/KeeperStatusBanner/KeeperStatusBanner.tsx` - WebSocket connection status indicator with reconnection banner
- `src/components/KeeperStatusBanner/KeeperStatusBanner.scss` - Amber reconnection banner styling
- `src/lib/keeperWebSocket/KeeperWebSocketManager.ts` - Removed ref-counting (switched to eager module-level connect)
- `src/lib/keeperWebSocket/useKeeperWebSocket.ts` - Simplified to eager singleton pattern
- `src/lib/keeperWebSocket/index.ts` - Updated exports

## Decisions Made
- Always use `wss://keeper.0xmarkets.io` instead of direct IP -- the local `ws://142.93.203.222:37017` URL didn't work due to mixed content and Cloudflare proxy requirements
- Switched from React-managed connection lifecycle to eager module-level connect -- React StrictMode double-mount was killing the WebSocket connection immediately after opening
- Changed SWR `mutate()` to pass data with `revalidate: false` -- calling `mutate()` without data was triggering a full HTTP refetch on every WebSocket message, defeating the purpose

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed WebSocket URL to always use wss://keeper.0xmarkets.io**
- **Found during:** Task 4 (end-to-end verification)
- **Issue:** ws://142.93.203.222:37017 failed due to mixed content restrictions and Cloudflare proxy
- **Fix:** Hardcoded wss://keeper.0xmarkets.io as the WebSocket URL
- **Files modified:** src/lib/keeperWebSocket/KeeperWebSocketManager.ts
- **Committed in:** `593ff5021`

**2. [Rule 1 - Bug] Fixed React StrictMode double-mount killing WebSocket**
- **Found during:** Task 4 (end-to-end verification)
- **Issue:** React StrictMode mounts/unmounts/remounts components, causing the cleanup effect to disconnect the WS immediately
- **Fix:** Switched to eager module-level connect pattern (no ref-counting, singleton manager connects on import)
- **Files modified:** src/lib/keeperWebSocket/useKeeperWebSocket.ts, src/lib/keeperWebSocket/KeeperWebSocketManager.ts
- **Committed in:** `593ff5021`

**3. [Rule 1 - Bug] Fixed SWR mutate triggering HTTP refetch on every WS message**
- **Found during:** Task 4 (end-to-end verification)
- **Issue:** `mutate()` without data argument triggered SWR revalidation (HTTP fetch) on every WebSocket message, increasing traffic instead of reducing it
- **Fix:** Changed to `mutate(data, { revalidate: false })` to inject data directly into SWR cache
- **Files modified:** src/domain/synthetics/tokens/useTokenRecentPricesData.ts
- **Committed in:** `593ff5021`

**4. [Rule 1 - Bug] Fixed SWR sequential wrapper format mismatch**
- **Found during:** Task 4 (end-to-end verification)
- **Issue:** `useSequentialTimedSWR` expects data wrapped in `{result, start}` format, but mutate was passing raw ticker data, causing the pipeline to break
- **Fix:** Wrapped WS data in `{result: data, start: Date.now()}` to match useSequentialTimedSWR expectations
- **Files modified:** src/domain/synthetics/tokens/useTokenRecentPricesData.ts
- **Committed in:** `590465c65`

---

**Total deviations:** 4 auto-fixed (4 bugs found during verification)
**Impact on plan:** All fixes were necessary for correct operation. Without them, WebSocket integration was non-functional (wrong URL), unstable (StrictMode killing connection), counterproductive (more HTTP requests), and data-incompatible (SWR wrapper mismatch).

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v1.12 WebSocket Price Streaming milestone is complete
- All phases (40-42) delivered: TLS infrastructure, keeper SSE streaming, WebSocket server, and frontend integration
- Production-verified: real-time prices flowing, HTTP polling reduced by >99%
- Future considerations: process isolation (PERF-01), PnL recalculation (PERF-02), stale price detection (RESL-01)

## Self-Check: PASSED

All 5 commits verified. SUMMARY.md exists.

---
*Phase: 42-frontend-websocket-integration*
*Completed: 2026-03-06*
