# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9 ([shipped 2026-02-23](milestones/v1.2-ROADMAP.md))
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12 (shipped 2026-02-24)
- ✅ **v1.4 Maximum Keeper Speed** — Phases 13-14 (shipped 2026-02-25)
- 🚧 **v1.5 Minimal Keeper Rewrite** — Phases 15-17 (in progress)

## Phases

<details>
<summary>✅ v1.0 Fix Buy GM Flow (Phases 1-3) — SHIPPED 2026-02-21</summary>

- [x] Phase 1: Keeper Oracle Integration (2/2 plans) — completed 2026-02-21
- [x] Phase 2: End-to-End Deposit Execution (2/2 plans) — completed 2026-02-21
- [x] Phase 3: Deposit UX & Status Visibility (2/2 plans) — completed 2026-02-21

</details>

<details>
<summary>✅ v1.1 Full Trading Experience (Phases 4-6) — SHIPPED 2026-02-22</summary>

- [x] Phase 4: Stable Foundation (2/2 plans) — completed 2026-02-21
- [x] Phase 5: Liquidity & Swaps (2/2 plans) — completed 2026-02-21
- [x] Phase 6: Position Management (4/4 plans) — completed 2026-02-22

</details>

<details>
<summary>✅ v1.2 Demo-Ready Deployment (Phases 7-9) — SHIPPED 2026-02-23</summary>

- [x] Phase 7: Public Deployment (2/2 plans) — completed 2026-02-23
- [x] Phase 8: Keeper Monitoring (3/3 plans) — completed 2026-02-23
- [x] Phase 9: UI Polish & Tech Debt (2/2 plans) — completed 2026-02-23

</details>

<details>
<summary>✅ v1.3 Keeper Execution Speed (Phases 10-12) — SHIPPED 2026-02-24</summary>

- [x] Phase 10: Event-Driven Detection (2/2 plans) — completed 2026-02-23
- [x] Phase 11: Execution Pipeline Optimization (2/2 plans) — completed 2026-02-23
- [x] Phase 12: Observability & Tuning (2/2 plans) — completed 2026-02-24

</details>

<details>
<summary>✅ v1.4 Maximum Keeper Speed (Phases 13-14) — SHIPPED 2026-02-25</summary>

- [x] Phase 13: Oracle Correctness (4/4 plans) — completed 2026-02-25
- [x] Phase 14: Execution Speed (2/2 plans) — completed 2026-02-25

</details>

### 🚧 v1.5 Minimal Keeper Rewrite (In Progress)

**Milestone Goal:** Replace the 3,000+ line order-execution-keeper with a ~300 line single-loop keeper that reliably executes deposits, withdrawals, and orders.

- [ ] **Phase 15: Project Skeleton and Oracle** - Clean project reset with config/keys/ABIs and Pyth Lazer WebSocket cache
- [ ] **Phase 16: Keeper Logic and Infrastructure** - Event watcher, poller, sequential executor, health endpoint, Dockerfile
- [ ] **Phase 17: Deploy and Verify** - Deploy to DigitalOcean and verify all operation types end-to-end

## Phase Details

### Phase 15: Project Skeleton and Oracle
**Goal**: A clean TypeScript project that compiles, with correct config/keys/ABIs and a working Pyth Lazer oracle cache
**Depends on**: Phase 14 (v1.4 complete)
**Requirements**: ORCL-01, ORCL-02, ORCL-03
**Success Criteria** (what must be TRUE):
  1. Old code is removed (no Prisma, no scanner/executor class hierarchies, no TransactionMonitor) and the project compiles cleanly with `pnpm build`
  2. Pyth Lazer WebSocket connects and populates price cache for all 7 tokens (EUR, GBP, GOLD, JPY, USDC, WBTC, WETH) — verified by running `pnpm dev` and seeing cache populated in logs
  3. `buildOracleParams(tokens)` returns the correct Lazer provider address (`0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`) for every token — not a mix of providers
  4. Cache rejects prices older than 270 seconds, preventing MaxPriceAgeExceeded errors that plagued v1.3-v1.4
**Plans:** 2 plans
Plans:
- [ ] 15-01-PLAN.md — Gut old code, create project skeleton (config/keys/ABIs, package.json, tsconfig, Dockerfile)
- [ ] 15-02-PLAN.md — Pyth Lazer oracle cache module and minimal index.ts proving oracle works

### Phase 16: Keeper Logic and Infrastructure
**Goal**: A fully functional keeper that detects, deduplicates, and sequentially executes deposits, withdrawals, and orders with health monitoring
**Depends on**: Phase 15
**Requirements**: DET-01, DET-02, DET-03, EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Keeper detects DepositCreated, WithdrawalCreated, and OrderCreated events via WebSocket within 1 second of on-chain emission — verified by watching logs after submitting a deposit on the frontend
  2. Safety-net poller reads all three DataStore lists (DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST) every 15 seconds and enqueues any operations missed by the event watcher
  3. Same operation key is never executed twice — dedup Set prevents double-execution from event+poll overlap
  4. GET /health returns JSON with status, uptime, queue length, and keeper address; Docker health check passes with 30s start-period
  5. Keeper completes in-flight transaction on SIGTERM before shutting down — no orphaned nonces
**Plans**: TBD

### Phase 17: Deploy and Verify
**Goal**: Keeper deployed to production and all three operation types verified end-to-end on live chain
**Depends on**: Phase 16
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. Keeper running on DigitalOcean droplet (142.93.203.222) via Docker Compose with BetterStack health monitoring active
  2. A deposit submitted via the frontend executes successfully — user sees GM tokens appear
  3. A withdrawal submitted via the frontend executes successfully — user receives collateral back
  4. A market order submitted via the frontend executes successfully — user sees position opened/closed
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 15 → 16 → 17

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Keeper Oracle Integration | v1.0 | 2/2 | Complete | 2026-02-21 |
| 2. End-to-End Deposit Execution | v1.0 | 2/2 | Complete | 2026-02-21 |
| 3. Deposit UX & Status Visibility | v1.0 | 2/2 | Complete | 2026-02-21 |
| 4. Stable Foundation | v1.1 | 2/2 | Complete | 2026-02-21 |
| 5. Liquidity & Swaps | v1.1 | 2/2 | Complete | 2026-02-21 |
| 6. Position Management | v1.1 | 4/4 | Complete | 2026-02-22 |
| 7. Public Deployment | v1.2 | 2/2 | Complete | 2026-02-23 |
| 8. Keeper Monitoring | v1.2 | 3/3 | Complete | 2026-02-23 |
| 9. UI Polish & Tech Debt | v1.2 | 2/2 | Complete | 2026-02-23 |
| 10. Event-Driven Detection | v1.3 | 2/2 | Complete | 2026-02-23 |
| 11. Execution Pipeline Optimization | v1.3 | 2/2 | Complete | 2026-02-23 |
| 12. Observability & Tuning | v1.3 | 2/2 | Complete | 2026-02-24 |
| 13. Oracle Correctness | v1.4 | 4/4 | Complete | 2026-02-25 |
| 14. Execution Speed | v1.4 | 2/2 | Complete | 2026-02-25 |
| 15. Project Skeleton and Oracle | v1.5 | 0/2 | Not started | - |
| 16. Keeper Logic and Infrastructure | v1.5 | 0/TBD | Not started | - |
| 17. Deploy and Verify | v1.5 | 0/TBD | Not started | - |
