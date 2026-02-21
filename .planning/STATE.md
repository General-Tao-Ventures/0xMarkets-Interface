# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** User can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets
**Current focus:** v1.1 Full Trading Experience — Phase 4: Stable Foundation

## Current Position

Phase: 4 of 6 (Stable Foundation)
Plan: 2 of 2 (awaiting human-action: on-chain market config deployment)
Status: Checkpoint — human-action required
Last activity: 2026-02-21 — 04-02 market config values added, awaiting on-chain deployment

Progress: [████░░░░░░] ~33% (v1.0 complete, Phase 4 Plan 2 in-progress)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 6
- v1.0 phases: 3, all complete

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Keeper Oracle | 2/2 | Complete |
| 2. Deposit Execution | 2/2 | Complete |
| 3. Deposit UX | 2/2 | Complete |

*Updated after each plan completion*

## Accumulated Context

### Known Issues

- "Insufficient liquidity" warnings — market reserve factors and OI limits partially configured (FIX-02 target) — config ready, awaiting on-chain deployment
- Single keeper wallet nonce management — critical for concurrent operations (POS phase)
- 17 pre-existing failing SDK test files (21 tests) — pre-existing, unrelated to Phase 4 changes (deferred)

### Pending Todos

None.

### Blockers/Concerns

None currently. Phase 4 work (FIX-01..04) is well-defined from known issues.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 04-01-PLAN.md — crash fixes and WebSocket/metrics cleanup done
Resume file: .planning/phases/04-stable-foundation/04-02-SUMMARY.md

## Decisions

- 04-01: Zero divisor returns 0n with console.warn (not throw) — allows page to load while signaling misconfiguration to devs
- 04-01: minCollateralFactor === 0n shows "Market unavailable" in trade button — semantic fix at validation layer, bigMath guard is safety net
- 04-01: WebSocket CLOSING state detected before listenerCount() call — query itself triggers spam, so exit early and reconnect silently
- 04-01: Keeper discards batch_report data — testnet metrics have no operational value yet
- 04-02: Crypto markets (WETH, WBTC) get 1M USDC pool cap + 500K USD OI limits; baseMarketConfig defaults inherited at deploy time
- 04-02: Synthetic markets (EUR, GBP, JPY, GOLD) spread syntheticMarketConfig + explicit capacity limits
- 04-02: GOLD gets 750K pool / 375K OI (higher than 500K/250K forex) — more popular commodity asset
- 04-02: Deploy command confirmed: `npx hardhat update-market-config --network baseSepolia`
