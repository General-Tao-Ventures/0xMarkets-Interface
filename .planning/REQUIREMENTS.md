# Requirements: 0xMarkets v1.12 WebSocket Price Streaming

**Defined:** 2026-03-05
**Core Value:** Real-time price updates across the entire interface — mark prices, chart candles, and PnL — with sub-second latency via WebSocket streaming.

## v1.12 Requirements

### Infrastructure

- [x] **INFRA-01**: TLS termination configured on DO droplet for secure WebSocket connections (wss://)
- [x] **INFRA-02**: DNS subdomain (e.g., keeper.0xmarkets.io) pointing to DO droplet for direct WS access

### Keeper Streaming

- [x] **KSTR-01**: Keeper connects to Pyth Hermes SSE endpoint, replacing 2s HTTP polling in candleCollector
- [x] **KSTR-02**: In-memory price cache updated by SSE stream, serving all /prices/* endpoints from cache instead of per-request Hermes calls
- [x] **KSTR-03**: SSE connection auto-reconnects on disconnect (including Hermes 24h auto-close) with exponential backoff

### Keeper WebSocket Server

- [ ] **KWS-01**: WebSocket server mounted on existing Express HTTP server (port 37017) using `ws` library
- [ ] **KWS-02**: Ticker updates broadcast to all connected clients on each SSE price update
- [ ] **KWS-03**: In-progress candle updates broadcast at ~200ms intervals with current OHLC state
- [ ] **KWS-04**: Server-side heartbeat ping/pong detects and drops dead connections
- [ ] **KWS-05**: Backpressure handling — skip or drop messages for slow clients to prevent memory exhaustion

### Frontend WebSocket Client

- [ ] **FWS-01**: Frontend establishes WebSocket connection to keeper with auto-reconnect and exponential backoff
- [ ] **FWS-02**: Mark prices update via WebSocket push, replacing 1s HTTP polling of /prices/tickers
- [ ] **FWS-03**: TradingView chart receives real-time bar updates via WebSocket, replacing 1s HTTP polling of /prices/candles
- [ ] **FWS-04**: HTTP polling remains as fallback when WebSocket is unavailable or disconnected
- [ ] **FWS-05**: Timestamp gating prevents stale HTTP responses from overwriting fresher WebSocket data
- [ ] **FWS-06**: Connection status indicator visible in UI (connected/reconnecting/stale)

## Future Requirements

### Performance

- **PERF-01**: Process isolation — run WebSocket server in separate container from critical keeper loop
- **PERF-02**: Sub-second PnL recalculation reactive to WebSocket price updates

### Resilience

- **RESL-01**: Client-side stale price detection with visual warning after N seconds without update

## Out of Scope

| Feature | Reason |
|---------|--------|
| Direct browser-to-Hermes connection | Exposes Pyth API key to clients |
| Order book WebSocket | Oracle-based pricing, no order book |
| Client-side candle aggregation | Keeper is source of truth for candles |
| Multi-tab coordination | Complexity not justified for testnet |
| WebSocket authentication | Testnet — no sensitive data exposed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 40 | Complete |
| INFRA-02 | Phase 40 | Complete |
| KSTR-01 | Phase 40 | Complete |
| KSTR-02 | Phase 40 | Complete |
| KSTR-03 | Phase 40 | Complete |
| KWS-01 | Phase 41 | Pending |
| KWS-02 | Phase 41 | Pending |
| KWS-03 | Phase 41 | Pending |
| KWS-04 | Phase 41 | Pending |
| KWS-05 | Phase 41 | Pending |
| FWS-01 | Phase 42 | Pending |
| FWS-02 | Phase 42 | Pending |
| FWS-03 | Phase 42 | Pending |
| FWS-04 | Phase 42 | Pending |
| FWS-05 | Phase 42 | Pending |
| FWS-06 | Phase 42 | Pending |

**Coverage:**
- v1.12 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 — traceability updated with phase mappings*
