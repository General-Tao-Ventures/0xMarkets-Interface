# 0xMarkets Interface

## What This Is

A perpetual futures trading interface on Base Sepolia, deployed at app.0xmarkets.io. Users can provide liquidity (Buy/Sell GM), trade leveraged long/short positions across 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY), and manage positions with limit orders, stop-loss, and take-profit. Backed by cloud-hosted keepers with structured logging, health monitoring, uptime alerting, and a liquidation pipeline with deduplication, revert tracking, and multicall-optimized scanning.

## Core Value

A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## Current State

**Shipped:** v1.8 Deployment (2026-03-01)

Fixed OrderHandler division-by-zero, verified liquidation pipeline (scanner → executor → confirmator) with 9 bug fixes, refactored to view-call oracle pricing, added hardening (dedup, revert tracking, dead code cleanup) and performance optimizations (multicall batching, timing instrumentation). Pipeline verified through gas-estimation; on-chain TX blocked by pool reserve exhaustion.

**All prior milestones:**
- v1.0 Fix Buy GM Flow (2026-02-21) — deposit execution pipeline
- v1.1 Full Trading Experience (2026-02-22) — all 6 markets, positions, limit orders
- v1.2 Demo-Ready Deployment (2026-02-23) — Vercel, monitoring, UI polish
- v1.3 Keeper Execution Speed (2026-02-24) — event-driven detection, pipeline optimization, observability
- v1.4 Maximum Keeper Speed (2026-02-25) — oracle correctness, execution speed, timing instrumentation
- v1.5 Minimal Keeper Rewrite (2026-02-26) — clean 300-line keeper, Lazer oracle cache, deployed and verified
- v1.6 E2E Reliability (2026-02-27) — contract audit, toast lifecycle, auto-refresh, E2E test suite
- v1.7 Liquidation Readiness (2026-02-28) — contract fix, liquidation pipeline verification, hardening, performance

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
- ✓ OrderHandler zero-guard on reversed markets — JPY/USD orders no longer revert — v1.7
- ✓ OrderHandler and ExchangeRouter redeployed atomically — v1.7
- ✓ All service configs updated with new contract addresses — v1.7
- ✓ LIQUIDATION_KEEPER role verified on keeper wallet — v1.7
- ✓ Liquidation scanner detects undercollateralized positions within 30s — v1.7
- ✓ Oracle mode set to Lazer for independent keeper operation — v1.7
- ✓ Deduplication guard prevents double-submission within 60s — v1.7
- ✓ Reverted liquidation attempts tracked with error reason in DB — v1.7
- ✓ Dead code cleanup (riskEngine.ts removed) — v1.7
- ✓ Per-stage timing instrumentation for scanner, executor, confirmator — v1.7
- ✓ Position discovery uses multicall batching — v1.7
- ✓ Executor reuses position data from scanner — v1.7

### Active

## Current Milestone: v1.9 Event Indexer

**Goal:** Build a full on-chain event indexer into the data-verification-service, recording all contract events (orders, positions, deposits, withdrawals, shifts, market state, GLV, referrals, oracle prices) into a 50-table PostgreSQL schema, and deploy to DigitalOcean.

**Target features:**
- 50-table PostgreSQL schema with schema namespaces (orders, positions, deposits, withdrawals, shifts, market, glv, referrals, oracle)
- Event decoder ported from squid's eventDecoder.ts (decode EventLogData from raw log bytes)
- EventEmitter WebSocket listener for EventLog1 + EventLog2 events
- Event router mapping decoded events to correct database tables
- Cursor-based resumption (track last processed block for crash recovery)
- Deploy updated service to DO droplet alongside existing keepers
- Health check extended with event indexer status

### Out of Scope

- Token swaps (SWAP-01) — deferred from v1.1, user prioritized trading
- New pool creation or market configuration UI — admin operation
- Mobile-specific UI improvements
- Advanced analytics or charting
- Social/copy trading features
- Multi-chain support beyond Base Sepolia
- Mainnet deployment — testnet-first
- Offline mode — real-time oracle feeds are core requirement
- On-chain liquidation TX proof (LIQ-03/LIQ-04) — verified through gas-estimation, blocked by testnet pool reserves

## Context

- **Chain:** Base Sepolia (84532)
- **Deployed:** app.0xmarkets.io (Vercel)
- **Shipped:** v1.0-v1.7 across 8 milestones in 8 days (2026-02-21 → 2026-02-28)
- **Codebase:** 27 phases, 58 plans across 8 milestones
- **Keeper infrastructure:** Two services on DigitalOcean (142.93.203.222) with pino JSON logging, real health endpoints, and BetterStack uptime monitoring
  - keeper-service (port 37017): price feeds, liquidation scanning, candle data
  - order-execution-keeper-service (port 37018): executes deposits, withdrawals, orders
- **Oracle mode:** Pyth Lazer only (WebSocket cache, getOraclePrice view calls for scanner)
- **Pyth Pro API key:** QpxMy21OMvC7rap9hYxJ6GB0eb3PdOEs2WvmG0XN (crypto account)
- **Test suite:** 136 pass, 1 skipped (live RPC), 0 failures
- **Liquidation pipeline:** scanner → executor → confirmator with PostgreSQL audit trail, dedup guard, revert tracking, multicall batching, and per-stage timing
- **Known issues:**
  - REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
  - JPY/USD Pyth Lazer oracle data gap ("Best ask price is not present") — testnet infrastructure, not code
  - Synthetic tokens (EUR/GBP/JPY/GOLD) have intermittent Pyth Lazer data gaps
  - Shared wallet nonce conflict between keeper-service and order-execution-keeper — documented testnet risk
  - WETH/USD pool at 100% reserve capacity — blocks new position creation

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
| Liquidation keeper in keeper-service | Already has scanner+executor, no need for standalone | ✓ Good — verified in v1.7 |
| Zero-guard before Precision.mulDiv | Check != 0 before division, simpler than SafeMath wrapper | ✓ Good — JPY/USD fixed |
| getOraclePrice view calls over updatePrice writes | Eliminates gas, nonce issues, ABI parsing errors | ✓ Good — scanner works without TX |
| Config-driven PythLazerFeedProvider address | Read from config instead of hardcoding | ✓ Good — survived address change |
| Dedup guard separate from cooldown | 60s submission TTL vs 5min gas-estimation failure | ✓ Good — different purposes |
| Multicall batching with allowFailure | Individual failures don't break batch | ✓ Good — robust discovery |
| Accept pipeline verification via gas-estimation | Pool reserves prevent final TX but code paths proven | ✓ Good — operational, not code issue |

---
*Last updated: 2026-03-03 after v1.9 milestone start*
