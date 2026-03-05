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
- **v1.11 Trade History & Leaderboard Fix** — Phases 38-39

## Phases

### v1.11 Trade History & Leaderboard Fix

- [ ] Phase 38: Squid Fixes & Redeployment (TH-01, TH-02, LB-01, LB-02)
  - **Plans:** 1 plan
  - Diagnose why MarketIncrease/MarketDecrease OrderExecuted events are missing from trade history
  - Fix squid event processing for trade actions and pnlUsd enrichment
  - Fix accountStats: maxCapital precision, realizedFees field sourcing
  - Redeploy squid with --hard-reset and verify indexed data via GraphQL

  Plans:
  - [ ] 38-01-PLAN.md — Fix pnlUsd + fee extraction, deploy squid, verify data

- [ ] Phase 39: Frontend Verification & Fixes (TH-03, LB-03)
  - Verify trade history renders market order executions with rPnL
  - Fix frontend leaderboard period query params if needed
  - Validate against Erkin's live account data

<details>
<summary>✅ v1.10 E2E Verification (Phases 35-37) — SHIPPED 2026-03-05</summary>

- [x] Phase 35: Trigger Order Fix (1/1 plan) — completed 2026-03-04
- [x] Phase 36: E2E Test Suite (1/1 plan) — completed 2026-03-04
- [x] Phase 37: Frontend Verification (2/2 plans) — completed 2026-03-05

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 38. Squid Fixes & Redeployment | v1.11 | 0/1 | Pending | — |
| 39. Frontend Verification & Fixes | v1.11 | 0/1 | Pending | — |
| 35. Trigger Order Fix | v1.10 | 1/1 | Complete | 2026-03-04 |
| 36. E2E Test Suite | v1.10 | 1/1 | Complete | 2026-03-04 |
| 37. Frontend Verification | v1.10 | 2/2 | Complete | 2026-03-05 |

---
*Created: 2026-03-04*
*Updated: 2026-03-04 — Phase 38 planned (1 plan)*
