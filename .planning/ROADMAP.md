# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9 ([shipped 2026-02-23](milestones/v1.2-ROADMAP.md))
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12 (shipped 2026-02-24)
- ✅ **v1.4 Maximum Keeper Speed** — Phases 13-14 (shipped 2026-02-25)
- ✅ **v1.5 Minimal Keeper Rewrite** — Phases 15-17 (shipped 2026-02-26)
- 🚧 **v1.6 E2E Reliability** — Phases 20-23 (in progress)

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

<details>
<summary>Superseded: v1.6 Execution Feedback — Phase 18 (partial)</summary>

Phase 18 was partially completed under the original v1.6 "Execution Feedback" scope.
Plan 18-01 shipped (RPC polling fallback). Plans 18-02 and 18-03 were superseded when v1.6 scope
was replaced with E2E Reliability. The polling infrastructure from 18-01 carries forward into Phase 22.

- [x] 18-01-PLAN.md — RPC polling fallback for reliable event detection and timeout handling
- [ ] ~~18-02-PLAN.md — Verify toast lifecycle (superseded)~~
- [ ] ~~18-03-PLAN.md — Gap closure (superseded)~~

</details>

### v1.6 E2E Reliability (In Progress)

**Milestone Goal:** Every market x every operation (deposit, trade, withdrawal) works reliably end-to-end: user action -> keeper execution -> frontend toast + auto-refresh. No manual page refresh needed.

- [ ] **Phase 20: Contract Address Audit** - Verify all addresses across interface SDK, keeper, and contracts repo match on-chain reality
- [ ] **Phase 21: Keeper Execution Fixes** - All 6 markets execute deposits, withdrawals, and orders without reverts
- [ ] **Phase 22: Frontend Feedback** - Toast lifecycle and auto-refresh for all operation types
- [ ] **Phase 23: Automated E2E Testing** - Scripts that verify all 18 market x operation combinations

## Phase Details

### Phase 20: Contract Address Audit
**Goal**: All contract addresses across every service are verified correct against on-chain state, so no execution failures come from stale config
**Depends on**: Phase 17 (v1.5 complete -- keeper deployed and running)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04
**Success Criteria** (what must be TRUE):
  1. Every market address in the interface SDK (`sdk/src/configs/markets.ts`) resolves to a valid on-chain DataStore entry -- no phantom markets
  2. Every token address in the order-execution-keeper-service matches the token contracts actually deployed on Base Sepolia
  3. Oracle provider addresses in both keeper and interface match the on-chain DataStore oracle configuration for all 6 markets
  4. All 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY) are enabled on-chain with non-zero reserve factors, OI limits, and pool caps
  5. A single audit report documents every discrepancy found and every fix applied, so future redeployments have a checklist
**Plans**: 2 plans
- [ ] 20-01-PLAN.md -- Write audit verification script, run against on-chain DataStore, produce audit report
- [ ] 20-02-PLAN.md -- Apply all fixes from audit report, SDK prebuild, re-verify, smoke test, keeper restart

### Phase 21: Keeper Execution Fixes
**Goal**: The order-execution-keeper executes all three operation types across all 6 markets without reverts, so every user action reaches completion
**Depends on**: Phase 20 (addresses verified correct -- execution failures are real bugs, not config)
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04
**Success Criteria** (what must be TRUE):
  1. A deposit submitted on any of the 6 markets is detected by the keeper within 10 seconds and executes without reverting
  2. A withdrawal submitted on any of the 6 markets is detected by the keeper within 10 seconds and executes without reverting
  3. A market order (long or short) submitted on any of the 6 markets is detected by the keeper within 10 seconds and executes without reverting
  4. Keeper logs show zero revert errors across a full 6-market test pass (deposit + withdrawal + order per market = 18 operations)
**Plans**: TBD

### Phase 22: Frontend Feedback
**Goal**: Users see real-time toast notifications for every operation and never need to manually refresh to see updated balances or positions
**Depends on**: Phase 21 (keeper executes reliably -- frontend can trust execution happens)
**Requirements**: FB-01, FB-02, FB-03, FB-04, FB-05, FB-06, FB-07, FB-08
**Success Criteria** (what must be TRUE):
  1. After submitting a deposit, a "Pending..." toast appears immediately and updates to "Executed!" when the DepositExecuted event is detected on-chain
  2. After submitting a withdrawal, a "Pending..." toast appears immediately and updates to "Executed!" when the WithdrawalExecuted event is detected on-chain
  3. After submitting a market order, a "Pending..." toast appears immediately and updates to "Executed!" when the OrderExecuted event is detected on-chain
  4. GM token balances on the pools page auto-refresh after a deposit or withdrawal executes -- no manual page refresh
  5. Positions list on the trade page auto-refresh after an order executes -- new position appears or existing position closes without page refresh
**Plans**: TBD

### Phase 23: Automated E2E Testing
**Goal**: A repeatable test suite validates all 18 market x operation combinations, so regressions are caught before they reach users
**Depends on**: Phase 22 (full pipeline working -- tests validate the complete flow)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Running the deposit test script produces a pass/fail result for each of the 6 markets (6 results total)
  2. Running the withdrawal test script produces a pass/fail result for each of the 6 markets (6 results total)
  3. Running the order test script produces a pass/fail result for each of the 6 markets (6 results total)
  4. All 18 tests pass on a clean run against the deployed keeper and live Base Sepolia contracts
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 20 -> 21 -> 22 -> 23

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
| 18. Event Detection and Toast Feedback | v1.6 (old) | 1/3 | Superseded | - |
| 20. Contract Address Audit | 1/2 | In Progress|  | - |
| 21. Keeper Execution Fixes | v1.6 | 0/TBD | Not started | - |
| 22. Frontend Feedback | v1.6 | 0/TBD | Not started | - |
| 23. Automated E2E Testing | v1.6 | 0/TBD | Not started | - |
