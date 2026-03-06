# Phase 40: Infrastructure + Keeper Hermes SSE - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

TLS infrastructure on the DO droplet enabling secure WebSocket connections from the Vercel-hosted frontend, plus Pyth Hermes SSE streaming replacing HTTP polling in the keeper-service. All existing /prices/* endpoints serve from an SSE-fed in-memory cache.

</domain>

<decisions>
## Implementation Decisions

### Stack constraints
- Frontend hosted on Vercel — cannot proxy WebSocket (Vercel serverless limitation)
- Keeper runs on DO droplet (142.93.203.222) via Docker Compose
- TLS and reverse proxy tooling must work within this Vercel + DO setup
- Direct wss:// from browser to DO droplet required (no Vercel middleman)

### Claude's Discretion
- TLS approach (Caddy vs nginx+certbot) — choose what's simplest for DO + Docker
- Subdomain naming convention (keeper.0xmarkets.io or similar)
- SSE vs WebSocket for Pyth Hermes connection — choose based on library support and reconnection behavior
- Cache architecture — how SSE stream feeds into existing pricesController and candleCollector
- Deployment/rollback strategy

</decisions>

<specifics>
## Specific Ideas

No specific requirements — user deferred all implementation choices to Claude's discretion given the established stack context.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@pythnetwork/hermes-client` (v2.1.0): Already a dependency, has SSE/streaming support
- `candleCollector.ts`: 2s polling loop with in-memory OHLC candles + Prisma DB flush — SSE replaces the polling
- `pricesController.ts`: Three endpoints (getTickers, get24hPrices, getPriceBySymbol) each make independent Hermes HTTP calls — all should read from shared cache
- `pythOracle.ts`: Scanner batch-fetches prices from Hermes — can also read from cache
- `httpServer.ts`: Express server on port 37017 — WebSocket server will mount here (Phase 41)
- `healthState.ts`: Mutable singleton for health status — extend with SSE connection state

### Established Patterns
- Pino structured logging with child loggers per module
- Docker Compose orchestration with env vars for all config
- Express HTTP server with CORS middleware
- Lazy-initialized singleton clients (getHermesClient pattern)

### Integration Points
- `docker-compose.yml`: keeper-service exposes port 37017 — TLS proxy sits in front
- `PYTH_PRICE_FEED_IDS`: Duplicated in candleCollector.ts and pricesController.ts — consolidate into shared config
- `currentCandles` export: candlesController reads from candleCollector's in-memory map
- DNS: 0xmarkets.io domain — needs subdomain record pointing to DO droplet

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-infrastructure-keeper-hermes-sse*
*Context gathered: 2026-03-05*
