# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.11 — Trade History & Leaderboard Fix

**Shipped:** 2026-03-05
**Phases:** 2 | **Plans:** 2 | **Sessions:** 1

### What Was Built
- Squid pnlUsd enrichment: OrderExecuted trade actions now carry pnlUsd for closed positions
- PositionFeesCollected handler with cross-event fee merging into OrderExecuted via feesByOrderKey map
- collateralDeltaAmount type-aware extraction fixing maxCapital (was always 0)
- Frontend leaderboard all-time query fix: `to: 0` instead of `to: undefined`

### What Worked
- Root cause analysis was fast — checked contract events, traced through squid handlers, identified missing fields
- Two-phase approach (backend fix → frontend verify) kept each phase focused and fast
- Live GraphQL verification against squid confirmed fixes before moving to frontend
- Total active time ~30 minutes for the entire milestone

### What Was Inefficient
- Required two squid deployments because the collateralDeltaAmount bug was discovered during verification of the first deployment
- Could have caught the int256/uint256 type mismatch in the original squid development (v1.9) with better contract event type documentation

### Patterns Established
- Cross-event enrichment pattern: tracking map (feesByOrderKey) for merging data from related events
- Type-aware event field extraction: always check both intItems and uintItems for numeric fields
- Apollo GraphQL `undefined` vs `0` distinction: undefined omits the variable entirely

### Key Lessons
1. Solidity event fields can use different numeric types (int256 vs uint256) for the same logical field across different events — always verify the source contract
2. Apollo GraphQL silently omits `undefined` variables — use `null` or `0` for explicit "send this value" semantics
3. Squid `--hard-reset` is essential when fixing field extraction logic — cached/stale indexed data won't self-correct

### Cost Observations
- Model mix: ~80% opus (executor), ~20% sonnet (verifier)
- Sessions: 1 (planning through completion)
- Notable: Fastest milestone to date — 2 phases completed in a single session

---

## Milestone: v1.10 — E2E Verification

**Shipped:** 2026-03-05
**Phases:** 3 | **Plans:** 4 | **Sessions:** 2

### What Was Built
- Trigger order fix: diagnosed oracle staleness as root cause of InvalidOrderPrices, widened price margins to 5%
- Comprehensive E2E test suite: deposits, withdrawals, market orders, trigger orders (limit/SL/TP), liquidation
- Unified test runner (run-all.ts) with per-suite timeouts, --skip/--only flags
- On-chain state verification script (verify-frontend-data.ts) reading pools, positions, orders, balances via multicall
- Human-verified frontend accuracy at app.0xmarkets.io — all data matches on-chain state

### What Worked
- GSD workflow executed the entire milestone in ~2.5 hours (3 phases, 4 plans)
- Existing E2E test infrastructure from v1.6 provided solid foundation — only needed gap-filling, not rewriting
- Human-verify checkpoint for frontend verification was the right pattern — automated script generates ground truth, human compares
- Phase dependencies were well-structured: fix trigger orders → build test suite → verify frontend

### What Was Inefficient
- Multiple prior sessions spent debugging trigger orders before finding the oracle staleness root cause (investigated price scaling, keeper config, etc.)
- The 51 pending orders on the test wallet are noise from prior testing sessions — could benefit from a cleanup script
- abis.ts has an incorrect ABI definition (getAccountOrders) that was worked around with inline ABI rather than fixed at source

### Patterns Established
- E2E tests use 5% price margins for trigger orders to handle oracle price staleness
- On-chain verification scripts as ground truth for frontend accuracy testing
- Per-suite timeout configuration in unified test runner

### Key Lessons
1. Oracle staleness (MAX_ORACLE_PRICE_AGE = 300s) is the primary failure mode for trigger orders — always account for price drift between order creation and keeper execution
2. MarketDecrease (close position) uses orderType 4 with acceptablePrice 0n for longs — this isn't well-documented
3. GM token totalSupply can be read directly from the market address since the market contract IS the GM ERC20 token
4. Liquidation test timing is infrastructure-dependent — treat keeper timing as PASS with note, not hard FAIL

### Cost Observations
- Model mix: ~70% opus (executor agents), ~30% sonnet (verifier, planning)
- Sessions: 2 (planning+execution, then completion)
- Notable: Phase 35 (trigger order fix) was the lightest — the fix was already committed, just needed verification

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.11 | 1 | 2 | Fastest milestone — single session, 30 min total |
| v1.10 | 2 | 3 | First milestone using GSD framework end-to-end with wave execution |

### Cumulative Quality

| Milestone | E2E Tests | Coverage | Key Addition |
|-----------|-----------|----------|--------------|
| v1.11 | — | Squid + frontend | Cross-event enrichment, type-aware extraction |
| v1.10 | 5 suites | All operation types | Unified runner, frontend verification |

### Top Lessons (Verified Across Milestones)

1. Oracle-related issues (price staleness, provider mismatches) are the #1 source of keeper execution failures — always validate oracle freshness
2. Building verification tooling (E2E tests, on-chain scripts) pays dividends across all future development
3. Solidity event numeric types (int256 vs uint256) vary per event — always verify against contract source, not assumptions
