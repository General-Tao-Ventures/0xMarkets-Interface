# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** User can deposit USDC into ETH/USD pool and receive GM tokens with clear feedback at every step
**Current focus:** Phase 3 — UI Feedback (Phases 1-2 Complete)

## Current Position

Phase: 2 of 3 (Keeper Resilience) -- COMPLETE
Plan: 2 of 2 in current phase (all complete)
Status: Phase 2 complete, ready for Phase 3
Last activity: 2026-02-20 — Plan 02-02 complete

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 8 min
- Total execution time: 31 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-execution | 2 complete | 24 min | 12 min |
| 02-keeper-resilience | 2 complete | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 4 min, 20 min, 2 min, 5 min
- Trend: accelerating

*Updated after each plan completion*
| Phase 01-core-execution P01 | 4 min | 2 tasks | 3 files |
| Phase 01-core-execution P02 | 20 min | deploy + E2E test | 1 file fix |
| Phase 02-keeper-resilience P01 | 2 min | 2 tasks | 4 files |
| Phase 02-keeper-resilience P02 | 5 min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Project init: Last known error was OracleTimestampsAreLargerThanRequestExpirationTime — stale deposits, not a code bug
- Project init: Previous session fixes already deployed (waitForTransactionReceipt, cache freshness, WebSocket race condition, index token inclusion, fail-fast gas estimation, 10s startup delay)
- Plan 01-01: Ghost deposits marked CANCELLED not FAILED — EmptyDeposit() means zeroed-on-chain (not a real execution failure)
- Plan 01-01: buildOracleParams throws on empty tokens instead of returning silent empty params
- Plan 01-01: waitForTransactionReceipt added after executeDeposit submission before marking EXECUTED
- Plan 01-02: ETH/USD market uses mUSDC as BOTH longToken and shortToken — WETH is only indexToken for price
- Plan 01-02: InvalidSwapOutputToken(WETH, mUSDC) caused by test script using wrong initialLongToken — keeper pipeline was correct all along
- Plan 01-02: End-to-end verified: deposit detected, prices pushed, executed in 13s, 0.99995009 GM minted
- [Phase 02-keeper-resilience]: Unknown errors retried (not fail-fast) — safer to assume retryable when error is unclassified
- [Phase 02-keeper-resilience]: Ghost/stale CANCELLED writes stay in executeOnce as early returns (not thrown errors) — not execution failures
- Plan 02-02: encodeAbiParameters (not encodePacked) for CONTROLLER role hash — must match Solidity abi.encode padding
- Plan 02-02: cancelExpiredDeposits in 5-min cleanup cycle, not 10s scan cycle — expiry not latency-sensitive
- Plan 02-02: REQUEST_EXPIRATION_TIME == 0 means expiry disabled on-chain, silently skip cancellation

### Key Verification Results

- Deposit TX: 0x90d2d1481b1c804c21c8c88ee2538ab7acf5c64a00c8e482b7f91ca67bb9ed46 (block 37908181)
- Execution TX: 0x5cb80e75583195968c814c87533f1781a2bec4044f068c77d3ed00456528d2b7 (block 37908189)
- Keeper executed deposit in 13 seconds (well within 300s oracle freshness window)
- GM tokens minted: 0.99995009 to wallet 0xe96128886A27067D373ea44B3F3c8f25A182F886

### Pending Todos

None.

### Blockers/Concerns

- "Dropping duplicate message" WebSocket spam floods keeper logs — not blocking execution but makes debugging harder (Phase 2 candidate)
- Single keeper wallet means nonce management is critical for concurrent deposits (LIFE-04)

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 02-02-PLAN.md (Phase 2 complete)
Resume file: None
