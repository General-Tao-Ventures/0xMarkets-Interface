# Roadmap: 0xMarkets Interface

## Milestones

- [x] **v1.0 Fix Buy GM Flow** - Phases 1-3 (shipped 2026-02-21)
- [ ] **v1.1 Full Trading Experience** - Phases 4-6 (in progress)

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

### v1.1 Full Trading Experience (In Progress)

**Milestone Goal:** Enable the full trading loop — open positions, manage orders, execute swaps, and withdraw liquidity across all 6 markets.

## Phase Details

### Phase 4: Stable Foundation
**Goal**: Trade page loads without crashes and all 6 markets are fully configured for trading operations
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Success Criteria** (what must be TRUE):
  1. Trade page loads without throwing a Division by zero error on any of the 6 markets
  2. All 6 markets display valid liquidity, reserve factors, and open interest limits (no zero values causing validation failures)
  3. WebSocket connection recovers silently from CLOSING state without console spam
  4. Metrics endpoint errors are suppressed — no 404/500 noise in the console blocking normal use
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Frontend defensive guards, WebSocket suppression, and metrics endpoint
- [x] 04-02-PLAN.md — On-chain market configuration for all 6 Base Sepolia markets

### Phase 5: Liquidity & Swaps
**Goal**: Users can withdraw liquidity from pools and view pool statistics, completing the liquidity lifecycle
**Depends on**: Phase 4
**Requirements**: LIQ-01, LIQ-02, SWAP-01
**SWAP-01 Deferred**: User explicitly deferred swaps ("we don't need the swap route, we just want long and short"). SWAP-01 will be addressed in a future milestone.
**Success Criteria** (what must be TRUE):
  1. User can submit a Sell GM transaction and receive underlying tokens back in their wallet
  2. Pools page displays utilization percentage, fees earned, and APY for each active pool
  3. Pools page has "My Pools" tab showing user's pools with PnL
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Sell GM flow: action buttons, withdrawal notifications, and cancel support
- [x] 05-02-PLAN.md — Pool stats: All Pools / My Pools tabs, utilization, and PnL display

### Phase 6: Position Management
**Goal**: Users can open, manage, and close leveraged positions with all order types across all 6 markets
**Depends on**: Phase 5
**Requirements**: POS-01, POS-02, POS-03, POS-04
**Success Criteria** (what must be TRUE):
  1. User can open a long or short market order on any of the 6 configured markets and the position appears in their positions list
  2. User can close a full or partial position and the collateral returns to their wallet
  3. User can place a limit order to open a position at a specified price, and it executes when the market reaches that price
  4. User can attach stop-loss and take-profit orders to an existing open position
**Plans**: 4 plans

Plans:
- [x] 06-01-PLAN.md — Market order submission and position display (end-to-end)
- [ ] 06-02-PLAN.md — Close positions (full and partial) via PositionSeller
- [ ] 06-03-PLAN.md — Limit orders and SL/TP order attachment
- [ ] 06-04-PLAN.md — Human verification of all position management flows

## Progress

**Execution Order:** 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Keeper Oracle Integration | v1.0 | 2/2 | Complete | 2026-02-21 |
| 2. End-to-End Deposit Execution | v1.0 | 2/2 | Complete | 2026-02-21 |
| 3. Deposit UX & Status Visibility | v1.0 | 2/2 | Complete | 2026-02-21 |
| 4. Stable Foundation | v1.1 | 2/2 | Complete | 2026-02-21 |
| 5. Liquidity & Swaps | v1.1 | 2/2 | Complete | 2026-02-21 |
| 6. Position Management | 2/4 | In Progress|  | - |
