---
phase: 24-contract-bug-fixes
verified: 2026-02-27T23:55:00Z
status: gaps_found
score: 3/4 success criteria verified
re_verification: false
gaps:
  - truth: "The E2E test suite passes 18/18 (including JPY/USD which was previously skipped)"
    status: failed
    reason: "SUMMARY documents 17/18 — JPY/USD order test fails with 'Best ask price is not present for the timestamp' from Pyth Lazer oracle. SKIP_MARKETS is now an empty set so JPY/USD runs and returns FAIL status. test-orders.ts allPassed logic requires every result to be PASS or SKIP; FAIL causes exit code 1. The division-by-zero contract bug is fixed and the order reaches the oracle layer (proving the Solidity fix is correct), but the Pyth Lazer oracle has a testnet data-availability gap for JPY/USD that blocks full execution."
    artifacts:
      - path: "e2e/test-orders.ts"
        issue: "SKIP_MARKETS is empty (correct per plan) but JPY/USD order execution fails at Pyth Lazer oracle layer — 5/6 orders PASS, 1/6 FAIL"
    missing:
      - "Either: Pyth Lazer oracle must supply JPY price data for the test timestamp so JPY/USD order executes end-to-end"
      - "Or: E2E infrastructure fix (retry logic, oracle timestamp alignment) to work around testnet Pyth Lazer data gaps"
      - "Note: The contract fix (CFIX-01) IS correct — the revert is now in oracle validation, not in OrderHandler.sol math. The gap is in oracle infrastructure, not the Solidity fix."

human_verification:
  - test: "Submit a JPY/USD market order and observe where it fails"
    expected: "Order should reach oracle validation step (not revert in OrderHandler) — confirms the contract fix is working. Oracle step may fail with Pyth Lazer data gap."
    why_human: "Cannot run live E2E test programmatically; requires wallet with ETH, running keeper, and Pyth Lazer oracle data availability at the moment of test"
  - test: "Check ROADMAP.md 24-02-PLAN.md checkbox"
    expected: "Should read [x] 24-02-PLAN.md given the SUMMARY exists and work was completed"
    why_human: "The checkbox at ROADMAP.md line 102 reads [ ] (unchecked) despite 24-02-SUMMARY.md existing. This is an administrative artifact inconsistency, not a code gap. Human should update to [x] and commit."
---

# Phase 24: Contract Bug Fixes — Verification Report

**Phase Goal:** JPY/USD orders execute without reverting, the E2E test suite passes 18/18, and all services point to the fixed contracts
**Verified:** 2026-02-27T23:55:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A market order on JPY/USD executes without reverting — the triggerPrice=0 division-by-zero is gone | VERIFIED | OrderHandler.sol lines 51-60 contain zero-guards: `if (params.numbers.triggerPrice != 0)` and `if (params.numbers.acceptablePrice != 0)` before Precision.mulDiv calls. Commit `aed293e8` in contracts repo. SUMMARY confirms order reaches oracle layer (not math layer) — proves the fix is operative. |
| 2 | `cast call <EXCHANGE_ROUTER> "orderHandler()(address)"` returns the NEW OrderHandler address | VERIFIED | Deployment artifacts confirm: ExchangeRouter `0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321`, OrderHandler `0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad`. Commit `90bb2b00` in contracts repo. SUMMARY documents on-chain `cast call` verification and user-approved Basescan checkpoint. |
| 3 | All five services reference the new OrderHandler and ExchangeRouter addresses | VERIFIED | SDK `contracts.ts` line 11: `0xF98622...4321`. E2E `config.ts` line 57: `0xF98622...4321`. Keeper `.env` line 21: `ORDER_HANDLER_ADDRESS="0x63dE8c...04Ad"`. `keeper-infrastructure.md` lines 41+45: both addresses updated. `.claude/contract-address-update-guide.md` lines 139+152: both addresses updated. Old addresses (`0x5AcE...f631`, `0xCf75...A397`) absent from all key files. Commits `0fbaac571` and `83556e560` in interface repo. |
| 4 | The E2E test suite passes 18/18 (including JPY/USD which was previously skipped) | FAILED | SUMMARY documents 17/18: 6/6 deposits, 6/6 withdrawals, 5/6 orders. JPY/USD order fails at Pyth Lazer oracle layer with "Best ask price is not present for the timestamp". SKIP_MARKETS is correctly emptied (`new Set<string>()`), so JPY/USD runs and receives FAIL status. `test-orders.ts` line 270: `allPassed = results.every(r => r.status === "PASS" \|\| r.status === "SKIP")` — a FAIL result causes exit code 1. |

**Score:** 3/4 success criteria verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `../0xmarkets_contract/contracts/exchange/OrderHandler.sol` | Zero-guarded reversed market price inversion | VERIFIED | Lines 51-60 contain `if (params.numbers.triggerPrice != 0)` and `if (params.numbers.acceptablePrice != 0)` guards. Both `mulDiv` calls protected. |
| `../0xmarkets_contract/deployments/baseSepolia/OrderHandler.json` | New OrderHandler deployment artifact | VERIFIED | File exists. Address: `0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad` (different from old `0xCf752B72...`). |
| `../0xmarkets_contract/deployments/baseSepolia/ExchangeRouter.json` | New ExchangeRouter deployment artifact | VERIFIED | File exists. Address: `0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321` (different from old `0x5AcE07B0...`). |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sdk/src/configs/contracts.ts` | Updated ExchangeRouter address | VERIFIED | Line 11: `ExchangeRouter: "0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321"` |
| `e2e/config.ts` | Updated ExchangeRouter address | VERIFIED | Line 57: `ExchangeRouter: "0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321" as Address` |
| `e2e/test-orders.ts` | JPY/USD no longer skipped | VERIFIED | Line 220: `const SKIP_MARKETS = new Set<string>();` — empty set, no markets skipped |
| `../order-execution-keeper-service/.env` | Updated ORDER_HANDLER_ADDRESS | VERIFIED | Line 21: `ORDER_HANDLER_ADDRESS="0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad"` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sdk/src/configs/contracts.ts` | ExchangeRouter on-chain | address string | WIRED | `ExchangeRouter: "0xF98622...4321"` matches deployment artifact. Frontend `src/config/contracts.ts` reads from SDK via `getContract()`. |
| `e2e/config.ts` | ExchangeRouter on-chain | address string in CONTRACTS | WIRED | `ExchangeRouter: "0xF98622...4321" as Address` matches deployment artifact. |
| `e2e/test-orders.ts` | All 6 markets including JPY/USD | SKIP_MARKETS set | WIRED | `SKIP_MARKETS = new Set<string>()` — JPY/USD included. However, JPY/USD FAILS at oracle layer. |
| ExchangeRouter | OrderHandler | immutable constructor arg | WIRED | Deployment artifacts confirm both new addresses. SUMMARY documents `cast call` on-chain verification confirmed. ROUTER_PLUGIN role fixed (wrong hash from Plan 01, corrected via on-chain TX `0x7c594a9ef6...`). |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CFIX-01 | 24-01-PLAN.md | OrderHandler guards triggerPrice=0 before inverting on reversed markets | SATISFIED | Zero-guards present in OrderHandler.sol lines 51-60. Commit `aed293e8`. REQUIREMENTS.md marks complete. |
| CFIX-02 | 24-01-PLAN.md | OrderHandler and ExchangeRouter redeployed atomically to Base Sepolia | SATISFIED | Both deployment artifacts contain new addresses. Commit `90bb2b00`. REQUIREMENTS.md marks complete. |
| CFIX-03 | 24-02-PLAN.md | All service configs updated with new contract addresses | SATISFIED | All 5 config locations updated (SDK, E2E config, keeper .env, docs x2). Old addresses absent. REQUIREMENTS.md marks complete. |

All three requirement IDs from PLAN frontmatter are accounted for in REQUIREMENTS.md and show verified implementation in the codebase.

**Orphaned requirements:** None. No REQUIREMENTS.md entries map to Phase 24 beyond CFIX-01, CFIX-02, CFIX-03.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/ROADMAP.md` | 102 | `[ ] 24-02-PLAN.md` — checkbox unchecked despite SUMMARY existing and work completed | Info | Administrative only. Phase 24 is marked complete at line 84 (`[x] **Phase 24: Contract Bug Fixes**`). The per-plan checkbox was not updated when 24-02 was finished. No code impact. |
| `e2e/test-orders.ts` | 246-250 | SKIP_MARKETS block still has stale error message referencing "Phase 24" div-by-zero bug, but SKIP_MARKETS is empty so this code is dead | Info | Dead code. Since SKIP_MARKETS is always empty now, the SKIP branch (lines 246-256) can never execute. Not a blocker but could mislead future readers. |

No blocker or warning anti-patterns found in production code.

---

## Human Verification Required

### 1. JPY/USD Oracle Data Availability

**Test:** Submit a JPY/USD market order via E2E test (`npx tsx test-orders.ts`)
**Expected:** Order should submit to new ExchangeRouter, be picked up by keeper, and either (a) execute successfully if Pyth Lazer has JPY/USD price data available, or (b) fail with oracle error "Best ask price is not present" — confirming the revert is at oracle layer, not in OrderHandler math
**Why human:** Cannot run live E2E test programmatically from this context. Requires live Base Sepolia state, running order-execution-keeper with new ORDER_HANDLER_ADDRESS, and Pyth Lazer oracle data availability at test time (intermittent on testnet).

### 2. ROADMAP.md 24-02 Checkbox Update

**Test:** Open `.planning/ROADMAP.md` line 102
**Expected:** Change `[ ] 24-02-PLAN.md` to `[x] 24-02-PLAN.md` to reflect completed work
**Why human:** Minor administrative fix. The checkbox does not affect any automated tooling, but keeping it inconsistent may cause confusion in future phase tracking.

---

## Gaps Summary

### Gap 1: E2E 18/18 Target Not Achieved (Success Criterion 4)

The phase goal explicitly requires "the E2E test suite passes 18/18." The actual result from Plan 02 execution is **17/18** — 6/6 deposits, 6/6 withdrawals, 5/6 orders. JPY/USD order fails at the Pyth Lazer oracle layer ("Best ask price is not present for the timestamp").

**What is correct:**
- The Solidity fix is operative: JPY/USD orders no longer revert inside OrderHandler.sol with a division-by-zero panic. The order successfully passes through OrderHandler's `createOrder()` and reaches the keeper's `executeOrder()` step.
- SKIP_MARKETS was correctly emptied — JPY/USD is no longer hidden.
- All address propagation is complete and correct.

**What is missing:**
The Pyth Lazer oracle on Base Sepolia testnet does not consistently have JPY/USD price data for the timestamps required by the keeper's `executeOrder()` call. This is a testnet infrastructure issue, not a contract code issue. The SUMMARY correctly characterizes this as "a pre-existing testnet oracle infrastructure issue, not caused by the contract fix."

**Impact on phase goal:** The phase goal ("E2E test suite passes 18/18") is not met in a clean automated run. The underlying contract bug is fixed, but the E2E success criterion that was intended to verify the fix cannot be cleanly satisfied due to oracle data availability on testnet.

**Path to close the gap:** Either (a) investigate and fix Pyth Lazer oracle data feed for JPY/USD on Base Sepolia so the keeper can source prices reliably, or (b) reframe the success criterion to accept 17/18 with documented oracle gap as a known testnet limitation. This is a scope question — the contract fix itself (CFIX-01, CFIX-02, CFIX-03) is fully complete.

---

_Verified: 2026-02-27T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
