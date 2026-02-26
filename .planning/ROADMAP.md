# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9 ([shipped 2026-02-23](milestones/v1.2-ROADMAP.md))
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12 (shipped 2026-02-24)
- ✅ **v1.4 Maximum Keeper Speed** — Phases 13-14 (shipped 2026-02-25)
- ✅ **v1.5 Minimal Keeper Rewrite** — Phases 15-17 (shipped 2026-02-26)
- 🚧 **v1.6 Execution Feedback** — Phases 18-19 (in progress)

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

<details>
<summary>✅ v1.5 Minimal Keeper Rewrite (Phases 15-17) — SHIPPED 2026-02-26</summary>

- [x] Phase 15: Project Skeleton and Oracle (2/2 plans) — completed 2026-02-26
- [x] Phase 16: Keeper Logic and Infrastructure (2/2 plans) — completed 2026-02-26
- [x] Phase 17: Deploy and Verify (2/2 plans) — completed 2026-02-26

</details>

### v1.6 Execution Feedback (In Progress)

**Milestone Goal:** Real-time toast notifications and auto-balance refresh when deposits, withdrawals, and orders execute — no manual page refresh needed.

- [ ] **Phase 18: Event Detection and Toast Feedback** - Watch EventEmitter for execution events and show toast notification lifecycle (pending/executed/error)
- [ ] **Phase 19: Auto-Refresh on Execution** - Automatically refresh balances and positions when execution events are detected

## Phase Details

### Phase 18: Event Detection and Toast Feedback
**Goal**: User sees real-time toast notifications tracking their operation from submission through execution or failure
**Depends on**: Phase 17 (v1.5 complete — keeper executes all operation types)
**Requirements**: DET-01, DET-02, DET-03, FB-01, FB-02, FB-03
**Success Criteria** (what must be TRUE):
  1. After user submits a deposit, a "Pending..." toast appears immediately and updates to "Executed!" when the DepositExecuted event is detected on-chain
  2. After user submits a withdrawal, a "Pending..." toast appears immediately and updates to "Executed!" when the WithdrawalExecuted event is detected on-chain
  3. After user submits an order (market, limit, stop-loss, take-profit), a "Pending..." toast appears immediately and updates to "Executed!" when the OrderExecuted event is detected on-chain
  4. If an operation fails or expires without execution, the toast updates to an error state with an actionable message (not stuck on "Pending..." forever)
**Plans**: 3 plans

Plans:
- [x] 18-01-PLAN.md — RPC polling fallback for reliable event detection and timeout handling
- [ ] 18-02-PLAN.md — Verify toast lifecycle for all operation types (e2e testing)
- [ ] 18-03-PLAN.md — Gap closure: wire watchOrderTxn into deposit/withdrawal flows and fix polling interval stability

### Phase 19: Auto-Refresh on Execution
**Goal**: User's balances and positions update automatically when operations execute, eliminating the need to manually refresh the page
**Depends on**: Phase 18 (event detection infrastructure exists)
**Requirements**: REF-01, REF-02
**Success Criteria** (what must be TRUE):
  1. After a deposit executes, the user's GM token balance updates on the pools page without a page refresh
  2. After a withdrawal executes, the user's USDC balance updates without a page refresh
  3. After an order executes, the user's positions list on the trade page updates without a page refresh (new position appears or existing position closes)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 18 → 19

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
| 15. Project Skeleton and Oracle | v1.5 | 2/2 | Complete | 2026-02-26 |
| 16. Keeper Logic and Infrastructure | v1.5 | 2/2 | Complete | 2026-02-26 |
| 17. Deploy and Verify | v1.5 | 2/2 | Complete | 2026-02-26 |
| 18. Event Detection and Toast Feedback | 2/3 | In Progress|  | - |
| 19. Auto-Refresh on Execution | v1.6 | 0/TBD | Not started | - |
