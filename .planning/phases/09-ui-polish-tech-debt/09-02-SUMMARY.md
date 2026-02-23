---
phase: 09-ui-polish-tech-debt
plan: 02
subsystem: sdk, testing, infra
tags: [typescript, vitest, tech-debt, positions, keeper]

# Dependency graph
requires:
  - phase: 06-position-management
    provides: "Position type system with pendingImpactAmount workaround"
  - phase: 08-keeper-monitoring
    provides: "Keeper services with health endpoints and scan cycles"
provides:
  - "Documented pendingImpactAmount workaround with full usage trace"
  - "Clean test suite (136 pass, 1 skipped, 0 failures)"
  - "Clean tsc --noEmit build"
  - "Keeper efficiency findings with optimization recommendations"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSDoc documentation for contract struct mismatches with full cross-reference"
    - "it.skip() with documented reason for environment-dependent integration tests"

key-files:
  created: []
  modified:
    - "sdk/src/types/positions.ts"
    - "sdk/src/modules/positions/positions.ts"
    - "src/domain/synthetics/positions/usePositions.ts"
    - "src/domain/multichain/fetchMultichainTokenBalances.spec.ts"

key-decisions:
  - "pendingImpactAmount documented rather than removed — used in real calculations (liquidation price, price impact), removing would change many signatures for no functional benefit since 0n is correct when contract lacks the field"
  - "useOrders.ts TypeScript error already resolved in prior phase — confirmed clean"
  - "fetchMultichainTokenBalances test skipped rather than mocked — it's an integration test requiring live Base Mainnet RPC, not suitable for CI"

patterns-established:
  - "Contract struct mismatch documentation: JSDoc at type definition with full cross-reference to all construction and calculation sites"

requirements-completed: [DEBT-01, DEBT-02, DEBT-03, DEBT-04]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 9 Plan 2: Tech Debt Summary

**Documented pendingImpactAmount contract struct mismatch with full usage trace, confirmed clean tsc build, fixed test suite to 0 failures, and investigated keeper execution timing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T19:09:28Z
- **Completed:** 2026-02-23T19:11:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Traced pendingImpactAmount across 23+ files and documented the workaround with comprehensive JSDoc explaining why it defaults to 0n, what calculations use it, and when it can be properly resolved
- Confirmed useOrders.ts TypeScript error was already resolved in a prior phase (PropsStructOutput typing)
- Fixed test suite: skipped unreliable integration test requiring live Base Mainnet RPC, achieving 136 passed / 1 skipped / 0 failures
- Investigated keeper execution timing: order-keeper scans every 10s, price-keeper every 30s, with batch size 100

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve pendingImpactAmount workaround and useOrders.ts TypeScript error** - `69f8d296c` (docs)
2. **Task 2: Fix or skip SDK test failures and investigate keeper efficiency** - `c87c907f6` (fix)

## Files Created/Modified
- `sdk/src/types/positions.ts` - Added comprehensive JSDoc on pendingImpactAmount documenting contract struct mismatch, default behavior, and all calculation sites
- `sdk/src/modules/positions/positions.ts` - Added inline comment at construction site referencing type documentation
- `src/domain/synthetics/positions/usePositions.ts` - Added inline comment at construction site referencing type documentation
- `src/domain/multichain/fetchMultichainTokenBalances.spec.ts` - Skipped integration test with documented reason

## Decisions Made
- **pendingImpactAmount: document, don't remove** — The field is used in real calculations (liquidation price in `getLiquidationPrice()`, proportional impact in `getProportionalPendingImpactValues()`, position net value in `getPositionNetValue()`). With the 0n default, these calculations produce correct results (no impact adjustment applied). Removing the field would require changing function signatures across 15+ files for zero functional benefit. The comprehensive documentation makes the workaround clear for future developers.
- **useOrders.ts: already clean** — The TypeScript error was resolved in a prior phase when the typing was changed from `OrderInfoStructOutput` to `OrderContract.PropsStructOutput`. Confirmed via `tsc --noEmit` passing with zero errors.
- **Test fix approach: skip with documented reason** — The `fetchMultichainTokenBalances` test calls a live RPC endpoint for Base Mainnet. This is an environment-dependent integration test unsuitable for CI. Skipped with a clear reason rather than adding complex mocking.

## Keeper Efficiency Investigation (DEBT-04)

### Current Configuration
| Service | Scan Interval | Batch Size | Config Source |
|---------|--------------|------------|---------------|
| order-execution-keeper | 10s (SCAN_INTERVAL_SECONDS env) | 100 keys per batch | `order-execution-keeper-service/src/config.ts` |
| keeper-service (prices/liquidation) | 30s (SCAN_INTERVAL_SECONDS env) | 100 positions per batch | `keeper-service/src/config.ts` |

### Execution Flow
1. Order-keeper scans DataStore for pending deposits, withdrawals, and orders every 10s
2. For each pending item found, it fetches oracle prices and submits execution transaction
3. Typical end-to-end latency: 10-20s from order creation to execution (1 scan cycle + tx confirmation)

### Optimization Opportunities
1. **Quick win: Reduce order-keeper scan interval from 10s to 3-5s** — The env var `SCAN_INTERVAL_SECONDS` can be changed without code modification. This would reduce worst-case latency from 10s to 3-5s. Low risk since each scan is lightweight (reads DataStore counts).
2. **Quick win: Reduce price-keeper scan interval from 30s to 10-15s** — More frequent price updates improve liquidation detection speed and candle data freshness.
3. **Medium effort: WebSocket event listener** — Instead of polling, subscribe to contract events for new deposits/orders. Would make execution near-instant but requires WebSocket reliability management.
4. **Low priority: Parallel execution** — Currently processes items sequentially within a scan. For demo with few concurrent orders, this is fine. Would matter at scale.

### Recommendation for Demo
Set `SCAN_INTERVAL_SECONDS=5` for order-execution-keeper and `SCAN_INTERVAL_SECONDS=15` for keeper-service. This halves perceived latency with zero code changes — just environment variable updates on the DO server.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All tech debt items resolved: pendingImpactAmount documented, tsc clean, tests clean, keeper findings documented
- Phase 9 plan 1 (UI polish) can proceed independently
- Keeper optimization recommendations ready for implementation (env var changes on DO server)

---
*Phase: 09-ui-polish-tech-debt*
*Completed: 2026-02-23*
