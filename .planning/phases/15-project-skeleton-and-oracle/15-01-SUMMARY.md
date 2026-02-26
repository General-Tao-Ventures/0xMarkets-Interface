---
phase: 15-project-skeleton-and-oracle
plan: 01
subsystem: infra
tags: [typescript, viem, pyth-lazer-sdk, keeper, docker]

# Dependency graph
requires: []
provides:
  - "Clean TypeScript project skeleton for order-execution-keeper-service"
  - "Fail-fast config.ts with required()/requiredHex() helpers"
  - "DataStore key constants in keys.ts using encodeAbiParameters"
  - "Consolidated ABIs in abis.ts (dataStore, eventEmitter, depositHandler, withdrawalHandler, orderHandler, reader)"
  - "Stripped package.json with pyth-lazer-sdk pinned to exactly 5.2.0"
  - "Simplified Dockerfile with no Prisma and 30s start-period"
affects: [15-02-oracle-module, 16-keeper-logic]

# Tech tracking
tech-stack:
  added: []
  patterns: [fail-fast-config, verbatim-key-encoding, consolidated-abis]

key-files:
  created:
    - "order-execution-keeper-service/src/config.ts"
    - "order-execution-keeper-service/src/keys.ts"
    - "order-execution-keeper-service/src/abis.ts"
  modified:
    - "order-execution-keeper-service/package.json"
    - "order-execution-keeper-service/tsconfig.json"
    - "order-execution-keeper-service/Dockerfile"

key-decisions:
  - "Pinned pyth-lazer-sdk to exactly 5.2.0 (no caret) to avoid Node ^24 engine requirement in 5.2.1+"
  - "Used console.error for config failures instead of pino logger to avoid circular dependency"
  - "Kept PYTH_PRO_ACCESS_TOKEN env var name (not PYTH_LAZER_TOKEN) to match existing .env on server"

patterns-established:
  - "Fail-fast config: required() helper exits with FATAL on missing env vars"
  - "Key encoding: always use encodeAbiParameters, never encodePacked for DataStore keys"
  - "ABI consolidation: single abis.ts file with all contract ABIs as const arrays"

requirements-completed: [ORCL-02]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 15 Plan 01: Project Skeleton Summary

**Gutted 3,000+ line keeper codebase and rebuilt clean TypeScript skeleton with fail-fast config, DataStore keys, and consolidated ABIs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T05:34:59Z
- **Completed:** 2026-02-26T05:37:57Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Deleted all old code: prisma/, src/core/, src/server/, src/test/, src/utils/, src/config/ (7,931 lines removed)
- Created config.ts with fail-fast env var validation using required()/requiredHex() helpers that call process.exit(1) on missing vars
- Created keys.ts with 5 DataStore key constants ported verbatim using encodeAbiParameters (not encodePacked)
- Created abis.ts consolidating all 6 contract ABIs from scattered files into one
- Stripped package.json to minimal deps with pyth-lazer-sdk pinned to exactly 5.2.0
- Simplified tsconfig.json to target ES2022 and Dockerfile to remove all Prisma references

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete old code and update project config** - `467d0b8` (chore)
2. **Task 2: Create config.ts, keys.ts, and abis.ts** - `80656ee` (feat)

## Files Created/Modified
- `order-execution-keeper-service/src/config.ts` - Fail-fast env var loading with required()/requiredHex() helpers, exports config object with all contract addresses, RPC URLs, oracle provider
- `order-execution-keeper-service/src/keys.ts` - DataStore key constants (DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST, REQUEST_EXPIRATION_TIME, MAX_ORACLE_PRICE_AGE) using encodeAbiParameters
- `order-execution-keeper-service/src/abis.ts` - Consolidated ABIs for dataStore, eventEmitter, depositHandler, withdrawalHandler, orderHandler, reader contracts
- `order-execution-keeper-service/package.json` - Stripped deps, tsx watch dev script, pyth-lazer-sdk pinned to 5.2.0
- `order-execution-keeper-service/tsconfig.json` - Simplified: ES2022 target, no declaration/sourceMap
- `order-execution-keeper-service/Dockerfile` - No Prisma, no openssl, 30s start-period, single node command

## Decisions Made
- Pinned pyth-lazer-sdk to exactly "5.2.0" (no caret) because ^5.2.0 resolves to 5.2.1 which requires Node ^24
- Used console.error instead of pino for config failure messages to avoid circular dependency (logger depends on config)
- Kept PYTH_PRO_ACCESS_TOKEN env var name to match existing server .env file
- Converted eventEmitter ABI from parseAbi format to plain object format to remove the parseAbi import dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Project skeleton compiles cleanly with pnpm build
- src/ directory ready for oracle.ts (Plan 02) and index.ts (Plan 02)
- All ABIs, keys, and config in place for Phase 16 keeper logic

## Self-Check: PASSED

All 6 created/modified files verified on disk. Both task commits (467d0b8, 80656ee) verified in git log. SUMMARY.md exists.

---
*Phase: 15-project-skeleton-and-oracle*
*Completed: 2026-02-26*
