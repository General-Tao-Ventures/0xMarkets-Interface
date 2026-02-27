# 0xMarkets Interface

## What This Is

A perpetual futures trading interface on Base Sepolia, deployed at app.0xmarkets.io. Users can provide liquidity (Buy/Sell GM), trade leveraged long/short positions across 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY), and manage positions with limit orders, stop-loss, and take-profit. Backed by cloud-hosted keepers with structured logging, health monitoring, and uptime alerting.

## Core Value

A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## Current State

**Shipped:** v1.6 E2E Reliability (2026-02-27)

Contract address audit across all services, frontend toast lifecycle and auto-refresh, automated E2E test suite (17/18 pass, JPY skipped due to contract bug). Keeper execution fixes verified manually.

**All prior milestones:**
- v1.0 Fix Buy GM Flow (2026-02-21) — deposit execution pipeline
- v1.1 Full Trading Experience (2026-02-22) — all 6 markets, positions, limit orders
- v1.2 Demo-Ready Deployment (2026-02-23) — Vercel, monitoring, UI polish
- v1.3 Keeper Execution Speed (2026-02-24) — event-driven detection, pipeline optimization, observability
- v1.4 Maximum Keeper Speed (2026-02-25) — oracle correctness, execution speed, timing instrumentation
- v1.5 Minimal Keeper Rewrite (2026-02-26) — clean 300-line keeper, Lazer oracle cache, deployed and verified
- v1.6 E2E Reliability (2026-02-27) — contract audit, toast lifecycle, auto-refresh, E2E test suite

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
- ✓ Per-token oracle routing — all 6 markets execute without reverts — v1.4
- ✓ On-chain oracle provider verification at keeper startup — v1.4
- ✓ Flashblocks RPC for ~200ms TX preconfirmations — v1.4
- ✓ Background oracle updates at 5s intervals with 30s safety margin — v1.4
- ✓ Per-stage execution timing instrumentation — v1.4
- ✓ Clean keeper rewrite: single-loop with event watcher + safety-net polling + sequential executor — v1.5
- ✓ Pyth Lazer WebSocket oracle cache for all 7 tokens with 270s TTL — v1.5
- ✓ Keeper deployed to DigitalOcean, all operation types verified e2e — v1.5
- ✓ Contract addresses verified correct across all services via on-chain DataStore audit — v1.6
- ✓ All 6 markets × 3 operations execute without reverts (keeper verified manually) — v1.6
- ✓ Toast lifecycle: Pending → Executed! for deposits, withdrawals, and orders — v1.6
- ✓ Auto-refresh: pool balances and positions update after execution without page refresh — v1.6
- ✓ E2E test suite: 17/18 market×operation combinations pass (JPY skipped, contract bug) — v1.6

### Active

## Current Milestone: v1.7 Liquidation Readiness

**Goal:** Fix remaining contract bugs, verify the existing liquidation keeper works end-to-end, and optimize it for performance and efficiency.

**Target features:**
- Contract bug fixes: guard triggerPrice=0 in OrderHandler for reversed markets, redeploy, update all service configs
- Liquidation verification: confirm keeper-service liquidation pipeline (scanner → riskEngine → executor) works on Base Sepolia
- Liquidation performance: optimize scanning speed, risk assessment efficiency, and execution latency

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
- **Codebase:** 18 phases, 41 plans, 6 milestones across 6 days
- **Critical risk:** Multiple contract deployments mean stale addresses across services — audit before testing
- **Keeper infrastructure:** Two services on DigitalOcean (142.93.203.222) with pino JSON logging, real health endpoints, and BetterStack uptime monitoring
  - keeper-service (port 37017): price feeds, liquidation scanning, candle data
  - order-execution-keeper-service (port 37018): executes deposits, withdrawals, orders
- **Oracle mode:** Pyth Lazer only (v1.5 keeper uses Lazer WebSocket exclusively)
- **Pyth Pro API key:** QpxMy21OMvC7rap9hYxJ6GB0eb3PdOEs2WvmG0XN (crypto account)
- **Test suite:** 136 pass, 1 skipped (live RPC), 0 failures
- **Liquidation keeper:** Already exists in keeper-service (scanner → riskEngine → executor with PostgreSQL audit trail) — needs verification and optimization
- **Known issues:**
  - REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
  - batch_report 404 from metrics (GMX analytics endpoint not implemented — cosmetic)
  - pendingImpactAmount defaults to 0n (documented workaround — correct behavior)
  - OrderHandler.sol division-by-zero on reversed markets (JPY/USD) when triggerPrice=0 — Phase 24 fix

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

| Pyth Pro crypto key for oracle feeds | Previous token had zero entitlements | ✓ Good |
| Per-token Lazer/Hermes fallback | Graceful degradation per token vs global switch | ✓ Good |
| Transaction mutex for nonce conflicts | Serializes execution + cleanup paths | ✓ Good |

| Contract audit before testing | Multiple deployments mean stale addresses are likely | ✓ Good — 89/89 verified |
| Liquidation keeper in keeper-service | Already has scanner+riskEngine+executor, no need for standalone | — Pending verification |

---
*Last updated: 2026-02-27 after v1.7 Liquidation Readiness milestone started*
