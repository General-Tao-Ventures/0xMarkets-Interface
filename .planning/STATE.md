---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Event Indexer
status: completed
stopped_at: Completed 34-02-PLAN.md (v1.9 milestone complete)
last_updated: "2026-03-03T23:02:53.216Z"
last_activity: 2026-03-03 — Completed 34-02 deploy and verify
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 7
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.9 Event Indexer — MILESTONE COMPLETE, all 4 phases deployed and verified

## Current Position

Phase: 34-deploy-verify
Plan: 02/02 complete
Status: v1.9 milestone complete
Last activity: 2026-03-03 — Completed 34-02 deploy and verify

## Accumulated Context

### Known Issues

- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
- JPY/USD Pyth Lazer oracle data gap: "Best ask price is not present for the timestamp"
- Shared wallet nonce conflict between keeper-service and order-execution-keeper — documented testnet risk
- WETH/USD pool at 100% reserve capacity — blocks new position/liquidation testing
- GOLD feed (346/XAUUSD) recording 0 prices in data-verification-service — needs investigation

### Server State

- All 3 repos pushed to GitHub and pulled on DO server (142.93.203.222)
- keeper-service: /opt/0xmarkets/keeper-service/ (ken/keeper-updates)
- order-execution-keeper: /opt/0xmarkets/order-execution-keeper-service/ (ken/keeper-rebuild)
- data-verification-service: deployed on same droplet, port 37019
- All Docker containers running and healthy
- Prisma migrations applied, price_candles 140k+ rows preserved

### Data Verification Service State

- Market snapshotter: per-block multicall reads for 6 markets (working)
- Price recorder: per-second Pyth Lazer WebSocket for 7 assets (working, GOLD issue)
- Database: 2 Prisma tables (market_snapshots, price_ticks)
- Event indexer: DEPLOYED AND VERIFIED on DO droplet
- Event decoder uses viem decodeAbiParameters (ported from squid's ethers v6)
- 52 event name constants, DecodedEventData type, helper getters all in src/events/
- Event indexer loop: cursor recovery, 2000-block chunk replay, real-time WebSocket subscription
- All 10 SQL migrations executed on droplet, 50 event tables across 9 PG schemas
- Health endpoint at :37019/health reports all 3 collector metrics
- WS_RPC_URL configured in parent docker-compose.yml on droplet

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

See .planning/PROJECT.md key decisions table for full history.

- 31-01: Used NUMERIC(78,0) for all uint256/int256 to preserve full 78-digit precision
- 31-01: Composite PK (block_number, log_index) for natural uniqueness from on-chain data
- 31-01: ClaimableFundingUpdated uses nullable time_key/next_pool_value for two Solidity overloads
- 31-01: Position fee tables have nullable referral/pro/liquidation columns matching conditional emit logic
- 31-01: DistributionCreated skipped (no contract emit function exists)
- 31-02: Used pg Client (not Prisma) for raw SQL execution since event tables use PG schema namespaces
- 31-02: Migration runner aborts on error to prevent app starting with incomplete schema
- 31-02: Resolve SQL directory via process.cwd() for dev/Docker compatibility
- 32-01: Used viem decodeAbiParameters with named fields for structured decoding (no positional indexing)
- 32-01: Normalize addresses/hex to lowercase at decode time for consistent downstream comparison
- 32-01: 52 event constants (actual squid count) rather than plan's stated 50
- [Phase 32]: Used viem decodeAbiParameters with named fields for structured event decoding
- 32-02: 51 handlers (not 49/50) matching actual 52 event constants minus DistributionCreated
- 32-02: All SQL column names double-quoted for reserved word safety (oracle.timestamp)
- 32-02: Position fee column specs shared between FeesCollected and FeesInfo handlers
- 33-01: Used viem WebSocket auto-reconnect (no custom reconnect logic)
- 33-01: Block timestamps cached per-chunk to avoid redundant getBlock RPC calls
- 33-01: First run sets cursor to current block (no historical replay on initial deploy)
- 33-01: Per-event error handling: log and continue, single bad event does not crash indexer
- [Phase 33-event-listener]: Used viem WebSocket auto-reconnect for real-time event subscription
- 34-01: Used simple rolling average for eventsPerMinute (count/uptime, no windowed tracking)
- 34-01: Docker build verification skipped (no local daemon) -- pnpm build sufficient
- 34-02: Used scp file sync instead of git pull for deployment (local code is source of truth)
- 34-02: Rebuilt container with --no-cache for clean image with all event indexer code

## Session Continuity

Last session: 2026-03-03T22:55:46Z
Stopped at: Completed 34-02-PLAN.md (v1.9 milestone complete)
Next: None -- v1.9 Event Indexer milestone fully deployed and verified
