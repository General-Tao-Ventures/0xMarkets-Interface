# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** All keeper-executed operations complete as fast as possible with proper oracle configuration
**Current focus:** Phase 13 — Oracle Correctness

## Current Position

Phase: 13 of 14 (Oracle Correctness)
Plan: 01 of 02 complete
Status: Executing
Last activity: 2026-02-24 — Completed 13-01 (Lazer Safety Checks)

Progress: [##########..........] 25% (v1.4) — 1/4 plans

## Performance Metrics

**Velocity (v1.0-v1.3):**
- Total plans completed: 27
- Phases: 12, all complete

**By Phase:**

| Phase | Milestone | Plans | Status |
|-------|-----------|-------|--------|
| 1-3 | v1.0 | 6/6 | Complete |
| 4-6 | v1.1 | 8/8 | Complete |
| 7-9 | v1.2 | 7/7 | Complete |
| 10-12 | v1.3 | 6/6 | Complete |
| 13-14 | v1.4 | 1/4 | In progress |

**v1.4 Execution:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 13 P01 | 2min | 2 | 3 |

## Accumulated Context

### Research Flags

- Phase 13: Pyth entitlement verification must happen FIRST — if all 7 feeds have Lazer data, dual-oracle architecture is unnecessary
- Phase 13: ChainlinkPriceFeedProvider FX compatibility on Base Sepolia unknown — check before writing routing code
- Phase 11 (RESOLVED): PythLazerFeedProvider.getOraclePrice() reads from storedPrices; separate updatePriceOnChain() TX required but moved to proactive background loop
- Phase 10 (RESOLVED): viem fallback([webSocket(), http()]) does NOT produce WebSocket-type client; must use dedicated WebSocket-only PublicClient

### Known Issues

- FX token withdrawals fail with InvalidOracleProvider — Hermes not registered on-chain (Phase 13 target)
- MaxPriceAgeExceeded when using Lazer-only mode — stored prices go stale (Phase 14 target)
- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

Archived with v1.3 milestone. See .planning/PROJECT.md for key decisions table.

**v1.4 decisions:**
- 13-01: verifyLazerFeeds is synchronous cache-check (no network calls) since data arrives via WebSocket during 10s warm-up
- 13-01: Oracle provider mismatch is non-fatal warning (not process.exit) since Hermes mode may still work
- 13-01: Uses encodeAbiParameters (not encodePacked) to match Solidity abi.encode for DataStore key computation

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 13-01-PLAN.md
Next: Execute 13-02-PLAN.md
