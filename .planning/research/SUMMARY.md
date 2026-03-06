# Project Research Summary

**Project:** v1.12 WebSocket Price Streaming
**Domain:** Real-time price streaming for perpetual futures trading interface
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

This project replaces three HTTP polling loops with WebSocket-based streaming across two system boundaries: Pyth Hermes to the keeper service (SSE), and the keeper service to the frontend (WebSocket). The current architecture polls Pyth Hermes every 2 seconds for candle data and forces every frontend tab to poll the keeper every 1 second for both ticker prices and chart bars. This adds 1-3 seconds of unnecessary latency and scales poorly with multiple open tabs. The recommended approach follows a strict upstream-first build order: stream from Hermes first, then expose a WebSocket server on the keeper, then wire the frontend to consume it.

The stack delta is minimal -- one new dependency (`ws` ^8.19.0) on the keeper, zero new dependencies on the frontend. The existing `@pythnetwork/hermes-client` already supports SSE streaming via `getPriceUpdatesStream()`. The frontend uses the native browser WebSocket API. SWR continues handling non-streaming data (candle history, APY, incentives). This is a targeted infrastructure upgrade, not a rewrite.

The primary risks are infrastructure-level: Vercel cannot proxy WebSocket connections (the frontend must connect directly to the keeper), which requires TLS termination on the DigitalOcean droplet to avoid mixed-content blocking. On the keeper side, unbounded message buffering for slow/dead clients can OOM the process and take down all keeper services (liquidations, order execution, candle collection). Both risks have well-documented mitigations and must be addressed in Phase 1 before any downstream work begins.

## Key Findings

### Recommended Stack

The stack change is deliberately small. Only one new npm package is needed across both services.

**Core technologies:**
- `ws` ^8.19.0 (keeper): WebSocket server for broadcasting prices to frontend -- standard Node.js WS library, zero dependencies, attaches to existing Express HTTP server on port 37017
- `@pythnetwork/hermes-client` ^2.1.0 (keeper, existing): `getPriceUpdatesStream()` returns an EventSource for SSE streaming -- replaces 2s HTTP polling with push-based price delivery
- Native browser `WebSocket` API (frontend): No library needed -- reconnection logic is ~20 lines, avoids Socket.IO's 300KB bundle for features we do not use
- SWR 2.3.3 (frontend, existing): Continues handling request-response data; WebSocket supplements it for streaming, does not replace it

### Expected Features

**Must have (table stakes):**
- Keeper Hermes SSE streaming -- replaces 2s HTTP poll, catches price extremes between ticks
- Keeper WebSocket endpoint -- broadcasts ticker and candle updates to all connected frontends
- Frontend mark prices via WebSocket -- replaces 1s SWR poll, drives all price displays
- TradingView real-time bars via WebSocket -- replaces 1s PauseableInterval poll, fixes chart staleness
- Connection resilience with auto-reconnect and exponential backoff with jitter
- Stale price indicator -- warning banner if prices stop arriving for >5 seconds

**Should have (differentiators):**
- Sub-second PnL updates -- derived calculation, free once mark prices stream via WebSocket
- More accurate candle high/low -- SSE provides more data points than 2s polling
- Ticker snapshot on connect -- eliminates "loading prices..." gap on page load

**Defer (v2+):**
- Multi-resolution chart streaming (current aggregation approach works)
- Binary/protobuf encoding (JSON is fine for 6 markets on testnet)
- Per-user position streaming (positions change infrequently, poll on trade events)

### Architecture Approach

The architecture follows a fan-out pattern: a single persistent SSE connection from keeper to Pyth Hermes feeds an in-memory price cache (`priceStreamCollector`), which emits events to a WebSocket broadcast server (`wsServer`), which pushes to N frontend clients. The keeper remains the single source of truth for prices -- both the WebSocket broadcast and the existing HTTP endpoints read from the same in-memory cache, eliminating divergence. The frontend maintains a single multiplexed WebSocket connection per tab with message-type discrimination (`ticker`, `candle`, `candle_update`, `ping`).

**Major components:**
1. `priceStreamCollector` (keeper, new) -- single Hermes SSE connection, maintains latestTickers + currentCandles in memory, flushes completed candles to PostgreSQL
2. `wsServer` (keeper, new) -- WebSocket server on existing HTTP server, broadcasts price/candle events, manages subscriptions and heartbeats
3. `usePriceWebSocket` (frontend, new) -- single WS connection per tab, dispatches updates to global price store, handles reconnection
4. `useTokenRecentPricesData` (frontend, modified) -- reads from WS-fed store with automatic HTTP polling fallback
5. `DataFeed.subscribeBars` (frontend, modified) -- receives candle pushes via WS callback instead of PauseableInterval polling

### Critical Pitfalls

1. **Vercel cannot proxy WebSocket** -- frontend must connect directly to keeper. Requires dedicated DNS record (`ws.0xmarkets.io`) and TLS on the DO droplet. Decide this in Phase 1 or all subsequent work is wasted.
2. **Silent connection death without heartbeat** -- TCP connections die silently from NAT timeout, sleep/wake, mobile transitions. Server must send ping every 15-20s, terminate clients missing 2 pongs. Client must detect staleness after 10s of silence.
3. **Dual-source race condition during migration** -- stale HTTP response overwrites fresh WS update. Gate all price updates on `publishTime` timestamp. Disable SWR polling when WS is active.
4. **Keeper memory exhaustion from slow/dead clients** -- `ws` buffers outgoing messages unboundedly. Check `bufferedAmount` before each send, skip updates when buffer exceeds 64KB. Cap max connections. This can OOM the keeper and take down liquidations.
5. **Mixed content blocking (HTTPS to plain WS)** -- browser blocks `ws://` from `https://` page. TLS termination (nginx + Let's Encrypt or Caddy) on DO droplet is a prerequisite for all frontend WS work.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Infrastructure + Keeper Hermes SSE

**Rationale:** Everything downstream depends on TLS infrastructure and a streaming price source. Without TLS, the frontend cannot connect. Without Hermes SSE, there is nothing to broadcast. This phase is also independently valuable -- it eliminates per-request Hermes polling even before WebSocket exists.

**Delivers:** TLS-terminated WebSocket-capable endpoint on DO droplet. `priceStreamCollector` replacing `candleCollector` with Hermes SSE streaming. Modified `pricesController` reading from in-memory cache instead of calling Hermes per request. All existing HTTP endpoints continue working unchanged.

**Addresses:** Keeper Hermes SSE (table stakes), more accurate candle high/low (differentiator)

**Avoids:** Pitfall 5 (mixed content), Pitfall 1 (Vercel proxy), Pitfall 7 (candle semantics -- validate against HTTP baseline), Pitfall 9 (Lazer/Hermes naming confusion)

### Phase 2: Keeper WebSocket Server

**Rationale:** Server must broadcast before clients can consume. Depends on Phase 1's priceStreamCollector events.

**Delivers:** `wsServer` mounted on existing HTTP server at `/ws/prices`. Broadcasts ticker + candle updates. Subscription protocol. Heartbeat/ping-pong. Backpressure handling. Testable with `wscat`.

**Addresses:** Keeper WS endpoint (table stakes), ticker snapshot on connect (differentiator)

**Avoids:** Pitfall 6 (port conflict -- use `noServer: true`), Pitfall 4 (memory exhaustion -- bufferedAmount check + client cap), Pitfall 2 (silent deaths -- heartbeat from day one), Pitfall 12 (format breaking changes -- define schema upfront)

### Phase 3: Frontend WebSocket Integration

**Rationale:** Consumer of the data. Cannot test without keeper WS server running. This is where users see the improvement.

**Delivers:** `usePriceWebSocket` hook with connection management. Modified `useTokenRecentPricesData` reading from WS store. Modified `DataFeed.subscribeBars` using WS push. HTTP polling fallback. Stale price indicator. Connection status display.

**Addresses:** Frontend mark prices via WS (table stakes), TradingView real-time bars (table stakes), connection resilience (table stakes), stale price indicator (table stakes), sub-second PnL updates (differentiator)

**Avoids:** Pitfall 3 (race condition -- timestamp-gated updates, disable SWR when WS active), Pitfall 8 (thundering herd -- exponential backoff with jitter), Pitfall 10 (no degradation -- HTTP fallback after 5s), Pitfall 11 (background tabs -- Page Visibility API throttling)

### Phase Ordering Rationale

- **Strict upstream-first dependency chain:** Hermes SSE (data source) -> WS server (broadcaster) -> frontend client (consumer). Cannot skip or reorder.
- **Phase 1 is independently valuable:** Even without WebSocket, switching to Hermes SSE and caching prices in memory eliminates per-request Hermes calls and improves candle accuracy. If the project stalls after Phase 1, the keeper is still better off.
- **Infrastructure is a prerequisite, not a phase:** TLS setup is bundled into Phase 1 because Phase 3 cannot function without it. Separating infrastructure into its own phase risks it being skipped or deferred.
- **All three phases must ship together for user-visible impact.** Phase 1 and 2 are invisible to users. Phase 3 is the payoff. Plan accordingly -- do not ship Phase 1 and leave it for weeks.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (TLS/infrastructure):** Need to verify current nginx/Caddy setup on DO droplet, DNS configuration for `ws.0xmarkets.io`, and whether the existing firewall allows WebSocket upgrade on port 37017.
- **Phase 2 (subscription protocol):** The subscribe/unsubscribe protocol for candle channels needs exact specification -- which resolutions to support, whether to filter by symbol server-side or client-side.

Phases with standard patterns (skip research-phase):
- **Phase 3 (frontend WS client):** Well-documented patterns. The existing `WebsocketContextProvider.tsx` in the codebase already implements reconnect + health check for the RPC provider -- same approach applies. TradingView `subscribeBars` callback signature is unchanged.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All verified from existing codebase lockfiles, npm registry, and Pyth type declarations. Zero speculative dependencies. |
| Features | HIGH | Feature set derived from direct codebase analysis of current polling patterns. Competitor analysis (Hyperliquid) confirms table stakes. |
| Architecture | HIGH | Component boundaries follow existing codebase structure. Data flow verified against current `candleCollector.ts`, `pricesController.ts`, `DataFeed.ts`. |
| Pitfalls | HIGH | Critical pitfalls (Vercel WS limitation, ws buffering, mixed content) sourced from official documentation and confirmed GitHub issues. |

**Overall confidence:** HIGH

### Gaps to Address

- **DO droplet TLS status:** Unknown whether nginx or Caddy is already running on the droplet. Phase 1 planning must audit current infrastructure before choosing a TLS approach.
- **Vercel WS proxy verification:** While documentation says Vercel does not support WS, the exact behavior of the current `/api/keeper` proxy rewrite for upgrade requests should be tested empirically before committing to direct connection.
- **Pyth Hermes SSE rate/volume:** The exact frequency of SSE events per feed is not documented precisely. Phase 1 should measure actual event rate to calibrate the batching window (100-200ms proposed).
- **Concurrent Pyth connections:** Whether the existing Pyth Pro API key supports both a Lazer WS and a Hermes SSE connection simultaneously without rate limiting needs verification during Phase 1.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `keeper-service/package.json`, `candleCollector.ts`, `pricesController.ts`, `httpServer.ts`, `pythLazerOracle.ts`
- Existing codebase: `src/domain/tradingview/DataFeed.ts`, `useTokenRecentPricesData.ts`, `oracleKeeperFetcher.ts`, `WebsocketContextProvider.tsx`
- `@pythnetwork/hermes-client` type declarations -- `getPriceUpdatesStream()` API verified
- [ws npm package](https://www.npmjs.com/package/ws) v8.19.0 -- zero dependencies, upgrade handling
- [Vercel KB: Serverless Functions do not support WebSocket](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [ws GitHub issue #1830](https://github.com/websockets/ws/issues/1830) -- bufferedAmount memory leak confirmed

### Secondary (MEDIUM confidence)
- [Pyth Hermes SSE documentation](https://docs.pyth.network/price-feeds/core/fetch-price-updates) -- 24h auto-close policy
- [TradingView streaming implementation guide](https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial/Streaming-Implementation/)
- [Hyperliquid WebSocket API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket) -- competitor reference
- [Nginx WebSocket proxy docs](https://nginx.org/en/docs/http/websocket.html) -- proxy_read_timeout default 60s
- [Wolt engineering: From polling to WebSockets](https://careers.wolt.com/en/blog/engineering/from-polling-to-websockets-improving-order-tracking-user-experience) -- race condition patterns

---
*Research completed: 2026-03-05*
*Replaces: v1.7 SUMMARY.md (2026-02-27) -- that covered liquidation readiness; this covers v1.12 WebSocket streaming scope*
*Ready for roadmap: yes*
