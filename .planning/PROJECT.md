# Fix Buy GM Flow — ETH/USD Pool

## What This Is

Fix the end-to-end "Buy GM" (deposit/liquidity provision) flow for the ETH/USD pool on 0xMarkets. A user deposits USDC into a pool, the order-execution-keeper detects the on-chain deposit request and executes it via the DepositHandler contract, and the user receives GM (market) tokens. Currently the deposit transaction mines successfully but the keeper fails to execute it, leaving users stuck on a "Fulfilling buy request" spinner.

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

### Active

<!-- Current scope. Building toward these. -->

- [ ] Keeper successfully executes deposits end-to-end (createDeposit → executeDeposit → GM tokens received)
- [ ] Expired deposits are detected and auto-cancelled with user-friendly messaging
- [ ] Failed executions have retry logic for transient errors (nonce issues, gas estimation failures)
- [ ] UI surfaces clear deposit status (pending → executing → complete/failed)
- [ ] Error messages are actionable — user knows what happened and what to do next

### Out of Scope

- Other pool types beyond ETH/USD — focus on one pool first
- Withdrawal (Sell GM) flow fixes — separate effort
- Order execution fixes — separate effort
- New pool creation or market configuration
- Mobile-specific UI improvements

## Context

- **Chain:** Base Sepolia (84532)
- **Keeper infrastructure:** Two services on DigitalOcean (142.93.203.222), managed via Docker Compose at `/opt/0xmarkets/`
  - keeper-service (port 37017): price feeds, liquidation scanning, candle data
  - order-execution-keeper-service (port 37018): executes deposits, withdrawals, orders
- **Oracle mode:** Pyth Lazer — binary WebSocket price feeds, prices stored on-chain via PythLazerFeedProvider
- **Previous session fixes deployed:**
  - Transaction confirmation (waitForTransactionReceipt) after price updates
  - Cache freshness validation (30s max age)
  - WebSocket initialization race condition (clientReady Promise)
  - Index token inclusion in oracle params
  - Fail-fast gas estimation (no fallback to 500000n)
  - 10-second startup delay for WebSocket warmup
- **Last known error:** OracleTimestampsAreLargerThanRequestExpirationTime — deposits expired before keeper could execute (not a code bug, deposits were stale)
- **Key contract addresses:**
  - DataStore: `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E`
  - PythLazerFeedProvider v3: `0x2F00A6200853B093459BCAAee1De6648D9d672fc`
  - DepositHandler: `0x9388B07f807eB870aD36d350d80DC0c214a7f04f`
  - Reader: `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c`
  - Keeper wallet: `0x48Cb0d738C9B3F44F60f7338F788fa093FD25828`

## Constraints

- **Deployment:** Changes to keeper must be deployed to DO server via SSH and Docker rebuild
- **Oracle freshness:** MAX_ORACLE_PRICE_AGE is 300 seconds — keeper must push prices and execute within this window
- **Deposit expiry:** Deposits have a max lifetime on-chain; keeper must execute before expiry
- **Nonce management:** Single keeper wallet means sequential transaction ordering matters

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pyth Lazer over Pyth Classic | Lower latency price feeds for faster execution | — Pending |
| Single keeper wallet | Simpler architecture for testnet | — Pending |
| Docker Compose deployment | Simple deployment model for single server | — Pending |

---
*Last updated: 2026-02-20 after initialization*
