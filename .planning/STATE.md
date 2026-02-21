# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** User can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets
**Current focus:** v1.1 Full Trading Experience — Phase 5: Liquidity & Swaps

## Current Position

Phase: 5 of 6 (Liquidity & Swaps) — IN PROGRESS
Plan: 1/2 complete
Status: 05-01 complete — Sell GM flow (withdrawal UX) shipped
Last activity: 2026-02-21 — 05-01 Buy GM/Sell GM buttons and cancelWithdrawalTxn

Progress: [███████░░░] ~60% (v1.0 complete, Phase 4 complete, Phase 5 in progress)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 7
- v1.0 phases: 3, all complete

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Keeper Oracle | 2/2 | Complete |
| 2. Deposit Execution | 2/2 | Complete |
| 3. Deposit UX | 2/2 | Complete |

**By Phase (v1.1):**

| Phase | Plans | Status |
|-------|-------|--------|
| 4. Stable Foundation | 2/2 | Complete |
| 5. Liquidity & Swaps | 1/2 | In Progress |

*Updated after each plan completion*

## Accumulated Context

### Known Issues

- Single keeper wallet nonce management — critical for concurrent operations (POS phase)
- 17 pre-existing failing SDK test files (21 tests) — pre-existing, unrelated to Phase 4 changes (deferred)
- Pre-existing TypeScript error in useOrders.ts (OrderInfoStructOutput export mismatch) — unrelated to current work

### Pending Todos

None.

### Blockers/Concerns

None currently.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 05-01-PLAN.md — Buy GM/Sell GM buttons + cancelWithdrawalTxn + enhanced withdrawal notification
Next: Phase 5 Plan 02 (if exists) or Phase 6

## Decisions

- 04-01: Zero divisor returns 0n with console.warn (not throw) — allows page to load while signaling misconfiguration to devs
- 04-01: minCollateralFactor === 0n shows "Market unavailable" in trade button — semantic fix at validation layer, bigMath guard is safety net
- 04-01: WebSocket CLOSING state detected before listenerCount() call — query itself triggers spam, so exit early and reconnect silently
- 04-01: Keeper discards batch_report data — testnet metrics have no operational value yet
- 04-02: Crypto markets (WETH, WBTC) get 1M USDC pool cap + 500K USD OI limits; baseMarketConfig defaults inherited at deploy time
- 04-02: Synthetic markets (EUR, GBP, JPY, GOLD) spread syntheticMarketConfig + explicit capacity limits
- 04-02: GOLD gets 750K pool / 375K OI (higher than 500K/250K forex) — more popular commodity asset
- 04-02: Deploy command confirmed: `npx hardhat update-market-config --network baseSepolia`
- 05-01: operation=Withdrawal query param drives PoolsDetailsContext — no context changes needed, useEffect already parses searchParams
- 05-01: useDepositElapsed called twice (deposit + withdrawal) — hook is generic, takes createdAt: number | undefined
- 05-01: withdrawalElapsedSeconds thresholds match deposit: 15s/60s/120s for progressive disclosure
