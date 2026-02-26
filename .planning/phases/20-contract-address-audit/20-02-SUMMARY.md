---
phase: 20-contract-address-audit
plan: 02
subsystem: infra
tags: [contract-addresses, base-sepolia, sdk-prebuild, keeper-config, audit]

# Dependency graph
requires:
  - phase: 20-contract-address-audit (plan 01)
    provides: "Audit report with 35 infrastructure address mismatches identified"
provides:
  - "All 35 stale infrastructure addresses corrected across Interface SDK, keeper .env files, squid, and docs"
  - "SDK prebuilt hashed keys regenerated for new contract addresses"
  - "Audit verification script confirms 89/89 address matches (zero mismatches)"
  - "Smoke test deposits confirmed for 4/6 markets (remaining 2 blocked by low testnet ETH, not addresses)"
affects: [keeper-execution-fixes, frontend-feedback, e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Two-pass audit approach: discover mismatches (Plan 01) then fix all at once (Plan 02)"]

key-files:
  created: []
  modified:
    - "sdk/src/configs/contracts.ts"
    - "sdk/src/prebuilt/hashedKinkModelMarketRatesKeys.json"
    - "sdk/src/prebuilt/hashedMarketConfigKeys.json"
    - "sdk/src/prebuilt/hashedMarketValuesKeys.json"
    - "keeper-service/.env (local only)"
    - "order-execution-keeper-service/.env (local only)"
    - "0xMarkets-squid/src/processor.ts"
    - "docs/keeper-infrastructure.md (local only)"
    - ".claude/contract-address-update-guide.md (local only)"
    - ".planning/phases/20-contract-address-audit/20-AUDIT-REPORT.md"

key-decisions:
  - "Keeper .env files updated locally only (gitignored, contain private keys) -- cloud update requires manual deployment"
  - "4/6 smoke tests passing is sufficient proof of address correctness; GOLD/JPY failures traced to depleted testnet ETH (0.0007 ETH < 0.001 execution fee)"
  - "docs/ directory is not version-controlled; keeper-infrastructure.md updated locally"

patterns-established:
  - "Audit verification script at 0xmarkets_contract/scripts/auditAddresses.ts can re-verify all 89 address checks at any time"
  - "Smoke test script at 0xmarkets_contract/scripts/testAllMarkets.ts tests deposits across all 6 markets"

requirements-completed: [AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04]

# Metrics
duration: 17min
completed: 2026-02-26
---

# Phase 20 Plan 02: Apply Address Fixes Summary

**Updated 35 stale infrastructure contract addresses across 5 services, verified 89/89 on-chain matches, confirmed 4/6 deposit smoke tests pass**

## Performance

- **Duration:** 17 min
- **Started:** 2026-02-26T22:15:11Z
- **Completed:** 2026-02-26T22:33:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 10 (4 committed, 6 local-only)

## Accomplishments

- Fixed all 10 infrastructure contract addresses in Interface SDK contracts.ts (DataStore, EventEmitter, ExchangeRouter, Reader, Router, DepositVault, WithdrawalVault, OrderVault, ShiftVault, ReferralStorage)
- Regenerated 3 SDK prebuilt hashed key files via `yarn prebuild`
- Updated 6 addresses in keeper-service .env and 8 addresses in order-execution-keeper-service .env
- Updated EventEmitter address in squid processor.ts
- Updated all market + infrastructure addresses in docs/keeper-infrastructure.md
- Re-ran audit script: 89/89 checks MATCH, zero mismatches
- Smoke test confirmed deposits work for WETH, WBTC, EUR, GBP markets (GOLD/JPY blocked by low testnet ETH)

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply all address fixes** - `02cd63d8a` (fix) in Interface repo, `3dd09bd` (fix) in Squid repo
2. **Task 2: Re-run verification and smoke test** - `e6cc11489` (docs) - audit report updated with fixes applied section
3. **Task 3: Human verification checkpoint** - approved (keeper restart + frontend check deferred to user)

## Files Created/Modified

- `sdk/src/configs/contracts.ts` - Updated 10 infrastructure + 2 V1 alias addresses to match on-chain deployment
- `sdk/src/prebuilt/hashedKinkModelMarketRatesKeys.json` - Regenerated (84 lines changed)
- `sdk/src/prebuilt/hashedMarketConfigKeys.json` - Regenerated (612 lines changed)
- `sdk/src/prebuilt/hashedMarketValuesKeys.json` - Regenerated (168 lines changed)
- `keeper-service/.env` - 6 addresses updated (local only, gitignored)
- `order-execution-keeper-service/.env` - 8 addresses updated (local only, gitignored)
- `0xMarkets-squid/src/processor.ts` - EventEmitter address updated
- `docs/keeper-infrastructure.md` - All market + infrastructure addresses updated (local only, no VCS)
- `.claude/contract-address-update-guide.md` - Infrastructure addresses updated + handlers added (local only, gitignored)
- `.planning/phases/20-contract-address-audit/20-AUDIT-REPORT.md` - Added "Fixes Applied" section with before/after tables and verification results

## Decisions Made

- Keeper .env files contain private keys and are gitignored; updates applied locally, cloud deployment is a manual step for the team
- 4/6 smoke test pass rate accepted as sufficient proof: the audit script's 89/89 match definitively proves all addresses are correct, and the 2 failures are traced to insufficient testnet ETH (wallet had 0.0007 ETH, each deposit needs 0.001 ETH execution fee)
- docs/ directory has no version control; changes applied but cannot be committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated contract-address-update-guide.md**
- **Found during:** Task 1 (address fixes)
- **Issue:** The audit report (Section 6) identified that `.claude/contract-address-update-guide.md` had stale infrastructure addresses and was missing handler addresses entirely
- **Fix:** Updated all infrastructure addresses and added LiquidationHandler, DepositHandler, WithdrawalHandler, OrderHandler, AdlHandler
- **Files modified:** `.claude/contract-address-update-guide.md`
- **Verification:** Visual inspection confirms addresses match on-chain
- **Committed in:** N/A (gitignored directory)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for completeness of the address update guide. No scope creep.

## Issues Encountered

- **Smoke test partial failure:** GOLD/USD and JPY/USD deposits reverted because the keeper wallet ran out of testnet ETH after 4 successful deposits. Each deposit requires 0.001 ETH execution fee, but the wallet only had ~0.0047 ETH. This is a testnet funding issue, not an address problem. The audit verification script's 89/89 match confirms all addresses are correct.
- **Keeper .env not committable:** Both keeper service .env files are gitignored because they contain private keys and API tokens. The address fixes are applied locally but require manual cloud deployment.

## User Setup Required

The following manual steps are needed for full deployment:

1. **Cloud keeper restart:** Update .env files on DigitalOcean for both keeper-service and order-execution-keeper-service with the new addresses (see audit report Section 10c and 10d)
2. **Testnet ETH top-up:** Fund keeper wallet `0x9724251d7DeC79FB5C41F31b2793892831Bf1200` with at least 0.1 ETH for continued testing
3. **Squid redeployment:** The squid indexer needs to be redeployed/reindexed with the new EventEmitter address

## Next Phase Readiness

- All contract addresses verified correct (89/89 on-chain matches)
- Phase 21 (Keeper Execution Fixes) can proceed -- execution failures are now real bugs, not stale config
- Frontend should show all 6 markets with prices once keepers are restarted with new .env

---
*Phase: 20-contract-address-audit*
*Completed: 2026-02-26*
