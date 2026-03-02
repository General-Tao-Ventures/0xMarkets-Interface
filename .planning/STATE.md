---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Deployment
status: unknown
last_updated: "2026-03-01T03:15:56.692Z"
progress:
  total_phases: 18
  completed_phases: 18
  total_plans: 39
  completed_plans: 39
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.8 Deployment — Phase 30: CI/CD Automation

## Current Position

Phase: 30 of 31 (CI/CD Automation)
Plan: 0 of TBD in current phase
Status: Ready for planning
Last activity: 2026-03-01 — Completed 21-01 (Keeper Execution Fixes)

Progress: [=============================.] 94% (29/31 phases)

## Performance Metrics

**Velocity (v1.0-v1.8):**
- Total plans completed: 62
- Phases: 29 complete across 8 milestones

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 28    | 01   | 2min     | 2     | 1     |
| 28    | 02   | 5min     | 2     | 0     |
| 29    | 01   | 15min    | 3     | 0     |

## Accumulated Context

### Known Issues

- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
- JPY/USD Pyth Lazer oracle data gap: "Best ask price is not present for the timestamp"
- Shared wallet nonce conflict between keeper-service and order-execution-keeper — documented testnet risk
- WETH/USD pool at 100% reserve capacity — blocks new position/liquidation testing

### Server State (after 29-01)

- All 3 repos pushed to GitHub and pulled on DO server
- keeper-service on server: git repo on ken/keeper-updates, path /opt/0xmarkets/keeper-service/
- order-execution-keeper on server: git repo on ken/keeper-rebuild, path /opt/0xmarkets/order-execution-keeper-service/
- docker-compose.yml on server has all v1.7 addresses, ORACLE_MODE=lazer, ORACLE_PROVIDER_ADDRESS, FLASHBLOCKS_RPC_URL
- Server .env has 6 required secrets
- All 3 Docker containers running and healthy (postgres, keeper-service, order-execution-keeper)
- Prisma migrations applied (2 migrations, none pending), price_candles 140k+ rows preserved
- keeper-service health: HTTP 200, liquidation scanner active (30s cycles)
- order-execution-keeper health: HTTP 200, 7 cached tokens, oracle fresh

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

See .planning/PROJECT.md key decisions table for full history.

- [28-01] docker-compose.yml not in a git repo -- updated locally, will transfer to server in Plan 02
- [28-01] ORACLE_MODE hardcoded to "lazer" (not env var default) to prevent hermes fallback
- [28-01] order-execution-keeper uses DataStore-registered oracle provider (0xc5810) as PYTH_LAZER_FEED_PROVIDER_ADDRESS
- [28-02] Server path is /opt/0xmarkets/ (not /root/0xmarkets/ as originally assumed)
- [28-02] GitHub org is General-Tao-Ventures (not taoshidev)
- [28-02] Used fresh clone + swap for keeper-service git init (avoids dirty tree conflicts)
- [28-02] Removed stale ORACLE_MODE=hermes from server .env
- [Phase 29]: Docker rebuild preserves pgdata volume -- data survived across container rebuild
- [Phase 29]: Prisma auto-migration on container CMD is reliable for this deployment model

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 29-01-PLAN.md (Phase 29 complete)
Next: Plan Phase 30 (CI/CD Automation)
