# Domain Pitfalls: WebSocket Price Streaming

**Domain:** Adding WebSocket streaming to an existing DeFi trading interface
**Researched:** 2026-03-05
**Context:** Keeper on DigitalOcean (Express on port 37017), frontend on Vercel, currently HTTP polling at 1-2s intervals

---

## Critical Pitfalls

Mistakes that cause outages, data corruption, or require architectural rework.

---

### Pitfall 1: Vercel Cannot Terminate WebSocket Connections

**What goes wrong:** You try to serve WebSocket connections from the keeper through Vercel's proxy/CDN layer. Vercel Serverless Functions do not support WebSocket connections. The frontend currently fetches prices via `oracleKeeperFetcher` which hits URLs configured in `sdk/configs/oracleKeeper.ts`. If that URL routes through Vercel, WebSocket upgrade requests will fail silently or return opaque 502 errors.

**Why it happens:** The existing HTTP polling works through Vercel's proxy because each request is stateless. WebSocket requires a persistent HTTP Upgrade handshake that Vercel's edge network does not support. Developers assume "if HTTP works through Vercel, WebSocket will too."

**Consequences:** WebSocket connections fail on the frontend. Users get no price updates. No error in keeper logs because the connection never reaches the keeper.

**Prevention:**
- Frontend WebSocket must connect DIRECTLY to the keeper's public endpoint, bypassing Vercel entirely.
- Set up a separate DNS record (e.g., `ws.0xmarkets.io`) pointing to the DO droplet (142.93.203.222) for WebSocket traffic.
- Keep the existing HTTP `/prices/tickers` endpoint alive as a fallback -- WebSocket is an enhancement, not a replacement.
- If nginx is added on the DO droplet for TLS termination, configure `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"`, and `proxy_read_timeout 86400s`.

**Detection:** WebSocket `onerror` fires immediately after `new WebSocket(url)`. Connection never reaches `onopen`. Browser DevTools Network tab shows the upgrade request failing with a non-101 status.

**Warning signs:** Any WebSocket URL containing `vercel.app` or routed through a Vercel-hosted domain without explicit WebSocket support.

**Phase:** Must be decided in Phase 1 (architecture/infrastructure). Wrong proxy path wastes all subsequent work.

---

### Pitfall 2: Silent Connection Death Without Application-Level Heartbeat

**What goes wrong:** The WebSocket connection drops silently -- no `close` event fires, no `error` event fires. The frontend shows stale prices for minutes without any indication. The keeper thinks the client is still connected and keeps buffering messages into the void.

**Why it happens:** TCP connections can die silently due to NAT timeout (commonly 60-300s on consumer routers), mobile network transitions, laptop sleep/wake, or intermediate load balancers dropping idle connections. The `ws` library in Node.js does NOT send ping frames automatically. The WebSocket protocol's ping/pong frames are not always forwarded by all intermediaries.

**Consequences:** Users see frozen prices and think the platform is live. They make trading decisions on data that stopped updating minutes ago. On the server side, dead connections accumulate, consuming memory (compounding Pitfall 4).

**Prevention:**
- Implement server-side heartbeat: `ws.ping()` every 15-20 seconds. Track last pong timestamp per client. Terminate clients that miss 2 consecutive pongs (`ws.terminate()`, not `ws.close()`).
- Implement client-side staleness detection: track `lastMessageTime`. If no message received for 10 seconds, assume dead connection and trigger reconnection. Display a "Reconnecting..." indicator in the UI.
- Add a price staleness indicator: if the most recent price update's `publishTime` is older than 5 seconds, show a warning badge next to the price.
- If nginx sits in front of the keeper, set `proxy_read_timeout 86400s` (default 60s silently kills idle WebSocket connections).

**Detection:** Monitor connected client count over time on the keeper. A count that only grows (never decreases) indicates silent deaths accumulating. Check `healthState` for divergence between `wsConnected` and actual active client count.

**Warning signs:** Users reporting "prices froze" without seeing any error toast. Keeper memory slowly growing.

**Phase:** Phase 1 (keeper WebSocket server) must include heartbeat from day one. Retrofitting heartbeat after deployment means a period of silent failures in production.

---

### Pitfall 3: Dual-Source Race Condition During Migration

**What goes wrong:** During the transition period, both HTTP polling and WebSocket are active. A stale HTTP response arrives AFTER a fresh WebSocket update, overwriting the latest price with an older one. Prices visibly jump backward.

**Why it happens:** The frontend currently uses `useTokenRecentPricesRequest` with SWR `refreshInterval: 1000` (in `src/lib/timeConstants.ts`). This will keep firing even after a WebSocket connection is established. HTTP responses have variable latency (50-500ms). WebSocket messages arrive near-instantly. Without timestamp comparison, last-write-wins means a slow HTTP response can overwrite a faster WebSocket update.

**Consequences:** Price jitter. Users see prices flip between two values. PnL calculations oscillate. Trading decisions made on incorrect prices. The UI feels broken even though both data sources are individually correct.

**Prevention:**
- Every price update (HTTP or WebSocket) must carry Pyth's `publish_time` timestamp (already present in both `pricesController.ts` ticker response and candle collector data).
- Frontend state update logic: only accept a price if its `publishTime` >= the currently displayed price's `publishTime`.
- When WebSocket connects successfully and receives its first price update, STOP the SWR polling interval (set `refreshInterval: 0` or conditionally disable the fetcher). Re-enable polling only on WebSocket disconnect after a grace period (5 seconds).
- Never run both sources simultaneously for the same data in steady state.

**Detection:** Add a counter for "rejected stale updates" in the frontend. If this counter is non-zero after WebSocket is stable, the race condition is active. Price values that oscillate between two distinct numbers at ~1Hz indicate the race.

**Warning signs:** After adding WebSocket, prices "flicker" or "jump" on the trade page. PnL values oscillate without trades happening.

**Phase:** Phase 3 (frontend WebSocket integration). The frontend migration phase must handle this explicitly.

---

### Pitfall 4: Keeper Memory Exhaustion from Slow/Dead Clients

**What goes wrong:** The keeper's `ws` server buffers outgoing messages for slow clients. With 7 price feeds being relayed to N browser clients, the send buffer grows unboundedly for any client that cannot keep up. The keeper process OOMs and crashes, killing ALL services: liquidation scanner, order execution candle collector, and price feeds.

**Why it happens:** The `ws` library's `send()` enqueues data in the Node.js TCP send buffer when the receiver is slow. There is no built-in backpressure mechanism. A single browser tab on a slow 3G connection, or a tab that went to sleep without closing the WebSocket, accumulates megabytes of buffered price updates on the server side. The keeper runs ALL critical services in a single Node.js process on a single DO droplet -- there is no process isolation.

**Consequences:** Keeper crashes from OOM. ALL keeper functions go down simultaneously: liquidations stop, order execution stops, candle collection stops, price feeds stop. Full platform outage caused by a WebSocket feature that was supposed to be an enhancement.

**Prevention:**
- Check `ws.bufferedAmount` before each `send()`. If buffered data exceeds 64KB, skip the update for that client. Price updates are ephemeral -- a dropped update is always superseded by the next one.
- Set a maximum client count (e.g., 50 for testnet). Reject new connections with HTTP 503 when at capacity.
- Combine with heartbeat-based dead connection cleanup (Pitfall 2).
- Rate-limit the relay: Pyth Lazer streams at 200ms intervals, but the frontend only needs ~500ms-1s updates. Throttle the broadcast to one message per 500ms.
- Monitor keeper memory: log `process.memoryUsage().rss` every 30 seconds. Alert if RSS exceeds 400MB (or 80% of available).
- Consider running the WebSocket server in a separate Node.js process (e.g., separate Docker container) to isolate it from the critical keeper loop. If the WS server OOMs, the liquidation scanner and order executor survive.

**Detection:** `process.memoryUsage().rss` trending upward over hours without corresponding increase in client count. `ws.bufferedAmount > 0` growing for specific clients in periodic health logs.

**Warning signs:** Keeper restarts without clear cause. Docker OOM-kill events in `docker logs`.

**Phase:** Phase 1 (keeper WebSocket server). Backpressure handling must be built into the broadcast loop from the start. Process isolation decision should be made during architecture.

---

### Pitfall 5: Mixed Content Blocking -- HTTPS Frontend Cannot Connect to Plain WS

**What goes wrong:** Frontend at `https://app.0xmarkets.io` (HTTPS via Vercel) tries to open `ws://142.93.203.222:37017` (plain WebSocket). Browser blocks the connection due to mixed content policy: an HTTPS page cannot load insecure WebSocket resources.

**Why it happens:** The keeper currently serves plain HTTP on port 37017 via Express (`httpServer.ts`). There is no TLS termination on the DO droplet. The existing HTTP polling works because the frontend proxies through Vercel's HTTPS edge (or the keeper URL is already HTTPS). WebSocket connections bypass Vercel (Pitfall 1) and go directly to the keeper, exposing the lack of TLS.

**Consequences:** `new WebSocket("ws://...")` fails silently in the browser. No connection is established. No error event fires in some browsers. The WebSocket feature appears completely broken with no obvious cause.

**Prevention:**
- Set up TLS on the DO droplet before writing any frontend WebSocket code. Options:
  1. **nginx + Let's Encrypt** as reverse proxy (proven, well-documented)
  2. **Caddy** for automatic HTTPS (simpler, auto-renews)
- Use a proper domain (`wss://ws.0xmarkets.io`) instead of raw IP. Let's Encrypt requires a domain for certificate issuance.
- Test the WebSocket connection from the actual deployed frontend URL, not from localhost (localhost is exempt from mixed content policies).

**Detection:** Browser console shows "Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'."

**Warning signs:** WebSocket works in local development (`http://localhost:3000` to `ws://localhost:37017`) but fails completely on the deployed site.

**Phase:** Phase 1 (infrastructure). TLS setup is a prerequisite for all frontend WebSocket work.

---

## Moderate Pitfalls

---

### Pitfall 6: Express and WebSocket Server Port Conflict

**What goes wrong:** You try to attach the `ws` WebSocketServer to the same HTTP server that Express uses (port 37017). Without careful handling of the `upgrade` event, the WebSocket server and Express compete for incoming connections. Existing HTTP endpoints (`/health`, `/prices/tickers`, `/prices/candles`, `/api/*`) start failing intermittently or the WebSocket upgrade never completes.

**Why it happens:** Both Express and `ws` need to handle HTTP requests on the same port. The `upgrade` event fires for all HTTP upgrade requests. Without explicit path-based routing, the WebSocket server may intercept health check requests, or Express may respond to WebSocket upgrade requests with a 404.

**Prevention:**
- **Option A (recommended for simplicity):** Run the WebSocket server on a separate port (e.g., 37019). Opens a new port on the firewall but completely avoids conflicts. The data-verification-service already uses 37019 -- use 37020 or another available port.
- **Option B (shared port):** Use `ws` with `noServer: true` and manually route the `upgrade` event:
  ```typescript
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws/prices') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy(); // reject non-WS upgrade requests
    }
  });
  ```
- After adding WebSocket, explicitly test ALL existing HTTP endpoints to verify they still work.

**Phase:** Phase 1 (keeper WebSocket server). Architecture decision needed before implementation.

---

### Pitfall 7: Pyth Hermes Streaming Has Different Semantics Than HTTP Polling

**What goes wrong:** The candle collector (`candleCollector.ts`) currently calls `client.getLatestPriceUpdates()` every 2 seconds via HTTP. Switching to Hermes SSE/WebSocket changes the data delivery pattern: updates arrive push-based at variable frequency (sub-second), not on a fixed 2-second cadence. The candle-building logic may produce subtly different OHLC data.

**Why it happens:** The current `tick()` function samples at fixed 2s intervals. With streaming, you get every price Pyth publishes. The `floorToMinute()` and in-memory candle logic still works correctly, but:
- "Open" is now the first streamed price of the minute (more accurate) rather than the first polled price (which could arrive up to 2s after the minute started).
- High/low coverage improves dramatically (catches spikes between polls).
- Volume of price updates per minute increases from ~30 to potentially hundreds, increasing CPU usage for candle processing.
- Hermes SSE connections auto-disconnect after 24 hours to prevent resource leaks.

**Prevention:**
- The candle-building logic is actually correct for both polling and streaming -- it's stateless per-update. No code changes needed for correctness.
- Add reconnection logic for the 24-hour disconnect: detect stream close, reconnect immediately.
- Debounce database writes: the current pattern (flush previous candle when minute changes) already handles this correctly. Do not change to flush on every update.
- Validate candle accuracy: compare streaming candles against HTTP-polled candles for a few hours before cutting over.

**Phase:** Phase 1 (keeper Pyth streaming). Test candle accuracy against HTTP baseline before removing the HTTP polling code path.

---

### Pitfall 8: Reconnection Thundering Herd After Keeper Restart

**What goes wrong:** The keeper restarts (deploy, crash, OOM). All connected frontend clients detect the disconnect simultaneously and reconnect at the same instant. The keeper gets slammed with N simultaneous WebSocket upgrade requests plus subscription messages, potentially overloading it during the fragile startup period.

**Why it happens:** All clients use the same reconnection delay without randomization. Reconnection attempts synchronize, creating a burst.

**Prevention:**
- Frontend reconnection must use exponential backoff with random jitter: `delay = min(1000 * 2^attempt, 30000) + random(0, 3000)`.
- The keeper should not broadcast accumulated/buffered messages on new connections -- just start fresh from the next price update.
- Set a connection rate limit on the keeper: accept at most 10 new connections per second during startup.
- After reconnecting, the frontend should immediately request the latest price via HTTP fallback (Pitfall 10) to avoid showing stale data during the reconnection window.

**Phase:** Phase 3 (frontend WebSocket client). Reconnection logic is a frontend concern.

---

### Pitfall 9: Pyth Lazer WebSocket Confusion -- Two Different Pyth Connections for Different Purposes

**What goes wrong:** The keeper already has ONE Pyth Lazer WebSocket connection (`PythLazerOracleService` in `pythLazerOracle.ts`) for on-chain oracle signing. Adding a second Pyth connection (Hermes for price streaming to the frontend) creates confusion about which connection serves which purpose. Developers modify the wrong connection, or assume one connection can serve both needs.

**Why it happens:** Both connections talk to Pyth infrastructure, both deliver price data, but they serve completely different purposes:
- **Pyth Lazer** (existing): `@pythnetwork/pyth-lazer-sdk`, binary EVM format, used for `updatePrice()` on-chain transactions. Cannot be repurposed for frontend streaming.
- **Pyth Hermes** (new): `@pythnetwork/hermes-client`, parsed JSON format, used for display prices. Does not provide EVM-encoded data for on-chain use.

**Prevention:**
- Name modules distinctly: `pythLazerOracle.ts` (existing, oracle signing) vs `priceStreamer.ts` or `hermesPriceStream.ts` (new, price streaming).
- Verify the Pyth Pro API key (`QpxMy21OMvC7rap9hYxJ6GB0eb3PdOEs2WvmG0XN`) supports both Lazer and Hermes concurrent connections without rate limiting.
- Document the two connections clearly in the keeper's README or config comments.

**Phase:** Phase 1 (keeper). Naming and separation must be clear from the start.

---

## Minor Pitfalls

---

### Pitfall 10: No Graceful Degradation When WebSocket Fails

**What goes wrong:** WebSocket is deployed as the primary price source. When it fails (keeper restart, network blip, client-side WebSocket unsupported), the frontend shows no prices at all. Users cannot trade.

**Prevention:**
- Keep the HTTP `/prices/tickers` endpoint operational. It is already built and working in `pricesController.ts`.
- Frontend should automatically fall back to HTTP polling (the current `useTokenRecentPricesRequest` with 1s SWR) when WebSocket is disconnected for more than 5 seconds.
- Display connection status: "Live" (WebSocket active), "Delayed" (HTTP polling fallback), "Offline" (both failed).
- The fallback must be tested: kill the WebSocket server while the frontend is running and verify prices continue updating via HTTP.

**Phase:** Phase 3 (frontend). Fallback logic is part of the frontend WebSocket integration.

---

### Pitfall 11: Browser Tab Backgrounding Wastes Resources

**What goes wrong:** WebSocket messages keep arriving when the browser tab is in the background. Each message triggers React state updates via the price store, causing unnecessary renders and CPU usage. On mobile, this drains battery and may cause the OS to kill the tab.

**Prevention:**
- Use the Page Visibility API (`document.visibilityState`). When hidden for more than 30 seconds, stop processing incoming WebSocket messages (but keep connection alive to avoid reconnection cost). Resume processing when visible.
- The current SWR polling uses `refreshWhenHidden: true`. Decide whether WebSocket should match this behavior or be smarter. For a trading app, keeping prices fresh in background tabs is reasonable -- but throttle to 5s updates instead of real-time.

**Phase:** Phase 3 (frontend optimization). Not a launch blocker but improves mobile experience.

---

### Pitfall 12: WebSocket Message Format Breaking Changes

**What goes wrong:** The keeper broadcasts prices in a specific JSON format. Frontend parses this format. A keeper deploy changes the format (field renamed, new field added, precision changed). Frontend breaks until redeployed.

**Prevention:**
- Define a versioned message schema. Include a `version` field in every WebSocket message (e.g., `{ version: 1, type: "prices", data: [...] }`).
- Frontend should validate incoming messages and gracefully ignore unknown versions (fall back to HTTP).
- Deploy keeper changes before frontend changes. The keeper's HTTP `/prices/tickers` format is the contract -- the WebSocket format should match it exactly.

**Phase:** Phase 1 (keeper). Define the message format specification before implementing either side.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Infrastructure / TLS | Pitfall 5: mixed content blocking | Set up nginx + Let's Encrypt on DO droplet FIRST |
| Infrastructure / DNS | Pitfall 1: Vercel cannot proxy WS | Create `ws.0xmarkets.io` DNS record pointing to DO |
| Keeper WebSocket server | Pitfall 6: port conflict with Express | Use `noServer: true` or separate port |
| Keeper WebSocket server | Pitfall 4: memory exhaustion from slow clients | Check `bufferedAmount`, set client cap, implement heartbeat |
| Keeper WebSocket server | Pitfall 2: silent connection deaths | Server-side ping/pong every 15s, terminate after 2 missed pongs |
| Keeper WebSocket server | Pitfall 12: format breaking changes | Define versioned message schema upfront |
| Keeper Pyth streaming | Pitfall 7: candle semantics change | Validate candle accuracy against HTTP baseline |
| Keeper Pyth streaming | Pitfall 9: Lazer/Hermes confusion | Name modules distinctly, separate concerns |
| Frontend WebSocket client | Pitfall 3: race condition with HTTP polling | Timestamp-gated updates, disable polling when WS active |
| Frontend WebSocket client | Pitfall 8: thundering herd on reconnect | Exponential backoff with random jitter |
| Frontend fallback | Pitfall 10: no degradation path | Keep HTTP endpoint, auto-fallback after 5s disconnect |
| Frontend optimization | Pitfall 11: background tab waste | Page Visibility API throttling |

---

## Sources

### Primary (HIGH confidence -- official documentation and verified issues)
- [Vercel KB: Serverless Functions do not support WebSocket](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections) -- Vercel's official statement
- [Nginx WebSocket proxy documentation](https://nginx.org/en/docs/http/websocket.html) -- official proxy_read_timeout default of 60s
- [ws library: memory leak in weak network environments](https://github.com/websockets/ws/issues/1830) -- confirmed bufferedAmount accumulation
- [Node.js backpressure in streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams) -- official Node.js documentation
- [Pyth Hermes documentation](https://docs.pyth.network/price-feeds/core/how-pyth-works/hermes) -- SSE streaming, 24h auto-disconnect

### Secondary (MEDIUM confidence -- well-sourced technical analysis)
- [WebSocket backpressure analysis](https://skylinecodes.substack.com/p/backpressure-in-websocket-streams) -- buffering layer breakdown
- [WebSocket heartbeat/ping-pong implementation](https://oneuptime.com/blog/post/2026-01-27-websocket-heartbeat/view) -- 20-30s interval recommendation
- [WebSockets in production with Node.js](https://medium.com/voodoo-engineering/websockets-on-production-with-node-js-bdc82d07bb9f) -- silent disconnect patterns
- [Wolt: From polling to WebSockets](https://careers.wolt.com/en/blog/engineering/from-polling-to-websockets-improving-order-tracking-user-experience) -- race condition during migration, timestamp-based ordering

### Codebase Analysis (HIGH confidence -- direct reading)
- `keeper-service/src/core/candleCollector.ts` -- 2s HTTP polling, in-memory candle building, floorToMinute logic
- `keeper-service/src/server/controllers/pricesController.ts` -- HTTP ticker endpoint, normalizePythPrice, HermesClient usage
- `keeper-service/src/core/pythLazerOracle.ts` -- existing Pyth Lazer WebSocket, binary EVM format, 200ms channel
- `keeper-service/src/server/httpServer.ts` -- Express on port 37017, CORS middleware, health endpoint
- `src/domain/synthetics/tokens/useTokenRecentPricesData.ts` -- SWR with 1s refreshInterval, publish_time available
- `src/lib/timeConstants.ts` -- PRICES_UPDATE_INTERVAL = 1000ms
- `src/lib/oracleKeeperFetcher/oracleKeeperFetcher.ts` -- URL routing, fallback logic

---
*Pitfalls research for: v1.12 WebSocket Price Streaming*
*Researched: 2026-03-05*
