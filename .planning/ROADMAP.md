# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9 ([shipped 2026-02-23](milestones/v1.2-ROADMAP.md))
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12 (shipped 2026-02-24)
- 🚧 **v1.4 Maximum Keeper Speed** — Phases 13-14 (in progress)

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

### 🚧 v1.4 Maximum Keeper Speed (In Progress)

**Milestone Goal:** All keeper-executed operations complete as fast as possible with proper oracle configuration for both crypto and FX markets.

- [ ] **Phase 13: Oracle Correctness** - Per-token oracle routing so all 6 markets execute without reverts
- [ ] **Phase 14: Execution Speed** - Flashblocks RPC, tighter update intervals, and pipeline timing instrumentation

## Phase Details

### Phase 13: Oracle Correctness
**Goal**: All 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY) execute deposits, withdrawals, and orders without oracle-related reverts
**Depends on**: Phase 12
**Requirements**: ORCL-01, ORCL-02, ORCL-03, ORCL-04
**Success Criteria** (what must be TRUE):
  1. Keeper starts up, verifies Pyth Lazer feed entitlements for all 7 tokens, and exits with a clear FATAL log within 30 seconds if any expected feed receives no data
  2. A deposit on an FX market (EUR, GBP, GOLD, or JPY) executes end-to-end without InvalidOracleProvider revert — the correct on-chain provider is registered and the keeper routes oracle params accordingly
  3. A deposit on a crypto market (ETH or BTC) continues to execute via Lazer with no regression from the oracle routing changes
  4. Keeper logs a FATAL error at startup if any token's on-chain `oracleProviderForToken` does not match the keeper's configured provider address, preventing hours of cryptic debugging
**Plans**: TBD

### Phase 14: Execution Speed
**Goal**: Keeper execution latency reduced to the minimum achievable on Base Sepolia, with per-stage timing to prove it
**Depends on**: Phase 13
**Requirements**: SPEED-01, SPEED-02, SPEED-03, SPEED-04
**Success Criteria** (what must be TRUE):
  1. Transaction confirmation time drops from ~2-4 seconds to under 500ms after switching to Flashblocks-enabled RPC (measurable in keeper logs)
  2. MaxPriceAgeExceeded errors no longer occur during normal operation — background oracle updates at 5s intervals with 30s safety margin keep prices fresh
  3. Normal execution path does not include a synchronous `updatePriceOnChain()` transaction — background updater handles freshness, eliminating 2-4s of blocking overhead per execution
  4. Every execution logs per-stage timing (detection, oracle param build, TX submission, TX confirmation) via `performance.now()` instrumentation, enabling latency regression detection
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 13 → 14

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
| 13. Oracle Correctness | 1/2 | In Progress|  | - |
| 14. Execution Speed | v1.4 | TBD | Not started | - |
