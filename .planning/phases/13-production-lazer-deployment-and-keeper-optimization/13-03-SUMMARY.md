---
phase: 13-production-lazer-deployment-and-keeper-optimization
plan: 03
subsystem: infra
tags: [pyth, lazer, hermes, oracle, keeper, routing]

# Dependency graph
requires:
  - phase: 13-01
    provides: "verifyLazerFeeds() startup entitlement check and oracle provider consistency verification"
provides:
  - "Per-token oracle routing in buildOracleParams() based on Lazer entitlement state"
  - "Lazer entitlement state API (set/get/isEntitled) in pythLazerOracle.ts"
  - "Unconditional Hermes feed registration for fallback capability"
affects: [14-background-price-refresh]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-token-oracle-routing, entitlement-state-module-api]

key-files:
  created: []
  modified:
    - order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts
    - order-execution-keeper-service/src/index.ts
    - order-execution-keeper-service/src/core/executors/baseExecutor.ts

key-decisions:
  - "Entitlement state stored as module-level Set<string> with lowercase normalization for case-insensitive matching"
  - "Hermes feeds registered unconditionally (not gated by oracleMode) to enable per-token fallback in lazer mode"
  - "Per-token Lazer failure gracefully moves individual tokens to Hermes rather than failing the entire buildOracleParams call"

patterns-established:
  - "Per-token routing: buildOracleParams partitions tokens into lazerTokens/hermesTokens based on entitlement state"
  - "Module-level state API: setLazerEntitledTokens/getLazerEntitledTokens/isTokenLazerEntitled for cross-module access"

requirements-completed: [ORCL-02]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 13 Plan 03: Per-Token Oracle Routing Summary

**Per-token oracle routing in buildOracleParams() using Lazer entitlement state for graceful Hermes fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T22:01:37Z
- **Completed:** 2026-02-24T22:03:52Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- buildOracleParams() now partitions tokens per-token: Lazer-entitled tokens get PythLazerFeedProvider, others get Hermes
- Entitlement state stored at startup via verifyLazerFeeds() and accessible from buildOracleParams() via isTokenLazerEntitled()
- Hermes feeds registered unconditionally (regardless of oracleMode) enabling fallback path for any token
- Individual Lazer update failures gracefully move that token to Hermes rather than failing the entire operation

## Task Commits

Each task was committed atomically:

1. **Task 1: Export Lazer entitlement state and add per-token routing to buildOracleParams** - `52ed1f2` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` - Added setLazerEntitledTokens, getLazerEntitledTokens, isTokenLazerEntitled module-level API
- `order-execution-keeper-service/src/index.ts` - verifyLazerFeeds returns Address[], stores entitlement state, Hermes feeds registered unconditionally
- `order-execution-keeper-service/src/core/executors/baseExecutor.ts` - buildOracleParams() partitions tokens into Lazer/Hermes groups based on entitlement

## Decisions Made
- Entitlement state stored as module-level Set<string> with lowercase normalization for case-insensitive matching
- Hermes feeds registered unconditionally to enable per-token fallback even in lazer-only mode
- Per-token Lazer failure gracefully moves individual tokens to Hermes rather than failing the entire buildOracleParams call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Per-token oracle routing ready for production use
- Phase 14 (background price refresh) can build on the entitlement state API for targeted refresh scheduling
- Crypto markets (ETH, BTC, USDC) continue to route through Lazer; FX tokens without Lazer entitlements fall back to Hermes

## Self-Check: PASSED

- FOUND: pythLazerOracle.ts
- FOUND: index.ts
- FOUND: baseExecutor.ts
- FOUND: 52ed1f2 (task 1 commit)
- FOUND: 13-03-SUMMARY.md

---
*Phase: 13-production-lazer-deployment-and-keeper-optimization*
*Completed: 2026-02-24*
