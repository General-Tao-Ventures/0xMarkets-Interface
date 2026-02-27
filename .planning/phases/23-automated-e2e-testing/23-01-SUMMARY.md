---
phase: 23-automated-e2e-testing
plan: 1
subsystem: testing
tags: [e2e, viem, base-sepolia, deposits, event-detection, tsx]

# Dependency graph
requires:
  - phase: 20-contract-address-audit
    provides: verified contract addresses for all markets and infrastructure
provides:
  - Standalone e2e/ test project with viem, dotenv, tsx
  - Shared config (6 markets, contract addresses, viem clients)
  - Shared helpers (ensureApprovals, waitForExecution, extractOperationKey, formatResults)
  - Working deposit test script covering all 6 markets
affects: [23-02 withdrawal and order tests]

# Tech tracking
tech-stack:
  added: [viem (e2e), tsx (e2e), dotenv (e2e)]
  patterns: [raw topic-based event detection, EventLog2 polling]

key-files:
  created:
    - e2e/config.ts
    - e2e/abis.ts
    - e2e/helpers.ts
    - e2e/test-deposits.ts
    - e2e/package.json
    - e2e/tsconfig.json
  modified: []

key-decisions:
  - "Used raw log topic matching instead of ABI-based decoding for EventEmitter events"
  - "EventLog2 (not EventLog1) is the actual event emitted by deposit/withdrawal/order operations"
  - "Pre-computed keccak256 hashes of event names for efficient topic matching"

patterns-established:
  - "Raw topic matching: use keccak256(eventName) as topic[1] filter, operationKey as topic[2] filter"
  - "Standalone e2e/ project: separate from main app, uses pnpm with COREPACK_ENABLE_STRICT=0"

requirements-completed: [TEST-01]

# Metrics
duration: 12min
completed: 2026-02-27
---

# Phase 23 Plan 1: E2E Test Infrastructure and Deposit Tests Summary

**Standalone e2e/ test project with viem-based deposit tests for all 6 Base Sepolia markets, using raw EventLog2 topic matching for keeper execution verification**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-27T08:14:07Z
- **Completed:** 2026-02-27T08:26:39Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created standalone e2e/ test project with viem, tsx, dotenv (independent of main app's yarn workspace)
- Built shared helpers for operation key extraction, execution polling, USDC minting, and token approvals
- Implemented deposit test that submits 20 USDC deposits to all 6 markets and waits for keeper execution
- Verified end-to-end: WETH/USD deposit submitted and executed by keeper in 1 block

## Task Commits

Each task was committed atomically:

1. **Task 1: Create E2E test project scaffold and shared infrastructure** - `e029979` (feat)
2. **Task 2: Implement deposit E2E test script** - `d8b16dc` (feat)

## Files Created/Modified
- `e2e/package.json` - Minimal deps: viem, dotenv, tsx, typescript
- `e2e/tsconfig.json` - ESNext/NodeNext target with strict mode
- `e2e/config.ts` - Typed config with 6 markets, contract addresses, viem clients
- `e2e/abis.ts` - Minimal ABIs for ExchangeRouter (multicall, sendWnt, sendTokens, createDeposit), EventEmitter (EventLog1), ERC20 (approve, allowance, balanceOf, mint)
- `e2e/helpers.ts` - ensureApprovals, waitForExecution, extractOperationKey, formatResults, sleep
- `e2e/test-deposits.ts` - Deposit test: submits 20 USDC per market, waits for keeper, reports PASS/FAIL
- `e2e/.gitignore` - Excludes node_modules, dist, .env
- `e2e/.env` - RPC URL, chain ID, private key (not committed)

## Decisions Made
- **Raw topic matching over ABI decoding:** The EventEmitter contract's `EventLog2` event uses `EventUtils.EventLogData` (a deeply nested struct with 7 sub-structs) as a parameter. Attempting to decode this with viem's `decodeEventLog` requires the full tuple ABI. Instead, we match events by raw log topics: `topics[1]` = keccak256 of the event name string (e.g., "DepositCreated"), `topics[2]` = operation key. This is simpler, faster, and doesn't require maintaining the complex EventLogData ABI.
- **EventLog2 not EventLog1:** The plan and keeper code reference EventLog1, but the actual deposit/withdrawal/order events use `emitEventLog2()` which adds a `topic2` (account address). EventLog2 has 4 topics (sig + 3 indexed), EventLog1 has 3. Our topic-based approach handles both transparently.
- **COREPACK_ENABLE_STRICT=0 for pnpm:** The root project uses yarn (packageManager field), which prevents pnpm from running in subdirectories. Using this env var override allows the e2e/ project to use pnpm independently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed event ABI mismatch: EventLog2 not EventLog1**
- **Found during:** Task 2 (Deposit test implementation)
- **Issue:** The plan specified using EventLog1 ABI for event detection, but the contract's DepositCreated/DepositExecuted events use `emitEventLog2()`. The keeper's ABI is also wrong (uses EventLog1 with `bytes` eventData instead of the actual complex tuple), but the keeper works because it has a DataStore polling fallback. Our test had no such fallback.
- **Fix:** Replaced ABI-based `decodeEventLog` approach with raw topic matching. Pre-computed keccak256 hashes of event name strings and matched directly against log topics. extractOperationKey reads `topics[2]` for the operation key. waitForExecution filters by `topics[1]` (eventNameHash) and `topics[2]` (operationKey).
- **Files modified:** e2e/helpers.ts
- **Verification:** extractOperationKey correctly parsed real deposit receipt. waitForExecution detected keeper execution within 1 block.
- **Committed in:** d8b16dc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness. Without this fix, extractOperationKey returned null and no execution detection was possible.

## Issues Encountered
- The root package.json `packageManager` field blocks pnpm in subdirectories. Resolved by using `COREPACK_ENABLE_STRICT=0` environment variable.

## User Setup Required
None - no external service configuration required. The e2e/ .env uses the same private key as the keeper service.

## Next Phase Readiness
- Shared helpers (ensureApprovals, waitForExecution, extractOperationKey, formatResults) are ready for Plan 02 (withdrawal and order tests)
- The raw topic matching pattern works for all operation types (Deposit, Withdrawal, Order) since they all use EventLog2
- Keeper must be running for tests to pass (deposits timeout after 60s if keeper is offline)

---
*Phase: 23-automated-e2e-testing*
*Completed: 2026-02-27*
