---
phase: 28-git-sync-server-config
plan: 01
subsystem: infra
tags: [git, docker-compose, deployment, contract-addresses, oracle]

# Dependency graph
requires:
  - phase: 24-contract-bug-fix-redeploy
    provides: "v1.7 contract addresses from redeployment"
  - phase: 25-liquidation-pipeline-verification
    provides: "Oracle mode lazer config and ORACLE_PROVIDER_ADDRESS"
provides:
  - "All v1.7 code pushed to GitHub across 3 repos (keeper-service, frontend, order-execution-keeper)"
  - "docker-compose.yml with correct v1.7 contract addresses and oracle config"
affects: [29-server-deployment, 30-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns: ["hardcoded ORACLE_MODE=lazer instead of env var default", "FLASHBLOCKS_RPC_URL for TX speed improvement"]

key-files:
  created: []
  modified:
    - "/Users/ken/Projects/0xM/docker-compose.yml"

key-decisions:
  - "docker-compose.yml lives in /Users/ken/Projects/0xM/ which is not a git repo -- file updated locally, will be rsync'd or handled in Plan 02"
  - "ORACLE_MODE hardcoded to 'lazer' (not env var default) to prevent hermes fallback on server"
  - "order-execution-keeper PYTH_LAZER_FEED_PROVIDER_ADDRESS uses DataStore-registered oracle provider (0xc5810) not getStoredPrice address (0x8a3eb)"

patterns-established:
  - "Contract addresses hardcoded in docker-compose; secrets use ${} env var syntax"

requirements-completed: [GIT-01, GIT-02, CFG-01, CFG-02, CFG-03]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 28 Plan 01: Git Sync & Docker Compose Update Summary

**Pushed 79 commits across 3 repos to GitHub and updated docker-compose.yml with all v1.7 contract addresses, ORACLE_MODE=lazer, and ORACLE_PROVIDER_ADDRESS**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T22:45:00Z
- **Completed:** 2026-02-28T22:47:00Z
- **Tasks:** 2
- **Files modified:** 1 (docker-compose.yml)

## Accomplishments
- Pushed 16 keeper-service commits (ken/keeper-updates) to GitHub
- Pushed 63 frontend commits (ken/integration) to GitHub -- triggers Vercel auto-deploy
- Confirmed order-execution-keeper (ken/keeper-rebuild) already fully pushed
- Updated docker-compose.yml with all 11 contract address changes across both keeper services
- Added ORACLE_PROVIDER_ADDRESS and ORACLE_MODE=lazer for keeper-service
- Added FLASHBLOCKS_RPC_URL for order-execution-keeper

## Task Commits

1. **Task 1: Push all local commits to GitHub** - No commit (git push operations only, no file changes in tracked repos)
2. **Task 2: Update docker-compose.yml** - No commit (docker-compose.yml is in /Users/ken/Projects/0xM/ which is not a git repo)

Note: Both tasks completed successfully but neither produced committable changes in the frontend repo. The docker-compose.yml changes are local and will be transferred to the server via rsync or git init in Plan 02.

## Files Created/Modified
- `/Users/ken/Projects/0xM/docker-compose.yml` - Updated all contract addresses to v1.7, added ORACLE_PROVIDER_ADDRESS, hardcoded ORACLE_MODE=lazer, added FLASHBLOCKS_RPC_URL

### Address Changes Applied

**keeper-service:**
| Variable | Old | New |
|----------|-----|-----|
| READER_ADDRESS | 0xb53122a7... | 0x1e6Ca804... |
| DATA_STORE_ADDRESS | 0xBaD049d5... | 0x3B9d71B4... |
| LIQUIDATION_HANDLER_ADDRESS | 0xa4900B62... | 0x241829af... |
| EVENT_EMITTER_ADDRESS | 0x1E4cBc2e... | 0xd5aAfa71... |
| REFERRAL_STORAGE_ADDRESS | 0x38D58E8A... | 0xF5F9CdBe... |
| ORACLE_PROVIDER_ADDRESS | (new) | 0xc5810FC1... |
| ORACLE_MODE | ${ORACLE_MODE:-hermes} | "lazer" |

**order-execution-keeper:**
| Variable | Old | New |
|----------|-----|-----|
| DATA_STORE_ADDRESS | 0xBaD049d5... | 0x3B9d71B4... |
| READER_ADDRESS | 0xb53122a7... | 0x1e6Ca804... |
| EVENT_EMITTER_ADDRESS | 0x1E4cBc2e... | 0xd5aAfa71... |
| DEPOSIT_HANDLER_ADDRESS | 0x9388B07f... | 0xA91306c0... |
| WITHDRAWAL_HANDLER_ADDRESS | 0x7aAF500d... | 0x6b2aDac8... |
| ORDER_HANDLER_ADDRESS | 0x6d299Cdf... | 0x63dE8c59... |
| PYTH_LAZER_FEED_PROVIDER_ADDRESS | 0x8a3eb351... | 0xc5810FC1... |
| FLASHBLOCKS_RPC_URL | (new) | ${FLASHBLOCKS_RPC_URL:-https://sepolia-preconf.base.org} |

## Decisions Made
- docker-compose.yml is not in a git repo -- updated locally, will be transferred to server in Plan 02
- ORACLE_MODE hardcoded to "lazer" (not using env var default) to prevent accidental hermes fallback
- order-execution-keeper uses DataStore-registered oracle provider (0xc5810) as its PYTH_LAZER_FEED_PROVIDER_ADDRESS since it calls this directly for execution

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All code is on GitHub, ready for server to pull
- docker-compose.yml has correct addresses, ready to transfer to server
- Plan 02 will handle server-side git setup, code pull, and container rebuild

## Self-Check: PASSED

- FOUND: /Users/ken/Projects/0xM/docker-compose.yml
- FOUND: 28-01-SUMMARY.md
- VERIFIED: keeper-service origin/ken/keeper-updates matches HEAD (bff78a4)
- VERIFIED: frontend origin/ken/integration matches HEAD (93182c447)
- VERIFIED: No stale addresses in docker-compose.yml

---
*Phase: 28-git-sync-server-config*
*Completed: 2026-02-28*
