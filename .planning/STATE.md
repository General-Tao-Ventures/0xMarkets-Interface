---
gsd_state_version: 1.0
milestone: "v1.12"
milestone_name: "WebSocket Price Streaming"
status: defining_requirements
stopped_at: null
last_updated: "2026-03-05"
progress:
  total_phases: 39
  completed_phases: 39
  total_plans: 70
  completed_plans: 70
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.12 WebSocket Price Streaming

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-05 — Milestone v1.12 started

## Accumulated Context

### Known Issues

- WETH/USD pool at 100% reserve capacity — blocks new position creation on that market
- JPY/USD Pyth Lazer oracle data gap — testnet infrastructure, not code
- Shared wallet nonce conflict between keeper-service and order-execution-keeper
- abis.ts has incorrect getAccountOrders ABI (uint256 enums, phantom updatedAtBlock)
- Chart candle data lags mark price by 0-2s due to keeper's 2s Pyth HTTP polling interval

### Server State

- All services deployed on DO droplet (142.93.203.222)
- keeper-service: port 37017, order-execution-keeper: port 37018, data-verification: port 37019
- Squid redeployed 2026-03-05 with pnlUsd + fee + maxCapital fixes, fully re-indexed

### Pending Todos

None.

### Blockers/Concerns

None.

## Decisions

(Cleared — see PROJECT.md Key Decisions table for full history)

## Session Continuity

Last session: 2026-03-05
Stopped at: Defining v1.12 requirements
Next: Define requirements → create roadmap
