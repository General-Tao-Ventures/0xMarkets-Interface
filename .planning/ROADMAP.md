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

---

## v1.10 E2E Verification

**Goal:** Fix trigger order execution, run a comprehensive E2E test suite covering all operation types against live testnet, and verify the frontend displays accurate on-chain state with working UI functionality.

## Phases

- [ ] **Phase 35: Trigger Order Fix** - Diagnose and fix InvalidOrderPrices error blocking limit/TP/SL execution
- [ ] **Phase 36: E2E Test Suite** - Run full E2E coverage across deposits, withdrawals, market orders, trigger orders, and liquidations
- [ ] **Phase 37: Frontend Verification** - Verify on-chain state accuracy in UI and confirm all pages/forms function correctly

## Phase Details

### Phase 35: Trigger Order Fix
**Goal**: Trigger orders (limit increase, stop-loss, take-profit) execute successfully on the live testnet
**Depends on**: Nothing (first phase of v1.10)
**Requirements**: TRIG-01, TRIG-02
**Success Criteria** (what must be TRUE):
  1. Root cause of InvalidOrderPrices (0x0481a15a) is identified and documented
  2. A limit increase order executes on-chain without reverting when trigger price is reached
  3. A stop-loss order executes on-chain without reverting when trigger price is reached
  4. A take-profit order executes on-chain without reverting when trigger price is reached
**Plans**: TBD

Plans:
- [ ] 35-01-PLAN.md — TBD

### Phase 36: E2E Test Suite
**Goal**: A single test suite run proves every operation type works end-to-end against the live testnet
**Depends on**: Phase 35 (trigger orders must execute for E2E-04/05/06 to pass)
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07, E2E-08
**Success Criteria** (what must be TRUE):
  1. Deposit test creates a deposit and confirms GM tokens are minted in the user's wallet
  2. Withdrawal test creates a withdrawal and confirms USDC is returned to the user's wallet
  3. Market order test opens a long/short position and closes it, confirming collateral is returned
  4. Limit order test places an order that executes when the trigger price condition is met
  5. Stop-loss and take-profit tests confirm execution when trigger price conditions are met
  6. Liquidation test creates an undercollateralized position on a market with available reserves (BTC, EUR, etc.) and confirms the keeper liquidates it
  7. Running the full suite produces a pass/fail summary covering all operation types
**Plans**: TBD

Plans:
- [ ] 36-01-PLAN.md — TBD

### Phase 37: Frontend Verification
**Goal**: The frontend at app.0xmarkets.io accurately reflects on-chain state and all pages/forms work without errors
**Depends on**: Phase 36 (E2E tests create on-chain state to verify against)
**Requirements**: FE-01, FE-02, FE-03, FE-04, UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Pool balances shown in the Pools page match the on-chain GM token balances and pool value
  2. Positions displayed on the Trade page (size, collateral, PnL) match on-chain position data
  3. Order statuses (pending, executed, cancelled) in the UI match on-chain order state
  4. Wallet token balances (USDC, ETH) displayed in the UI match on-chain balances
  5. All pages (Trade, Pools, Dashboard, Earn) load without console errors, forms submit correctly, and toast notifications resolve from Pending to Executed
**Plans**: TBD

Plans:
- [ ] 37-01-PLAN.md — TBD

## Progress

**Execution Order:** 35 -> 36 -> 37

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 35. Trigger Order Fix | 0/? | Not started | - |
| 36. E2E Test Suite | 0/? | Not started | - |
| 37. Frontend Verification | 0/? | Not started | - |

---
*Created: 2026-03-04*
