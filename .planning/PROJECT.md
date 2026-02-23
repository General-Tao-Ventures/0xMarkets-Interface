# 0xMarkets Interface

## What This Is

A perpetual futures trading interface on Base Sepolia. Users can provide liquidity (Buy/Sell GM), trade leveraged long/short positions across 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY), and manage positions with limit orders, stop-loss, and take-profit. Backed by an order-execution-keeper that detects on-chain requests and executes them.

## Core Value

A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## Current State

**Shipped:** v1.1 Full Trading Experience (2026-02-22)
**Previous:** v1.0 Fix Buy GM Flow (2026-02-21)

The full trading loop works end-to-end on Base Sepolia: deposit liquidity, open long/short positions, close positions, place limit orders, set stop-loss/take-profit, withdraw liquidity. All 6 markets configured and verified by human testing.

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

### Active

<!-- Current scope for next milestone -->

(None yet — define in next milestone)

### Out of Scope

- New pool creation or market configuration UI
- Mobile-specific UI improvements
- Advanced analytics or charting
- Social/copy trading features
- Multi-chain support beyond Base Sepolia
- Token swaps (SWAP-01) — deferred from v1.1, user prioritized trading

## Context

- **Chain:** Base Sepolia (84532)
- **Shipped:** v1.0 (2026-02-21), v1.1 (2026-02-22)
- **Codebase:** ~43 files modified in v1.1, +3,428 lines
- **Keeper infrastructure:** Two services on DigitalOcean (142.93.203.222), managed via Docker Compose at `/opt/0xmarkets/`
  - keeper-service (port 37017): price feeds, liquidation scanning, candle data
  - order-execution-keeper-service (port 37018): executes deposits, withdrawals, orders
- **Oracle mode:** Pyth Lazer — binary WebSocket price feeds, prices stored on-chain via PythLazerFeedProvider
- **Key contract addresses:**
  - DataStore: `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E`
  - PythLazerFeedProvider v4: `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`
  - DepositHandler: `0x9388B07f807eB870aD36d350d80DC0c214a7f04f`
  - OrderHandler: `0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1`
  - Reader: `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c`
  - Keeper wallet: `0x48Cb0d738C9B3F44F60f7338F788fa093FD25828`
- **Known issues:**
  - Cloud keepers need ABI + config updates to match local fixes from v1.1 verification
  - 17 pre-existing failing SDK test files (unrelated to v1.1)
  - pendingImpactAmount defaulted to 0n (contract struct mismatch from GMX fork)
  - REQUEST_EXPIRATION_TIME set to 3600s for testnet

## Constraints

- **Deployment:** Changes to keeper must be deployed to DO server via SSH and Docker rebuild
- **Oracle freshness:** MAX_ORACLE_PRICE_AGE is 300 seconds — keeper must push prices and execute within this window
- **Nonce management:** Single keeper wallet means sequential transaction ordering matters

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pyth Lazer over Pyth Classic | Lower latency price feeds | ✓ Good — 13s execution |
| Single keeper wallet | Simpler for testnet | ✓ Good — sufficient |
| Docker Compose deployment | Simple single-server model | ✓ Good |
| Ghost deposits → CANCELLED not FAILED | Zeroed on-chain = not execution failure | ✓ Good |
| Zero divisor returns 0n with console.warn | Page loads while signaling misconfiguration | ✓ Good |
| Express loading state doesn't block buttons | Submit awaits, falls back to direct wallet | ✓ Good |
| Limit price shortcuts use BigInt math | Avoid float precision errors | ✓ Good |
| SWAP-01 deferred | User prioritized trading over swaps | ✓ Good — focused scope |
| pendingImpactAmount ?? 0n | Contract struct doesn't have this field | ⚠️ Revisit — may need proper removal |

---
*Last updated: 2026-02-22 after v1.1 milestone*
