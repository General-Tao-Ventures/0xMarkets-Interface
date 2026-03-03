---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Event Indexer
status: defining_requirements
last_updated: "2026-03-03"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.9 Event Indexer — Defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-03 — Milestone v1.9 started

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

## Session Continuity

Last session: 2026-03-03
Stopped at: Defining v1.9 requirements
Next: Complete requirements, create roadmap
