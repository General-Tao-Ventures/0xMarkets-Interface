# Milestones

## v1.0 Fix Buy GM Flow (Shipped: 2026-02-21)

**Phases completed:** 3 phases, 6 plans
**Timeline:** 2026-02-20 → 2026-02-21 (1 day)
**Git range:** 840cc6b7c → debc77716 (19 commits)

**Key accomplishments:**
- End-to-end deposit execution working: createDeposit → keeper detects (10s) → prices pushed → executeDeposit (13s) → GM tokens minted
- Ghost deposit guard (CANCELLED vs FAILED) and empty oracle token validation
- Exponential backoff retry (3 attempts) with error classification and Prisma error recording
- On-chain expired deposit cancellation via DepositHandler with CONTROLLER role
- Keeper deposit status API with CORS for frontend consumption
- Enhanced deposit notification UI: elapsed time counter, 60s/120s timeout escalation, cancel button, actionable error messages

---

## v1.1 Full Trading Experience (Shipped: 2026-02-22)

**Phases completed:** 3 phases (4-6), 8 plans
**Timeline:** 2026-02-21 → 2026-02-22 (2 days)
**Files changed:** 43 files, +3,428 / -171 lines
**Git range:** 23fc998..HEAD

**Key accomplishments:**
- Trade page stability: BigInt division guards, WebSocket spam fix, metrics suppression across all 6 markets
- On-chain market configuration: reserve factors, OI limits, and pool caps for ETH, BTC, EUR, GBP, GOLD, JPY
- Sell GM withdrawal flow with action buttons, elapsed time notifications, and cancel support
- Pool stats: All Pools / My Pools tabs with utilization, fees earned, and PnL display
- Full position management: market orders, close (full/partial), limit orders, stop-loss/take-profit
- Human-verified end-to-end trading: live trade executed on Base Sepolia with keeper pipeline
- Fixed keeper oracle provider mismatches, order executor token resolution, and frontend BigInt crash

**Known Gaps:**
- SWAP-01: Token swaps deferred (user decision: "we don't need the swap route, we just want long and short")

---

