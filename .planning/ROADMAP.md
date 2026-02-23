# Roadmap: 0xMarkets Interface

## Milestones

- [x] **v1.0 Fix Buy GM Flow** - Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- [x] **v1.1 Full Trading Experience** - Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- [ ] **v1.2 Demo-Ready Deployment** - Phases 7-9 (in progress)

## Phases

<details>
<summary>v1.0 Fix Buy GM Flow (Phases 1-3) - SHIPPED 2026-02-21</summary>

### Phase 1: Keeper Oracle Integration
**Goal**: Keeper pushes valid Pyth Lazer prices on-chain before executing deposits
**Plans**: 2 plans

Plans:
- [x] 01-01: Fix Pyth Lazer WebSocket initialization and clientReady pattern
- [x] 01-02: Include market index token (WETH) in oracle params

### Phase 2: End-to-End Deposit Execution
**Goal**: Deposits execute reliably from createDeposit through GM token receipt
**Plans**: 2 plans

Plans:
- [x] 02-01: Keeper detects deposit events and executes with retry logic
- [x] 02-02: Ghost deposit guard (CANCELLED vs FAILED) and expired deposit cancellation

### Phase 3: Deposit UX & Status Visibility
**Goal**: Users see clear deposit status and actionable error feedback throughout the flow
**Plans**: 2 plans

Plans:
- [x] 03-01: Keeper deposit status API with CORS for frontend consumption
- [x] 03-02: Enhanced deposit notification UI with elapsed time counter and cancel button

</details>

<details>
<summary>v1.1 Full Trading Experience (Phases 4-6) - SHIPPED 2026-02-22</summary>

### Phase 4: Stable Foundation
**Goal**: Trade page loads without crashes and all 6 markets are fully configured for trading operations
**Plans**: 2 plans

Plans:
- [x] 04-01: Frontend defensive guards, WebSocket suppression, and metrics endpoint
- [x] 04-02: On-chain market configuration for all 6 Base Sepolia markets

### Phase 5: Liquidity & Swaps
**Goal**: Users can withdraw liquidity from pools and view pool statistics, completing the liquidity lifecycle
**Plans**: 2 plans (SWAP-01 deferred)

Plans:
- [x] 05-01: Sell GM flow: action buttons, withdrawal notifications, and cancel support
- [x] 05-02: Pool stats: All Pools / My Pools tabs, utilization, and PnL display

### Phase 6: Position Management
**Goal**: Users can open, manage, and close leveraged positions with all order types across all 6 markets
**Plans**: 4 plans

Plans:
- [x] 06-01: Market order submission and position display (end-to-end)
- [x] 06-02: Close positions (full and partial) via PositionSeller
- [x] 06-03: Limit orders and SL/TP order attachment with price shortcuts
- [x] 06-04: Human verification of all position management flows

</details>

### v1.2 Demo-Ready Deployment (In Progress)

**Milestone Goal:** 0xMarkets is accessible via a public Vercel URL with cloud keepers running, health monitoring, and a UI polished enough to demo to investors.

#### Phase 7: Public Deployment
**Goal**: Anyone with the URL can access and use the app end-to-end without running anything locally
**Depends on**: Phase 6
**Requirements**: DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):
  1. Visiting the Vercel URL loads the app without errors for a first-time visitor
  2. A user can complete a full deposit-to-trade cycle with cloud keepers only (no local services)
  3. Cloud keepers detect and execute orders within the same timing as local verification (sub-60s)
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Deploy frontend to Vercel with env-driven keeper proxy, keeper-down banner, and custom domain
- [ ] 07-02-PLAN.md -- Sync cloud keepers with v1.1 fixes and verify end-to-end trading loop

#### Phase 8: Keeper Monitoring
**Goal**: Keeper health is observable and failures trigger alerts before they affect users
**Depends on**: Phase 7
**Requirements**: MON-01, MON-02, MON-03
**Success Criteria** (what must be TRUE):
  1. A GET request to the keeper health endpoint returns status 200 with service state (up/down, last execution time)
  2. Keeper logs include structured fields (timestamp, level, service, event) readable in DO log viewer
  3. An alert fires within 5 minutes of a keeper process going down or stopping execution
**Plans**: 3 plans

Plans:
- [ ] 08-01-PLAN.md -- Pino structured logging + real health endpoint for order-execution-keeper-service
- [ ] 08-02-PLAN.md -- Pino structured logging + real health endpoint for keeper-service
- [ ] 08-03-PLAN.md -- Dockerfile for order-keeper + BetterStack uptime monitoring setup

#### Phase 9: UI Polish & Tech Debt
**Goal**: The UI is demo-ready for investors and the codebase has no unresolved workarounds blocking future development
**Depends on**: Phase 7
**Requirements**: UI-01, UI-02, UI-03, DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):
  1. A first-time user can navigate from pools to trading to position management without encountering a confusing state, broken layout, or console error
  2. Loading states, empty states, and error messages throughout the app look intentional (not placeholder)
  3. All 6 market pages render with consistent visual styling (same fonts, spacing, component sizes)
  4. The TypeScript build completes without errors (useOrders.ts error resolved)
  5. SDK test suite output is clean — all tests either pass or have explicit skip annotations with documented reasons
**Plans**: TBD

Plans:
- [ ] 09-01: UI audit — identify and fix rough edges across all pages
- [ ] 09-02: Tech debt resolution — pendingImpactAmount, TypeScript errors, SDK tests, keeper efficiency

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Keeper Oracle Integration | v1.0 | 2/2 | Complete | 2026-02-21 |
| 2. End-to-End Deposit Execution | v1.0 | 2/2 | Complete | 2026-02-21 |
| 3. Deposit UX & Status Visibility | v1.0 | 2/2 | Complete | 2026-02-21 |
| 4. Stable Foundation | v1.1 | 2/2 | Complete | 2026-02-21 |
| 5. Liquidity & Swaps | v1.1 | 2/2 | Complete | 2026-02-21 |
| 6. Position Management | v1.1 | 4/4 | Complete | 2026-02-22 |
| 7. Public Deployment | v1.2 | 2/2 | Complete | 2026-02-23 |
| 8. Keeper Monitoring | 1/3 | In Progress|  | - |
| 9. UI Polish & Tech Debt | v1.2 | 0/2 | Not started | - |
