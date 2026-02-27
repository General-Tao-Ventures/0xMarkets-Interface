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


## v1.2 Demo-Ready Deployment (Shipped: 2026-02-23)

**Phases completed:** 3 phases (7-9), 7 plans, 14 tasks
**Timeline:** 2026-02-22 → 2026-02-23 (~15 hours)
**Code files modified:** 26 (+861, -1,788)
**Git range:** f85f07f0f..34fca331e (26 commits)

**Key accomplishments:**
- Deployed frontend to Vercel at app.0xmarkets.io with env-driven serverless keeper proxies and keeper-down banner
- Synced cloud keepers with v1.1 fixes (PythLazer v4 address, indexToken resolution, FAILED-order retry)
- Replaced ~278 console.log calls with pino structured JSON logging across both keeper services
- Real /health endpoints returning 200/503 based on 2-minute scan staleness threshold with execution counts
- BetterStack uptime monitoring with email alerts for keeper downtime (5-minute detection)
- UI demo polish: loading spinners, correct Base Sepolia explorer URLs, descriptive "View on BaseScan" toast links

**Delivered:** 0xMarkets is accessible via public Vercel URL with cloud keepers running, health monitoring, and UI polished for investor demos.

---

## v1.3 Keeper Execution Speed (Shipped: 2026-02-24)

**Phases completed:** 3 phases (10-12), 6 plans
**Timeline:** 2026-02-23 → 2026-02-24

**Key accomplishments:**
- Event-driven detection replaces polling for deposit/withdrawal/order events
- Execution pipeline optimization with parallel oracle+gas estimation
- Observability with structured timing metrics and per-stage instrumentation

---

## v1.4 Maximum Keeper Speed (Shipped: 2026-02-25)

**Phases completed:** 2 phases (13-14), 6 plans
**Timeline:** 2026-02-24 → 2026-02-25

**Key accomplishments:**
- Per-token Lazer/Hermes oracle routing — all 6 markets execute without reverts
- On-chain oracle provider verification at keeper startup
- Flashblocks RPC for ~200ms TX preconfirmations
- Background oracle updates at 5s intervals with 30s safety margin

---

## v1.5 Minimal Keeper Rewrite (Shipped: 2026-02-26)

**Phases completed:** 3 phases (15-17), 6 plans
**Timeline:** 2026-02-25 → 2026-02-26

**Key accomplishments:**
- Replaced 3,000+ line keeper with ~300 line single-loop keeper
- Pyth Lazer WebSocket oracle cache for all 7 tokens with 270s TTL
- Event watcher + safety-net polling + sequential executor
- Deployed to DigitalOcean, all operation types verified e2e

---

## v1.6 E2E Reliability (Shipped: 2026-02-27)

**Phases completed:** 5 phases (18, 20-23), 10 plans
**Timeline:** 2026-02-26 → 2026-02-27

**Key accomplishments:**
- Contract address audit: 89/89 addresses verified correct across all services via on-chain DataStore
- Frontend toast lifecycle: Pending → Executed! for deposits, withdrawals, and orders
- Auto-refresh: pool balances and positions update after execution without page refresh
- Automated E2E test suite: 17/18 market×operation combinations pass (JPY/USD skipped — contract bug)
- Keeper execution fixes verified manually across all 6 markets

**Known Gaps:**
- JPY/USD orders fail with division-by-zero in OrderHandler (triggerPrice=0 on reversed markets) — deferred to v1.7 Phase 24

---

