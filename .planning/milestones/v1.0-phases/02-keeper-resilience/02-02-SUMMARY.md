---
phase: 02-keeper-resilience
plan: 02
subsystem: api
tags: [viem, prisma, deposit-cancellation, keeper, on-chain, controller-role, lifecycle]

# Dependency graph
requires:
  - phase: 02-keeper-resilience
    provides: "Retry loop with backoff and errorReason/retryCount Prisma fields from plan 02-01"
  - phase: 01-core-execution
    provides: "DepositScanner, DataStoreContract, DepositExecutor, deposit-handler ABI"
provides:
  - "Expired deposit detection via DataStore REQUEST_EXPIRATION_TIME comparison"
  - "On-chain deposit cancellation via DepositHandler.cancelDeposit()"
  - "CONTROLLER role grant script for keeper wallet"
  - "LIFE-03 restart recovery documentation in depositScanner.ts"
  - "cancelExpiredDeposits() wired into 5-minute cleanup cycle"
affects: [ui-feedback, withdrawal-executor, order-executor]

# Tech tracking
tech-stack:
  added: []
  patterns: [on-chain-cancellation, role-based-access-control, expiry-detection]

key-files:
  created:
    - "order-execution-keeper-service/scripts/grant-keeper-controller-role.mjs"
  modified:
    - "order-execution-keeper-service/src/core/blockchain/contracts/abis/deposit-handler.ts"
    - "order-execution-keeper-service/src/core/blockchain/contracts/dataStore.ts"
    - "order-execution-keeper-service/src/core/utils/keys.ts"
    - "order-execution-keeper-service/src/core/scanners/depositScanner.ts"
    - "order-execution-keeper-service/src/index.ts"

key-decisions:
  - "encodeAbiParameters (not encodePacked) for CONTROLLER role hash to match Solidity abi.encode"
  - "cancelExpiredDeposits runs in cleanup cycle (5min), not scan cycle (10s) — expiry is not time-critical"
  - "Expiration disabled on-chain (requestExpirationTime == 0n) means skip cancellation silently"

patterns-established:
  - "Role grant pattern: standalone .mjs script using viem, run once with DEPLOYER_KEY env var"
  - "On-chain cancellation pattern: read expiry from DataStore, compare with deposit updatedAtTime, cancel via handler"

requirements-completed: [LIFE-01, LIFE-03]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 2 Plan 2: Expired Deposit Cancellation Summary

**On-chain expired deposit cancellation via DepositHandler.cancelDeposit() with CONTROLLER role grant and LIFE-03 restart recovery documentation, deployed to DO server**

## Performance

- **Duration:** 5 min (continuation from checkpoint; total including user actions ~30 min)
- **Started:** 2026-02-20T17:38:41Z
- **Completed:** 2026-02-20T17:43:24Z
- **Tasks:** 3
- **Files modified:** 6 + 1 created

## Accomplishments
- Added cancelDeposit ABI, getUint on DataStoreContract, and REQUEST_EXPIRATION_TIME_KEY to detect and cancel expired deposits on-chain
- Created grant-keeper-controller-role.mjs script and granted CONTROLLER role to keeper wallet 0x48Cb0d738C9B3F44F60f7338F788fa093FD25828 on Base Sepolia
- Documented LIFE-03 restart recovery in depositScanner.ts scan() method (deposits created during downtime picked up on next cycle)
- Deployed full Phase 2 suite to DigitalOcean server with Prisma migration applied, verified clean startup

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement expired deposit cancellation infrastructure and logic** - `1c56f7f` (feat)
2. **Task 2: Grant CONTROLLER role to keeper wallet** - `cf9ad93` (fix: encodeAbiParameters for role hash)
3. **Task 3: Deploy to DO server and verify** - No local commit (deployment verification only)

## Files Created/Modified
- `order-execution-keeper-service/src/core/blockchain/contracts/abis/deposit-handler.ts` - Added cancelDeposit ABI entry
- `order-execution-keeper-service/src/core/blockchain/contracts/dataStore.ts` - Added getUint method for reading uint256 from DataStore
- `order-execution-keeper-service/src/core/utils/keys.ts` - Added REQUEST_EXPIRATION_TIME_KEY constant
- `order-execution-keeper-service/src/core/scanners/depositScanner.ts` - Added cancelExpiredDeposits() method and LIFE-03 documentation
- `order-execution-keeper-service/src/index.ts` - Wired cancelExpiredDeposits() into cleanup cycle
- `order-execution-keeper-service/scripts/grant-keeper-controller-role.mjs` - One-time CONTROLLER role grant script

## Decisions Made
- Used encodeAbiParameters (not encodePacked) to compute CONTROLLER role hash, matching Solidity's `keccak256(abi.encode("CONTROLLER"))` pattern. The grant script initially used encodePacked which produced a different hash; this was caught and fixed before the on-chain grant.
- cancelExpiredDeposits() runs in the 5-minute cleanup cycle rather than the 10-second scan cycle because expiry detection is not latency-sensitive.
- When REQUEST_EXPIRATION_TIME is 0 on-chain, cancellation is silently skipped (expiry disabled).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed encodePacked to encodeAbiParameters in grant script**
- **Found during:** Task 2 (grant CONTROLLER role)
- **Issue:** grant-keeper-controller-role.mjs used `encodePacked(['string'], ['CONTROLLER'])` which produces `keccak256("CONTROLLER")` — but Solidity's Keys.sol uses `keccak256(abi.encode("CONTROLLER"))` which pads to 32 bytes
- **Fix:** Changed to `encodeAbiParameters([{ type: 'string' }], ['CONTROLLER'])` to match the on-chain hash
- **Files modified:** scripts/grant-keeper-controller-role.mjs
- **Verification:** On-chain hasRole returns true with the corrected hash 0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b
- **Committed in:** cf9ad93

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix — incorrect role hash would have caused all cancelDeposit calls to revert with unauthorized error.

## Issues Encountered
- "Dropping duplicate message" WebSocket spam continues to flood keeper logs (pre-existing, documented in STATE.md blockers, not in scope for this plan)
- npx not available on DO server directly; Prisma migration runs inside Docker CMD automatically — no manual migration step needed

## User Setup Required
None for ongoing operation. The CONTROLLER role has been granted on-chain (one-time operation, already completed).

## Next Phase Readiness
- Phase 2 complete: retry logic, error recording, expired deposit cancellation, and restart recovery all deployed
- Keeper running on DO server with full resilience suite active
- Ready for Phase 3 (UI Feedback) which depends on Phase 2

## Verification Results
- Docker build: TypeScript compiled cleanly (pnpm build succeeded)
- Prisma migration: errorReason and retryCount columns present in deposit_requests table
- Container: Running and healthy (health endpoint returns {"status":"ok"})
- Scanner: Active, tracking 6 deposits in DEPOSIT_LIST
- Cleanup cycle: cancelExpiredDeposits wired in, runs after cleanupStaleDeposits

## Self-Check: PASSED

- SUMMARY.md exists at .planning/phases/02-keeper-resilience/02-02-SUMMARY.md
- Commit `1c56f7f` found in git log (Task 1)
- Commit `cf9ad93` found in git log (Task 2)
- All 6 modified/created files verified on disk

---
*Phase: 02-keeper-resilience*
*Completed: 2026-02-20*
