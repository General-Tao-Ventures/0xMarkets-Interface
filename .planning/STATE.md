---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Liquidation Readiness
status: complete
last_updated: "2026-02-28T17:54:00.000Z"
progress:
  total_phases: 17
  completed_phases: 17
  total_plans: 42
  completed_plans: 42
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.7 Liquidation Readiness -- Phase 26 complete (all plans)

## Current Position

Phase: 26 of 26 (Liquidation Hardening and Performance)
Plan: 2 of 2
Status: Complete
Last activity: 2026-02-28 -- Completed 26-02 (multicall batching, position data reuse, timing instrumentation)

Progress: [██████████] 100% Phase 26 (2/2 plans complete)

## Performance Metrics

**Velocity (v1.0-v1.6):**
- Total plans completed: 49
- Phases: 23 complete across 7 milestones

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1.0 | 1-3 | 6/6 | Complete |
| v1.1 | 4-6 | 8/8 | Complete |
| v1.2 | 7-9 | 7/7 | Complete |
| v1.3 | 10-12 | 6/6 | Complete |
| v1.4 | 13-14 | 6/6 | Complete |
| v1.5 | 15-17 | 6/6 | Complete |
| v1.6 | 18,20-23 | 10/10 | Complete |
| v1.7 | 24-26 | 8/8 | Complete |

**v1.7 Execution:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 24 P01 | 25min | 3 | 3 |
| Phase 24 P02 | 54min | 2 | 6 |
| Phase 25 P01 | 15min | 2 | 4 |
| Phase 25 P02 | 2h6min | 2 | 7 |
| Phase 25 P03 | 2min | 1 | 3 |
| Phase 25 P04 | 86min | 2 | 2 |
| Phase 26 P01 | 2min | 2 | 3 |
| Phase 26 P02 | 2min | 2 | 4 |

## Accumulated Context

### Known Issues

- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
- ~~OrderHandler.sol division-by-zero on reversed markets (JPY/USD) when triggerPrice=0~~ -- FIXED in 24-01
- ~~ExchangeRouter stores OrderHandler as immutable constructor arg -- must redeploy both atomically~~ -- DONE in 24-01
- ~~New contract addresses need propagation to all services (24-02)~~ -- DONE in 24-02
- JPY/USD Pyth Lazer oracle data gap: "Best ask price is not present for the timestamp" -- order execution fails for JPY market on testnet
- ~~LIQUIDATION_KEEPER role on keeper wallet is unverified~~ -- VERIFIED in 25-01 (role already granted)
- Shared wallet nonce conflict between keeper-service and order-execution-keeper -- documented testnet risk

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

**Prior milestone decisions:** See .planning/PROJECT.md key decisions table.

- **v1.7 scope:** Contract bug fix + liquidation verification + hardening/performance (3 phases)
- **LPERF-03 in Phase 25:** Oracle mode must be Lazer before verification -- moved from performance to verification phase
- **LPERF-01/02 merged with LHARD:** Quick depth combines hardening + performance into one phase (Phase 26)
- **Research deference:** Research recommended deferring multicall (LPERF-01) but it is in v1.7 requirements, so included in Phase 26
- **24-01 zero-guard pattern:** check != 0 before Precision.mulDiv instead of SafeMath wrapper -- simpler, zero stays zero after reversal
- **24-01 role granting:** Used individual hardhat scripts instead of afterDeploy hooks due to Base Sepolia nonce conflicts
- **24-02 ROUTER_PLUGIN encoding:** GMX role hashes use keccak256(abi.encode(string)) not keccak256(string) -- Plan 01 used wrong encoding, fixed in Plan 02
- **24-02 JPY/USD oracle gap:** Order failure is Pyth Lazer data availability issue, not contract bug -- not blocking for Phase 24 scope
- **25-01 PythLazerFeedProvider address:** On-chain verification proved 0x8a3eb351 is the active provider, not 0x81B3857 from docs -- on-chain state is authoritative
- **25-01 config-driven addresses:** contract.ts reads PythLazerFeedProvider from config instead of hardcoding -- pattern for future address changes
- **25-01 LIQUIDATION_KEEPER role:** Already granted on keeper wallet -- no grant transaction needed
- **25-02 Lazer-first pricing:** Scanner simulates getOraclePrice on-chain to match executor's Lazer data, Hermes HTTP fallback for tokens without Lazer feeds
- **25-02 Single WS connection:** Pyth SDK dedup with numConnections>1 drops all binary messages -- use 1 connection
- **25-02 Scanner cooldown:** 5-minute cooldown on positions where gas estimation shows PositionShouldNotBeLiquidated
- **25-02 Unnamed tuple ABI:** viem parseAbi requires (type, type, ...) not tuple(name type, ...) -- access results by index
- **25-02 Testnet blocker:** InsufficientReserveForOpenInterest prevents new positions on WETH/USD -- LIQ-04 deferred to Phase 26
- **25-03 PythLazer address fix:** On-chain cast call confirms 0x8a3eb351 active (ok=true), 0xc5810FC reverts -- working tree and .env files were reverted from correct committed state
- **25-04 Pool reserve saturation:** WETH/USD pool has $1548 USDC but $1370 already reserved (95% factor = $1471 max). Only ~$101 headroom blocks position creation. LIQ-03/LIQ-04 deferred to Phase 26.
- **25-04 Synthetic oracle gap:** GOLD/EUR/GBP Pyth Lazer feeds missing "best ask price" data -- order execution fails for these markets
- **26-01 Dedup vs cooldown:** submissionDedup (60s TTL for successful submissions) is separate from failedCooldown (5min for gas-estimation failures) -- different purposes
- **26-01 Fire-and-forget receipts:** watchReceipt() is non-blocking so executor can process other candidates concurrently
- **26-01 Timeout handling:** Receipt watcher timeout errors logged but do not update status -- stuck detection deferred to future phase
- **26-02 Multicall allowFailure:** allowFailure:true on multicall so individual position key failures don't break the batch
- **26-02 Position data pipeline:** Scanner passes collateralToken/isLong to executor, with fetchPositionByKey fallback for independent calls
- **26-02 Structured timing:** All timing as numeric pino fields (totalDurationMs, submitDurationMs, confirmDurationMs) for machine-parseable logs

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 26-02-PLAN.md (multicall batching, position data reuse, timing instrumentation)
Next: v1.7 milestone complete. LIQ-03/LIQ-04 (testnet liquidation execution) retry when pool has >$5000 liquidity
