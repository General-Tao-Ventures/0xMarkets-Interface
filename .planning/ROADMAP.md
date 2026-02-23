# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9 ([shipped 2026-02-23](milestones/v1.2-ROADMAP.md))
- 🚧 **v1.3 Keeper Execution Speed** — Phases 10-12 (in progress)

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

### 🚧 v1.3 Keeper Execution Speed (In Progress)

**Milestone Goal:** All keeper-executed operations (deposits, withdrawals, orders) complete in under 10 seconds, consistently.

- [x] **Phase 10: Event-Driven Detection** - WebSocket event listeners with execution queue and polling fallback (completed 2026-02-23)
- [ ] **Phase 11: Execution Pipeline Optimization** - Oracle pre-caching and redundant read elimination
- [ ] **Phase 12: Observability & Tuning** - Heartbeat health model and latency metrics

## Phase Details

### Phase 10: Event-Driven Detection
**Goal**: Keeper detects new operations within 2 seconds via WebSocket event subscriptions, with nonce-safe sequential execution and automatic gap recovery
**Depends on**: Phase 9 (v1.2 complete)
**Requirements**: DETECT-01, DETECT-02, DETECT-03, INFRA-01, EXEC-01
**Success Criteria** (what must be TRUE):
  1. A deposit/withdrawal/order created on-chain is detected by the keeper within 2 seconds (not 5-10s polling average)
  2. When the WebSocket connection drops, the keeper continues detecting operations via polling fallback without manual intervention
  3. After a keeper restart, any operations created during downtime are detected and executed (no missed events)
  4. Three concurrent deposits submitted in rapid succession all execute without nonce collision errors
  5. The keeper startup log confirms WebSocket transport is active (not silently falling back to HTTP polling)
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md — ExecutionQueue, WebSocket client, EventEmitter ABI, Prisma KeeperState model
- [ ] 10-02-PLAN.md — EventListener with backfill, main loop rewire to queue-driven execution

### Phase 11: Execution Pipeline Optimization
**Goal**: Oracle price overhead reduced from 2-8 seconds to near-zero by pre-caching Pyth Lazer prices and eliminating redundant chain reads
**Depends on**: Phase 10
**Requirements**: EXEC-02, EXEC-03
**Success Criteria** (what must be TRUE):
  1. Keeper execution does not send a separate oracle price update transaction before each operation — prices are pre-cached or inlined
  2. The executor does not re-read operation data from the chain that the scanner already fetched (no redundant RPC calls visible in logs)
  3. End-to-end execution time from detection to confirmation is under 5 seconds for deposits, withdrawals, and orders
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Observability & Tuning
**Goal**: Health monitoring accurately reflects keeper liveness in an event-driven architecture, with execution latency percentiles for performance tracking
**Depends on**: Phase 11
**Requirements**: INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. Health endpoint returns 200 during idle periods when no user operations are occurring (no false alerts from stale execution timestamps)
  2. Health endpoint reports p50 and p95 execution latency percentiles that can be consumed by monitoring tools
  3. BetterStack does not fire false-positive alerts during 5+ minutes of keeper inactivity
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12

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
| 10. Event-Driven Detection | 2/2 | Complete   | 2026-02-23 | - |
| 11. Execution Pipeline Optimization | v1.3 | 0/? | Not started | - |
| 12. Observability & Tuning | v1.3 | 0/? | Not started | - |
