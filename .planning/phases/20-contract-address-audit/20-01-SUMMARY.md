---
phase: 20-contract-address-audit
plan: 01
subsystem: infra
tags: [hardhat, ethers, datastore, on-chain-audit, address-verification]

# Dependency graph
requires: []
provides:
  - "Automated audit script (auditAddresses.ts) for on-chain vs config address verification"
  - "Comprehensive audit report (20-AUDIT-REPORT.md) with 35 mismatches across 5 services"
  - "Complete fix checklist with correct on-chain addresses for Plan 20-02"
affects: [20-02-address-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns: ["On-chain DataStore key hashing via hashData/hashString for market parameter reads"]

key-files:
  created:
    - "0xmarkets_contract/scripts/auditAddresses.ts"
    - ".planning/phases/20-contract-address-audit/20-AUDIT-REPORT.md"
  modified: []

key-decisions:
  - "Used Hardhat deployment artifacts (deployments/baseSepolia/) as source of truth for on-chain contract addresses rather than hardcoded values"
  - "Script reads cross-repo config files via fs.readFileSync with relative paths from contracts repo root"
  - "Oracle provider address verified by reading ORACLE_PROVIDER_FOR_TOKEN key from DataStore for each token"

patterns-established:
  - "Audit-then-fix: Run auditAddresses.ts before and after config changes to verify correctness"
  - "On-chain source of truth: Always verify against DataStore state, not deployment artifacts"

requirements-completed: [AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04]

# Metrics
duration: 8min
completed: 2026-02-26
---

# Phase 20 Plan 01: Contract Address Audit Summary

**Automated on-chain audit found 35 infrastructure address mismatches across Interface, both keepers, Squid, and docs -- all market/token addresses correct**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-26T22:04:36Z
- **Completed:** 2026-02-26T22:12:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created reusable Hardhat audit script that reads all 6 markets, 7 tokens, and oracle config from on-chain DataStore
- Identified 35 stale infrastructure contract addresses across 5 services (Interface SDK, Keeper, Order Keeper, Squid, Docs)
- Confirmed all 6 market token addresses and all 7 token addresses are correct across all services
- Verified all 6 markets are healthy (non-zero reserve factors, OI limits, pool caps, enabled)
- Produced complete fix checklist with exact file paths, field names, current values, and correct values for Plan 20-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the automated audit verification script** - `619f002c` (feat)
2. **Task 2: Run the audit script and produce the audit report** - `531a2f75b` (feat)

## Files Created/Modified
- `0xmarkets_contract/scripts/auditAddresses.ts` - Hardhat script that reads on-chain DataStore state and compares against all service config files
- `.planning/phases/20-contract-address-audit/20-AUDIT-REPORT.md` - Comprehensive audit report with discrepancy tables and fix checklist

## Decisions Made
- Script uses `ethers.getContract()` from Hardhat deployment artifacts to resolve on-chain contract addresses, making it dependent on `deployments/baseSepolia/` being up to date
- Asset token addresses (EUR, GBP, GOLD, JPY) verified via DataStore `ASSET_TOKEN` key rather than deployment artifacts since they are generated at deploy time
- WBTC identified by exclusion -- the market index token that is neither a synthetic asset nor WETH

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed variable hoisting issue in audit script**
- **Found during:** Task 1 (Writing audit script)
- **Issue:** `onChainEventEmitter` and `onChainRef` variables were used in keeper .env comparison sections before being declared later in the file
- **Fix:** Hoisted contract address fetching to before the comparison sections, removed duplicate declarations
- **Files modified:** `0xmarkets_contract/scripts/auditAddresses.ts`
- **Verification:** Script compiled and ran successfully against Base Sepolia
- **Committed in:** `619f002c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix was necessary for script correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audit report provides complete fix checklist for Plan 20-02
- Script can be re-run after fixes to verify 0 mismatches
- Key finding: 35 infrastructure contract addresses need updating across 5 services, while all market and token addresses are correct

## Self-Check: PASSED

- FOUND: `0xmarkets_contract/scripts/auditAddresses.ts`
- FOUND: `.planning/phases/20-contract-address-audit/20-AUDIT-REPORT.md`
- FOUND: `.planning/phases/20-contract-address-audit/20-01-SUMMARY.md`
- FOUND: commit `619f002c`
- FOUND: commit `531a2f75b`

---
*Phase: 20-contract-address-audit*
*Completed: 2026-02-26*
