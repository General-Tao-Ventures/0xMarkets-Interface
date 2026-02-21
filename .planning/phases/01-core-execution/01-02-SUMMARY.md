---
phase: 01-core-execution
plan: 02
subsystem: infra
tags: [docker, digitalocean, ssh, rsync, viem, base-sepolia, pyth-lazer, keeper, deposit, e2e]

# Dependency graph
requires:
  - phase: 01-core-execution plan 01
    provides: "Fixed keeper code (ghost key guard, oracle token guard, waitForTransactionReceipt) and standalone test-deposit.mjs script"
provides:
  - "End-to-end deposit execution verified on Base Sepolia with real GM tokens minted"
  - "Test deposit script fix: ETH/USD market uses mUSDC as both longToken and shortToken"
  - "Keeper deployed to DigitalOcean server with all Plan 01 fixes active"
affects: [02-keeper-resilience, production-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deploy via rsync + Docker rebuild: sync local code, rebuild container on server"
    - "E2E deposit verification: test script polls GM balance with createDeposit + keeper execution"

key-files:
  created: []
  modified:
    - "/Users/ken/Projects/0xM/order-execution-keeper-service/scripts/test-deposit.mjs"

key-decisions:
  - "ETH/USD market uses mUSDC as BOTH longToken and shortToken: WETH is only the indexToken for price feeds, not a deposit token — using WETH as initialLongToken caused InvalidSwapOutputToken(WETH, mUSDC) on keeper execution"
  - "InvalidSwapOutputToken was a test script bug, not a keeper pipeline bug: keeper oracle and execution logic was correct all along"

patterns-established:
  - "Market token role distinction: indexToken drives price lookup, longToken/shortToken are the actual deposit tokens"

requirements-completed: [EXEC-01, EXEC-02]

# Metrics
duration: 20min
completed: 2026-02-20
---

# Phase 1 Plan 02: Deploy and End-to-End Deposit Verification Summary

**Keeper deployed to DigitalOcean via rsync+Docker rebuild, E2E verified: createDeposit detected in 10s, prices pushed, executeDeposit succeeded in 13s, 0.99995009 GM minted to wallet**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-02-20T05:32:00Z
- **Completed:** 2026-02-20T05:52:14Z
- **Tasks:** 1 auto + 1 human-verify (both complete)
- **Files modified:** 1 (test-deposit.mjs fix in keeper-service repo)

## Accomplishments

- Deployed fixed keeper code from Plan 01 to DigitalOcean server via rsync + Docker rebuild
- Discovered and fixed `InvalidSwapOutputToken(WETH, mUSDC)` error: test script was using WETH as `initialLongToken` but the ETH/USD market uses mUSDC for both longToken and shortToken
- Ran end-to-end test deposit that fully succeeded: createDeposit mined, keeper detected in 10s, Pyth Lazer prices pushed, executeDeposit called and confirmed
- GM tokens minted: 0.99995009 to wallet 0xe96128886A27067D373ea44B3F3c8f25A182F886
- All 3 Phase 1 success criteria met

## Task Commits

Each task was committed atomically (commits in `order-execution-keeper-service` repo):

1. **Task 1: Fix test deposit script and deploy to DO server** - `3e7a65a` (fix) — in keeper-service repo

**Plan metadata (Interface repo):** `3fa293ae6` — "Mark Phase 1 complete: end-to-end deposit execution verified" (ROADMAP.md + STATE.md)

## Files Created/Modified

- `/Users/ken/Projects/0xM/order-execution-keeper-service/scripts/test-deposit.mjs` - Fixed `initialLongToken` from WETH to mUSDC — ETH/USD market uses mUSDC for both long and short token sides; WETH is only the index token for price feeds

## Decisions Made

- ETH/USD market token roles clarified: `indexToken=WETH` is used only for Pyth price lookup, `longToken=shortToken=mUSDC` are the actual deposit tokens. The keeper's oracle param building (which includes WETH for prices) was correct. The test script's `initialLongToken=WETH` was the bug.
- The keeper pipeline (oracle price push + executeDeposit call) was correct from Plan 01 — no keeper code changes needed in this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test deposit script using wrong initialLongToken**
- **Found during:** Task 1 (run test deposit script)
- **Issue:** `test-deposit.mjs` used WETH address as `initialLongToken` in the createDeposit call. The ETH/USD market contract has `indexToken=WETH` but `longToken=shortToken=mUSDC`. Using WETH caused `InvalidSwapOutputToken(WETH, mUSDC)` when the keeper tried to execute the deposit.
- **Fix:** Changed `initialLongToken` from WETH address to mUSDC address in the test script
- **Files modified:** `scripts/test-deposit.mjs`
- **Verification:** Re-ran test — deposit executed successfully in 13s, 0.99995009 GM minted
- **Committed in:** `3e7a65a` in keeper-service repo

---

**Total deviations:** 1 auto-fixed (1 bug in test script)
**Impact on plan:** The bug was in the test script, not the keeper pipeline. The fix was minimal and confirmed that the keeper code from Plan 01 was already correct. No scope creep.

## Verification Results

All 3 Phase 1 success criteria confirmed:

1. **Detection within scan cycle**: Keeper detected the fresh createDeposit within the 10s scan cycle
2. **Oracle freshness**: Pyth Lazer prices pushed and executeDeposit called well within the 300s oracle freshness window (13s total execution time)
3. **GM tokens minted**: executeDeposit tx succeeded on-chain

**Block explorer verification:**
- Deposit TX: `0x90d2d1481b1c804c21c8c88ee2538ab7acf5c64a00c8e482b7f91ca67bb9ed46` (block 37908181)
- Execution TX: `0x5cb80e75583195968c814c87533f1781a2bec4044f068c77d3ed00456528d2b7` (block 37908189)
- Keeper wallet: `0x48Cb0d738C9B3F44F60f7338F788fa093FD25828`
- GM tokens minted: 0.99995009 to `0xe96128886A27067D373ea44B3F3c8f25A182F886`
- Total execution time: 13 seconds

## Issues Encountered

The `InvalidSwapOutputToken` error was initially confusing because it appeared to be a keeper pipeline failure. Investigation showed the keeper's oracle params and executeDeposit call were correct — the root cause was the test script passing WETH as `initialLongToken` when the market expects mUSDC. Once the script was corrected, the first re-run succeeded immediately.

## User Setup Required

None — keeper is deployed and running on the DO server. No additional configuration required.

## Next Phase Readiness

- Phase 1 complete: end-to-end deposit execution verified on Base Sepolia
- Keeper is running on DO server with all fixes active
- Ready for Phase 2: Keeper Resilience (retry logic, error recording, expired deposit cancellation)

## Self-Check: PASSED

- FOUND: `/Users/ken/Projects/0xM/0xMarkets-Interface/.planning/phases/01-core-execution/01-02-SUMMARY.md`
- FOUND: Commit `3e7a65a` in keeper-service repo (Fix test deposit: use mUSDC as initialLongToken)
- FOUND: Commit `3fa293ae6` in interface repo (Mark Phase 1 complete)
- Block explorer TX hashes match STATE.md Key Verification Results
- All 3 Phase 1 success criteria confirmed in STATE.md

---
*Phase: 01-core-execution*
*Completed: 2026-02-20*
