# Feature Landscape: WebSocket Price Streaming

**Domain:** Real-time price streaming for perpetual futures trading interface
**Researched:** 2026-03-05
**Context:** Replacing HTTP polling (1s frontend, 2s keeper) with WebSocket streaming for v1.12

## Current State

The system has three HTTP polling loops that add unnecessary latency:

| What | Current Approach | Latency Cost |
|------|-----------------|--------------|
| Keeper candle data | `candleCollector.ts` polls Pyth Hermes HTTP every 2s via `HermesClient.getLatestPriceUpdates()` | 0-2s stale per tick, misses intra-interval price extremes |
| Frontend mark prices | `useTokenRecentPricesRequest` polls `/prices/tickers` every 1s via SWR through Vercel proxy | 0-1s stale + network RTT through Vercel -> DO keeper |
| Frontend chart bars | `DataFeed.subscribeBars` polls `fetchCandles` every 1s via `PauseableInterval` | 0-1s stale + fetches full candle(s) each tick |

---

## Table Stakes

Features users expect. Missing = product feels laggy or broken compared to competitors (Hyperliquid, dYdX).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Keeper: Pyth Hermes SSE for candle data | Hermes offers `/v2/updates/price/stream` SSE endpoint that pushes updates as they happen (~400ms). Current 2s polling misses price extremes between ticks and adds 0-2s latency. `HermesClient` already has `getStreamingPriceUpdates(priceIds)` built-in. | Low | Direct replacement of `setInterval(tick, 2000)` in `candleCollector.ts`. Single file change. Auto-reconnect needed (Hermes closes after 24h). |
| Keeper: WebSocket endpoint for frontend | Frontend polls `/prices/tickers` every 1s. Each poll = full HTTP round-trip through Vercel serverless proxy -> DO keeper. WebSocket eliminates per-request overhead and gives sub-100ms push latency. | Medium | Needs `ws` package on keeper. Must broadcast ticker + candle updates to all connected frontends. Vercel serverless **cannot** hold WS connections, so frontend connects directly to keeper. |
| Frontend: Mark prices via keeper WS | `useTokenRecentPricesRequest` uses SWR with 1s `refreshInterval` to poll tickers. Replace with WS subscription that updates React state on each push. All downstream consumers (positions, PnL, trade box, ~20 components) get instant updates. | Medium | Single integration point in price context. Must handle reconnection, stale detection, fallback to polling. |
| Frontend: TradingView real-time bars via WS | `subscribeBars` uses `PauseableInterval` polling `fetchCandles` at 1s. Chart feels stale because it only updates on next poll completion. With WS, bars update on each price tick. | Medium | TradingView requirements: bar time = period start not update time, only update most recent bar or add newer, callbacks must be async. Current `subscribeBars` already has bar patching logic -- just swap data source from polling to WS push. |
| Connection resilience: auto-reconnect with backoff | Every DeFi trading interface handles disconnects gracefully. Users on flaky connections or after sleep/wake must not see stale prices without knowing it. | Low | Exponential backoff with jitter. Existing `WebsocketContextProvider.tsx` already implements reconnect + health check patterns for the RPC WS provider -- same approach. |
| Stale price indicator | If WS disconnects or prices stop arriving, user must know prices are stale. Trading on stale prices = real money lost. | Low | Timestamp of last update, show warning banner if >5s stale. `KeeperStatusBanner.tsx` already exists for keeper health -- extend it. |

## Differentiators

Features that set the product apart. Not expected in testnet/early stage, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sub-second PnL updates | Position PnL recalculated on every price tick instead of every 1s poll. Feels like a CEX. Hyperliquid does this and it is a big part of why traders prefer it. | Low | Once mark prices stream via WS, PnL is a derived calculation. Already computed reactively from `pricesData` in position components. Free win. |
| More accurate candle high/low | Instead of building candles from 2s HTTP snapshots (missing intra-period price extremes), build from every Hermes SSE tick. Higher tick rate = more accurate high/low. | Low | Already doing candle aggregation in `candleCollector.ts`. SSE gives more data points, highs/lows become more accurate with zero extra work. |
| Multi-resolution chart streaming | Stream candle updates at user's selected resolution without fetching full candle history on each subscribeBars tick. Currently fetches 1+ candles per second regardless of resolution. | Medium | Keeper builds candles at 1m granularity. Frontend aggregates to higher resolutions. WS pushes only current candle update, not full refetch. |
| Ticker data broadcast on connect | Send latest ticker snapshot immediately on WS connection, so frontend has prices before first push arrives. Eliminates cold-start delay. | Low | Buffer latest ticker state in keeper memory, send on `connection` event. Avoids the "loading prices..." gap on page load. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Order book WebSocket | 0xMarkets uses oracle-based pricing, not an order book. There is no order book to stream. Building a fake one is misleading. | Show mark price from oracle. That is the execution price. |
| Per-user position streaming | Streaming individual user position changes via WS adds complexity for minimal gain. Position changes are infrequent (user-initiated trades). | Poll positions on trade events, use existing `SyntheticsEventsProvider` for execution notifications. |
| WebSocket for candle history | Historical candles do not change. Streaming them wastes bandwidth. | REST for history (`getBars` stays HTTP), WS only for the current live bar (`subscribeBars` uses WS). |
| Client-side candle aggregation from raw ticks | Having the browser aggregate raw Pyth ticks into candles is error-prone (tab sleep, missed ticks, clock skew). | Keeper aggregates candles server-side, streams completed/updated candles to frontend. Single source of truth. |
| Multiple WS connections per client | One for tickers, one for candles, one for events -- connection overhead adds up, especially on mobile. | Single multiplexed WS connection with message types: `{ type: "ticker", data: ... }`, `{ type: "candle", data: ... }`. |
| Pyth Lazer for price display | Lazer is for oracle signing (on-chain execution). It requires a Pro API key and has different semantics than Hermes. | Use Hermes SSE for display prices (keeper side). Lazer stays for oracle signing only. |
| Direct browser-to-Hermes SSE | Skip keeper for mark prices. Browser connects to Pyth Hermes directly. | Bad: exposes Pro API key client-side, CORS issues on public endpoint, rate limits. Keep keeper as price aggregator. |
| Binary/protobuf encoding | Compact binary frames instead of JSON for WS messages. | Premature optimization. 7 tokens x JSON ticker is ~2KB. Not a bottleneck for 6 markets on testnet. |

## Feature Dependencies

```
Keeper Hermes SSE ───────────────────> Keeper WS endpoint
  (replaces 2s HTTP poll                (serves frontends)
   in candleCollector.ts)                    |
                                             |
                          +------------------+------------------+
                          |                                     |
                          v                                     v
              Frontend mark prices via WS          TradingView real-time bars via WS
              (replaces 1s SWR poll in             (replaces 1s PauseableInterval
               useTokenRecentPricesData)            poll in DataFeed.subscribeBars)
                          |                                     |
                          v                                     v
              Sub-second PnL updates               Multi-resolution streaming
              (derived from mark prices)           (enhancement, deferred)

Connection resilience ──────> Required by ALL WS consumers (frontend + keeper-to-Hermes)
Stale price indicator ──────> Required by ALL frontend WS consumers
```

**Key ordering constraint:** Keeper must stream from Pyth Hermes first, then expose its own WS endpoint, then frontend can consume. Cannot build frontend WS without keeper WS server.

## Vercel Proxy Constraint

**Critical architecture issue:** The current frontend proxies keeper HTTP requests through Vercel serverless functions (`api/keeper.ts`). Vercel serverless functions **cannot hold WebSocket connections** -- they are request/response only with execution time limits.

**Recommendation:** Frontend connects directly to keeper for WS (`wss://<keeper-ip>:37017/ws` or a dedicated WS port with TLS). Keep Vercel proxy for REST endpoints only (candle history, health checks). This is standard for DeFi -- the WS endpoint is a separate URL from the REST API.

Options considered:
- Direct WS to keeper IP (simplest, acceptable for testnet, exposes keeper IP)
- Cloudflare Workers/Durable Objects as WS proxy (overkill for testnet)
- Nginx reverse proxy on DO droplet with TLS termination (good for production, adds ops complexity)

For v1.12 testnet: direct connection is the right call.

## MVP Recommendation

Prioritize (in dependency order):

1. **Keeper Hermes SSE** -- Replace `setInterval(tick, 2000)` with `HermesClient.getStreamingPriceUpdates()`. Lowest risk, immediate candle accuracy improvement, single file change.
2. **Keeper WS endpoint** -- Add `ws` server to keeper-service that broadcasts ticker + candle updates to connected clients. New code but straightforward pub/sub.
3. **Frontend mark prices via WS** -- Replace SWR polling in `useTokenRecentPricesRequest` with WS subscription. Single integration point that updates all downstream components.
4. **TradingView subscribeBars via WS** -- Wire `DataFeed.subscribeBars` to consume WS candle updates instead of polling `fetchCandles`. Fixes chart staleness.
5. **Connection resilience + stale indicator** -- Reconnect logic and stale price warning. Must ship alongside any WS feature.

Defer:
- **Multi-resolution streaming**: Current approach (fetch candles, TradingView aggregates) works. Enhancement, not a fix.
- **Binary encoding**: JSON is fine for 6 markets on testnet.
- **Ticker snapshot on connect**: Nice to have, can add in same milestone if time permits.

## Sources

- [Pyth Hermes SSE streaming endpoint](https://docs.pyth.network/price-feeds/core/fetch-price-updates) -- `/v2/updates/price/stream` with `ids[]` params, auto-closes after 24h -- HIGH confidence
- [Pyth Hermes architecture](https://docs.pyth.network/price-feeds/core/how-pyth-works/hermes) -- Hermes monitors Pythnet + Wormhole, exposes SSE + REST -- HIGH confidence
- [TradingView streaming implementation guide](https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial/Streaming-Implementation/) -- subscribeBars rules: bar time = period start, only update most recent, async callbacks -- HIGH confidence
- [Hyperliquid WebSocket API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket) -- Subscription model, auto-reconnect pattern, snapshot on connect -- MEDIUM confidence (competitor reference)
- Codebase analysis: `candleCollector.ts`, `DataFeed.ts`, `oracleKeeperFetcher.ts`, `useTokenRecentPricesData.ts`, `WebsocketContextProvider.tsx`, `api/keeper.ts` -- HIGH confidence

---
*Research completed: 2026-03-05*
*Replaces: v1.7 FEATURES.md (2026-02-27) -- that covered liquidation verification; this covers v1.12 WebSocket streaming scope*
