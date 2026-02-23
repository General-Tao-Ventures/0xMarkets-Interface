# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** User can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets
**Current focus:** v1.2 Demo-Ready Deployment — Phase 9: UI Polish & Tech Debt

## Current Position

Phase: 9 of 9 complete (UI Polish & Tech Debt — all 2 plans complete)
Status: Phase 9 complete — UI polish (loading spinner, explorer URL fix, BaseScan toast links) and tech debt (pendingImpactAmount, tsc, tests, keeper efficiency) all done
Last activity: 2026-02-23 — Phase 9 plan 1 complete

Progress: [██████████] 100% (9/9 phases complete)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 6
- Phases: 3, all complete

**Velocity (v1.1):**
- Total plans completed: 8
- Phases: 3, all complete

**By Phase:**

| Phase | Milestone | Plans | Status |
|-------|-----------|-------|--------|
| 1. Keeper Oracle | v1.0 | 2/2 | Complete |
| 2. Deposit Execution | v1.0 | 2/2 | Complete |
| 3. Deposit UX | v1.0 | 2/2 | Complete |
| 4. Stable Foundation | v1.1 | 2/2 | Complete |
| 5. Liquidity & Swaps | v1.1 | 2/2 | Complete |
| 6. Position Management | v1.1 | 4/4 | Complete |
| 7. Public Deployment | v1.2 | 2/2 | Complete |
| 8. Keeper Monitoring | v1.2 | 3/3 | Complete |
| 9. UI Polish & Tech Debt | v1.2 | 2/2 | Complete |
| Phase 09 P01 | 4min | 2 tasks | 4 files |
| Phase 09 P02 | 2min | 2 tasks | 4 files |

## Accumulated Context

### Known Issues

- ~~17 pre-existing failing SDK test files~~ RESOLVED: 136 pass, 1 skipped (live RPC test), 0 failures (DEBT-02)
- ~~Pre-existing TypeScript error in useOrders.ts~~ RESOLVED: already fixed in prior phase, confirmed clean (DEBT-03)
- ~~pendingImpactAmount defaulted to 0n~~ RESOLVED: documented with full usage trace — 0n is correct when contract lacks field (DEBT-01)
- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
- batch_report 404 from metrics — GMX analytics endpoint not implemented in our keeper (cosmetic)

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

- Relative URL pattern for keeper proxies (/api/keeper, /api/order-keeper) works in both Vite dev (via proxy) and Vercel prod (via serverless functions)
- process.env.KEEPER_URL fallback to hardcoded IP enables zero-config local development
- docker-compose.yml at /Users/ken/Projects/0xM/ is not git-tracked — must be scp'd to DO server separately from source git pull
- v1.1 keeper fixes (indexToken resolution, FAILED retry, PythLazer v4 address) deployed to DO server
- Docker ports bound to 0.0.0.0 (not 127.0.0.1) on DO to allow external access from Vercel proxies
- Base Sepolia WebSocket uses publicnode.com free WSS (Alchemy key was broken)
- Vercel Deployment Protection disabled via dashboard for public access
- [Phase 08]: pino child loggers with { module: filename } used per-file for log context without string prefixes
- [Phase 08]: recordScanCycle() is the primary liveness signal — called after every scan cycle even when idle, so a healthy but idle keeper reports healthy
- [Phase 08]: /health returns 503 when lastExecutionTime is null or more than 2 minutes old
- [Phase 08-keeper-monitoring]: pino logger singleton in utils/logger.ts with child({ module }) pattern per file
- [Phase 08-keeper-monitoring]: GET /health returns 503 on startup until first scan cycle completes (lastScanTime null = unhealthy)
- [Phase 08-keeper-monitoring]: healthState is a plain mutable singleton object (no class) to avoid circular imports
- [Phase 08-keeper-monitoring]: BetterStack free tier for uptime monitoring — pings health endpoints every 1-2 minutes, email alerts on 2 consecutive failures
- [Phase 08-keeper-monitoring]: Email alerts configured initially; Slack integration deferred
- [Phase 08-keeper-monitoring]: order-execution-keeper Dockerfile follows same multi-stage pattern as keeper-service (base -> deps -> build -> production)
- [Phase 09]: pendingImpactAmount documented rather than removed — used in real calculations, 0n default is correct when contract lacks the field
- [Phase 09]: Keeper optimization: order-keeper 10s scan, price-keeper 30s scan — recommend 5s/15s for demo latency
- [Phase 09]: EmptyTableContent spinner via Tailwind animate-spin — consistent across positions, orders, and claims tables
- [Phase 09]: Base Sepolia explorer URL fixed from basescan.org to sepolia.basescan.org — affected all explorer links globally

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 09-01-PLAN.md — UI polish (loading spinner, explorer URL, BaseScan toast links)
Next: All phases complete. v1.2 Demo-Ready Deployment milestone finished.
