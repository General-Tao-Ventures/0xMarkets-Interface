---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Trade History & Leaderboard Fix
status: unknown
stopped_at: Completed 38-01-PLAN.md
last_updated: "2026-03-05T01:56:52.207Z"
progress:
  total_phases: 24
  completed_phases: 23
  total_plans: 47
  completed_plans: 47
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.11 Trade History Fix — make successfully opened/closed positions appear in trade history with rPnL

## Current Position

Phase 38 complete. Phase 39 (Frontend Verification & Fixes) next.

### Completed
- Squid pnlUsd enrichment fixed (pnlUsd = basePnlUsd on position events)
- Fee extraction from PositionFeesCollected events (not PositionIncrease/Decrease)
- collateralDeltaAmount int256/uint256 type mismatch fixed (maxCapital was always 0)
- Squid redeployed with --hard-reset, all data verified via GraphQL

## Accumulated Context

### Known Issues

- WETH/USD pool at 100% reserve capacity — blocks new position creation on that market
- JPY/USD Pyth Lazer oracle data gap — testnet infrastructure, not code
- Shared wallet nonce conflict between keeper-service and order-execution-keeper
- abis.ts has incorrect getAccountOrders ABI (uint256 enums, phantom updatedAtBlock)

### Server State

- All services deployed on DO droplet (142.93.203.222)
- keeper-service: port 37017, order-execution-keeper: port 37018, data-verification: port 37019
- Squid redeployed 2026-03-05 with pnlUsd + fee + maxCapital fixes, fully re-indexed

### Pending Todos

None.

### Blockers/Concerns

None.

## Decisions

- pnlUsd = basePnlUsd for trade history display (matches GMX v2 subgraph approach)
- Fee data sourced from PositionFeesCollected events, not PositionIncrease/Decrease
- collateralDeltaAmount type-aware extraction (int256 for increase, uint256 for decrease)

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 38-01-PLAN.md
Next: /gsd:plan-phase 39 or /gsd:execute-phase 39
