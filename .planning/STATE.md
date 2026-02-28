---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Deployment
status: active
last_updated: "2026-02-28T22:47:00.000Z"
progress:
  total_phases: 31
  completed_phases: 27
  total_plans: 59
  completed_plans: 59
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.8 Deployment — Phase 28: Git Sync & Server Config

## Current Position

Phase: 28 of 31 (Git Sync & Server Config)
Plan: 1 of 2 in current phase
Status: Executing
Last activity: 2026-02-28 — Completed 28-01 (Git Sync & Docker Compose Update)

Progress: [============================..] 87% (27/31 phases)

## Performance Metrics

**Velocity (v1.0-v1.8):**
- Total plans completed: 59
- Phases: 27 complete across 8 milestones

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 28    | 01   | 2min     | 2     | 1     |

## Accumulated Context

### Known Issues

- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
- JPY/USD Pyth Lazer oracle data gap: "Best ask price is not present for the timestamp"
- Shared wallet nonce conflict between keeper-service and order-execution-keeper — documented testnet risk
- WETH/USD pool at 100% reserve capacity — blocks new position/liquidation testing

### Server State (after 28-01)

- All 3 repos pushed to GitHub (keeper-service 16 commits, frontend 63 commits, order-keeper already synced)
- docker-compose.yml updated locally with v1.7 addresses, ORACLE_MODE=lazer, ORACLE_PROVIDER_ADDRESS
- Server still running old code -- Plan 02 handles git setup, pull, and container rebuild
- docker-compose.yml is in /Users/ken/Projects/0xM/ which is NOT a git repo (will be rsync'd)

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

See .planning/PROJECT.md key decisions table for full history.

- [28-01] docker-compose.yml not in a git repo -- updated locally, will transfer to server in Plan 02
- [28-01] ORACLE_MODE hardcoded to "lazer" (not env var default) to prevent hermes fallback
- [28-01] order-execution-keeper uses DataStore-registered oracle provider (0xc5810) as PYTH_LAZER_FEED_PROVIDER_ADDRESS

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 28-01-PLAN.md
Next: Execute 28-02-PLAN.md (Server Deployment)
