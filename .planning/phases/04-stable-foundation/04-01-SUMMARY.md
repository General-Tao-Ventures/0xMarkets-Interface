---
phase: 04-stable-foundation
plan: 01
subsystem: ui
tags: [bigmath, validation, websocket, metrics, bigint, ethereum]

# Dependency graph
requires: []
provides:
  - Zero-divisor safety guards in bigMath.mulDiv, divRound, divRoundUp, mulmod (return 0n with console.warn)
  - "Market unavailable" error in trade validation when minCollateralFactor === 0n
  - WebSocket health check bypasses listener count query when in CLOSING state (silent reconnect)
  - Keeper POST /report/ui/batch_report and POST /report/ui/feedback endpoints returning 200 OK
  - Frontend silently catches batch_report and feedback failures
affects: [05-position-management, 06-close-position]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-divisor guard: check divisor === 0n before division in bigMath, return 0n with console.warn"
    - "Validation guard: check minCollateralFactor === 0n early in getIncreaseError to avoid division cascade"
    - "WebSocket closing-state guard: check isProviderInClosedState before calling listenerCount() to prevent spam"
    - "Silent metrics: .catch(() => new Response()) on fire-and-forget reporting calls"

key-files:
  created: []
  modified:
    - sdk/src/utils/bigmath.ts
    - sdk/src/utils/__tests__/bigmath.spec.ts
    - src/domain/synthetics/trade/utils/validation.ts
    - src/context/WebsocketContext/WebsocketContextProvider.tsx
    - src/lib/rpc/index.ts
    - src/lib/oracleKeeperFetcher/oracleKeeperFetcher.ts
    - ../keeper-service/src/server/httpServer.ts

key-decisions:
  - "Zero divisor returns 0n with console.warn (not throw) — allows page to load while signaling misconfiguration to devs"
  - "minCollateralFactor === 0n shows 'Market unavailable' in trade button — semantic fix at validation layer, bigMath guard is safety net"
  - "WebSocket CLOSING state: skip listenerCount query entirely (it triggers duplicate message spam), reconnect silently"
  - "removeAllListeners called before isProviderInClosedState check in closeWsConnection to ensure clean shutdown from any state"
  - "Keeper discards batch_report data (no storage) — testnet metrics have no operational value yet"
  - "keeper-service is a separate git repo, committed separately as feat/candles-endpoint branch"

patterns-established:
  - "Always guard bigMath operations at the semantic level (validation) AND at the math level (bigmath guards) for defense in depth"
  - "Metrics endpoints: accept and discard is correct for testnet — prevents noise without losing functionality"

requirements-completed: [FIX-01, FIX-03, FIX-04]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 4 Plan 01: Stable Foundation — Crash Fixes Summary

**Zero-divisor safety in bigMath (mulDiv/divRound/divRoundUp/mulmod), "Market unavailable" trade validation guard, WebSocket CLOSING-state reconnect without spam, and keeper metrics endpoints accepting batch_report POSTs**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-21T08:50:10Z
- **Completed:** 2026-02-21T08:53:50Z
- **Tasks:** 2
- **Files modified:** 7 (6 in interface repo, 1 in keeper-service repo)

## Accomplishments
- Trade page no longer crashes with Division by zero when market config has zero values — bigMath guards prevent RangeError, validation shows "Market unavailable" instead
- WebSocket reconnection no longer spams "Dropping duplicate message" — health check detects CLOSING state early and skips problematic listener count call
- Metrics batch_report 404 errors eliminated — keeper now accepts POST /report/ui/batch_report and /report/ui/feedback with 200 OK, frontend silently catches any remaining failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Division by zero guard and validation hardening** - `95cc9bbfe` (fix)
2. **Task 2: WebSocket spam suppression and metrics endpoint (interface)** - `fe41a75cc` (fix)
2. **Task 2: WebSocket spam suppression and metrics endpoint (keeper)** - `089c6aa` in keeper-service repo (fix)

## Files Created/Modified
- `sdk/src/utils/bigmath.ts` - Zero-divisor guards in mulDiv, divRound, divRoundUp, mulmod
- `sdk/src/utils/__tests__/bigmath.spec.ts` - 4 new zero-divisor test cases (10 total, all pass)
- `src/domain/synthetics/trade/utils/validation.ts` - Early return "Market unavailable" when minCollateralFactor === 0n in getIncreaseError and getIsMaxLeverageExceeded
- `src/context/WebsocketContext/WebsocketContextProvider.tsx` - Early CLOSING state check in health check effect to prevent listener count spam
- `src/lib/rpc/index.ts` - Move removeAllListeners before isProviderInClosedState check for clean shutdown from CLOSING state
- `src/lib/oracleKeeperFetcher/oracleKeeperFetcher.ts` - Silent .catch(() => new Response()) on fetchPostBatchReport and fetchPostFeedback
- `../keeper-service/src/server/httpServer.ts` - POST /report/ui/batch_report and POST /report/ui/feedback routes returning 200 OK

## Decisions Made
- Zero divisor returns `0n` with `console.warn` (not throw) — allows page to load while still flagging misconfiguration for developers
- `minCollateralFactor === 0n` shows "Market unavailable" in the trade button at the validation layer — this is the semantic fix; bigMath guard is a defense-in-depth safety net
- WebSocket CLOSING state detected before `listenerCount()` call — the listenerCount query itself triggers duplicate message processing on closing WebSockets, so we exit early and silently reconnect
- `removeAllListeners` moved before `isProviderInClosedState` check to ensure listeners are cleaned up even when already CLOSING
- Keeper discards batch_report body (no storage) — testnet metrics have no operational value yet, accepting with 200 is correct behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- keeper-service is a separate git repository at `/Users/ken/Projects/0xM/keeper-service` — committed keeper changes there on the `feat/candles-endpoint` branch separately from the interface repo commit
- 17 pre-existing failing SDK tests (21 individual test failures) exist before and after this plan — out of scope per deviation rule scope boundary, logged in deferred-items

## Next Phase Readiness
- Trade page crash fix is complete — FIX-01, FIX-03, FIX-04 resolved
- FIX-02 ("Insufficient liquidity" warnings) still pending — addressed in plan 02 once market config is deployed on-chain
- Phase 5 (position management) can proceed with clean console output and no crash on zero-config markets

---
*Phase: 04-stable-foundation*
*Completed: 2026-02-21*
