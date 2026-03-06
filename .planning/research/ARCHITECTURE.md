# Architecture Patterns

**Domain:** WebSocket price streaming for perpetual futures trading interface
**Researched:** 2026-03-05

## Current Architecture (Before WebSocket)

```
Pyth Hermes HTTP API
       |
       | HTTP poll every 2s (candleCollector.ts)
       | HTTP poll per-request (pricesController.ts getTickers)
       v
keeper-service (Express, port 37017)
  - candleCollector: polls Hermes, builds 1-min OHLC in memory, flushes to PostgreSQL
  - pricesController: polls Hermes on each /prices/tickers request (no caching)
  - candlesController: reads from DB + merges in-memory currentCandles
       |
       | HTTP poll every 1s (useTokenRecentPricesData via SWR)
       | HTTP poll every 1s (DataFeed subscribeBars via PauseableInterval)
       v
Frontend (React/Vite on Vercel)
  - useTokenRecentPricesData: fetches /prices/tickers, drives all price displays
  - DataFeed.ts: fetches /prices/candles, drives TradingView chart
```

**Key problem:** Every frontend tab polls keeper every 1s for tickers AND every 1s for candles. Keeper itself re-fetches Hermes on every tickers request. With N tabs open, keeper makes N+30 HTTP requests/minute to Hermes just for tickers.

## Recommended Architecture (After WebSocket)

```
Pyth Hermes SSE Stream
  /v2/updates/price/stream?ids[]=...
       |
       | Single persistent SSE connection (EventSource)
       v
keeper-service (Express + ws, port 37017)
  +-- priceStreamCollector.ts (NEW - replaces both candleCollector polling AND pricesController polling)
  |     - Connects to Hermes SSE
  |     - Maintains latestTickers Map<symbol, TickerData> (in-memory)
  |     - Maintains currentCandles Map<symbol, InMemoryCandle> (replaces candleCollector)
  |     - Flushes completed candles to PostgreSQL (same as today)
  |
  +-- wsServer.ts (NEW - WebSocket server on same HTTP server)
  |     - Upgrades /ws/prices to WebSocket
  |     - Broadcasts ticker updates to all connected clients
  |     - Broadcasts candle updates to subscribed clients
  |     - Tracks client subscriptions (which symbols, which resolutions)
  |
  +-- pricesController.ts (MODIFIED - reads from in-memory cache, no more Hermes calls)
  +-- candlesController.ts (UNCHANGED - still serves historical candles from DB)
       |
       | WebSocket (persistent connection per tab)
       v
Frontend (React/Vite on Vercel)
  +-- usePriceWebSocket.ts (NEW - single WS connection per tab)
  |     - Connects to keeper ws://keeper/ws/prices
  |     - Dispatches ticker updates to global price store
  |     - Dispatches candle updates to TradingView subscribers
  |
  +-- useTokenRecentPricesData.ts (MODIFIED - reads from WS store, HTTP fallback)
  +-- DataFeed.ts (MODIFIED - subscribeBars uses WS push, HTTP fallback)
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **priceStreamCollector** (keeper, NEW) | Single SSE connection to Pyth Hermes. Parses price updates, maintains in-memory ticker cache + candle state. Flushes completed candles to DB. Emits events for wsServer. | Pyth Hermes SSE, PostgreSQL, wsServer (EventEmitter) |
| **wsServer** (keeper, NEW) | WebSocket server mounted on Express HTTP server. Manages client connections, subscriptions, heartbeats. Broadcasts price/candle events from priceStreamCollector. | priceStreamCollector (listens to events), frontend WS clients |
| **pricesController** (keeper, MODIFIED) | HTTP GET /prices/tickers still works but reads from priceStreamCollector's in-memory cache instead of calling Hermes. Zero-latency responses. | priceStreamCollector (reads cache) |
| **candlesController** (keeper, UNCHANGED) | HTTP GET /prices/candles still reads from DB + in-memory currentCandles. No changes needed. | PostgreSQL, priceStreamCollector (reads currentCandles) |
| **usePriceWebSocket** (frontend, NEW) | React hook managing a single WS connection. Reconnects on disconnect. Pushes updates into a shared price store (Zustand or context). | keeper wsServer, frontend price store |
| **useTokenRecentPricesData** (frontend, MODIFIED) | Reads from WS-fed price store instead of polling. Falls back to HTTP if WS disconnected. | usePriceWebSocket (reads store), keeper HTTP (fallback) |
| **DataFeed.subscribeBars** (frontend, MODIFIED) | Receives candle pushes via WS callback instead of PauseableInterval polling. Falls back to HTTP polling if WS disconnected. | usePriceWebSocket (registers candle subscription), keeper HTTP (fallback) |

## Data Flow

### Ticker Price Flow (new)

```
1. Hermes SSE emits price update (parsed JSON with price, conf, expo, publish_time)
2. priceStreamCollector receives event:
   a. Updates latestTickers[symbol] with normalized GMX-format price
   b. Updates currentCandles[symbol] OHLC
   c. Emits "ticker" event with {symbol, minPrice, maxPrice, ...}
3. wsServer receives "ticker" event:
   a. JSON-serializes: {"type":"ticker","data":[...tickers]}
   b. Broadcasts to all connected WS clients
4. Frontend usePriceWebSocket receives message:
   a. Parses JSON
   b. Updates global price store
5. useTokenRecentPricesData reads from store (reactive, no polling)
```

### Candle Bar Flow (new)

```
1. priceStreamCollector detects minute boundary crossed:
   a. Flushes completed candle to PostgreSQL
   b. Starts new candle
   c. Emits "candle" event with {symbol, time, open, high, low, close}
2. wsServer receives "candle" event:
   a. Broadcasts to clients subscribed to that symbol
3. Frontend DataFeed.subscribeBars callback fires:
   a. Calls onTick() with the new bar
   b. TradingView chart updates in real-time
```

### In-Progress Candle Updates (critical for chart liveness)

```
1. priceStreamCollector updates currentCandles[symbol].close on every SSE tick
2. Every 200ms (batched), wsServer broadcasts current candle state:
   {"type":"candle_update","data":{"symbol":"WETH","time":1709654400,"open":3100,"high":3105,"low":3098,"close":3102}}
3. Frontend DataFeed.subscribeBars receives update:
   a. Calls onTick() with updated bar (same time = update existing bar)
   b. TradingView chart shows live price movement within current candle
```

This is the key difference from only broadcasting on minute boundaries. Without in-progress updates, the chart would freeze for 60 seconds between candle completions.

### WebSocket Protocol

```typescript
// Client -> Server (subscription)
{ "type": "subscribe", "channel": "tickers" }
{ "type": "subscribe", "channel": "candles", "symbol": "WETH", "resolution": "1" }
{ "type": "unsubscribe", "channel": "candles", "symbol": "WETH" }

// Server -> Client (data)
{ "type": "ticker", "data": [{ symbol, minPrice, maxPrice, tokenAddress, updatedAt }] }
{ "type": "candle", "data": { symbol, time, open, high, low, close } }
{ "type": "candle_update", "data": { symbol, time, open, high, low, close } }
{ "type": "ping" }

// Client -> Server (keepalive)
{ "type": "pong" }
```

## Patterns to Follow

### Pattern 1: Single Source of Truth for Prices

**What:** priceStreamCollector owns ALL price data. Both WS broadcasts and HTTP endpoints read from the same in-memory cache.

**Why:** Eliminates divergence between WS prices and HTTP prices. A client reconnecting via HTTP sees the same data as WS-connected clients.

```typescript
// priceStreamCollector.ts
export const latestTickers = new Map<string, TickerData>();
export const currentCandles = new Map<string, InMemoryCandle>();

// pricesController.ts (modified)
export const getTickers = (_req: Request, res: Response) => {
  const tickers = Array.from(latestTickers.values());
  if (tickers.length === 0) {
    return res.status(503).json({ error: "No price data available" });
  }
  res.json(tickers);
};
```

### Pattern 2: WS with HTTP Fallback

**What:** Frontend tries WS first but falls back to HTTP polling if WS connection fails or is unavailable (e.g., behind certain proxies).

**Why:** WebSocket upgrades can fail behind corporate proxies, load balancers, or Cloudflare. HTTP polling must remain functional.

```typescript
// usePriceWebSocket.ts
function usePriceWebSocket(keeperUrl: string) {
  const [connected, setConnected] = useState(false);
  // ... WS connection logic
  return { connected, prices };
}

// useTokenRecentPricesData.ts (modified)
const { connected, prices: wsPrices } = usePriceWebSocket(keeperUrl);
// If WS connected, use wsPrices. Otherwise fall back to SWR polling.
```

### Pattern 3: Mount WS on Existing HTTP Server

**What:** Use the `ws` npm package and attach to the existing Express HTTP server returned by `app.listen()`.

**Why:** No new port needed. Shares the existing CORS and routing infrastructure. The `/ws/prices` path is handled by the upgrade event, not Express routes.

```typescript
// wsServer.ts
import { WebSocketServer } from 'ws';

export function attachWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws/prices') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  return wss;
}
```

### Pattern 4: Batched Broadcasts

**What:** Don't broadcast every single SSE event individually. Batch ticker updates over a small window (100-200ms) and send one combined message.

**Why:** Hermes SSE can fire very rapidly. Sending one message per SSE event wastes bandwidth and causes unnecessary React re-renders. Batching at 200ms gives 5 updates/second, plenty for a trading UI.

### Pattern 5: Heartbeat/Ping-Pong

**What:** Server sends `{"type":"ping"}` every 30s. Client responds with `{"type":"pong"}`. Server closes connections that miss 2 pings.

**Why:** Detects dead connections that TCP keepalive misses (especially through proxies). Prevents resource leaks from abandoned tabs.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate WS Port

**What:** Running the WebSocket server on a different port (e.g., 37019).

**Why bad:** Requires new firewall rules on DigitalOcean, new Vercel proxy config, CORS complications. The existing `/api/keeper` proxy on Vercel would not forward to a second port.

**Instead:** Mount on the same Express HTTP server at `/ws/prices`.

### Anti-Pattern 2: Broadcasting Raw Hermes Data

**What:** Forwarding Pyth Hermes SSE events directly to frontend clients.

**Why bad:** Frontend needs GMX-format prices (30-decimal precision, adjusted by token decimals). Raw Hermes data requires normalization. Also leaks Pyth feed IDs that mean nothing to the frontend.

**Instead:** Normalize in priceStreamCollector, broadcast in the same TickerResponse format the HTTP endpoint already uses.

### Anti-Pattern 3: Per-Client Hermes Connections

**What:** Each WS client triggering its own Hermes subscription.

**Why bad:** N clients = N SSE connections to Hermes. Wastes resources, may hit rate limits.

**Instead:** Single SSE connection in priceStreamCollector, fan-out via wsServer.

### Anti-Pattern 4: Removing HTTP Endpoints

**What:** Deleting /prices/tickers and /prices/candles after adding WS.

**Why bad:** External tools, health checks, debugging, and the fallback path all depend on HTTP. Other services (data-verification-service) may also consume these endpoints.

**Instead:** Keep HTTP endpoints, just change their data source from "call Hermes" to "read in-memory cache".

### Anti-Pattern 5: Frontend Direct-to-Hermes SSE

**What:** Having the frontend connect directly to Pyth Hermes SSE, bypassing the keeper.

**Why bad:** Each browser tab opens its own Hermes SSE connection (wastes resources). The frontend would need to duplicate the GMX price normalization logic that already exists in the keeper. Cannot share candle state across tabs.

**Instead:** Keeper is the single Hermes consumer, frontend connects only to keeper.

## Vercel Proxy Consideration

The frontend connects to the keeper via Vercel's proxy rewrite (`/api/keeper` -> `http://142.93.203.222:37017`). WebSocket upgrade requests through Vercel require verifying that Vercel supports the `Upgrade: websocket` header forwarding.

**Likely scenario (Vercel does NOT proxy WebSocket upgrades):** The frontend must connect directly to `wss://142.93.203.222:37017/ws/prices` (or a domain pointing to the DO droplet with TLS termination). This requires:
- Adding a domain (e.g., `keeper.0xmarkets.io`) pointing to the DO droplet
- TLS certificate (Let's Encrypt via Caddy or nginx reverse proxy)
- The `getOracleKeeperUrl` config returns the HTTP URL; derive WS URL by replacing protocol

**Alternative (if Vercel does proxy WS):** The frontend connects to `wss://app.0xmarkets.io/api/keeper/ws/prices`. Preferred if available, but less likely.

Either way, the WS URL can be derived from the existing keeper URL by replacing `http(s)` with `ws(s)`.

## Suggested Build Order

Build order follows data flow: upstream source first, then server, then client.

### Phase 1: Keeper - Hermes SSE + In-Memory Cache

**Build:** priceStreamCollector.ts that connects to Pyth Hermes SSE `/v2/updates/price/stream`, maintains latestTickers and currentCandles in memory.

**Modify:** pricesController.ts getTickers to read from latestTickers cache instead of calling Hermes. candleCollector.ts replaced by priceStreamCollector (same candle logic, different data source).

**Verify:** HTTP /prices/tickers now reads from cache (zero Hermes calls per request). Candles still flush to DB. All existing HTTP endpoints work unchanged. Frontend works identically (still polling HTTP, just faster responses).

**Dependencies:** None. This is a pure backend refactor. The frontend does not change.

**Why first:** Everything downstream depends on having a streaming price source. Without this, there is nothing to broadcast via WS. Also independently valuable -- eliminates per-request Hermes polling even without WS.

### Phase 2: Keeper - WebSocket Server

**Build:** wsServer.ts mounted on existing HTTP server. Broadcasts ticker updates from priceStreamCollector events. Supports subscribe/unsubscribe for candle channels. Implements heartbeat.

**Verify:** Can connect with `wscat -c ws://localhost:37017/ws/prices` and receive ticker broadcasts. Subscribe to candle channel and receive updates.

**Dependencies:** Phase 1 (needs priceStreamCollector events to broadcast).

**Why second:** Server must be broadcasting before clients can consume.

### Phase 3: Frontend - WebSocket Client + Price Store

**Build:** usePriceWebSocket hook with connection management, reconnection, store updates. Modify useTokenRecentPricesData to read from WS store with HTTP fallback. Modify DataFeed.subscribeBars to use WS push with polling fallback.

**Verify:** Open trade page, prices update in real-time via WS. TradingView chart receives live bars without staleness. Disconnect WS (kill keeper), verify HTTP fallback kicks in within seconds. Reconnect, verify WS resumes.

**Dependencies:** Phase 2 (needs keeper WS server running).

**Why last:** Consumer of the data. Cannot test without server infrastructure.

## Scalability Considerations

| Concern | At 1-10 users (now) | At 100 users | At 1000+ users |
|---------|---------------------|--------------|----------------|
| Hermes connection | 1 SSE connection (persistent) | 1 SSE connection | 1 SSE connection |
| WS connections | 1-10 connections, trivial | 100 connections, still trivial for `ws` | May need connection pooling or sticky sessions behind LB |
| Broadcast cost | Negligible | ~100 JSON.stringify + send per tick | Consider binary protocol or shared buffer |
| Memory | ~7 tickers + 7 candles in memory, negligible | Same | Same |
| PostgreSQL writes | 7 candle upserts per minute (same as today) | Same | Same |

Current scale (testnet, <10 users) means scalability is not a concern. The architecture naturally scales to hundreds of concurrent users without changes.

## Sources

- Pyth Hermes SSE streaming: [Fetch Price Updates | Pyth Developer Hub](https://docs.pyth.network/price-feeds/core/fetch-price-updates)
- Pyth Hermes architecture: [Hermes | Pyth Developer Hub](https://docs.pyth.network/price-feeds/core/how-pyth-works/hermes)
- Existing codebase: keeper-service/src/core/candleCollector.ts, server/httpServer.ts, controllers/pricesController.ts, controllers/candlesController.ts
- Frontend codebase: src/domain/tradingview/DataFeed.ts, src/domain/synthetics/tokens/useTokenRecentPricesData.ts, src/lib/oracleKeeperFetcher/oracleKeeperFetcher.ts
