# Technology Stack: v1.12 WebSocket Price Streaming

**Project:** 0xMarkets keeper-service + 0xMarkets-Interface
**Researched:** 2026-03-05
**Overall Confidence:** HIGH

## Context

v1.12 replaces HTTP polling with WebSocket streaming at two boundaries:

1. **Pyth Hermes --> Keeper:** Replace 2s HTTP polling in `candleCollector.ts` with Hermes SSE streaming via `getPriceUpdatesStream()`
2. **Keeper --> Frontend:** Replace 1s HTTP polling of `/prices/tickers` and `/prices/candles` with a WebSocket server on the keeper and WebSocket client on the frontend
3. **TradingView integration:** Replace 1s `PauseableInterval` polling in `DataFeed.subscribeBars()` with real-time bar updates pushed via the keeper WebSocket

## Existing Stack (Do Not Re-research)

| Technology | Version | Service | Role |
|------------|---------|---------|------|
| Express | ^5.1.0 | keeper-service | HTTP server |
| @pythnetwork/hermes-client | ^2.1.0 | keeper-service | Pyth price fetching (HTTP + SSE) |
| @pythnetwork/pyth-lazer-sdk | ^5.2.0 | keeper-service | Oracle signing (WS, separate concern) |
| Prisma | ^5.22.0 | keeper-service | Candle persistence |
| pino | ^10.3.1 | keeper-service | Logging |
| React 18 + Vite 5 | -- | frontend | UI framework |
| SWR | 2.3.3 | frontend | Data fetching (current polling) |
| TradingView charting_library | -- | frontend | Charts |

---

## New Stack Additions

### Keeper-side: `ws` (WebSocket Server)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ws | ^8.19.0 | WebSocket server for broadcasting prices to frontend clients | Standard Node.js WebSocket library. Zero dependencies. Attaches to existing Express HTTP server (shares port 37017). No need for Socket.IO -- we need simple broadcast, not rooms/namespaces/fallback transports. |
| @types/ws | ^8.5.14 | TypeScript types for ws | Required for TypeScript compilation. |

**Why `ws` and not alternatives:**

| Alternative | Why Not |
|-------------|---------|
| Socket.IO | Adds 300KB+ bundle, abstractions for rooms/namespaces/acknowledgements we don't need. We broadcast one-way price data to all connected clients -- raw WebSocket is sufficient. |
| uWebSockets.js | Higher performance but C++ binding, harder to install in Docker, overkill for <100 concurrent connections on testnet. |
| express-ws | Unmaintained (last publish 2020), wraps `ws` anyway. Better to use `ws` directly for control. |
| SSE (Server-Sent Events) | One-directional like our use case, but browser EventSource API has no built-in reconnection backoff control, and we may want bidirectional later (subscribe to specific markets). WebSocket is more future-proof. |

**Installation (keeper-service):**

```bash
cd keeper-service
pnpm add ws
pnpm add -D @types/ws
```

### Keeper-side: Hermes SSE Streaming (Already Installed)

No new package needed. `@pythnetwork/hermes-client@2.1.0` already exposes `getPriceUpdatesStream()` which returns an `EventSource` (SSE client). The `eventsource@^3.0.5` package is a transitive dependency of hermes-client, already resolved in the lockfile.

**API (verified from hermes-client type declarations):**

```typescript
// Already available -- NO new install
const hermesClient = new HermesClient("https://hermes.pyth.network");
const eventSource: EventSource = await hermesClient.getPriceUpdatesStream(
  Object.values(PYTH_PRICE_FEED_IDS), // string[] of hex feed IDs
  { parsed: true }                      // get structured price data, not just binary
);

eventSource.onmessage = (event) => {
  const priceUpdate: PriceUpdate = JSON.parse(event.data);
  // priceUpdate.parsed contains array of { id, price: { price, expo, ... }, ... }
};
```

**Key behavior:** The Hermes SSE connection auto-closes after 24 hours. Must implement reconnection logic. This is NOT a limitation of the library -- it is Hermes server-side policy to prevent resource leaks.

### Frontend: Native WebSocket (No New Package)

The browser `WebSocket` API is sufficient. No library needed.

| Alternative | Why Not |
|-------------|---------|
| socket.io-client | Would require Socket.IO on server side. Adds bundle weight for features we don't use. |
| reconnecting-websocket | Nice convenience, but trivial to implement reconnection in ~20 lines. Not worth a dependency. |
| @tanstack/react-query ws adapter | Doesn't exist as a first-party adapter. SWR/react-query are for request-response, not streaming. |

**Pattern for frontend:**

```typescript
// Custom hook: useWebSocketPrices()
const ws = new WebSocket(`wss://${keeperHost}/ws/prices`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update React state / SWR cache
};
```

---

## Integration Architecture

### 1. Hermes SSE --> Keeper (replaces candleCollector polling)

**Current:** `candleCollector.ts` calls `hermesClient.getLatestPriceUpdates()` every 2s via `setInterval`.

**New:** `candleCollector.ts` calls `hermesClient.getPriceUpdatesStream()` once at startup. Each SSE message triggers candle update logic (same `tick()` body, but event-driven instead of polled). Reconnection on close/error with exponential backoff.

**Integration point:** The `currentCandles` Map and Prisma upsert logic stay identical. Only the trigger mechanism changes from `setInterval(tick, 2000)` to `eventSource.onmessage`.

### 2. Keeper WebSocket Server --> Frontend (replaces /prices/tickers polling)

**Current:** Frontend polls `GET /prices/tickers` every 1s via SWR. Keeper reads from Pyth Lazer cache + currentCandles map.

**New:** Keeper creates a `WebSocketServer` attached to the existing Express HTTP server (sharing port 37017). On each Hermes SSE price update, keeper broadcasts a JSON message to all connected WebSocket clients containing ticker data in the same format as `/prices/tickers`.

**ws attaches to Express HTTP server (shares port):**

```typescript
import { WebSocketServer } from "ws";
import { createHttpServer } from "./httpServer.js";

const server = createHttpServer(); // returns http.Server from app.listen()
const wss = new WebSocketServer({ server, path: "/ws/prices" });

wss.on("connection", (ws) => {
  // Send initial snapshot
  ws.send(JSON.stringify({ type: "tickers", data: getCurrentTickers() }));
  ws.send(JSON.stringify({ type: "candles", data: getRecentCandles() }));
});

// On each Hermes SSE update:
function broadcastTickers(tickers: TickerData[]) {
  const msg = JSON.stringify({ type: "tickers", data: tickers });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
```

**Key:** `createHttpServer()` currently returns the Express app's `server` from `app.listen()`. The `ws` library's `WebSocketServer` handles the HTTP Upgrade handshake when `{ server }` is passed. No additional Express middleware needed.

### 3. TradingView Real-time Bars (replaces PauseableInterval polling)

**Current:** `DataFeed.subscribeBars()` creates a `PauseableInterval` that calls `this.fetchCandles()` (HTTP to `/prices/candles`) every 1s.

**New:** `DataFeed.subscribeBars()` listens to the WebSocket connection for candle updates. The keeper pushes candle bar data on each price update. The `onTick` callback fires immediately on receipt instead of after a 1s poll delay.

**Integration point:** The existing `subscribeBars` callback signature (`onTick: SubscribeBarsCallback`) remains identical. Only the data source changes from HTTP poll to WebSocket message.

---

## Message Protocol (Keeper --> Frontend WebSocket)

Use simple JSON messages with a `type` discriminator:

```typescript
// Ticker update (replaces /prices/tickers polling)
{
  type: "tickers",
  data: [
    { tokenSymbol: "WETH", minPrice: "...", maxPrice: "...", oracleDecimals: 18, tokenAddress: "0x...", updatedAt: 1709654400 }
  ]
}

// Candle update (replaces /prices/candles polling)
{
  type: "candle",
  data: {
    tokenSymbol: "WETH",
    time: 1709654400,
    open: 3245.50,
    high: 3246.20,
    low: 3245.10,
    close: 3245.80
  }
}
```

**Why not Protocol Buffers / MessagePack:** JSON is fine at this scale (7 tokens, <1KB per message). The overhead of a binary protocol is not justified when messages are tiny and connection count is low. HTTP API responses are already JSON -- consistency reduces integration friction.

---

## What NOT to Add

### Do NOT add Socket.IO

Socket.IO adds ~300KB to the frontend bundle and requires `socket.io` on the server. It provides rooms, namespaces, acknowledgments, and HTTP long-polling fallback -- none of which we need. We broadcast price data one-way to all connected clients. Native WebSocket handles this.

### Do NOT add a message queue (Redis Pub/Sub, NATS, etc.)

Single keeper server broadcasting to frontend clients. No multi-instance coordination needed. A message queue adds operational complexity (another service to run in Docker Compose) for zero benefit at this scale.

### Do NOT add GraphQL Subscriptions

The data model is simple: ticker prices and candle bars. GraphQL subscriptions would require Apollo Server, subscription transport, and schema definitions for what amounts to two message types. Massive overhead.

### Do NOT replace SWR entirely

SWR still handles non-streaming data (candle history, 24h prices, incentives, APY). Only the real-time ticker/candle feeds move to WebSocket. Keep SWR for request-response patterns; add WebSocket alongside it for streaming.

### Do NOT add reconnecting-websocket on frontend

Reconnection with exponential backoff is ~20 lines of code. Adding a dependency for this is unnecessary when the reconnection logic is trivial and we want full control over behavior (e.g., showing a "reconnecting" banner).

### Do NOT upgrade @pythnetwork/hermes-client

Version 2.1.0 already has `getPriceUpdatesStream()` with full SSE support. No need to chase a newer version.

### Do NOT use Pyth Lazer for candle data

Pyth Lazer (via pyth-lazer-sdk) is for oracle price signing -- it delivers binary EVM payloads for on-chain use. Pyth Hermes provides parsed price data suitable for candle construction. These are different products with different purposes. Continue using Hermes for candles and Lazer for oracle signing.

---

## Complete Stack Delta for v1.12

### keeper-service: 1 New Dependency

```bash
cd keeper-service
pnpm add ws
pnpm add -D @types/ws
```

| Package | Version | Status | Purpose |
|---------|---------|--------|---------|
| ws | ^8.19.0 | NEW | WebSocket server for broadcasting prices to frontend |
| @types/ws | ^8.5.14 | NEW (dev) | TypeScript types |
| @pythnetwork/hermes-client | ^2.1.0 | EXISTING | Use `getPriceUpdatesStream()` instead of `getLatestPriceUpdates()` |

### 0xMarkets-Interface (frontend): 0 New Dependencies

| Technology | Status | Purpose |
|------------|--------|---------|
| Native WebSocket API | BUILT-IN | Connect to keeper WebSocket server |
| SWR 2.3.3 | EXISTING | Continues handling non-streaming data |
| TradingView charting_library | EXISTING | `subscribeBars` callback wired to WebSocket data |

**No `yarn add` commands needed for the frontend.**

---

## Keeper HTTP Endpoints: Keep for Fallback

Do NOT remove the existing HTTP endpoints (`/prices/tickers`, `/prices/candles`). Keep them as:

1. **Fallback** when WebSocket connection fails (frontend can degrade to polling)
2. **Health monitoring** (BetterStack pings HTTP endpoints)
3. **Initial data load** (historical candles are request-response, not streaming)
4. **Debugging** (curl-friendly for manual inspection)

The WebSocket channel is an addition, not a replacement.

---

## Sources

- Existing codebase: `keeper-service/package.json` -- confirmed @pythnetwork/hermes-client@^2.1.0, express@^5.1.0 (HIGH confidence)
- Existing codebase: `keeper-service/node_modules/@pythnetwork/hermes-client/dist/esm/hermes-client.d.ts` -- confirmed `getPriceUpdatesStream()` returns `Promise<EventSource>` with parsed option (HIGH confidence)
- Existing codebase: `keeper-service/node_modules/@pythnetwork/hermes-client/package.json` -- confirmed `eventsource@^3.0.5` transitive dependency (HIGH confidence)
- Existing codebase: `keeper-service/src/core/candleCollector.ts` -- confirmed 2s polling via setInterval + getLatestPriceUpdates (HIGH confidence)
- Existing codebase: `src/lib/oracleKeeperFetcher/oracleKeeperFetcher.ts` -- confirmed HTTP fetch to /prices/tickers and /prices/candles (HIGH confidence)
- Existing codebase: `src/domain/tradingview/DataFeed.ts` -- confirmed PauseableInterval polling in subscribeBars at 1s (HIGH confidence)
- Existing codebase: `src/domain/synthetics/tokens/useTokenRecentPricesData.ts` -- confirmed SWR polling at PRICES_UPDATE_INTERVAL (1000ms) (HIGH confidence)
- [ws npm package](https://www.npmjs.com/package/ws) -- v8.19.0 latest, zero dependencies (HIGH confidence)
- [ws GitHub releases](https://github.com/websockets/ws/releases) -- v8.19.0 released Jan 2025 (HIGH confidence)
- [Pyth Hermes SSE documentation](https://docs.pyth.network/price-feeds/core/fetch-price-updates) -- /v2/updates/price/stream endpoint, 24h auto-close (MEDIUM confidence -- verified via docs)
- [Pyth Hermes architecture](https://docs.pyth.network/price-feeds/core/how-pyth-works/hermes) -- SSE streaming overview (MEDIUM confidence)
- [@pythnetwork/hermes-client GitHub](https://github.com/pyth-network/pyth-crosschain/tree/main/apps/hermes/client/js) -- getPriceUpdatesStream usage example (MEDIUM confidence)
