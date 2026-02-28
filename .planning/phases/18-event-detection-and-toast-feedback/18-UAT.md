---
status: diagnosed
phase: 18-event-detection-and-toast-feedback
source: 18-01-SUMMARY.md
started: 2026-02-26T17:20:00Z
updated: 2026-02-26T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Deposit Toast Lifecycle
expected: Submit a Buy GM deposit on the Pools page. Toast shows "Pending..." then updates to "Executed!" when DepositExecuted event is detected on-chain.
result: issue
reported: "it does not work. the toast remains open and stuck on keeper executing. then it shows 'Taking longer than expected...'"
severity: major

### 2. Withdrawal Toast Lifecycle
expected: Submit a Sell GM (withdrawal) on the Pools page. Toast shows "Pending..." then updates to "Executed!" when WithdrawalExecuted event is detected.
result: issue
reported: "same issue as deposit"
severity: major

### 3. Market Order Toast Lifecycle
expected: Submit a market order (long or short) on the Trade page. Toast shows "Pending..." then updates to "Executed!" when OrderExecuted event is detected.
result: issue
reported: "same issue as deposit"
severity: major

### 4. Timeout Handling
expected: If an operation takes longer than 5 minutes without execution, the toast should update to an error/timeout state with an actionable message — not stay stuck on "Pending..." forever.
result: issue
reported: "the toast advances through messages but it never shows success. now its at 2m and its saying it may be stuck"
severity: major

## Summary

total: 4
passed: 0
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Toast updates to Executed! when DepositExecuted event is detected on-chain"
  status: failed
  reason: "User reported: toast remains stuck on keeper executing, then Taking longer than expected"
  severity: major
  test: 1
  root_cause: "createDepositTxn never calls watchOrderTxn(txHash) — Phase A polling has no watched hashes, so DepositCreated is never detected, depositStatuses never gets createdTxnHash, Phase B never starts"
  artifacts:
    - path: "src/domain/synthetics/markets/createDepositTxn.ts"
      issue: "No watchOrderTxn call after callContract returns txHash"
    - path: "src/components/GmSwap/GmSwapBox/GmDepositWithdrawalBox/useDepositWithdrawalTransactions.tsx"
      issue: "Does not destructure watchOrderTxn from useSyntheticsEvents"
  missing:
    - "Call watchOrderTxn(txHash) after deposit transaction is sent"
    - "Pass watchOrderTxn through deposit transaction params"

- truth: "Toast updates to Executed! when WithdrawalExecuted event is detected on-chain"
  status: failed
  reason: "User reported: same issue as deposit"
  severity: major
  test: 2
  root_cause: "createWithdrawalTxn never calls watchOrderTxn(txHash) — same root cause as deposit"
  artifacts:
    - path: "src/domain/synthetics/markets/createWithdrawalTxn.ts"
      issue: "No watchOrderTxn call after callContract returns txHash"
  missing:
    - "Call watchOrderTxn(txHash) after withdrawal transaction is sent"
    - "Pass watchOrderTxn through withdrawal transaction params"

- truth: "Toast updates to Executed! when OrderExecuted event is detected on-chain"
  status: failed
  reason: "User reported: same issue as deposit"
  severity: major
  test: 3
  root_cause: "Orders DO call watchOrderTxn but useEffect dependency array includes status objects causing interval churn — polling interval constantly torn down and restarted"
  artifacts:
    - path: "src/context/SyntheticsEvents/useExecutionPolling.ts"
      issue: "useEffect deps include depositStatuses, withdrawalStatuses, orderStatuses causing excessive restarts; status objects already read via refs"
  missing:
    - "Remove status objects from useEffect dependency array — they are read via refs"

- truth: "Toast shows success when operation completes, timeout error when it doesn't"
  status: failed
  reason: "User reported: toast advances through messages but never shows success, at 2m says may be stuck"
  severity: major
  test: 4
  root_cause: "Same as tests 1-3: execution events never detected, so toast only shows timeout escalation messages"
  artifacts: []
  missing: []
