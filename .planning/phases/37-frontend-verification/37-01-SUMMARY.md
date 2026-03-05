---
phase: 37-frontend-verification
plan: 01
subsystem: testing
tags: [viem, on-chain-verification, e2e, base-sepolia, datastore, synthetics-reader]

# Dependency graph
requires:
  - phase: 36-e2e-test-suite
    provides: E2E test infrastructure (config, abis, helpers, unified runner)
provides:
  - On-chain state verification script covering pools, positions, orders, and token balances
  - Programmatic JSON summary output for automated comparison
  - Integration into unified E2E test runner as "Frontend Data" suite
affects: [37-02-frontend-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-abi-definition, structured-json-summary-output]

key-files:
  created: [e2e/verify-frontend-data.ts]
  modified: [e2e/run-all.ts]

key-decisions:
  - "Used inline ABI for getAccountOrders matching SDK SyntheticsReader.json (uint8 enums, no updatedAtBlock) instead of abis.ts which has incorrect field types"
  - "GM token totalSupply read via market address since market contract IS the GM token ERC20"

patterns-established:
  - "Correct getAccountOrders ABI: uint8 for orderType/decreasePositionSwapType, 11 fields in numbers (no updatedAtBlock)"
  - "Verification script outputs both human-readable sections and machine-parseable JSON summary"

requirements-completed: [FE-01, FE-02, FE-03, FE-04]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 37 Plan 01: Frontend Data Verification Summary

**On-chain state verification script reading pool balances, positions, orders, and token balances from Base Sepolia contracts with structured JSON output**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T23:54:41Z
- **Completed:** 2026-03-05T00:01:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created comprehensive verification script covering all 4 FE requirements (pools, positions, orders, balances)
- Fixed getAccountOrders ABI mismatch: abis.ts uses incorrect uint256 for enums and includes non-existent updatedAtBlock field
- Integrated into unified E2E test runner, passing in 3.3s

## Task Commits

Each task was committed atomically:

1. **Task 1: Create comprehensive on-chain state verification script** - `8c163da59` (feat)
2. **Task 2: Add verify-frontend to unified test runner** - `4ac5947a6` (feat)

## Files Created/Modified
- `e2e/verify-frontend-data.ts` - Reads pool USDC amounts, GM supply, positions, orders, and token balances from on-chain contracts; outputs structured results with JSON summary
- `e2e/run-all.ts` - Added "Frontend Data" suite entry with 60s timeout

## Decisions Made
- Used inline ABI for getAccountOrders instead of importing from abis.ts, because the shared ABI has an incorrect struct definition (uint256 for enum types, extra updatedAtBlock field) that causes viem decode failures. The inline ABI matches the SDK's SyntheticsReader.json exactly.
- GM token totalSupply is read directly from the market address, since in GMX the market contract IS the GM token ERC20.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getAccountOrders ABI mismatch**
- **Found during:** Task 1 (verification script creation)
- **Issue:** The syntheticsReaderAbi in abis.ts defines orderType as uint256 and includes an extra updatedAtBlock field. The actual contract uses uint8 for orderType/decreasePositionSwapType and has only 11 fields in the numbers struct (no updatedAtBlock). This caused viem to fail with "Bytes value is not a valid boolean" because the field offset was shifted by one slot.
- **Fix:** Defined correct getAccountOrders ABI inline in verify-frontend-data.ts matching the SDK's SyntheticsReader.json. Did NOT modify abis.ts to avoid breaking existing tests that may work around the issue differently.
- **Files modified:** e2e/verify-frontend-data.ts
- **Verification:** Script successfully decodes 51 pending orders
- **Committed in:** 8c163da59 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** ABI fix was necessary for order verification to function. No scope creep.

## Issues Encountered
None beyond the ABI mismatch documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- On-chain verification script provides ground truth for Plan 02 (human checkpoint)
- Plan 02 can compare frontend UI against the structured output from this script
- The existing abis.ts getAccountOrders definition should be fixed in a future maintenance pass

---
*Phase: 37-frontend-verification*
*Completed: 2026-03-04*
