# Roadmap: 0xMarkets Interface

## Milestones

- [x] **v1.0 Fix Buy GM Flow** - Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- [x] **v1.1 Full Trading Experience** - Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))

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

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Keeper Oracle Integration | v1.0 | 2/2 | Complete | 2026-02-21 |
| 2. End-to-End Deposit Execution | v1.0 | 2/2 | Complete | 2026-02-21 |
| 3. Deposit UX & Status Visibility | v1.0 | 2/2 | Complete | 2026-02-21 |
| 4. Stable Foundation | v1.1 | 2/2 | Complete | 2026-02-21 |
| 5. Liquidity & Swaps | v1.1 | 2/2 | Complete | 2026-02-21 |
| 6. Position Management | v1.1 | 4/4 | Complete | 2026-02-22 |
