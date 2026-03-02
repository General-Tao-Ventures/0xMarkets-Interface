# Mainnet Launch Preparation Design

**Date:** 2026-03-01
**Status:** Approved
**Target chain:** Base mainnet (chain ID 8453)

---

## 1. Contract Deployment Strategy

Fresh deploy on Base mainnet. The hardhat config already has the `base` network entry ready.

### What Changes from Testnet

| Item | Testnet (current) | Mainnet (target) |
|---|---|---|
| Admin roles | Single deployer EOA holds everything | Safe multisig (2-of-3 or 3-of-5) for ROLE_ADMIN, TIMELOCK_ADMIN, TIMELOCK_MULTISIG |
| Keeper roles | Same wallet as admin | Dedicated keeper wallets (separate from admin). Multiple wallets for ORDER_KEEPER, LIQUIDATION_KEEPER |
| Fee receivers | `"REPLACE_ME"` placeholders | Actual treasury addresses (multisig-controlled) |
| Timelock delay | 24 hours | Increase to 48-72 hours (gives users time to react to parameter changes) |
| USDC | mUSDC (mock, anyone can mint) | Real USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| WETH | Same canonical address | Same (`0x4200000000000000000000000000000000000006`) |
| Synthetic tokens | Mock mintable tokens | Not needed — synthetics are virtual (only the market token is minted, collateral is USDC) |
| Oracle provider | PythLazerFeedProvider (custom, unaudited) | Same contract, but **get it audited** before mainnet |
| Market parameters | Loose testnet values | Tuned parameters: tighter funding rates, proper OI caps, calibrated swap/position impact factors |
| minOracleSigners | 0 | Evaluate whether to require 1+ (depends on Pyth Lazer's mainnet security model) |

### Critical Security Items

1. **Rotate the deployer key** — the current key is committed to git in plaintext (`docs/keeper-infrastructure.md`). Generate a fresh deployer wallet for mainnet, never commit it.
2. **Separate roles immediately** — deploy with the multisig as ROLE_ADMIN from the start, not "deploy then transfer."
3. **Audit PythLazerFeedProvider** — this is the only custom contract code not covered by GMX's audits. Even a focused review (not a full protocol audit) is worthwhile.
4. **Feature flags** — launch with kill switches enabled so you can disable specific operations if issues arise.

### Market Rollout

Don't launch all 100+ markets at once. Start with 4-6 high-liquidity pairs (ETH, BTC, SOL, maybe EUR/GOLD), validate execution and oracle reliability, then add markets in batches.

---

## 2. Keeper Infrastructure — Self-Hosted Fleet

### Architecture

```
                    Pyth Lazer WebSocket
                           |
                    Price Aggregator Service
                    (dedicated process, caches signed bytes)
                           |
                    Internal gRPC/HTTP API
                           |
On-chain Events --> Event Watcher --> Redis Queue (BullMQ)
                    (detection only)        |
                                    +-------+-------+
                                Wallet-1  Wallet-2  Wallet-3
                                Worker    Worker    Worker
                                    |       |       |
                                    +-------+-------+
                                         Base L1
```

### What Changes from Current

| Component | Current | Mainnet |
|---|---|---|
| Event detection | Watcher + 5s poller in same process as executor | Separate watcher process, publishes to Redis |
| Queue | In-memory array, lost on crash | Redis-backed BullMQ, survives restarts |
| Execution | 1 wallet, sequential | 3-5 wallets, parallel workers per wallet |
| Dedup | In-memory `seen` Map (10min TTL) | Redis-backed shared dedup across all workers |
| Oracle prices | Each service maintains its own Pyth WebSocket | Dedicated Price Aggregator service, workers fetch from it |
| Nonce management | Fetch from RPC each time, retry on conflict | Per-wallet local nonce tracker with optimistic increments |
| Monitoring | Health endpoint only | Prometheus metrics + Grafana dashboards + PagerDuty alerts |
| Infra | 1 vCPU / 2GB RAM single droplet | 2+ servers across regions, 4+ vCPU / 8GB+ each |

### Priority Tiers in the Queue

| Priority | Type | SLA | Rationale |
|---|---|---|---|
| Critical | Market orders | < 2s | Users are watching, price-sensitive |
| High | Liquidations | < 5s | Protocol health, prevent bad debt |
| Normal | Deposits, withdrawals | < 10s | Not price-sensitive |
| Low | ADL (auto-deleverage) | < 30s | Rare, less urgent |

### Wallet Pool Strategy

- **5 keeper wallets** at launch (can scale to 10-20)
- Each wallet gets ORDER_KEEPER + LIQUIDATION_KEEPER roles on-chain
- Workers claim jobs from Redis and execute with their assigned wallet
- If a wallet's ETH balance drops below threshold, alert fires and that worker pauses until topped up
- Fund each wallet with 0.5 ETH initially (Base gas is cheap, this lasts weeks)

### Fallback Layer

Register a Gelato Web3 Function as a **backup** that runs every 30 seconds:
- Scans for pending orders older than 15 seconds (meaning primary keepers missed them)
- Executes any stale orders
- This catches edge cases where all primary keepers are down simultaneously
- Costs almost nothing since it rarely fires

### Monitoring & Alerts

| Metric | Alert Threshold |
|---|---|
| Queue depth | > 50 jobs for > 30s |
| Execution latency p95 | > 5s |
| Oracle staleness | > 10s since last price update |
| Wallet ETH balance | < 0.1 ETH |
| Consecutive failures | 5+ in a row for any wallet |
| Process heartbeat | Missing for > 30s |
| RPC error rate | > 5% of calls in 1 minute |

---

## 3. Infrastructure & Operations

### Compute

| Component | Testnet | Mainnet |
|---|---|---|
| Servers | 1 DigitalOcean droplet (1 vCPU / 2GB) | 2+ servers, different regions (US-East + EU-West), 4 vCPU / 8GB minimum each |
| Database | Single Postgres in Docker | Managed Postgres (DigitalOcean Managed DB or AWS RDS) with automated backups and read replica |
| Redis | None | Managed Redis (for job queue + dedup + price cache) |
| Orchestration | Docker Compose | Kubernetes (DigitalOcean DOKS) or Docker Compose with Watchtower for auto-restart |
| Deployment | Manual rsync | CI/CD via GitHub Actions — push to deploy branch triggers rebuild on server |

### RPC Strategy

- **Primary**: Premium provider (Alchemy or QuickNode) with dedicated WebSocket
- **Fallback**: Second provider (Chainstack or Infura) auto-switched on error
- **Optional**: Run your own Base node for lowest latency and no rate limits (only worthwhile at very high scale)
- Load balance reads across providers, pin writes to primary

### Key Management

| Key Type | Testnet | Mainnet |
|---|---|---|
| Admin/deployer | Private key in `.env` file on disk | Hardware wallet (Ledger) for deployment. After deploy, admin control lives in Safe multisig |
| Keeper wallets | Same key as admin, in plaintext `.env` | Separate hot wallets, keys in cloud KMS (AWS KMS or HashiCorp Vault). Never in plaintext files |
| Pyth access token | `.env` on server | Stored in secrets manager (GitHub Secrets for CI, cloud KMS for runtime) |

### CI/CD Pipeline

```
Push to `main` branch
    |
    v
GitHub Actions:
    +-- Lint + typecheck + build
    +-- Run tests
    +-- On success:
         +-- Build Docker image
         +-- Push to container registry (GHCR or Docker Hub)
         +-- SSH to servers -> pull new image -> rolling restart
              +-- Server 1 (US-East): restart workers one at a time
              +-- Server 2 (EU-West): restart workers one at a time
```

Rolling restarts ensure at least one worker is always running during deploys. No downtime for order execution.

### Disaster Recovery

| Scenario | Response |
|---|---|
| Server 1 goes down | Server 2 continues processing from shared Redis queue. Alert fires. |
| Both servers down | Gelato fallback picks up stale orders every 30s. Alert fires. Manual intervention to restore. |
| Redis down | Workers fall back to in-memory queue (degraded mode, no dedup across instances). Alert fires. |
| RPC provider outage | Auto-switch to fallback RPC. Alert fires. |
| Pyth Lazer WebSocket drops | Price Aggregator reconnects automatically (already implemented). If down > 30s, workers pause execution (stale prices would cause reverts anyway). |
| Keeper wallet drained | Worker pauses, alert fires. Other wallets continue. Top up or rotate. |

---

## 4. Launch Checklist & Phasing

### Pre-Launch (Before Any Mainnet Deployment)

| Item | Status | Owner |
|---|---|---|
| Audit PythLazerFeedProvider contract | Not started | External auditor |
| Generate fresh deployer wallet (never committed to git) | Not started | Ken |
| Create Safe multisig (2-of-3 or 3-of-5) on Base mainnet | Not started | Ken + team |
| Generate 5 keeper wallets, store keys in KMS | Not started | Ken |
| Fill `config/roles.ts` base network section (multisig as admin, keeper wallets for ORDER_KEEPER/LIQUIDATION_KEEPER) | Not started | Dev |
| Fill `config/general.ts` fee receivers (multisig-controlled treasury) | Not started | Ken |
| Tune market parameters for initial 4-6 markets (OI caps, funding rates, impact factors, fees) | Not started | Dev |
| Set up managed Postgres + Redis | Not started | Dev |
| Set up 2 servers (US-East + EU-West) | Not started | Dev |
| Set up Prometheus + Grafana + PagerDuty | Not started | Dev |
| Scrub deployer private key from git history (`docs/keeper-infrastructure.md`) | Not started | Dev |
| Set up CI/CD pipeline for keeper deploys | Not started | Dev |
| Real USDC liquidity — seed initial pools | Not started | Ken |

### Phase 1: Soft Launch (Week 1-2)

- Deploy contracts to Base mainnet with multisig as admin
- Launch with **4-6 markets** only (ETH/USD, BTC/USD, SOL/USD, and 1-2 synthetics)
- Run 2 keeper wallets (conservative, validate everything works)
- Invite limited users (whitelist or just no marketing push)
- Kill switches enabled on all operations
- Monitor everything manually — watch every execution in logs
- Cap pool sizes and OI limits tight initially

### Phase 2: Scale Up (Week 3-8)

- Scale to 5 keeper wallets with Redis queue architecture
- Add 10-20 more markets in batches of 5
- Enable Gelato fallback layer
- Open to public, begin marketing
- Loosen OI caps as pools deepen
- Add read replica for database

### Phase 3: Full Scale (Month 3+)

- 50-100+ markets
- 5-10 keeper wallets, auto-scaling workers
- Permissionless keeper program (open-source bot, external keepers earn fees)
- Geographic distribution across 3+ regions
- Evaluate running own Base node for lowest latency
- Governance transition (if desired — move from multisig to token voting)

### Rollback Plan

If a critical issue is found post-launch:
1. **Immediate**: Use TIMELOCK_MULTISIG to disable the affected operation via feature flags (no timelock delay)
2. **If broader**: Disable all creates (deposits, orders) — existing positions can still be closed
3. **Nuclear**: Revoke all CONTROLLER roles, freezing the protocol entirely. Users' collateral remains safe in the DataStore vault — it can be returned via governance action

---

## Decision Log

| Decision | Rationale |
|---|---|
| Fresh deploy on Base mainnet | Clean slate, proper role separation from day one |
| Safe multisig for admin | Industry standard for DeFi protocol admin. Single EOA is unacceptable risk for mainnet |
| Self-hosted keeper fleet (not Gelato/Chainlink) | Lowest latency (< 2s vs 2-5s), native Pyth Lazer integration already built, full control over execution. Gelato used as fallback only |
| Gradual market rollout (4-6 then batches) | Validates execution and oracle reliability before scaling |
| Redis + BullMQ for job queue | Crash-resilient, shared dedup across workers, priority tiers, visibility for alerting |
| Gelato as fallback layer only | Decentralized safety net for missed orders without primary-path latency cost |
