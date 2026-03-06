# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12
- ✅ **v1.4 Maximum Keeper Speed** — Phases 13-14
- ✅ **v1.5 Minimal Keeper Rewrite** — Phases 15-17
- ✅ **v1.6 E2E Reliability** — Phases 18-23
- ✅ **v1.7 Liquidation Readiness** — Phases 24-27
- ✅ **v1.8 Deployment** — Phases 28-30
- ✅ **v1.9 Event Indexer** — Phases 31-34
- ✅ **v1.10 E2E Verification** — Phases 35-37 ([shipped 2026-03-05](milestones/v1.10-ROADMAP.md))
- ✅ **v1.11 Trade History & Leaderboard Fix** — Phases 38-39 ([shipped 2026-03-05](milestones/v1.11-ROADMAP.md))
- 🚧 **v1.12 WebSocket Price Streaming** — Phases 40-42 (in progress)

## Phases

<details>
<summary>✅ v1.11 Trade History & Leaderboard Fix (Phases 38-39) — SHIPPED 2026-03-05</summary>

- [x] Phase 38: Squid Fixes & Redeployment (1/1 plan) — completed 2026-03-05
- [x] Phase 39: Frontend Verification & Fixes (1/1 plan) — completed 2026-03-05

</details>

<details>
<summary>✅ v1.10 E2E Verification (Phases 35-37) — SHIPPED 2026-03-05</summary>

- [x] Phase 35: Trigger Order Fix (1/1 plan) — completed 2026-03-04
- [x] Phase 36: E2E Test Suite (1/1 plan) — completed 2026-03-04
- [x] Phase 37: Frontend Verification (2/2 plans) — completed 2026-03-05

</details>

### v1.12 WebSocket Price Streaming (In Progress)

**Milestone Goal:** Replace HTTP polling with WebSocket streaming for real-time price updates across keeper and frontend

- [x] **Phase 40: Infrastructure + Keeper Hermes SSE** — TLS endpoint on DO droplet and streaming price source replacing HTTP polling (completed 2026-03-06)
- [x] **Phase 41: Keeper WebSocket Server** — Broadcast ticker and candle updates to connected frontends over WebSocket (completed 2026-03-06)
- [ ] **Phase 42: Frontend WebSocket Integration** — Real-time mark prices and chart bars via WebSocket with HTTP fallback

## Phase Details

### Phase 40: Infrastructure + Keeper Hermes SSE
**Goal**: Keeper receives real-time prices from Pyth Hermes via SSE streaming and serves them from an in-memory cache, with TLS infrastructure ready for direct frontend WebSocket connections
**Depends on**: Nothing (first phase of v1.12)
**Requirements**: INFRA-01, INFRA-02, KSTR-01, KSTR-02, KSTR-03
**Success Criteria** (what must be TRUE):
  1. Frontend can establish a secure wss:// connection to the keeper subdomain (e.g., keeper.0xmarkets.io) without mixed-content errors
  2. Keeper receives price updates from Pyth Hermes via SSE stream instead of 2-second HTTP polling
  3. All existing /prices/* HTTP endpoints return data from the in-memory SSE-fed cache (no per-request Hermes calls)
  4. SSE connection automatically recovers after disconnect (including Hermes 24h auto-close) without manual intervention
**Plans**: 2 plans

Plans:
- [x] 40-01-PLAN.md — Cloudflare DNS/TLS proxy setup (human checkpoint)
- [x] 40-02-PLAN.md — Hermes SSE streaming + shared price cache

### Phase 41: Keeper WebSocket Server
**Goal**: Connected clients receive real-time ticker and candle data pushed from the keeper over WebSocket
**Depends on**: Phase 40
**Requirements**: KWS-01, KWS-02, KWS-03, KWS-04, KWS-05
**Success Criteria** (what must be TRUE):
  1. A WebSocket client (e.g., wscat) can connect to the keeper and receive continuous ticker price updates
  2. In-progress candle OHLC updates arrive at approximately 200ms intervals
  3. Dead connections (no pong response) are detected and dropped within 30-60 seconds
  4. Slow or stalled clients do not cause keeper memory growth — messages are skipped when buffer exceeds threshold
**Plans**: 2 plans

Plans:
- [x] 41-01-PLAN.md — WebSocket broadcast module with tests + keeper wiring (completed 2026-03-06)
- [ ] 41-02-PLAN.md — Deploy to DO droplet and verify through Cloudflare

### Phase 42: Frontend WebSocket Integration
**Goal**: Users see real-time mark prices and chart updates in the interface with sub-second latency, with transparent fallback to HTTP polling when WebSocket is unavailable
**Depends on**: Phase 41
**Requirements**: FWS-01, FWS-02, FWS-03, FWS-04, FWS-05, FWS-06
**Success Criteria** (what must be TRUE):
  1. Mark prices on the trade page update in real-time without visible polling delay (sub-second latency)
  2. TradingView chart updates with new bars in real-time — no staleness or gaps while the page is open
  3. If the WebSocket disconnects, prices continue updating via HTTP polling fallback within 5 seconds
  4. A connection status indicator shows connected/reconnecting/stale state in the UI
  5. Stale HTTP responses never overwrite fresher WebSocket data (timestamp-gated updates)
**Plans**: 2 plans

Plans:
- [ ] 42-01: TBD
- [ ] 42-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 40 -> 41 -> 42

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 38. Squid Fixes & Redeployment | v1.11 | 1/1 | Complete | 2026-03-05 |
| 39. Frontend Verification & Fixes | v1.11 | 1/1 | Complete | 2026-03-05 |
| 40. Infrastructure + Keeper Hermes SSE | v1.12 | 2/2 | Complete | 2026-03-06 |
| 41. Keeper WebSocket Server | 2/2 | Complete    | 2026-03-06 | - |
| 42. Frontend WebSocket Integration | v1.12 | 0/TBD | Not started | - |

---
*Created: 2026-03-04*
*Updated: 2026-03-06 — Phase 41-01 completed (WebSocket broadcast module)*
