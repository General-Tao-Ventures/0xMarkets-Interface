---
phase: 32-event-decoder-router
verified: 2026-03-03T22:07:20Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 32: Event Decoder Router Verification Report

**Phase Goal:** Port the squid's event decoder to viem, create typed insert handlers for all event tables, and wire a router that maps event names to handlers
**Verified:** 2026-03-03T22:07:20Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                           | Status     | Evidence                                                                                               |
| --- | ----------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 1   | EventLogData bytes decoded into typed Maps (address, uint, int, bool, bytes32, bytes, string)   | VERIFIED   | decoder.ts uses viem `decodeAbiParameters` with full 7-group struct; 8 tests pass                     |
| 2   | Both EventLog1 and EventLog2 formats handled correctly                                          | VERIFIED   | `decodeEventLog` sets `topic1 = topics[2]` for both; tests cover 3-topic and 4-topic scenarios        |
| 3   | Decoder extracts msgSender, eventName, and all eventData fields                                 | VERIFIED   | decoder.ts lines 225-273: msgSender normalized to lowercase, eventName extracted, all 14 Maps built   |
| 4   | Event router maps all 51 active event names to correct table insert functions                   | VERIFIED   | router.ts merges 9 handler maps; `getHandlerCount()` returns 51; confirmed by router.test.ts          |
| 5   | Conditional nullable fields (positions.fees referral/pro/liquidation) handled correctly         | VERIFIED   | positionHandlers.ts lines 133-145: 11 `nullable: true` ColumnSpecs on referral/pro/liquidation fields |
| 6   | Unknown event names logged at warn level and skipped without crash                              | VERIFIED   | router.ts lines 67-73: `log.warn(...)` then `return`; test 3 confirms no throw for unknown events     |
| 7   | Raw SQL inserts via pg client (not Prisma) with parameterized queries                           | VERIFIED   | insertBuilder.ts line 137: `client.query(sql, values)` with `$1, $2, ...` placeholders               |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                          | Expected                                      | Status     | Details                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `data-verification-service/src/events/types.ts`                  | DecodedEventData interface and LogMeta type   | VERIFIED   | 33 lines; exports both interfaces with 14 Map fields matching squid shape |
| `data-verification-service/src/events/eventKeys.ts`              | All event name constants                      | VERIFIED   | 52 individual event constants + ALL_EVENT_NAMES array (52 entries)        |
| `data-verification-service/src/events/decoder.ts`                | decodeEventLog using viem                     | VERIFIED   | 378 lines; uses `decodeAbiParameters`, exports 9 helper getters           |
| `data-verification-service/src/events/insertBuilder.ts`          | Generic SQL insert builder and ColumnSpec types | VERIFIED | 142 lines; exports `buildHandler`, `ColumnSpec`, `EventTableSpec`, `EventHandler` |
| `data-verification-service/src/events/router.ts`                 | Event router mapping eventName to handler     | VERIFIED   | 83 lines; exports `routeEvent` and `getHandlerCount`                      |
| `data-verification-service/src/events/handlers/orderHandlers.ts` | Insert handlers for 7 order event types       | VERIFIED   | 128 lines; exports `orderHandlers` Record with 7 entries                  |
| `data-verification-service/src/events/handlers/positionHandlers.ts` | Insert handlers for 6 position event types | VERIFIED   | 194 lines; exports `positionHandlers` with shared fee column spec array   |
| `data-verification-service/src/events/handlers/marketHandlers.ts` | Insert handlers for 17 market event types    | VERIFIED   | 270 lines; exports `marketHandlers` with all 17 handlers                  |
| `data-verification-service/src/events/handlers/glvHandlers.ts`   | Insert handlers for 9 GLV event types         | VERIFIED   | 163 lines; exports `glvHandlers` with 9 handlers                          |
| `data-verification-service/src/events/handlers/depositHandlers.ts`    | 3 deposit handlers                       | VERIFIED   | 70 lines; exports `depositHandlers`                                        |
| `data-verification-service/src/events/handlers/withdrawalHandlers.ts` | 3 withdrawal handlers                    | VERIFIED   | 65 lines; exports `withdrawalHandlers`                                     |
| `data-verification-service/src/events/handlers/shiftHandlers.ts`      | 3 shift handlers                         | VERIFIED   | 59 lines; exports `shiftHandlers`                                          |
| `data-verification-service/src/events/handlers/referralHandlers.ts`   | 2 referral handlers                      | VERIFIED   | 41 lines; exports `referralHandlers`                                       |
| `data-verification-service/src/events/handlers/oracleHandlers.ts`     | 1 oracle handler with quoted timestamp   | VERIFIED   | 27 lines; `"timestamp"` column auto-quoted by builder via `"${col.column}"` pattern |

### Key Link Verification

| From                          | To                                      | Via                                    | Status  | Details                                                                  |
| ----------------------------- | --------------------------------------- | -------------------------------------- | ------- | ------------------------------------------------------------------------ |
| `decoder.ts`                  | `types.ts`                              | `import type { DecodedEventData }`     | WIRED   | Line 10: `import type { DecodedEventData } from "./types.js"`            |
| `router.ts`                   | `handlers/*Handlers.ts`                 | `import { *Handlers }` (9 imports)     | WIRED   | Lines 15-23: all 9 handler modules imported and spread into `handlerMap` |
| `handlers/*Handlers.ts`       | `insertBuilder.ts`                      | `import { buildHandler }`              | WIRED   | All 9 handler files import `buildHandler` from `../insertBuilder.js`     |
| `router.ts`                   | `types.ts`                              | `import { DecodedEventData, LogMeta }` | WIRED   | Line 11: `import type { DecodedEventData, LogMeta } from "./types.js"`   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                      | Status    | Evidence                                                                    |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------- |
| DEC-01      | 32-01       | Event decoder parses EventLogData from raw log bytes into typed Maps                             | SATISFIED | decoder.ts: full 7-group ABI struct decoded; 8 unit tests pass              |
| DEC-02      | 32-01       | Decoder handles both EventLog1 (1 indexed topic) and EventLog2 (2 indexed topics)                | SATISFIED | `isEventLog2` param accepted; topic1 set from `topics[2]` in both cases     |
| DEC-03      | 32-01       | Decoder extracts msgSender, eventName, and all eventData fields                                  | SATISFIED | All three top-level fields extracted; helper getters verified by test        |
| ROUTE-01    | 32-02       | Decoded events routed to correct table by eventName (e.g. OrderCreated → orders.created)        | SATISFIED | router.ts dispatches via `handlerMap.get(eventName)`; 51 active handlers    |
| ROUTE-02    | 32-02       | All 50 event types have insert handlers mapping decoded fields to table columns                  | SATISFIED | 51 handlers created (52 constants minus DistributionCreated); all columns mapped |
| ROUTE-03    | 32-02       | Unknown event names are logged and skipped (no crash)                                            | SATISFIED | `log.warn(...)` + early return; router test 3 confirms no throw             |
| ROUTE-04    | 32-02       | Conditional nullable fields handled (e.g. positions.fees referral/pro/liquidation fields)        | SATISFIED | 11 `nullable: true` entries in `positionFeeColumns`; `ClaimableFundingUpdated` has 2 nullable |

**Note on event count:** The plan stated 50 event constants but the actual squid source has 52. The implementation correctly tracks the actual count (52 constants, 51 active handlers). REQUIREMENTS.md says "50 event types" which is the documented baseline; the implementation delivers a superset, which satisfies the requirement.

### Anti-Patterns Found

No anti-patterns detected. All files checked:

- No `TODO`/`FIXME`/`HACK` comments
- No empty arrow functions (`=> {}`)
- No `return null` stubs
- No hardcoded static return values in handlers
- No placeholder text

### Test Results

| Test Suite              | Tests | Status  | Command                                               |
| ----------------------- | ----- | ------- | ----------------------------------------------------- |
| `decoder.test.ts`       | 8/8   | PASSED  | `npx vitest run src/events/decoder.test.ts`           |
| `router.test.ts`        | 5/5   | PASSED  | `npx vitest run src/events/router.test.ts`            |
| TypeScript (`tsc`)      | —     | PASSED  | `npx tsc --noEmit` — zero errors                      |

### Git Commit Verification

All 6 commits from summaries confirmed in git history:

| Commit    | Description                                              |
| --------- | -------------------------------------------------------- |
| `4ec4d41` | feat(32-01): add event types and event key constants     |
| `74f8043` | test(32-01): add failing tests for event decoder         |
| `81c056a` | feat(32-01): implement event decoder with viem           |
| `692f95e` | feat(32-02): add insert builder and 51 event handler specs |
| `208651f` | test(32-02): add failing tests for event router          |
| `5a5bf2f` | feat(32-02): implement event router with 51-handler dispatch |

### Key Design Decisions Verified

1. **viem not ethers**: `decodeAbiParameters` from `viem` is used throughout — no ethers import anywhere in the events directory.

2. **bigint to string for NUMERIC**: `insertBuilder.ts` lines 58-71 convert all `uint`/`int` bigint values to `.toString()` before passing to pg client.

3. **All column names double-quoted**: The builder uses `` `"${col.column}"` `` for all columns, so `"timestamp"` is automatically safe.

4. **ON CONFLICT DO NOTHING**: Idempotent inserts confirmed on line 137 of insertBuilder.ts.

5. **DistributionCreated explicitly skipped**: router.ts checks `DISTRIBUTION_CREATED` constant first and logs at DEBUG (not WARN) before returning.

### Human Verification Required

None — all critical behaviors verified programmatically via TypeScript compilation and unit tests.

---

_Verified: 2026-03-03T22:07:20Z_
_Verifier: Claude (gsd-verifier)_
