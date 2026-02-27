---
phase: 23-automated-e2e-testing
verified: 2026-02-27T00:00:00Z
status: gaps_found
score: 3/4 success criteria verified
gaps:
  - truth: "Running the order test script produces a pass/fail result for each of the 6 markets (6 results total)"
    status: partial
    reason: "test-orders.ts hardcodes JPY/USD as SKIP due to a known contract bug (OrderHandler div-by-zero on reversed markets). The script emits a SKIP result for JPY/USD rather than a PASS or FAIL. Only 5 markets are actually tested."
    artifacts:
      - path: "e2e/test-orders.ts"
        issue: "SKIP_MARKETS = new Set(['JPY/USD']) at line 222 — JPY/USD is structurally excluded, not tested and failed"
    missing:
      - "Either: fix the contract bug (Phase 24) so all 6 markets can be tested, OR document that SKIP is an accepted result type for known contract defects and update Success Criterion 3 and 4 in ROADMAP.md to reflect 17/18 as the current baseline"
  - truth: "All 18 tests pass on a clean run against the deployed keeper and live Base Sepolia contracts"
    status: failed
    reason: "By design, only 17 tests run to completion: deposits 6/6, withdrawals 6/6, orders 5/6 (JPY/USD skipped). The goal of 18/18 PASS cannot be achieved until the JPY/USD contract bug is resolved in Phase 24."
    artifacts:
      - path: "e2e/test-orders.ts"
        issue: "Exit code for test-orders.ts is 0 when 5 PASS + 1 SKIP — the orchestrator test:all command exits 0 despite 17/18 rather than 18/18"
    missing:
      - "Phase 24 contract fix: remove JPY/USD from SKIP_MARKETS after OrderHandler is redeployed with triggerPrice=0 guard"
      - "REQUIREMENTS.md: TEST-02 and TEST-03 are still marked [ ] and Pending — they need to be updated to [x] and Complete since the scripts exist and pass"

human_verification:
  - test: "Run full E2E suite end-to-end with keeper active"
    expected: "pnpm tsx test-deposits.ts: 6/6 PASS, pnpm tsx test-withdrawals.ts: 6/6 PASS, pnpm tsx test-orders.ts: 5/6 PASS + 1 SKIP, exit 0"
    why_human: "Tests require keeper running at localhost:37018 and live Base Sepolia — cannot simulate programmatically"
---

# Phase 23: Automated E2E Testing Verification Report

**Phase Goal:** A repeatable test suite validates all 18 market x operation combinations, so regressions are caught before they reach users
**Verified:** 2026-02-27
**Status:** gaps_found — 3 of 4 success criteria verified; 1 partial, 1 failed (same root cause: JPY/USD contract bug)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the deposit test script produces a pass/fail result for each of the 6 markets (6 results total) | VERIFIED | `e2e/test-deposits.ts` iterates all 6 MARKETS entries, calls `testDeposit()` per market, returns PASS/FAIL per result, exits 0/1 |
| 2 | Running the withdrawal test script produces a pass/fail result for each of the 6 markets (6 results total) | VERIFIED | `e2e/test-withdrawals.ts` iterates all 6 markets, calls `testWithdrawal()` per market, returns PASS/FAIL per result |
| 3 | Running the order test script produces a pass/fail result for each of the 6 markets (6 results total) | PARTIAL | `e2e/test-orders.ts` iterates all 6 markets but JPY/USD is emitted as SKIP (not PASS or FAIL). Only 5 markets are actually tested against the keeper. |
| 4 | All 18 tests pass on a clean run against the deployed keeper and live Base Sepolia contracts | FAILED | By design, JPY/USD orders are skipped. Maximum achievable is 17 tests reaching PASS; 18/18 PASS requires Phase 24 contract fix. |

**Score:** 2/4 fully verified, 1 partial, 1 failed (both gaps share the same root cause)

---

## Required Artifacts

### Plan 23-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/config.ts` | Shared config: RPC URL, contract addresses, 6 market definitions, viem clients | VERIFIED | Exports `MARKETS` (6 entries), `CONTRACTS`, `USDC_ADDRESS`, `WETH_ADDRESS`, `EXECUTION_FEE`, `publicClient`, `walletClient`. Contains `MARKETS`. |
| `e2e/abis.ts` | ABI definitions for ExchangeRouter, EventEmitter, ERC20 | VERIFIED | Exports `exchangeRouterAbi` (multicall, sendWnt, sendTokens, createDeposit, createWithdrawal, createOrder), `eventEmitterAbi` (EventLog1), `erc20Abi`. Contains `exchangeRouterAbi`. |
| `e2e/helpers.ts` | Shared utilities: waitForExecution, extractOperationKey, ensureApprovals, formatResults | VERIFIED | All four functions exported. `waitForExecution` polls EventEmitter logs using raw topic matching for EventLog2. Contains `waitForExecution`. |
| `e2e/test-deposits.ts` | Deposit E2E test: submits deposit for each of 6 markets, waits for keeper execution | VERIFIED | Contains full `testDeposit()` implementation with multicall, receipt parsing, waitForExecution, PASS/FAIL logic. Contains `testDeposit`. |
| `e2e/package.json` | Minimal package with viem and tsx | VERIFIED | Contains `viem`, `dotenv`, `tsx`, `typescript`. Scripts: test:deposits, test:withdrawals, test:orders, test:all. |

### Plan 23-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/test-withdrawals.ts` | Withdrawal E2E test for 6 markets | VERIFIED | Full `testWithdrawal()` implementation: checks GM token balance, approves against SyntheticsRouter, builds multicall with sendWnt+sendTokens(marketToken)+createWithdrawal, calls waitForExecution("Withdrawal"). Contains `testWithdrawal`. |
| `e2e/test-orders.ts` | Market order E2E test for 6 markets | PARTIAL | Full `testOrder()` implementation for 5 markets. JPY/USD is hardcoded SKIP via `SKIP_MARKETS = new Set(["JPY/USD"])`. The function `testOrder` exists and is substantive but the 6th market is structurally excluded. Contains `testOrder`. |

---

## Key Link Verification

### Plan 23-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `e2e/test-deposits.ts` | `e2e/helpers.ts` | `import { waitForExecution, ensureApprovals }` | WIRED | Lines 14-18: imports `ensureApprovals`, `extractOperationKey`, `waitForExecution`, `formatResults`, `sleep`, `TestResult`. `waitForExecution` called at line 120. |
| `e2e/helpers.ts` | EventEmitter contract | `getLogs` polling for EventLog2 events by raw topic | WIRED | `waitForExecution()` uses `publicClient.getLogs({ address: eventEmitterAddress, topics: [null, null, operationKey], fromBlock, toBlock: "latest" })`. Uses pre-computed keccak256 hashes of event names as topic[1] filter. Note: actual event is EventLog2 (4 topics), not EventLog1 as named in abis.ts — but the raw topic approach handles both correctly. |
| `e2e/test-deposits.ts` | ExchangeRouter contract | `multicall` with sendWnt + sendTokens + createDeposit | WIRED | Lines 54-75: builds multicallData with encodeFunctionData for sendWnt, sendTokens (x2), createDeposit. Submitted via `walletClient.writeContract` at line 78. |

### Plan 23-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `e2e/test-withdrawals.ts` | `e2e/helpers.ts` | `import { waitForExecution, extractOperationKey }` | WIRED | Lines 11-17: imports `extractOperationKey`, `waitForExecution`, `formatResults`, `sleep`, `TestResult`. Both called within `testWithdrawal()`. |
| `e2e/test-orders.ts` | `e2e/helpers.ts` | `import { waitForExecution, extractOperationKey, ensureApprovals }` | WIRED | Lines 12-19: imports all three. `ensureApprovals` called at line 217, `extractOperationKey` at line 119, `waitForExecution` at line 135. |
| `e2e/test-withdrawals.ts` | ExchangeRouter contract | `multicall` with sendWnt + sendTokens(marketToken) + createWithdrawal | WIRED | Lines 96-112: multicallData built with sendWnt, sendTokens (market token), createWithdrawal. `createWithdrawal` pattern present. |
| `e2e/test-orders.ts` | ExchangeRouter contract | `multicall` with sendWnt + sendTokens(usdc) + createOrder | WIRED | Lines 74-90: multicallData with sendWnt, sendTokens, createOrder. `createOrder` pattern present. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEST-01 | 23-01-PLAN.md | E2E test script that tests deposits for all 6 markets and reports pass/fail | SATISFIED | `e2e/test-deposits.ts` implemented, commits e02997959 and d8b16dc77 confirmed. REQUIREMENTS.md already marks [x]. |
| TEST-02 | 23-02-PLAN.md | E2E test script that tests withdrawals for all 6 markets and reports pass/fail | SATISFIED (stale REQUIREMENTS.md) | `e2e/test-withdrawals.ts` implemented, commit 5a8a51ecf confirmed. Script tests all 6 markets. REQUIREMENTS.md incorrectly still shows `[ ]` Pending. |
| TEST-03 | 23-02-PLAN.md | E2E test script that tests market orders for all 6 markets and reports pass/fail | PARTIAL (stale REQUIREMENTS.md) | `e2e/test-orders.ts` implemented for 5/6 markets. JPY/USD is structurally skipped due to contract bug. Script exists but does not test all 6 markets. REQUIREMENTS.md incorrectly shows `[ ]` Pending; it should reflect the partial state. |

### Stale REQUIREMENTS.md

TEST-02 and TEST-03 are both marked `[ ]` and `Pending` in REQUIREMENTS.md even though both files exist with real implementations. The traceability table needs updating:

- TEST-02: Should be `[x]` Complete (script exists, tests 6/6 markets)
- TEST-03: Should be `[~]` Partial or `[ ]` with a note (script exists but JPY/USD is blocked by contract bug)

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/test-orders.ts` | 222 | `SKIP_MARKETS = new Set(["JPY/USD"])` | Warning | Structural exclusion of 1 market from the test suite. Not a code anti-pattern but a test coverage gap — the phase goal requires 18 tests to pass, and this makes 18/18 impossible without a contract fix. |
| `e2e/test-orders.ts` | 272 | `allPassed = results.every(r => r.status === "PASS" \|\| r.status === "SKIP")` | Info | Exit code 0 when JPY/USD is skipped. This means `pnpm run test:all` exits 0 even though only 17/18 tests actually ran. This is intentional behavior but may mislead CI into reporting all-clear on an incomplete suite. |

No placeholder implementations, TODO stubs, or unconnected artifacts found.

---

## Human Verification Required

### 1. Full Suite Run with Active Keeper

**Test:** With the order-execution-keeper-service running at `http://localhost:37018`, run:
```bash
cd e2e
COREPACK_ENABLE_STRICT=0 pnpm tsx test-deposits.ts
COREPACK_ENABLE_STRICT=0 pnpm tsx test-withdrawals.ts
COREPACK_ENABLE_STRICT=0 pnpm tsx test-orders.ts
```
**Expected:** deposits 6/6 PASS, withdrawals 6/6 PASS, orders 5/6 PASS + 1 SKIP (JPY/USD)
**Why human:** Tests submit real on-chain transactions and require the keeper service to execute them within 60s. Cannot simulate programmatically.

### 2. MARKET Env Var Filter

**Test:** `MARKET=WETH/USD COREPACK_ENABLE_STRICT=0 pnpm tsx test-deposits.ts`
**Expected:** Only 1 result, WETH/USD PASS, exit 0
**Why human:** Requires live testnet transaction.

---

## Gaps Summary

Two success criteria are not fully achieved. Both share the same root cause: **the JPY/USD contract bug (OrderHandler div-by-zero on reversed markets)** blocks all order testing for that market.

**Gap 1 — Order script does not produce a pass/fail for all 6 markets:** The script produces 5 PASS/FAIL results + 1 SKIP. SKIP is not a pass/fail result. The literal success criterion ("a pass/fail result for each of the 6 markets") is not met for the JPY/USD market.

**Gap 2 — 18/18 is not achievable until Phase 24:** The suite deliberately caps at 17 runnable tests. The current design treats this as a known limitation, not a bug in the test code. The test code itself is correct and well-structured; the blocker is the on-chain contract.

**What needs to happen to close these gaps:**

1. Phase 24 deploys a fixed OrderHandler with a `triggerPrice == 0` guard on reversed markets.
2. After redeployment, remove `"JPY/USD"` from `SKIP_MARKETS` in `e2e/test-orders.ts`.
3. Re-run `pnpm tsx test-orders.ts` and verify 6/6 PASS.
4. Update REQUIREMENTS.md: mark TEST-02 `[x]` and TEST-03 `[x]`, update traceability status to Complete.

**Note on REQUIREMENTS.md staleness:** TEST-02 is effectively complete (test-withdrawals.ts exists and covers all 6 markets) but is still marked Pending. This should be updated regardless of the Phase 24 contract work.

---

_Verified: 2026-02-27_
_Verifier: Claude (gsd-verifier)_
