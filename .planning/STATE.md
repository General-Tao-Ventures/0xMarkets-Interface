# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** All keeper-executed operations complete as fast as possible with proper oracle configuration
**Current focus:** Phase 13 — Oracle Correctness

## Current Position

Phase: 13 of 14 (Oracle Correctness)
Plan: 04 of 04 complete
Status: Phase 13 complete
Last activity: 2026-02-24 — Completed 13-04 (On-Chain Oracle Provider Verification)

Progress: [####################] 100% (Phase 13) — 4/4 plans

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
| 13-14 | v1.4 | 4/4 | Phase 13 complete |

**v1.4 Execution:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 13 P01 | 2min | 2 | 3 |
| Phase 13 P02 | 3min | 2 | 4 |
| Phase 13 P03 | 2min | 1 | 3 |
| Phase 13 P04 | 4min | 2 | 4 |

## Accumulated Context

### Research Flags

- Phase 13: Pyth entitlement verification must happen FIRST — if all 7 feeds have Lazer data, dual-oracle architecture is unnecessary
- Phase 13: ChainlinkPriceFeedProvider FX compatibility on Base Sepolia unknown — check before writing routing code
- Phase 11 (RESOLVED): PythLazerFeedProvider.getOraclePrice() reads from storedPrices; separate updatePriceOnChain() TX required but moved to proactive background loop
- Phase 10 (RESOLVED): viem fallback([webSocket(), http()]) does NOT produce WebSocket-type client; must use dedicated WebSocket-only PublicClient

### Known Issues

- FX token withdrawals fail with InvalidOracleProvider — RESOLVED: on-chain oracleProviderForToken updated for all 7 tokens (13-04)
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
- 13-02: Separated /metrics from /health to keep BetterStack probes clean while providing rich operational data
- 13-02: 120s HEALTHCHECK start-period covers DB migration + Lazer init + 10s data wait + initial scan
- 13-02: Force-tracked .env.production.example despite .env.* gitignore (template only, no secrets)
- 13-03: Entitlement state stored as module-level Set<string> with lowercase normalization for case-insensitive matching
- 13-03: Hermes feeds registered unconditionally (not gated by oracleMode) to enable per-token fallback in lazer mode
- 13-03: Per-token Lazer failure gracefully moves individual tokens to Hermes rather than failing the entire buildOracleParams call
- 13-04: Script uses same viem client infrastructure as keeper for consistency
- 13-04: Fix mode guarded behind --fix flag to prevent accidental chain writes during diagnostics
- 13-04: Script suggests contracts repo deploy command if keeper wallet lacks CONTROLLER role

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 13-04-PLAN.md (On-Chain Oracle Provider Verification)
Next: Phase 14 (Execution Speed)
