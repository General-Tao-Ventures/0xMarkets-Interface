---
phase: 04-stable-foundation
plan: "02"
subsystem: infra
tags: [hardhat, markets, datastore, base-sepolia, onchain-config]

# Dependency graph
requires:
  - phase: 04-stable-foundation
    provides: "Known issues list (FIX-02: insufficient liquidity from missing market params)"
provides:
  - "Per-market config overrides for all 6 baseSepolia markets in contracts repo"
  - "Capacity limits: pool amounts, OI limits, deposit caps per market type"
affects: [trade-page, pools-page, market-selector, liquidity-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Crypto markets (WETH, WBTC) use baseMarketConfig defaults + explicit capacity limits"
    - "Synthetic markets (EUR, GBP, JPY, GOLD) use syntheticMarketConfig spread + explicit capacity limits"
    - "USDC amounts use expandDecimals(amount, 6); USD values use decimalToFloat(amount)"

key-files:
  created: []
  modified:
    - ../0xmarkets_contract/config/markets.ts

key-decisions:
  - "Crypto markets (WETH, WBTC): 1M USDC pool cap, 500K USD OI limits each side"
  - "Forex markets (EUR, GBP, JPY): 500K USDC pool cap, 250K USD OI limits, syntheticMarketConfig spread"
  - "GOLD commodity: 750K USDC pool cap, 375K USD OI limits, syntheticMarketConfig spread (higher than forex)"
  - "JPY retains reversed: true (USD/JPY price representation)"

patterns-established:
  - "Pool capacity params (maxLongTokenPoolAmount, maxShortTokenPoolAmount, maxPoolUsdForDeposit, maxOpenInterestForLongs/Shorts) must be set per-market — not inherited from baseMarketConfig which lacks them"

requirements-completed: [FIX-02]

# Metrics
duration: 15min
completed: 2026-02-21
---

# Phase 4 Plan 02: On-Chain Market Config Summary

**Per-market USDC capacity limits and OI caps deployed on-chain to all 6 baseSepolia markets via DataStore — no more "Insufficient liquidity" warnings on trade page**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-21T08:50:10Z
- **Completed:** 2026-02-21T09:05:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 1

## Accomplishments
- Added complete per-market config overrides to all 6 baseSepolia markets in `0xmarkets_contract/config/markets.ts`
- Crypto markets (WETH, WBTC): 1M USDC pool, 500K USD OI limits per side
- Forex markets (EUR, GBP, JPY): syntheticMarketConfig + 500K USDC pool, 250K USD OI limits
- GOLD (commodity): syntheticMarketConfig + 750K USDC pool, 375K USD OI limits
- No TypeScript errors introduced; pre-existing warnings remain (unused vars, unrelated scripts)

## Task Commits

1. **Task 1: Add per-market config values to baseSepolia markets** - `45d841be` (feat, in 0xmarkets_contract)
2. **Task 2: Deploy market config to Base Sepolia DataStore** - Human deployment complete (on-chain, no code commit)

## Files Created/Modified
- `/Users/ken/Projects/0xM/0xmarkets_contract/config/markets.ts` - Added per-market capacity limits and OI caps for all 6 baseSepolia markets

## Decisions Made
- Used `syntheticMarketConfig` spread for EUR, GBP, JPY, GOLD (lower PnL factors appropriate for synthetic assets)
- Crypto markets rely on `baseMarketConfig` defaults (merged by the deploy script at runtime) — only capacity fields are overridden
- GOLD gets slightly higher limits than forex (750K vs 500K pool) — higher demand asset
- `expandDecimals(amount, 6)` for USDC token amounts; `decimalToFloat(amount)` for USD-denominated caps

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript check command `npx tsc --noEmit` conflicts with `emitDeclarationOnly` in tsconfig.json. Used `npx tsc --emitDeclarationOnly` instead. No errors in `config/markets.ts`. Pre-existing errors in other scripts are unrelated to this plan.

## User Setup Required

None - on-chain deployment completed by user on 2026-02-21.

## Next Phase Readiness
- All 6 markets fully configured on-chain — Phase 4 (Stable Foundation) is complete
- Frontend multicall reads non-zero values for reserveFactor, maxOpenInterest, and pool amounts on all markets
- FIX-01 through FIX-04 all resolved — ready for Phase 5 (Liquidity & Swaps)

## Self-Check: PASSED

- FOUND: `/Users/ken/Projects/0xM/0xmarkets_contract/config/markets.ts` (modified)
- FOUND: `/Users/ken/Projects/0xM/0xMarkets-Interface/.planning/phases/04-stable-foundation/04-02-SUMMARY.md` (created)
- FOUND: commit `45d841be` in 0xmarkets_contract repo (Task 1)
- FOUND: commit `41d38b7e0` in 0xMarkets-Interface repo (metadata)

---
*Phase: 04-stable-foundation*
*Completed: 2026-02-21*
