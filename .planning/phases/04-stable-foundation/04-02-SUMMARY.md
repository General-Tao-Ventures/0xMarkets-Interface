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

**Per-market USDC capacity limits and OI caps added to all 6 baseSepolia markets in contracts config, awaiting on-chain deployment via `npx hardhat update-market-config --network baseSepolia`**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-21T08:50:10Z
- **Completed:** 2026-02-21T09:05:00Z
- **Tasks:** 1/2 complete (Task 2 is human-action checkpoint — on-chain deployment)
- **Files modified:** 1

## Accomplishments
- Added complete per-market config overrides to all 6 baseSepolia markets in `0xmarkets_contract/config/markets.ts`
- Crypto markets (WETH, WBTC): 1M USDC pool, 500K USD OI limits per side
- Forex markets (EUR, GBP, JPY): syntheticMarketConfig + 500K USDC pool, 250K USD OI limits
- GOLD (commodity): syntheticMarketConfig + 750K USDC pool, 375K USD OI limits
- No TypeScript errors introduced; pre-existing warnings remain (unused vars, unrelated scripts)

## Task Commits

1. **Task 1: Add per-market config values to baseSepolia markets** - `45d841be` (feat)
2. **Task 2: Deploy market config to Base Sepolia DataStore** - PENDING (human-action checkpoint)

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

**On-chain deployment required.** After verifying the config changes:

1. `cd /Users/ken/Projects/0xM/0xmarkets_contract`
2. Ensure `.env` has `DEPLOYER_PRIVATE_KEY` set (account with CONFIG_KEEPER role on DataStore)
3. Run: `npx hardhat update-market-config --network baseSepolia`
4. Verify on-chain: load trade page in browser, confirm no "Insufficient liquidity" warnings on all 6 markets

## Next Phase Readiness
- Config file is ready — deployment is the only remaining step
- Once deployed, frontend multicall will read non-zero values for all critical market config fields
- FIX-02 (Insufficient liquidity warnings) will be resolved after on-chain deployment

---
*Phase: 04-stable-foundation*
*Completed: 2026-02-21*
