# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** All keeper-executed operations complete as fast as possible with proper oracle configuration
**Current focus:** Phase 13 — Oracle Correctness

## Current Position

Phase: 13 of 14 (Oracle Correctness)
Plan: —
Status: Ready to plan
Last activity: 2026-02-24 — Roadmap created for v1.4

Progress: [░░░░░░░░░░] 0% (v1.4)

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
| 13-14 | v1.4 | 0/TBD | Not started |

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

## Session Continuity

Last session: 2026-02-24
Stopped at: v1.4 roadmap created
Next: Plan Phase 13 (Oracle Correctness)
