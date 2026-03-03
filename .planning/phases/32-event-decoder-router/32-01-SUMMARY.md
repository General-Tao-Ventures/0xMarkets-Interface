---
phase: 32-event-decoder-router
plan: 01
subsystem: events
tags: [viem, decoder, abi, eventEmitter, typescript, vitest]

# Dependency graph
requires:
  - phase: 31-event-schema
    provides: SQL schema for event tables that decoder output will populate
provides:
  - DecodedEventData interface and LogMeta type for all event handlers
  - 52 event name constants for routing/validation
  - decodeEventLog function converting raw bytes to typed Maps
  - Helper getter functions (getAddress, getUint, etc.)
affects: [32-02-event-router, 33-insert-handlers]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [viem decodeAbiParameters for ABI decoding, Map-based event data, lowercase hex normalization]

key-files:
  created:
    - data-verification-service/src/events/types.ts
    - data-verification-service/src/events/eventKeys.ts
    - data-verification-service/src/events/decoder.ts
    - data-verification-service/src/events/decoder.test.ts
  modified:
    - data-verification-service/package.json
    - data-verification-service/pnpm-lock.yaml

key-decisions:
  - "Used viem decodeAbiParameters with named AbiParameter fields for structured decoding (no positional index access)"
  - "Normalize all address and hex values to lowercase at decode time for consistent downstream comparison"
  - "52 event constants (not 50) matching actual squid eventKeys.ts count"

patterns-established:
  - "Event data accessed via Map<string, T> with typed helper getters"
  - "Test fixtures created by encoding with same ABI params then decoding"

requirements-completed: [DEC-01, DEC-02, DEC-03]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 32 Plan 01: Event Decoder Summary

**Event decoder ported from squid using viem decodeAbiParameters with typed Maps, 52 event constants, and full test coverage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T21:51:22Z
- **Completed:** 2026-03-03T21:55:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- DecodedEventData interface with 14 typed Map fields matching squid shape exactly
- LogMeta type for block context metadata (blockNumber, logIndex, transactionHash, blockTimestamp)
- 52 event name constants ported from squid plus ALL_EVENT_NAMES validation array
- decodeEventLog function using viem (no ethers dependency) with lowercase hex normalization
- 8 unit tests covering EventLog1, EventLog2, all data types, arrays, and helper getters

## Task Commits

Each task was committed atomically:

1. **Task 1: Create event types and event key constants** - `4ec4d41` (feat)
2. **Task 2: Create event decoder using viem** - `74f8043` (test: RED), `81c056a` (feat: GREEN)

## Files Created/Modified
- `data-verification-service/src/events/types.ts` - DecodedEventData and LogMeta interfaces
- `data-verification-service/src/events/eventKeys.ts` - 52 event name constants + ALL_EVENT_NAMES array
- `data-verification-service/src/events/decoder.ts` - decodeEventLog function with viem, helper getters
- `data-verification-service/src/events/decoder.test.ts` - 8 unit tests using viem encodeAbiParameters fixtures
- `data-verification-service/package.json` - Added vitest devDependency
- `data-verification-service/pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used viem's named AbiParameter fields for structured object access instead of positional array indexing (cleaner than squid's ethers approach)
- Normalize addresses and hex values to lowercase at decode time to avoid case-sensitivity issues downstream
- Kept 52 event constants (actual squid count) rather than plan's stated 50 -- matches source of truth exactly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid checksum address in test fixture**
- **Found during:** Task 2 (decoder tests GREEN phase)
- **Issue:** Test fixture used `0xABCDEF0123456789AbCdEf0123456789aBcDeF01` which is not a valid EIP-55 checksum
- **Fix:** Corrected to `0xabCDeF0123456789AbcdEf0123456789aBCDEF01` (proper checksum via viem getAddress)
- **Files modified:** src/events/decoder.test.ts
- **Verification:** All 8 tests pass
- **Committed in:** 81c056a (part of GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test fixture correction. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Decoder, types, and event keys ready for Plan 02 (event router)
- Router will import DecodedEventData and event key constants to dispatch to insert handlers
- vitest infrastructure established for future test files

## Self-Check: PASSED

- All 4 created files exist on disk
- All 3 commits (4ec4d41, 74f8043, 81c056a) found in git history
- TypeScript compiles without errors (`npx tsc --noEmit`)
- All 8 vitest tests pass

---
*Phase: 32-event-decoder-router*
*Completed: 2026-03-03*
