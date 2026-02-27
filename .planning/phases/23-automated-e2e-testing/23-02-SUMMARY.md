---
phase: 23-automated-e2e-testing
plan: 2
subsystem: testing
tags: [e2e, viem, base-sepolia, withdrawals, orders, event-detection]

# Dependency graph
requires:
  - phase: 23-01
    provides: shared e2e infra, config, helpers, deposit tests
provides:
  - Withdrawal E2E test script covering all 6 markets
  - Order E2E test script covering 5/6 markets (JPY/USD skipped — contract bug)
  - Complete 17/18 E2E test coverage (JPY orders pending Phase 24 contract fix)
affects: [phase-24 contract bug fixes]

# Tech tracking
tech-stack:
  added: []
  patterns: [SKIP status for known-broken markets]

key-files:
  created:
    - e2e/test-withdrawals.ts
    - e2e/test-orders.ts
  modified:
    - e2e/abis.ts
    - e2e/helpers.ts

key-decisions:
  - "Fixed createOrder ABI: 3 struct field orderings corrected to match contract (addresses, numbers, outer)"
  - "Added SKIP status to TestResult for markets with known contract bugs"
  - "JPY/USD orders skipped: OrderHandler.sol div-by-zero on reversed markets (Phase 24)"
  - "triggerPrice=0 is correct for MarketIncrease; the revert only happens on reversed markets"

patterns-established:
  - "SKIP_MARKETS set for known-broken markets with clear error message and phase reference"

requirements-completed: [TEST-02, TEST-03]

# Metrics
duration: ~20min (across sessions)
completed: 2026-02-27
---

# Phase 23 Plan 2: Withdrawal and Order E2E Tests Summary

**Withdrawal and market order E2E test scripts for all 6 Base Sepolia markets, completing the test suite at 17/18 pass (JPY/USD orders blocked by contract bug)**

## Performance

- **Duration:** ~20 min (across 2 sessions)
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 2

## Accomplishments
- Created withdrawal test script: submits withdrawals for all 6 markets, verifies keeper execution via EventLog2 polling
- Created order test script: submits MarketIncrease long orders for 5/6 markets (JPY/USD skipped)
- Fixed createOrder ABI field ordering (3 mismatches vs contract struct definitions)
- Added SKIP status support to TestResult type and formatResults output
- Verified 17/18 tests pass: deposits 6/6, withdrawals 6/6, orders 5/6 (JPY skipped)

## Task Commits

1. **Task 1: Implement withdrawal and order E2E test scripts** - `5a8a51e` (feat)
2. **Task 2: Fix ABI, skip JPY/USD, verify results** - `84e2dd8` (fix)

## Files Created/Modified
- `e2e/test-withdrawals.ts` - Withdrawal test: withdraws half of GM tokens per market, waits for keeper execution
- `e2e/test-orders.ts` - Order test: submits 5 USDC / $10 size MarketIncrease long orders, skips JPY/USD
- `e2e/abis.ts` - Fixed createOrder ABI: callbackContract before uiFeeReceiver, initialCollateralDeltaAmount position, decreasePositionSwapType before isLong
- `e2e/helpers.ts` - Added SKIP status to TestResult type and formatResults summary

## Decisions Made
- **Skip JPY/USD orders:** OrderHandler.sol line 51 calls `Precision.mulDiv(FLOAT_PRECISION, FLOAT_PRECISION, triggerPrice)` where triggerPrice=0 causes a div-by-zero revert on reversed markets. JPY/USD is the only reversed market. The triggerPrice=1 workaround was attempted but the inverted value causes downstream validation failures. Tracked as Phase 24 contract fix.
- **ABI field ordering matters:** Viem encodes tuple fields positionally, so the ABI component order must exactly match the Solidity struct. Three mismatches were found and fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed createOrder ABI struct field ordering**
- **Found during:** Checkpoint verification (test-orders.ts producing reverts)
- **Issue:** Three struct fields in the createOrder ABI were in wrong order vs contract: (a) addresses: callbackContract should come before uiFeeReceiver, (b) numbers: initialCollateralDeltaAmount at position 2 not end, (c) outer: decreasePositionSwapType before isLong
- **Fix:** Reordered all three sub-structs to match contract definitions
- **Committed in:** 84e2dd8

**2. [Rule 4 - Known issue] JPY/USD orders cannot be tested**
- **Found during:** Checkpoint verification
- **Issue:** OrderHandler.sol divides by triggerPrice without zero guard on reversed markets
- **Workaround:** Skip JPY/USD in SKIP_MARKETS set with clear error message referencing Phase 24
- **Impact:** 17/18 tests pass instead of 18/18. Phase 24 will fix the contract and remove the skip.

---

**Total deviations:** 2 (1 auto-fixed bug, 1 known issue)
**Impact on plan:** 17/18 tests pass. The missing JPY/USD order test requires a contract fix (Phase 24).

## Issues Encountered
- createOrder ABI field ordering silently encodes wrong values — no type error, just reverts on-chain
- JPY/USD is the only reversed market; all other 5 markets work correctly

## Next Phase Readiness
- Phase 24 (Contract Bug Fixes) should fix OrderHandler div-by-zero, redeploy, and remove JPY/USD from SKIP_MARKETS
- After Phase 24, re-running `pnpm tsx test-orders.ts` should produce 6/6 PASS

---
*Phase: 23-automated-e2e-testing*
*Completed: 2026-02-27*
