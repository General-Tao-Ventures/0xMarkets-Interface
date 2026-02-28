---
phase: 25-liquidation-pipeline-verification
verified: 2026-02-28T02:28:47Z
status: gaps_found
score: 3/5 success criteria verified
re_verification: false
gaps:
  - truth: "Both keeper-service and order-execution-keeper use the same PythLazerFeedProvider address (the on-chain active provider)"
    status: failed
    reason: "Both .env files use 0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6, which reverts when getStoredPrice is called. The on-chain active provider is 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05 (returns ok=true). config.ts was correctly fixed in commit e319e36 to use 0x8a3eb351 as the fallback, but has an uncommitted working-tree change that reverted it back to 0xc5810FC. Since .env overrides config.ts, the runtime address is always the wrong one."
    artifacts:
      - path: "keeper-service/.env"
        issue: "Line 66: PYTH_LAZER_FEED_PROVIDER_ADDRESS=0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6 (wrong — reverts on getStoredPrice)"
      - path: "keeper-service/src/config.ts"
        issue: "Line 22: fallback is 0xc5810FC (uncommitted working-tree change from correct 0x8a3eb351 set in e319e36)"
      - path: "order-execution-keeper-service/.env"
        issue: "Line 27: same wrong address 0xc5810FC"
    missing:
      - "Fix PYTH_LAZER_FEED_PROVIDER_ADDRESS in keeper-service/.env to 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05"
      - "Fix PYTH_LAZER_FEED_PROVIDER_ADDRESS in order-execution-keeper-service/.env to 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05"
      - "Restore config.ts fallback to 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05 and commit the file"

  - truth: "The executor submits executeLiquidation and the transaction succeeds on-chain (visible on Basescan)"
    status: failed
    reason: "25-02 SUMMARY explicitly documents 'Executor: TX submission — NOT TESTED. No position deep enough to pass gas estimation.' The testnet WETH/USD pool has exhausted open interest reserves (InsufficientReserveForOpenInterest), so no new positions of any size could be created during the verification session. The executor code path that calls writeContract is present and structurally correct, but was never exercised end-to-end."
    artifacts:
      - path: "keeper-service/src/core/executor.ts"
        issue: "TX submission code exists (lines 155, 182) but was never triggered in testing; no on-chain transaction hash recorded"
    missing:
      - "A successful executeLiquidation transaction on Base Sepolia (tx hash visible on Basescan)"
      - "Testnet WETH/USD pool liquidity sufficient to allow new position creation"
      - "A position deep enough in loss that gas estimation passes (Lazer price agrees it is liquidatable)"

  - truth: "The confirmator updates the PostgreSQL record from SUBMITTED to EXECUTED with the correct transaction hash"
    status: failed
    reason: "25-02 SUMMARY documents 'Confirmator: status updates — NOT TESTED. No successful execution to confirm.' The confirmator is running and watches for OrderExecuted events with orderType=7, but no such event was emitted because no liquidation transaction was submitted."
    artifacts:
      - path: "keeper-service/src/core/confirmator.ts"
        issue: "Event watcher is running but updateExecutionStatus(MINED) and updateCandidateStatus(EXECUTED) were never called with real data"
    missing:
      - "At least one liquidation_execution row with status=MINED and a valid tx_hash in PostgreSQL"
      - "At least one liquidation_candidate row with status=EXECUTED in PostgreSQL"
      - "Requires the executor TX submission gap to be resolved first"

human_verification:
  - test: "Verify scanner detects position as liquidatable within 30s using correct Lazer prices"
    expected: "After fixing PYTH_LAZER_FEED_PROVIDER_ADDRESS to 0x8a3eb351, scanner logs show 'lazer: 3, hermes: 4' in refreshed price cache, and at least one position is detected as liquidatable"
    why_human: "Requires keeper-service to be running with the correct address and a liquidatable position to exist on-chain"
  - test: "Verify full pipeline: executeLiquidation TX submitted and confirmed"
    expected: "Basescan shows a successful executeLiquidation call from keeper wallet 0x48Cb0d...; PostgreSQL shows execution with status=MINED and candidate with status=EXECUTED"
    why_human: "Requires testnet pool liquidity and a sufficiently undercollateralized position — cannot verify programmatically"
---

# Phase 25: Liquidation Pipeline Verification — Verification Report

**Phase Goal:** Verify end-to-end liquidation pipeline on Base Sepolia testnet — a real undercollateralized position detected by the scanner, executed by the executor, and recorded in PostgreSQL
**Verified:** 2026-02-28T02:28:47Z
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Keeper wallet has `LIQUIDATION_KEEPER` role on RoleStore, verified via `cast call` | VERIFIED | `cast call 0x773C3f6...` `hasRole(0x48Cb0d..., roleHash)` returns `true` — confirmed live during this verification |
| 2 | keeper-service runs with `ORACLE_MODE=lazer` | VERIFIED | `keeper-service/.env` line 83: `ORACLE_MODE=lazer` |
| 3 | Undercollateralized position detected as liquidatable within one scan cycle (30s) | PARTIAL | Scanner code is operational with Hermes fallback; 34 candidates in DB; Lazer-first pricing broken due to wrong provider address (uses 0xc5810FC which reverts for getStoredPrice). Hermes fallback does detect borderline positions. Full Lazer-first detection NOT verified with correct address. |
| 4 | Executor submits `executeLiquidation` and transaction succeeds on-chain | FAILED | Explicitly NOT TESTED — testnet pool reserves exhausted, no position passed gas estimation gate |
| 5 | Confirmator updates PostgreSQL record from SUBMITTED to EXECUTED with correct tx hash | FAILED | Explicitly NOT TESTED — depends on truth 4, which was not achieved |

**Score:** 2/5 success criteria fully verified (truth 3 partially verified via Hermes)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `keeper-service/src/core/contract.ts` | Dynamic PythLazerFeedProvider from config | VERIFIED | Line 8: `(config.pythLazerFeedProviderAddress \|\| "0x0000...")` |
| `keeper-service/.env` | `ORACLE_MODE=lazer` + correct provider address | PARTIAL | `ORACLE_MODE=lazer` verified. Provider address is `0xc5810FC` (reverts on getStoredPrice); correct is `0x8a3eb351` |
| `keeper-service/src/config.ts` | Correct fallback address `0x8a3eb351` | FAILED | Committed HEAD has `0x8a3eb351` (correct), but working tree has uncommitted change back to `0xc5810FC` (wrong). Current runtime uses wrong address. |
| `e2e/test-liquidation.ts` | Script to create undercollateralized position (50+ lines) | VERIFIED | 312 lines, real implementation using ensureApprovals/multicall/waitForExecution; compiles without TS errors |
| `keeper-service/src/core/scanner.ts` | Lazer-first pricing with Hermes fallback | VERIFIED (code) | Implementation present: simulateContract.getOraclePrice with Hermes fallback. Cooldown mechanism present. Works via fallback but Lazer path is broken by wrong address. |
| `keeper-service/src/core/executor.ts` | executeLiquidation writeContract call | VERIFIED (code) | Lines 155, 182: writeContract calls for executeLiquidation present. Gas estimation gate present. Never triggered end-to-end. |
| `keeper-service/src/core/confirmator.ts` | updateExecutionStatus MINED + updateCandidateStatus EXECUTED | VERIFIED (code) | Lines 123-143: watchContractEvent for OrderExecuted, orderType=7 filter, updateExecutionStatus("MINED"), updateCandidateStatus("EXECUTED") all present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `keeper-service/src/core/contract.ts` | `keeper-service/src/config.ts` | `config.pythLazerFeedProviderAddress` import | WIRED | `import { config } from "../config.js"` on line 3; `PYTH_LAZER_FEED_PROVIDER_ADDRESS = config.pythLazerFeedProviderAddress` on line 8 |
| `keeper-service/src/core/scanner.ts` | `keeper-service/src/core/contract.ts` | `PYTH_LAZER_FEED_PROVIDER_ADDRESS` import | WIRED | Line 7: `import { ..., PYTH_LAZER_FEED_PROVIDER_ADDRESS, ... } from "./contract.js"` |
| `keeper-service/src/core/scanner.ts` | `Reader.isPositionLiquidatable()` | `readContract` on Reader | WIRED | Line 466: `functionName: "isPositionLiquidatable"` in readContract call |
| `keeper-service/src/core/executor.ts` | `LiquidationHandler.executeLiquidation()` | `writeContract` call | WIRED (untested) | Lines 155, 182: `functionName: "executeLiquidation"` in writeContract. Code present; never executed end-to-end. |
| `keeper-service/src/core/confirmator.ts` | `keeper-service/src/core/store.ts` | `updateExecutionStatus("MINED")` + `updateCandidateStatus("EXECUTED")` | WIRED (untested) | Lines 136, 143: both calls present in confirmator. store.ts has both functions. Never triggered. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIQ-01 | 25-01 | Keeper wallet has LIQUIDATION_KEEPER role verified on-chain | SATISFIED | `cast call hasRole()` returns `true` for 0x48Cb0d... verified live in this verification session |
| LIQ-02 | 25-02 | Liquidation scanner detects undercollateralized positions within one scan cycle (30s) | PARTIAL | Scanner detects via Hermes fallback; 34 candidates in DB; Lazer-first pricing broken by wrong provider address. Detection works but oracle path is degraded. |
| LIQ-03 | 25-02 | Liquidation executor successfully calls executeLiquidation on a real test position | BLOCKED | 25-02 SUMMARY: "NOT TESTED — No position deep enough to pass gas estimation." Executor code is correct but was never executed end-to-end. 25-02 requirements-completed only claims LIQ-02 and LIQ-03, but the evidence shows LIQ-03 was not demonstrated. |
| LIQ-04 | 25-02 | Confirmator records liquidation result in PostgreSQL with correct status | BLOCKED | Not tested. Requires LIQ-03 first. REQUIREMENTS.md correctly marks this as `[ ]` (incomplete). |
| LPERF-03 | 25-01 | Oracle mode set to Lazer (not Hermes default) for keeper-service | SATISFIED | `ORACLE_MODE=lazer` in keeper-service/.env line 83 |

**Note on LIQ-03 claim in 25-02-SUMMARY:** The plan frontmatter says `requirements-completed: [LIQ-02, LIQ-03]` but the pipeline status table in the same SUMMARY explicitly says "Executor: TX submission — NOT TESTED." LIQ-03 requires the executor to "successfully call executeLiquidation on a real test position" — gas estimation alone does not satisfy this requirement. LIQ-03 is NOT completed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `keeper-service/src/config.ts` | 22 | Uncommitted working-tree change reverts `pythLazerFeedProviderAddress` fallback from `0x8a3eb351` (correct) back to `0xc5810FC` (wrong, reverts on-chain) | BLOCKER | Scanner's Lazer-first pricing silently fails for all tokens (falls back to Hermes); executor's Lazer oracle params reference wrong contract instance |
| `keeper-service/.env` | 66 | `PYTH_LAZER_FEED_PROVIDER_ADDRESS=0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6` — address is wrong; `getStoredPrice` reverts entirely on this address | BLOCKER | Lazer simulation queries wrong contract; any Lazer-specific functionality is silently degraded |
| `keeper-service/src/core/scanner.ts` | 68 | `TODO: In the future, we can track accounts via events or use DataStore to get all position keys` | INFO | Future enhancement note; not blocking current functionality |

### Human Verification Required

#### 1. Full E2E Pipeline After Address Fix

**Test:** Fix `keeper-service/.env` and `order-execution-keeper-service/.env` to use `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`, restore `config.ts` fallback, restart both keepers, and run `npx tsx e2e/test-liquidation.ts` to create an undercollateralized position, then observe keeper-service logs.

**Expected:** Keeper logs show `lazer: 3, hermes: 4` in refreshed price cache; scanner detects position as liquidatable; executor submits `executeLiquidation`; Basescan shows successful transaction; PostgreSQL shows `liquidation_candidates` with `status=EXECUTED` and `liquidation_executions` with `status=MINED` and valid `tx_hash`.

**Why human:** Requires keepers to be running live, testnet pool to have liquidity, and a position that is liquidatable at Lazer prices (not just Hermes prices). Cannot simulate end-to-end pipeline in static code analysis.

#### 2. Testnet Pool Liquidity

**Test:** Verify the WETH/USD pool on Base Sepolia has sufficient open interest reserves to accept new positions.

**Expected:** `e2e/test-liquidation.ts` succeeds in creating a position without `InsufficientReserveForOpenInterest` revert.

**Why human:** Requires interacting with the testnet. Pool liquidity state changes over time and cannot be verified statically.

### Gaps Summary

Three gaps block full goal achievement:

**Gap 1 — Wrong PythLazerFeedProvider address (blocker for Lazer-first pricing):**
Both keeper `.env` files and the `config.ts` working tree have `0xc5810FC` as the PythLazerFeedProvider address. This address reverts when `getStoredPrice` is called. The correct on-chain active provider is `0x8a3eb351` (returns `ok=true` with a current WETH price). The commit `e319e36` correctly set `config.ts` to `0x8a3eb351`, but a subsequent uncommitted working-tree change reverted it. The `.env` committed in `cde2bd0` always had the wrong address. The net effect: the Lazer-first pricing path in the scanner always fails and falls back to Hermes. This is masked because Hermes fallback works, but it means the executor's Lazer oracle params reference a different contract instance than the one registered in the on-chain DataStore — which will cause gas estimation to pass but execution to potentially revert for price-sensitive positions.

**Gap 2 — Executor TX not tested (LIQ-03 not satisfied):**
The testnet WETH/USD pool exhausted its open interest reserves during the Phase 25 session. No new positions could be created (`InsufficientReserveForOpenInterest`), and the existing borderline SHORT position was only liquidatable at Hermes prices, not at Lazer prices (which the LiquidationHandler uses during execution). The gas estimation gate correctly rejected these positions. The executor write path (`writeContract.executeLiquidation`) was never triggered. LIQ-03 requires a real successful call — the 25-02 SUMMARY's claim of `requirements-completed: [LIQ-03]` is incorrect based on the SUMMARY's own pipeline status table.

**Gap 3 — Confirmator status updates not tested (LIQ-04 not satisfied):**
Directly dependent on Gap 2. No liquidation TX was submitted, so no `OrderExecuted` event with `orderType=7` was emitted, so the confirmator never called `updateExecutionStatus("MINED")` or `updateCandidateStatus("EXECUTED")`. The code is structurally correct and wired properly, but the data-level proof is absent.

**Root cause relationship:** Gaps 2 and 3 share a single root cause — insufficient testnet pool liquidity. Resolving this resolves both. Gap 1 is independent and must also be fixed for the Lazer-first pricing path to work correctly during execution (not just scanning).

---

_Verified: 2026-02-28T02:28:47Z_
_Verifier: Claude (gsd-verifier)_
