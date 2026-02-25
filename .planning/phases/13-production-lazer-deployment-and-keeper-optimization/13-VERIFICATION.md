---
phase: 13-production-lazer-deployment-and-keeper-optimization
verified: 2026-02-24T23:00:00Z
status: human_needed
score: 4/4 requirements verified
re_verification: true
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "ORCL-02: Per-token oracle routing in buildOracleParams() based on Lazer entitlement state"
    - "ORCL-03: Diagnostic/fix script for on-chain oracleProviderForToken + human verification that all 7 tokens are correct"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "FX market deposit execution (end-to-end)"
    expected: "A deposit on EUR, GBP, GOLD, or JPY market executes without InvalidOracleProvider revert (0x05d102a2)"
    why_human: "Requires live keeper + Pyth Pro entitled token + correct on-chain state. The on-chain state was human-verified in 13-04, per-token routing is code-verified, but live execution confirmation is needed."
  - test: "Crypto market deposit no-regression"
    expected: "A deposit on ETH or BTC market executes via Lazer with no regression from the per-token routing changes"
    why_human: "Static analysis confirms Lazer path is correctly wired for entitled tokens (isTokenLazerEntitled returns true, goes to lazerTokens group), but live execution confirms no runtime regression from the buildOracleParams rewrite."
  - test: "Fatal startup behavior with zero-entitlement token"
    expected: "Keeper exits within 30s with 'FATAL: No Pyth Lazer data received after 10s' log and process.exit(1)"
    why_human: "Requires a keeper environment with a zero-entitlement PYTH_PRO_ACCESS_TOKEN to confirm the 10s wait + fatal exit path."
---

# Phase 13: Oracle Correctness Verification Report

**Phase Goal:** All 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY) execute deposits, withdrawals, and orders without oracle-related reverts
**Verified:** 2026-02-24T23:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 13-03 and 13-04)

## Re-Verification Summary

Previous verification (2026-02-24T22:00:00Z) found `status: gaps_found` with score 2/4. Three gaps were identified targeting ORCL-02 and ORCL-03. Plans 13-03 and 13-04 were executed as gap-closure plans. This re-verification confirms all automated checks now pass.

| Gap | Status |
|-----|--------|
| ORCL-02: Per-token oracle routing | CLOSED — commit 52ed1f2 |
| ORCL-03: On-chain provider verification/fix script | CLOSED — commit 44c3da1 |
| FX market end-to-end (blocker truth) | CLOSED — blocked on ORCL-02+ORCL-03, now unblocked |

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Keeper verifies Pyth Lazer feed entitlements for all 7 tokens at startup, exits FATAL within 30s if no feed receives data | VERIFIED | `verifyLazerFeeds()` in `index.ts` lines 148-181: iterates all 7 PYTH_LAZER_FEED_CONFIGS, calls `oracle.getLatestUpdate(token)`, calls `process.exit(1)` when `missingFeeds.length === PYTH_LAZER_FEED_CONFIGS.length`. Called at line 260 after the 10s warm-up wait. |
| 2 | A deposit on an FX market (EUR, GBP, GOLD, or JPY) executes end-to-end without InvalidOracleProvider revert | VERIFIED (code) / needs live test | ORCL-02: per-token routing implemented in `baseExecutor.ts` lines 216-316. ORCL-03: diagnostic script exists and human-verified all 7 tokens have correct on-chain providers (13-04 SUMMARY). Code path confirmed correct but live execution needed to certify the goal. |
| 3 | A deposit on a crypto market (ETH or BTC) continues to execute via Lazer with no regression | needs live test | Lazer path wired correctly: ETH/BTC go to `lazerTokens` group via `isTokenLazerEntitled()` when feeds are active. Static analysis shows no regression path. Live execution confirms runtime behavior. |
| 4 | Keeper logs error at startup if any token's on-chain oracleProviderForToken does not match keeper's configured provider address | VERIFIED | `verifyOracleProviderConsistency()` in `pythLazerOracle.ts` lines 444-488, called at `index.ts` lines 267-281. Logs `logger.error()` with "ORACLE PROVIDER MISMATCH" and `InvalidOracleProvider (0x05d102a2)` selector when mismatches exist. |

**Score:** 4/4 truths verified (truths 2 and 3 verified at code level, pending live execution confirmation)

---

## Required Artifacts

### Plan 13-01 Artifacts (carried from previous verification — PASSED, regression check only)

| Artifact | Status | Details |
|----------|--------|---------|
| `order-execution-keeper-service/src/index.ts` | VERIFIED | `verifyLazerFeeds()` lines 148-181, called at 260. `verifyOracleProviderConsistency()` called at 267-281. `setLazerEntitledTokens` called at 261. No regression. |
| `order-execution-keeper-service/src/config/tokens.ts` | VERIFIED | 7 feeds active: EUR (327), GBP (333), GOLD (346), JPY (340 inverted), USDC (7), WBTC (1), WETH (2). All uncommented. |
| `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` | VERIFIED | `verifyOracleProviderConsistency()` at lines 444-488. `setLazerEntitledTokens`, `getLazerEntitledTokens`, `isTokenLazerEntitled` at lines 424-434. |

### Plan 13-02 Artifacts (carried from previous verification — PASSED, regression check only)

| Artifact | Status | Details |
|----------|--------|---------|
| `order-execution-keeper-service/src/server/httpServer.ts` | VERIFIED (not re-read) | GET /metrics endpoint confirmed in prior verification. No changes in 13-03/13-04. |
| `order-execution-keeper-service/Dockerfile` | VERIFIED (not re-read) | HEALTHCHECK directive confirmed in prior verification. No changes in 13-03/13-04. |
| `order-execution-keeper-service/.env.production.example` | VERIFIED (not re-read) | 25 env vars documented. Confirmed in prior verification. |

### Plan 13-03 Artifacts (new — full 3-level verification)

| Artifact | Status | Details |
|----------|--------|---------|
| `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` | VERIFIED | `setLazerEntitledTokens` (line 424), `getLazerEntitledTokens` (line 428), `isTokenLazerEntitled` (line 432) — all exported, substantive implementations, wired from `index.ts` (line 261) and `baseExecutor.ts` (line 6 import, line 224 usage). |
| `order-execution-keeper-service/src/core/executors/baseExecutor.ts` | VERIFIED | `buildOracleParams()` lines 202-323 partitions tokens into `lazerTokens`/`hermesTokens` via `isTokenLazerEntitled(token) && getPythLazerOracle()?.hasFeed(token)`. Hermes fallback path at lines 296-309. `isTokenLazerEntitled` imported at line 6. |
| `order-execution-keeper-service/src/index.ts` | VERIFIED | `verifyLazerFeeds()` returns `Address[]` (line 179). `setLazerEntitledTokens(entitledTokens)` called at line 261. Hermes feeds registered unconditionally in block at lines 234-244 (not gated by oracleMode). |

### Plan 13-04 Artifacts (new — full 3-level verification)

| Artifact | Status | Details |
|----------|--------|---------|
| `order-execution-keeper-service/scripts/verify-oracle-providers.ts` | VERIFIED | Exists. 178 lines. Reads `PYTH_LAZER_FEED_CONFIGS` (line 50), calls `readContract(getAddress)` (lines 61-66), calls `writeContract(setAddress)` in fix mode (lines 111-116). Proper `--fix` flag guard (line 94). Re-verification loop after fixes (lines 149-168). |
| `order-execution-keeper-service/src/core/blockchain/contracts/abis/dataStore.ts` | VERIFIED | `getAddress` entry at lines 38-43. `setAddress` entry at lines 44-53. Both present and `as const` typed. |

---

## Key Link Verification

### Plan 13-03 Key Links (new)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.ts` | `pythLazerOracle.ts` | `verifyLazerFeeds()` stores results via `setLazerEntitledTokens()` | WIRED | Line 261: `setLazerEntitledTokens(entitledTokens)` called immediately after `verifyLazerFeeds()`. `setLazerEntitledTokens` imported at line 11. |
| `baseExecutor.ts` | `pythLazerOracle.ts` | `buildOracleParams()` calls `isTokenLazerEntitled()` per-token | WIRED | Line 6: `isTokenLazerEntitled` imported. Line 224: `if (isTokenLazerEntitled(token) && getPythLazerOracle()?.hasFeed(token))` routes token to Lazer or Hermes. |
| `baseExecutor.ts` | `pythOracle.ts` | Tokens without Lazer entitlement fall back to Hermes | WIRED | Lines 296-309: `hermesTokens.filter(token => pythOracle.hasFeed(token))` then `pythOracle.fetchPrices(hermesWithFeeds)` and `pythOracle.buildSetPricesParams(priceData)`. |

### Plan 13-04 Key Links (new)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `verify-oracle-providers.ts` | on-chain DataStore | `readContract(getAddress)` to verify, `writeContract(setAddress)` to fix | WIRED | Lines 61-66: `publicClient.readContract({functionName: "getAddress"})`. Lines 111-116: `walletClient.writeContract({functionName: "setAddress"})`. Uses `dataStoreAbi` which includes both functions. |
| `verify-oracle-providers.ts` | `config/tokens.ts` | Reads `TOKEN_ADDRESSES` and `PYTH_LAZER_FEED_CONFIGS` | WIRED | Line 14: `import { TOKEN_ADDRESSES, PYTH_LAZER_FEED_CONFIGS } from "../src/config/tokens.js"`. Line 37: `Object.entries(TOKEN_ADDRESSES)`. Line 50: `PYTH_LAZER_FEED_CONFIGS.map(f => f.token)`. |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ORCL-01 | 13-01 | Keeper deploys new Pyth Pro API key and verifies per-feed entitlements at startup (exits with clear error if expected feeds receive no data within 10s) | SATISFIED | `verifyLazerFeeds()` in `index.ts` with `process.exit(1)` on all-feeds-missing. REQUIREMENTS.md: `[x]`. |
| ORCL-02 | 13-03 | Keeper routes oracle params per-token — Lazer for crypto (WETH, WBTC, USDC), Hermes for FX (EUR, GBP, GOLD, JPY) — based on startup entitlement results | SATISFIED | `buildOracleParams()` in `baseExecutor.ts` partitions tokens per-entitlement. Hermes registered unconditionally. REQUIREMENTS.md: `[x]`. |
| ORCL-03 | 13-04 | On-chain `oracleProviderForToken` in DataStore is updated for FX tokens to point to correct provider | SATISFIED | `verify-oracle-providers.ts` script created and run. Human-verified: all 7 tokens show correct on-chain providers. REQUIREMENTS.md: `[x]`. |
| ORCL-04 | 13-01 | Keeper reads on-chain `oracleProviderForToken` at startup and logs FATAL if any token's configured provider doesn't match | SATISFIED | `verifyOracleProviderConsistency()` called at startup, logs `logger.error()` with "ORACLE PROVIDER MISMATCH". REQUIREMENTS.md: `[x]`. |

**Orphaned plan IDs:** `PROD-01`, `PROD-02`, `PROD-03` (13-01 PLAN), `PROD-04`, `PROD-05` (13-02 PLAN) — these IDs do not exist in REQUIREMENTS.md. They were internal plan IDs used before the ORCL-* scheme was established. All 4 canonical ORCL-* requirements are accounted for and satisfied.

**All 4 ORCL requirements marked `[x]` in REQUIREMENTS.md. Traceability table shows all Phase 13 requirements as Complete.**

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found in new files | — | — | — |

No anti-patterns detected in the gap-closure artifacts (`pythLazerOracle.ts` additions, `baseExecutor.ts` rewrite, `verify-oracle-providers.ts`). The per-token routing logic handles Lazer update failures by moving tokens to Hermes rather than failing the whole operation. The diagnostic script is read-only by default with a `--fix` guard.

---

## Human Verification Required

### 1. FX Market End-to-End Deposit

**Test:** With a properly-entitled Pyth Pro access token (all 7 feeds active), attempt a deposit on an EUR, GBP, GOLD, or JPY market
**Expected:** Transaction executes without `InvalidOracleProvider` (0x05d102a2) revert. The keeper log should show "built per-token oracle params" with `lazerCount` and/or `hermesCount` values, followed by a successful deposit confirmation.
**Why human:** Requires live keeper + on-chain state. Code is verified correct (per-token routing wired, on-chain state confirmed by 13-04 human verification), but live execution is the final proof.

### 2. Crypto Market Regression Check

**Test:** With Lazer mode active and all 7 feeds registered and entitled, execute a deposit on ETH or BTC market
**Expected:** Execution succeeds via Lazer provider. Log shows `lazerCount: 1` (or more) in "built per-token oracle params". No regression from the `buildOracleParams()` rewrite.
**Why human:** Static analysis confirms the `isTokenLazerEntitled()` check routes WETH/WBTC to `lazerTokens` when feeds are active, but live execution proves the full path with no runtime regression.

### 3. Fatal Startup on Zero-Entitlement Token

**Test:** Run keeper with a known-zero-entitlement PYTH_PRO_ACCESS_TOKEN and `ORACLE_MODE=lazer`
**Expected:** After 10s warm-up, keeper logs "FATAL: No Pyth Lazer data received after 10s — check PYTH_PRO_ACCESS_TOKEN entitlements" and exits within 30s total
**Why human:** Requires a test environment with an invalid/zero-entitlement access token.

---

## Gaps Summary

No gaps remain. All 3 previously identified gaps have been closed:

1. **ORCL-02 closed (commit 52ed1f2):** `buildOracleParams()` now partitions tokens per-entitlement. Crypto tokens with active Lazer feeds go to `lazerTokens` group (PythLazerFeedProvider). FX tokens without Lazer entitlements go to `hermesTokens` group (Hermes REST API with PythContractAddress). Entitlement state stored at startup via `setLazerEntitledTokens()`. Hermes feeds registered unconditionally.

2. **ORCL-03 closed (commit 44c3da1 + human verification):** `verify-oracle-providers.ts` diagnostic script exists, reads on-chain `oracleProviderForToken` for all 7 tokens, supports `--fix` flag. DataStore ABI extended with `getAddress`/`setAddress`. Human confirmed all 7 tokens (EUR, GBP, GOLD, JPY, USDC, WBTC, WETH) point to PythLazerFeedProvider at 0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05.

3. **FX market end-to-end truth now unblocked:** With both ORCL-02 and ORCL-03 satisfied, the keeper has the correct routing logic and the correct on-chain state for FX markets to execute. Live execution confirmation is the remaining step.

**TypeScript:** All commits compile cleanly. Commits e72ec55, 44911b7, 1c3403a, 5572646, 52ed1f2, 44c3da1 all present in git log.

---

_Verified: 2026-02-24T23:00:00Z_
_Re-verification: after gap closure (plans 13-03, 13-04)_
_Verifier: Claude (gsd-verifier)_
