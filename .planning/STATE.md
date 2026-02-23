# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** User can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets
**Current focus:** v1.2 Demo-Ready Deployment — Phase 7: Public Deployment

## Current Position

Phase: 7 of 9 (Public Deployment)
Plan: 2/2 complete (awaiting human checkpoint: DO deployment + trading loop verification)
Status: In progress — checkpoint reached
Last activity: 2026-02-23 — Completed plan 07-02 Task 1 (v1.1 fixes committed, docker-compose.yml updated)

Progress: [███████░░░] 72% (7/9 phases — Phase 7 Task 1 complete, checkpoint pending)

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
| 7. Public Deployment | v1.2 | 2/2 | Checkpoint pending (DO deploy + trading loop) |
| 8. Keeper Monitoring | v1.2 | 0/2 | Not started |
| 9. UI Polish & Tech Debt | v1.2 | 0/2 | Not started |

## Accumulated Context

### Known Issues

- 17 pre-existing failing SDK test files (21 tests) — pre-existing, unrelated to v1.1 (addressed in DEBT-02)
- Pre-existing TypeScript error in useOrders.ts (OrderInfoStructOutput export mismatch) (DEBT-03)
- pendingImpactAmount defaulted to 0n — contract struct mismatch, may need proper removal (DEBT-01)
- Cloud keeper source fixes committed (DEPLOY-02 Task 1 complete); pending DO deployment and trading loop verification
- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)

### Pending Todos

None.

### Blockers/Concerns

- Vercel Deployment Protection (password) is enabled on the project — user must disable via Vercel Dashboard (Settings -> Deployment Protection) to make app publicly accessible. This is a dashboard setting, not a code change.

### Decisions

- Relative URL pattern for keeper proxies (/api/keeper, /api/order-keeper) works in both Vite dev (via proxy) and Vercel prod (via serverless functions)
- process.env.KEEPER_URL fallback to hardcoded IP enables zero-config local development
- Deployment protection must be disabled via Vercel Dashboard for public access
- docker-compose.yml at /Users/ken/Projects/0xM/ is not git-tracked — must be scp'd to DO server separately from source git pull
- v1.1 keeper fixes (indexToken resolution, FAILED retry, PythLazer v4 address) now committed to order-execution-keeper-service main branch

## Session Continuity

Last session: 2026-02-23
Stopped at: 07-02-PLAN.md Task 1 complete — checkpoint:human-verify for DO deployment + trading loop test
Resume file: .planning/phases/07-public-deployment/07-02-SUMMARY.md
Next: User deploys keepers to DO and verifies full trading loop (see 07-02-SUMMARY.md User Setup Required)
