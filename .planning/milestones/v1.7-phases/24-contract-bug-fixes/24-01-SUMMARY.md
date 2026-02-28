---
phase: 24-contract-bug-fixes
plan: 01
subsystem: contracts
tags: [solidity, hardhat-deploy, base-sepolia, division-by-zero, reversed-markets]

# Dependency graph
requires:
  - phase: 23-automated-e2e-testing
    provides: "E2E tests that documented the JPY/USD division-by-zero bug (17/18 pass)"
provides:
  - "Fixed OrderHandler.sol with zero-guards on reversed market price inversion"
  - "New OrderHandler deployed at 0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad"
  - "New ExchangeRouter deployed at 0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321"
  - "Both contracts have CONTROLLER, ROUTER_PLUGIN, and ReferralStorage roles granted"
affects: [24-02-PLAN, 25-liquidation-pipeline-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["zero-guard before Precision.mulDiv on potentially-zero values in Solidity"]

key-files:
  created: []
  modified:
    - "../0xmarkets_contract/contracts/exchange/OrderHandler.sol"
    - "../0xmarkets_contract/deployments/baseSepolia/OrderHandler.json"
    - "../0xmarkets_contract/deployments/baseSepolia/ExchangeRouter.json"

key-decisions:
  - "Zero-guard pattern: check != 0 before mulDiv instead of using SafeMath wrapper -- simpler, zero stays zero after reversal"
  - "Roles granted via individual hardhat scripts instead of afterDeploy hooks due to Base Sepolia nonce conflicts"

patterns-established:
  - "Zero-guard before Precision.mulDiv: always guard division when denominator could be zero from user defaults"

requirements-completed: [CFIX-01, CFIX-02]

# Metrics
duration: ~25min
completed: 2026-02-27
---

# Phase 24 Plan 01: Contract Bug Fix and Deploy Summary

**Zero-guard fix for reversed market division-by-zero in OrderHandler.sol, deployed atomically with ExchangeRouter to Base Sepolia**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-27T22:00:00Z
- **Completed:** 2026-02-27T22:26:24Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Fixed division-by-zero bug in OrderHandler.sol that caused all JPY/USD market orders to revert
- Deployed fixed OrderHandler to Base Sepolia at 0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad
- Deployed new ExchangeRouter to Base Sepolia at 0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321 pointing to the new OrderHandler
- Verified on-chain linkage: ExchangeRouter.orderHandler() returns correct address
- All roles granted: CONTROLLER, ROUTER_PLUGIN, ReferralStorage handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply zero-guard fix to OrderHandler.sol** - `aed293e8` (fix) -- in 0xmarkets_contract repo
2. **Task 2: Deploy OrderHandler and ExchangeRouter to Base Sepolia** - `90bb2b00` (feat) -- in 0xmarkets_contract repo
3. **Task 3: Verify deployment on Basescan** - checkpoint:human-verify, approved by user

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `../0xmarkets_contract/contracts/exchange/OrderHandler.sol` - Added zero-guards on triggerPrice and acceptablePrice before Precision.mulDiv in reversed market block
- `../0xmarkets_contract/deployments/baseSepolia/OrderHandler.json` - New deployment artifact with address 0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad
- `../0xmarkets_contract/deployments/baseSepolia/ExchangeRouter.json` - New deployment artifact with address 0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321

## Decisions Made
- **Zero-guard pattern:** Wrapped each `Precision.mulDiv` call with `if (value != 0)` rather than using a SafeMath-style wrapper. This is simpler and semantically correct -- a zero triggerPrice means "no trigger" (market order default), so zero should stay zero after reversal.
- **Role granting via scripts:** The afterDeploy hooks in the deploy scripts encountered nonce conflicts on Base Sepolia. Roles were granted via individual hardhat scripts instead. Same end result, different execution path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Roles granted via individual scripts instead of afterDeploy hooks**
- **Found during:** Task 2 (Deploy contracts)
- **Issue:** Base Sepolia nonce conflicts caused afterDeploy hooks to fail when granting roles
- **Fix:** Granted CONTROLLER, ROUTER_PLUGIN, and ReferralStorage handler roles via individual hardhat scripts
- **Files modified:** None (scripts already existed, deployment artifacts updated)
- **Verification:** On-chain verification via cast call confirmed all roles present
- **Committed in:** 90bb2b00 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Role granting method changed but end state is identical. No scope creep.

## Issues Encountered
- Base Sepolia nonce conflicts during deployment required running role grants as separate transactions rather than in afterDeploy hooks. This is a known testnet issue with shared wallets.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- New contract addresses ready for propagation to all services (Plan 02: 24-02-PLAN.md)
- OrderHandler: 0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad
- ExchangeRouter: 0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321
- Plan 02 will update: interface SDK, order-execution-keeper, keeper-service, E2E tests, and remove the JPY/USD skip

## Self-Check: PASSED

- FOUND: commit aed293e8 (Task 1)
- FOUND: commit 90bb2b00 (Task 2)
- FOUND: 24-01-SUMMARY.md
- FOUND: OrderHandler.sol
- FOUND: OrderHandler deployment artifact
- FOUND: ExchangeRouter deployment artifact

---
*Phase: 24-contract-bug-fixes*
*Completed: 2026-02-27*
