---
phase: 25-liquidation-pipeline-verification
plan: 01
subsystem: infra
tags: [keeper, oracle, pyth-lazer, config, role-store, liquidation]

# Dependency graph
requires:
  - phase: 24-contract-bug-fixes
    provides: Clean contract surface (OrderHandler zero-guard fix)
provides:
  - Dynamic PythLazerFeedProvider address in keeper-service config
  - Oracle mode set to Lazer for independent keeper operation
  - Verified LIQUIDATION_KEEPER role on keeper wallet
affects: [25-02, 26-liquidation-hardening-and-performance]

# Tech tracking
tech-stack:
  added: []
  patterns: [config-driven contract addresses instead of hardcoded constants]

key-files:
  created: []
  modified:
    - keeper-service/src/core/contract.ts
    - keeper-service/src/config.ts
    - keeper-service/.env
    - order-execution-keeper-service/.env

key-decisions:
  - "PythLazerFeedProvider 0x8a3eb351 is the on-chain active provider, not 0x81B3857 from docs"
  - "contract.ts reads address from config.pythLazerFeedProviderAddress instead of hardcoding"
  - "No role grant needed -- keeper wallet already had LIQUIDATION_KEEPER role"

patterns-established:
  - "Config-driven addresses: keeper contract addresses should be read from config, not hardcoded"

requirements-completed: [LIQ-01, LPERF-03]

# Metrics
duration: ~15min
completed: 2026-02-27
---

# Phase 25 Plan 01: Liquidation Prerequisites Summary

**PythLazerFeedProvider address made dynamic from config, oracle mode set to Lazer, and LIQUIDATION_KEEPER role verified on keeper wallet**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-27T23:37:00Z
- **Completed:** 2026-02-27T23:54:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced hardcoded PythLazerFeedProvider address in contract.ts with config-driven lookup via `config.pythLazerFeedProviderAddress`
- Updated config.ts default to the verified on-chain active provider (0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05)
- Set ORACLE_MODE=lazer in keeper-service .env so the keeper uses Pyth Lazer independently
- Aligned both keeper-service and order-execution-keeper-service .env files to the same PythLazerFeedProvider address
- Verified LIQUIDATION_KEEPER role already granted on keeper wallet 0x48Cb0d738C9B3F44F60f7338F788fa093FD25828 via on-chain cast call

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PythLazerFeedProvider address and oracle mode configuration** - `e319e36` (fix) in keeper-service repo
2. **Task 2: Verify LIQUIDATION_KEEPER role on-chain** - No commit needed (verification-only task, role already existed)

**Plan metadata:** `cb67704` (docs: complete plan)

## Files Created/Modified
- `keeper-service/src/core/contract.ts` - PYTH_LAZER_FEED_PROVIDER_ADDRESS now reads from config instead of hardcoded value
- `keeper-service/src/config.ts` - Default PythLazerFeedProvider address updated to verified on-chain address (0x8a3eb351)
- `keeper-service/.env` - ORACLE_MODE set to lazer, PythLazerFeedProvider address aligned
- `order-execution-keeper-service/.env` - PythLazerFeedProvider address aligned with keeper-service

## Decisions Made
- **On-chain address wins over docs:** Research phase documented 0x81B3857 as the correct PythLazerFeedProvider, but on-chain verification (getStoredPrice returning ok=true) proved 0x8a3eb351 is the active provider. Used the on-chain value as authoritative.
- **Config-driven vs hardcoded:** Changed contract.ts from a hardcoded string to reading `config.pythLazerFeedProviderAddress`, establishing a pattern for future address changes.
- **No role grant transaction needed:** The plan anticipated needing to grant LIQUIDATION_KEEPER, but the role was already present on the keeper wallet. Verified via `cast call hasRole()` returning true.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected PythLazerFeedProvider address from docs value to on-chain verified value**
- **Found during:** Task 1 (on-chain verification step)
- **Issue:** Research documented 0x81B3857cD770887fa1d839AbEa66f951ECa4206f as the correct address, but getStoredPrice returned false for it. The actually active provider was 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05.
- **Fix:** Used on-chain verified address (0x8a3eb351) for both config.ts default and .env files
- **Files modified:** keeper-service/src/config.ts, keeper-service/.env, order-execution-keeper-service/.env
- **Verification:** cast call getStoredPrice on 0x8a3eb351 returns ok=true with valid WETH price
- **Committed in:** e319e36

---

**Total deviations:** 1 auto-fixed (1 bug fix -- address mismatch between docs and on-chain state)
**Impact on plan:** Necessary correction. The plan's verification step was specifically designed to catch this case.

## Issues Encountered
None -- all steps proceeded without unexpected problems.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PythLazerFeedProvider address is correct and config-driven -- scanner can read stored prices
- Oracle mode is Lazer -- keeper operates independently of order-execution-keeper uptime
- LIQUIDATION_KEEPER role verified -- executor can submit liquidation transactions
- Ready for Plan 02: end-to-end liquidation pipeline test (create undercollateralized position, verify detection/execution/confirmation)

## Self-Check: PASSED

- [x] SUMMARY.md exists at expected path
- [x] Commit e319e36 exists in keeper-service repo
- [x] contract.ts contains config.pythLazerFeedProviderAddress
- [x] keeper-service .env has ORACLE_MODE=lazer

---
*Phase: 25-liquidation-pipeline-verification*
*Completed: 2026-02-27*
