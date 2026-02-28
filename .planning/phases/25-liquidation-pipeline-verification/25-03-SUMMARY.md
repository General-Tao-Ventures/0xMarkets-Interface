---
phase: 25-liquidation-pipeline-verification
plan: 03
subsystem: infra
tags: [pyth, lazer, oracle, keeper, config]

# Dependency graph
requires:
  - phase: 25-01
    provides: PythLazerFeedProvider config-driven address pattern in config.ts
provides:
  - Correct PythLazerFeedProvider address (0x8a3eb351) in all three config files
  - Lazer-first pricing against active on-chain provider
affects: [25-04, 26-liquidation-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - keeper-service/.env
    - keeper-service/src/config.ts (working tree restored to committed state)
    - order-execution-keeper-service/.env

key-decisions:
  - "On-chain cast call verification confirms 0x8a3eb351 returns ok=true, 0xc5810FC reverts -- address change is correct"
  - "config.ts working tree was dirty (reverted from committed state) -- restoring it produces no git diff since committed state already correct"
  - "order-execution-keeper-service .env is gitignored -- fix applied on disk only, no commit possible"

patterns-established: []

requirements-completed: [LIQ-02, LPERF-03]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 25 Plan 03: PythLazer Address Fix Summary

**Fixed PythLazerFeedProvider address from reverting 0xc5810FC to active 0x8a3eb351 across all keeper config files**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T02:41:23Z
- **Completed:** 2026-02-28T02:42:52Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Verified on-chain that 0x8a3eb351 returns ok=true for WETH getStoredPrice and 0xc5810FC reverts
- Fixed PythLazerFeedProvider address in keeper-service/.env (committed)
- Restored keeper-service/src/config.ts working tree to match committed state from e319e36
- Fixed PythLazerFeedProvider address in order-execution-keeper-service/.env (gitignored, on disk)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PythLazerFeedProvider address in all three config files** - `25144c3` (fix) [keeper-service repo]

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `keeper-service/.env` - Updated PYTH_LAZER_FEED_PROVIDER_ADDRESS to 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05
- `keeper-service/src/config.ts` - Restored working tree fallback address to match committed state (0x8a3eb351)
- `order-execution-keeper-service/.env` - Updated PYTH_LAZER_FEED_PROVIDER_ADDRESS to 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05

## Decisions Made
- On-chain `cast call` verification used as source of truth: 0x8a3eb351 returns `ok=true` with valid WETH price, 0xc5810FC reverts
- config.ts working tree had been dirty (reverted from committed state) -- restoring produces no git diff
- order-execution-keeper-service .env is gitignored -- fix applied on disk only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- config.ts appeared unchanged in git diff because the committed state (e319e36) already had the correct address -- only the working tree had been reverted. Restoring the working tree to match committed state resolved the issue with no commit needed for that file.
- order-execution-keeper-service .env is gitignored, so the fix cannot be committed via git. The on-disk change is sufficient for runtime.

## User Setup Required

None - no external service configuration required. Keepers should be restarted to pick up the new address (covered in Plan 04).

## Next Phase Readiness
- All three config files now reference the active PythLazerFeedProvider (0x8a3eb351)
- Scanner will use Lazer-first pricing against the correct on-chain provider when keepers are restarted
- Ready for Plan 04 (keeper restart and E2E verification)

---
*Phase: 25-liquidation-pipeline-verification*
*Completed: 2026-02-28*
