# Fix Buy GM Flow — ETH/USD Pool

## What This Is

End-to-end "Buy GM" (deposit/liquidity provision) flow for the ETH/USD pool on 0xMarkets. A user deposits USDC into a pool, the order-execution-keeper detects the on-chain deposit request and executes it via the DepositHandler contract, and the user receives GM (market) tokens. The deposit flow now works end-to-end with retry logic, expired deposit cancellation, and real-time UI feedback.

## Core Value

A user can deposit USDC into the ETH/USD pool and receive GM tokens within a reasonable timeframe, with clear feedback at every step.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Interface submits createDeposit transaction successfully — existing
- ✓ Keeper detects new deposit requests via event scanning — existing
- ✓ Keeper pushes Pyth Lazer prices on-chain before execution — existing (fixed in previous sessions)
- ✓ Keeper includes market index token (WETH) in oracle params — existing (fixed in previous sessions)
- ✓ Toast notifications for deposit completion/failure — existing
- ✓ Pyth Lazer WebSocket initialization with clientReady pattern — existing (fixed in previous sessions)
- ✓ Keeper executes deposits end-to-end (createDeposit → executeDeposit → GM tokens received) — v1.0
- ✓ Expired deposits detected and auto-cancelled with user-friendly messaging — v1.0
- ✓ Retry logic for transient errors (nonce issues, gas estimation failures) — v1.0
- ✓ UI surfaces clear deposit status (pending → executing → complete/failed) — v1.0
- ✓ Error messages are actionable — user knows what happened and what to do next — v1.0

### Active

<!-- Current scope. Building toward these. -->

(None — next milestone will define new requirements)

### Out of Scope

- Other pool types beyond ETH/USD — focus on one pool first
- Withdrawal (Sell GM) flow fixes — separate effort
- Order execution fixes — separate effort
- New pool creation or market configuration
- Mobile-specific UI improvements

## Context

- **Chain:** Base Sepolia (84532)
- **Shipped:** v1.0 Fix Buy GM Flow (2026-02-21)
- **Keeper infrastructure:** Two services on DigitalOcean (142.93.203.222), managed via Docker Compose at `/opt/0xmarkets/`
  - keeper-service (port 37017): price feeds, liquidation scanning, candle data
  - order-execution-keeper-service (port 37018): executes deposits, withdrawals, orders
- **Oracle mode:** Pyth Lazer — binary WebSocket price feeds, prices stored on-chain via PythLazerFeedProvider
- **Key contract addresses:**
  - DataStore: `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E`
  - PythLazerFeedProvider v3: `0x2F00A6200853B093459BCAAee1De6648D9d672fc`
  - DepositHandler: `0x9388B07f807eB870aD36d350d80DC0c214a7f04f`
  - Reader: `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c`
  - Keeper wallet: `0x48Cb0d738C9B3F44F60f7338F788fa093FD25828`
- **Known issues:**
  - "Dropping duplicate message" WebSocket spam in keeper logs (cosmetic, doesn't affect execution)
  - Single keeper wallet means nonce management is critical for concurrent deposits

## Constraints

- **Deployment:** Changes to keeper must be deployed to DO server via SSH and Docker rebuild
- **Oracle freshness:** MAX_ORACLE_PRICE_AGE is 300 seconds — keeper must push prices and execute within this window
- **Deposit expiry:** Deposits have a max lifetime on-chain; keeper must execute before expiry
- **Nonce management:** Single keeper wallet means sequential transaction ordering matters

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pyth Lazer over Pyth Classic | Lower latency price feeds for faster execution | ✓ Good — 13s execution time |
| Single keeper wallet | Simpler architecture for testnet | ✓ Good — sufficient for testnet |
| Docker Compose deployment | Simple deployment model for single server | ✓ Good — rsync+rebuild workflow works |
| Ghost deposits → CANCELLED not FAILED | EmptyDeposit() means zeroed on-chain, not execution failure | ✓ Good — prevents retry loops |
| buildOracleParams throws on empty tokens | Silent empty params caused mysterious reverts | ✓ Good — errors surface at right level |
| ETH/USD market: mUSDC as both long+short token | WETH is only indexToken for price, mUSDC is deposit token | ✓ Good — clarified token roles |
| Unknown errors retried (not fail-fast) | Safer to assume retryable when error is unclassified | ✓ Good — covers edge cases |
| encodeAbiParameters for CONTROLLER role hash | Must match Solidity abi.encode padding (not encodePacked) | ✓ Good — hash matches on-chain |
| Manual CORS middleware (not cors package) | Testnet only, minimal footprint | ✓ Good — simple and sufficient |
| Elapsed time escalation: 15s→60s→120s | Progressive urgency: silent → counter → warning → cancel | ✓ Good — matches UX expectations |

---
*Last updated: 2026-02-21 after v1.0 milestone*
