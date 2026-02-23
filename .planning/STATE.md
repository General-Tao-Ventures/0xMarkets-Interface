# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** User can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets
**Current focus:** v1.2 Demo-Ready Deployment — Phase 8: Keeper Monitoring

## Current Position

Phase: 7 of 9 complete (Public Deployment)
Status: Phase 7 verified — full trading loop works from public URL
Last activity: 2026-02-23 — Phase 7 complete, app live at app.0xmarkets.io

Progress: [████████░░] 78% (7/9 phases complete)

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
| 8. Keeper Monitoring | v1.2 | 0/2 | Not started |
| 9. UI Polish & Tech Debt | v1.2 | 0/2 | Not started |

## Accumulated Context

### Known Issues

- 17 pre-existing failing SDK test files (21 tests) — pre-existing, unrelated to v1.1 (addressed in DEBT-02)
- Pre-existing TypeScript error in useOrders.ts (OrderInfoStructOutput export mismatch) (DEBT-03)
- pendingImpactAmount defaulted to 0n — contract struct mismatch, may need proper removal (DEBT-01)
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

## Session Continuity

Last session: 2026-02-23
Stopped at: Phase 7 complete — app.0xmarkets.io live with full trading loop verified
Next: Phase 8 (Keeper Monitoring) or Phase 9 (UI Polish & Tech Debt)
