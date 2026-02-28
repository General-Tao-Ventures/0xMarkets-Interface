# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9 ([shipped 2026-02-23](milestones/v1.2-ROADMAP.md))
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12 (shipped 2026-02-24)
- ✅ **v1.4 Maximum Keeper Speed** — Phases 13-14 (shipped 2026-02-25)
- ✅ **v1.5 Minimal Keeper Rewrite** — Phases 15-17 (shipped 2026-02-26)
- ✅ **v1.6 E2E Reliability** — Phases 18, 20-23 (shipped 2026-02-27)
- 🚧 **v1.7 Liquidation Readiness** — Phases 24-26 (in progress)

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
<summary>✅ v1.6 E2E Reliability (Phases 18, 20-23) — SHIPPED 2026-02-27</summary>

- [x] Phase 18: Event Detection and Toast Feedback (3/3 plans) — completed 2026-02-27
- [x] Phase 20: Contract Address Audit (2/2 plans) — completed 2026-02-26
- [x] Phase 21: Keeper Execution Fixes (1/1 plans) — completed 2026-02-27
- [x] Phase 22: Frontend Feedback (2/2 plans) — completed 2026-02-27
- [x] Phase 23: Automated E2E Testing (2/2 plans) — completed 2026-02-27

</details>

### v1.7 Liquidation Readiness (In Progress)

**Milestone Goal:** Fix the last contract bug (JPY/USD division-by-zero), verify the existing liquidation keeper pipeline works end-to-end on Base Sepolia, and harden it for reliability and performance.

- [x] **Phase 24: Contract Bug Fixes** - Fix OrderHandler div-by-zero on reversed markets, redeploy atomically with ExchangeRouter, propagate addresses to all services (completed 2026-02-27)
- [x] **Phase 25: Liquidation Pipeline Verification** - Prove the liquidation keeper detects, executes, and records a real liquidation on Base Sepolia (1/2 plans complete) (completed 2026-02-28)
- [ ] **Phase 26: Liquidation Hardening and Performance** - Add reliability guards, timing instrumentation, dead code cleanup, and scan performance optimizations

## Phase Details

### Phase 24: Contract Bug Fixes
**Goal**: JPY/USD orders execute without reverting, the E2E test suite passes 18/18, and all services point to the fixed contracts
**Depends on**: Phase 23 (E2E tests documented the bug; provides the 18/18 verification target)
**Requirements**: CFIX-01, CFIX-02, CFIX-03
**Success Criteria** (what must be TRUE):
  1. A market order on JPY/USD executes without reverting -- the triggerPrice=0 division-by-zero is gone
  2. `cast call <EXCHANGE_ROUTER> "orderHandler()(address)"` returns the NEW OrderHandler address -- ExchangeRouter was redeployed atomically, not just OrderHandler
  3. All five services (interface SDK, order-execution-keeper, keeper-service, E2E tests, contracts repo) reference the new OrderHandler and ExchangeRouter addresses
  4. The E2E test suite passes 18/18 (including JPY/USD which was previously skipped)
**Plans**: 2 plans
Plans:
- [x] 24-01-PLAN.md -- Fix OrderHandler.sol zero-guard and deploy both contracts to Base Sepolia
- [x] 24-02-PLAN.md -- Propagate new addresses to all services, remove JPY/USD skip, verify E2E 18/18

### Phase 25: Liquidation Pipeline Verification
**Goal**: A real undercollateralized position on Base Sepolia is detected by the liquidation scanner, executed by the liquidation executor, and recorded in PostgreSQL -- proving the full pipeline works
**Depends on**: Phase 24 (contract surface must be clean -- LiquidationUtils also hits triggerPrice=0 on reversed markets)
**Requirements**: LIQ-01, LIQ-02, LIQ-03, LIQ-04, LPERF-03
**Success Criteria** (what must be TRUE):
  1. The keeper wallet has `LIQUIDATION_KEEPER` role on LiquidationHandler, verified via `cast call` on RoleStore
  2. The keeper-service runs with `ORACLE_MODE=lazer` so its oracle cache is independent of the order-execution-keeper's uptime
  3. A deliberately undercollateralized test position is detected as liquidatable by the scanner within one scan cycle (30s)
  4. The executor submits `executeLiquidation` and the transaction succeeds on-chain (visible on Basescan)
  5. The confirmator updates the PostgreSQL record from SUBMITTED to EXECUTED with the correct transaction hash
**Plans**: 4 plans
Plans:
- [x] 25-01-PLAN.md -- Fix PythLazerFeedProvider address, set oracle mode to Lazer, verify LIQUIDATION_KEEPER role
- [x] 25-02-PLAN.md -- End-to-end liquidation pipeline test (partial -- 9 bug fixes, testnet pool reserves blocker)
- [ ] 25-03-PLAN.md -- Gap closure: fix wrong PythLazerFeedProvider address in all config files
- [ ] 25-04-PLAN.md -- Gap closure: execute full liquidation pipeline (executor TX + confirmator status)

### Phase 26: Liquidation Hardening and Performance
**Goal**: The liquidation pipeline handles edge cases gracefully, has observability instrumentation, and scans positions efficiently
**Depends on**: Phase 25 (pipeline proven correct -- hardening and optimization do not mask correctness bugs)
**Requirements**: LHARD-01, LHARD-02, LHARD-03, LHARD-04, LPERF-01, LPERF-02
**Success Criteria** (what must be TRUE):
  1. Submitting the same position key twice within 60 seconds results in exactly one liquidation attempt -- the deduplication guard prevents double-submission
  2. A reverted liquidation transaction is recorded in PostgreSQL with status REVERTED and an error reason, not stuck as SUBMITTED forever
  3. `riskEngine.ts` is removed or archived -- dead code is not in the active codebase
  4. Keeper logs show per-stage timing (scan duration, check duration, submit duration, confirm duration) for each liquidation cycle
  5. Position discovery uses a single multicall RPC request instead of N serial `getPosition()` calls
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 24 -> 25 -> 26

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
| 18. Event Detection and Toast Feedback | v1.6 | 3/3 | Complete | 2026-02-27 |
| 20. Contract Address Audit | v1.6 | 2/2 | Complete | 2026-02-26 |
| 21. Keeper Execution Fixes | v1.6 | 1/1 | Complete | 2026-02-27 |
| 22. Frontend Feedback | v1.6 | 2/2 | Complete | 2026-02-27 |
| 23. Automated E2E Testing | v1.6 | 2/2 | Complete | 2026-02-27 |
| 24. Contract Bug Fixes | 2/2 | Complete    | 2026-02-27 | - |
| 25. Liquidation Pipeline Verification | 3/4 | In Progress|  | - |
| 26. Liquidation Hardening and Performance | v1.7 | 0/TBD | Not started | - |
