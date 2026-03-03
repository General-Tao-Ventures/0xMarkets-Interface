---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Event Indexer
status: completed
stopped_at: Completed 31-02-PLAN.md (Phase 31 complete)
last_updated: "2026-03-03T20:05:32.045Z"
last_activity: 2026-03-03 — Completed 31-02 migration runner
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.9 Event Indexer — Phase 31 complete, Phase 32 next

## Current Position

Phase: 31-event-schema (COMPLETE)
Plan: 02/02 complete
Status: Phase 31 complete
Last activity: 2026-03-03 — Completed 31-02 migration runner

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
- Event indexer: NOT YET BUILT — this milestone's focus
- Existing squid eventDecoder.ts can be ported (ethers v6 ABI decoder)
- EventEmitter ABI available in order-execution-keeper (EventLog1 + EventLog2)

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

## Session Continuity

Last session: 2026-03-03T20:01:14Z
Stopped at: Completed 31-02-PLAN.md (Phase 31 complete)
Next: Execute Phase 32 (event decoder)
