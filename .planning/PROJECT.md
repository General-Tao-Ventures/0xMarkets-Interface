# 0xMarkets Interface

## What This Is

A perpetual futures trading interface on Base Sepolia, deployed at app.0xmarkets.io. Users can provide liquidity (Buy/Sell GM), trade leveraged long/short positions across 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY), and manage positions with limit orders, stop-loss, and take-profit. Backed by cloud-hosted keepers with structured logging, health monitoring, and uptime alerting.

## Core Value

A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## Current State

**Shipped:** v1.2 Demo-Ready Deployment (2026-02-23)

The full trading loop works end-to-end on Base Sepolia from a public Vercel URL. Cloud keepers on DigitalOcean execute deposits, withdrawals, and orders. Health endpoints and BetterStack uptime monitoring provide observability. UI is polished for investor demos.

**All prior milestones:**
- v1.0 Fix Buy GM Flow (2026-02-21) — deposit execution pipeline
- v1.1 Full Trading Experience (2026-02-22) — all 6 markets, positions, limit orders
- v1.2 Demo-Ready Deployment (2026-02-23) — Vercel, monitoring, UI polish

## Requirements

### Validated

- ✓ Interface submits createDeposit transaction successfully — existing
- ✓ Keeper detects new deposit requests via event scanning — existing
- ✓ Keeper pushes Pyth Lazer prices on-chain before execution — v1.0
- ✓ Keeper includes market index token (WETH) in oracle params — v1.0
- ✓ Keeper executes deposits end-to-end — v1.0
- ✓ Expired deposits detected and auto-cancelled — v1.0
- ✓ Retry logic for transient errors — v1.0
- ✓ UI surfaces clear deposit status — v1.0
- ✓ Error messages are actionable — v1.0
- ✓ Trade page loads without crashing — v1.1
- ✓ All 6 markets fully configured for trading — v1.1
- ✓ User can open long/short positions on all 6 markets — v1.1
- ✓ User can close positions and receive collateral back — v1.1
- ✓ User can place limit orders, stop-loss, and take-profit — v1.1
- ✓ User can withdraw liquidity (Sell GM) from pools — v1.1
- ✓ Pool stats display utilization, fees, and PnL — v1.1
- ✓ Frontend deployed to Vercel — anyone with URL can access the app — v1.2
- ✓ Cloud keepers synced with v1.1 fixes — full loop works without running locally — v1.2
- ✓ Keeper health monitoring — health checks, logging, alerting — v1.2
- ✓ UI/UX polish — professional enough to demo to investors — v1.2
- ✓ Tech debt cleanup — failing tests, workarounds, code quality — v1.2

### Active

## Current Milestone: v1.3 Keeper Execution Speed

**Goal:** All keeper-executed operations (deposits, withdrawals, orders) complete in under 10 seconds, consistently.

**Target features:**
- Event-driven operation detection (replace polling with on-chain event listeners)
- Optimized scan intervals and execution pipeline
- Consistent sub-10s latency across deposits, withdrawals, and orders
- Both keeper-service and order-execution-keeper-service optimized

### Out of Scope

- Token swaps (SWAP-01) — deferred from v1.1, user prioritized trading
- New pool creation or market configuration UI — admin operation
- Mobile-specific UI improvements
- Advanced analytics or charting
- Social/copy trading features
- Multi-chain support beyond Base Sepolia
- Mainnet deployment — testnet-first

## Context

- **Chain:** Base Sepolia (84532)
- **Deployed:** app.0xmarkets.io (Vercel)
- **Shipped:** v1.0 (2026-02-21), v1.1 (2026-02-22), v1.2 (2026-02-23)
- **Codebase:** 9 phases, 21 plans, 3 milestones across 3 days
- **Keeper infrastructure:** Two services on DigitalOcean (142.93.203.222) with pino JSON logging, real health endpoints, and BetterStack uptime monitoring
  - keeper-service (port 37017): price feeds, liquidation scanning, candle data
  - order-execution-keeper-service (port 37018): executes deposits, withdrawals, orders
- **Oracle mode:** Pyth Lazer — binary WebSocket price feeds
- **Test suite:** 136 pass, 1 skipped (live RPC), 0 failures
- **Known issues:**
  - REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
  - batch_report 404 from metrics (GMX analytics endpoint not implemented — cosmetic)
  - pendingImpactAmount defaults to 0n (documented workaround — correct behavior)

## Constraints

- **Deployment:** Keeper changes deployed to DO server via SSH and Docker rebuild
- **Oracle freshness:** MAX_ORACLE_PRICE_AGE is 300 seconds
- **Nonce management:** Single keeper wallet means sequential transaction ordering

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pyth Lazer over Pyth Classic | Lower latency price feeds | ✓ Good — 13s execution |
| Single keeper wallet | Simpler for testnet | ✓ Good — sufficient |
| Docker Compose deployment | Simple single-server model | ✓ Good |
| Ghost deposits → CANCELLED not FAILED | Zeroed on-chain = not execution failure | ✓ Good |
| Zero divisor returns 0n with console.warn | Page loads while signaling misconfiguration | ✓ Good |
| SWAP-01 deferred | User prioritized trading over swaps | ✓ Good — focused scope |
| pendingImpactAmount ?? 0n | Contract struct doesn't have this field, documented | ✓ Good — documented workaround |
| Env-driven keeper proxies | Relative URLs work in both dev and prod | ✓ Good — zero-config dev |
| Pino structured logging | JSON logs for observability and debugging | ✓ Good — replaced ~278 console calls |
| BetterStack free tier for uptime | Pings health endpoints, email alerts on failure | ✓ Good — 5-min detection |
| healthState mutable singleton | Avoids circular imports across scanner/executor/oracle | ✓ Good |
| /health returns 503 until first scan | Prevents false-healthy reports on startup | ✓ Good |

---
*Last updated: 2026-02-23 after v1.3 milestone started*
