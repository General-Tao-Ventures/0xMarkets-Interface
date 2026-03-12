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
- ✅ **v1.10 E2E Verification** — Phases 35-37 ([shipped 2026-03-05](milestones/v1.10-ROADMAP.md))
- ✅ **v1.11 Trade History & Leaderboard Fix** — Phases 38-39 ([shipped 2026-03-05](milestones/v1.11-ROADMAP.md))
- ✅ **v1.12 WebSocket Price Streaming** — Phases 40-42 (shipped 2026-03-06)
- 🚧 **v1.13 0xM Token Rebrand + Error UX** — Phases 43-46 (in progress)

## Phases

<details>
<summary>✅ v1.12 WebSocket Price Streaming (Phases 40-42) — SHIPPED 2026-03-06</summary>

- [x] Phase 40: Infrastructure + Keeper Hermes SSE (2/2 plans) — completed 2026-03-06
- [x] Phase 41: Keeper WebSocket Server (2/2 plans) — completed 2026-03-06
- [x] Phase 42: Frontend WebSocket Integration (2/2 plans) — completed 2026-03-06

</details>

<details>
<summary>✅ v1.11 Trade History & Leaderboard Fix (Phases 38-39) — SHIPPED 2026-03-05</summary>

- [x] Phase 38: Squid Fixes & Redeployment (1/1 plan) — completed 2026-03-05
- [x] Phase 39: Frontend Verification & Fixes (1/1 plan) — completed 2026-03-05

</details>

<details>
<summary>✅ v1.10 E2E Verification (Phases 35-37) — SHIPPED 2026-03-05</summary>

- [x] Phase 35: Trigger Order Fix (1/1 plan) — completed 2026-03-04
- [x] Phase 36: E2E Test Suite (1/1 plan) — completed 2026-03-04
- [x] Phase 37: Frontend Verification (2/2 plans) — completed 2026-03-05

</details>

### v1.13 0xM Token Rebrand + Error UX (In Progress)

**Milestone Goal:** Redeploy contracts with "0xM" branding replacing "GM", update all service configs, re-seed pools, and surface human-readable error messages for failed operations.

- [ ] **Phase 43: Contract Deployment** — Deploy new MarketToken with 0xM branding and create all 7 markets on-chain
- [ ] **Phase 44: Service Config + Pool Seeding** — Update all service configs with new addresses and seed pools with USDC
- [ ] **Phase 45: Error UX** — Decode revert reasons from cancelled events and display human-readable error messages
- [ ] **Phase 46: End-to-End Verification** — Verify all operations work with new contracts across all services

## Phase Details

### Phase 43: Contract Deployment
**Goal**: New MarketToken contract is live on-chain with "0xM" symbol and all 7 markets are created using it
**Depends on**: Nothing (first phase of v1.13)
**Requirements**: REBRAND-01, REBRAND-02, REBRAND-03
**Success Criteria** (what must be TRUE):
  1. MarketToken contract is deployed on Base Sepolia with symbol "0xM" and name "0xMarkets Pool"
  2. All 7 markets (ETH, BTC, EUR, GBP, GOLD, JPY, WTI) exist on-chain using the new MarketToken
  3. Market parameters configured on-chain (swap/position impact factors=0, pool caps, OI limits, reserve factors, leverage limits via set-max-leverage)
  4. Each market's pool token address is recorded for downstream config updates
**Plans:** 1 plan

Plans:
- [ ] 43-01-PLAN.md — Deploy MarketToken with 0xM branding, create 7 markets, configure parameters and leverage limits

### Phase 44: Service Config + Pool Seeding
**Goal**: All services (interface, keepers, squid) are configured with new contract addresses and pools have USDC liquidity
**Depends on**: Phase 43
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04, REBRAND-04
**Success Criteria** (what must be TRUE):
  1. Interface loads without errors and displays all 7 markets with new 0xM pool tokens
  2. Both keeper services are running with new token/contract addresses and reporting healthy
  3. Squid indexer is redeployed with new EventEmitter address and processing events from the correct start block
  4. All 7 pools have USDC deposits and show non-zero balances in the interface
**Plans**: TBD

Plans:
- [ ] 44-01: Update interface SDK configs (tokens.ts, markets.ts, contracts.ts, static/markets.ts, multichain.ts)
- [ ] 44-02: Update keeper configs, squid processor, and seed pools with USDC

### Phase 45: Error UX
**Goal**: Users see clear, human-readable error messages when their deposits, withdrawals, or orders fail
**Depends on**: Nothing (independent frontend work, can parallel with 43-44 but logically separate)
**Requirements**: ERR-01, ERR-02
**Success Criteria** (what must be TRUE):
  1. When a deposit/withdrawal/order is cancelled on-chain, the UI decodes the reasonBytes into a human-readable message
  2. Error messages appear in toast notifications with actionable context (e.g., "Deposit failed: insufficient liquidity" not "0x1234abcd")
  3. Operations that succeed continue to show success toasts unchanged
**Plans**: TBD

Plans:
- [ ] 45-01: Decode reasonBytes and surface error messages in toast notifications

### Phase 46: End-to-End Verification
**Goal**: All operations are verified working end-to-end with the new 0xM contracts across all services
**Depends on**: Phase 44
**Requirements**: VER-01, VER-02, VER-03
**Success Criteria** (what must be TRUE):
  1. A user can deposit USDC into a pool and receive 0xM tokens, then withdraw 0xM tokens and receive USDC back
  2. A user can open a leveraged position (long or short) and close it, receiving collateral back
  3. Trade history shows the executed trades with correct PnL, and leaderboard reflects the activity
**Plans**: TBD

Plans:
- [ ] 46-01: End-to-end deposit/withdrawal verification
- [ ] 46-02: End-to-end trading and squid verification

## Progress

**Execution Order:**
Phases execute in numeric order: 43 -> 44 -> 45 -> 46

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 40. Infrastructure + Keeper Hermes SSE | v1.12 | 2/2 | Complete | 2026-03-06 |
| 41. Keeper WebSocket Server | v1.12 | 2/2 | Complete | 2026-03-06 |
| 42. Frontend WebSocket Integration | v1.12 | 2/2 | Complete | 2026-03-06 |
| 43. Contract Deployment | v1.13 | 0/1 | Not started | - |
| 44. Service Config + Pool Seeding | v1.13 | 0/2 | Not started | - |
| 45. Error UX | v1.13 | 0/1 | Not started | - |
| 46. End-to-End Verification | v1.13 | 0/2 | Not started | - |

---
*Created: 2026-03-04*
*Updated: 2026-03-09 — Phase 43 planned (1 plan, 7 markets including WTI)*
