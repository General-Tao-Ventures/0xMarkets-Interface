---
phase: 18-event-detection-and-toast-feedback
verified: 2026-02-27T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Deposit toast Pending -> Executed lifecycle on live testnet"
    expected: "Toast appears immediately on submission and updates to Executed when keeper executes the deposit"
    why_human: "Live network behavior already confirmed by human tester in 18-02 UAT (Test A: PASS)"
  - test: "Withdrawal toast Pending -> Executed lifecycle on live testnet"
    expected: "Toast appears immediately on submission and updates to Executed when keeper executes the withdrawal"
    why_human: "Live network behavior already confirmed by human tester in 18-02 UAT (Test B: PASS)"
  - test: "Market order toast Pending -> Executed lifecycle on live testnet"
    expected: "Toast appears immediately on submission and updates to Executed when keeper executes the order"
    why_human: "Live network behavior already confirmed by human tester in 18-02 UAT (Test C: PASS)"
---

# Phase 18: Event Detection and Toast Feedback — Verification Report

**Phase Goal:** Detect execution events reliably and show toast feedback for all operation types (deposit, withdrawal, order). Add polling fallback for missed WebSocket events and timeout handling.
**Verified:** 2026-02-27
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                        | Status     | Evidence                                                                                                              |
|----|----------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------|
| 1  | After a deposit is submitted, the DepositExecuted event is detected even if WebSocket misses it | VERIFIED | `useExecutionPolling` Phase B polls `eth_getLogs` for `DEPOSIT_EXECUTED_HASH`; `createDepositTxn` calls `watchOrderTxn(res.hash)` so Phase A detects DepositCreated from tx receipt |
| 2  | After a withdrawal is submitted, the WithdrawalExecuted event is detected even if WebSocket misses it | VERIFIED | Same pattern: `createWithdrawalTxn` calls `watchOrderTxn(res.hash)`, Phase A then Phase B covers `WITHDRAWAL_EXECUTED_HASH` |
| 3  | After an order is submitted, the OrderExecuted event is detected even if WebSocket misses it   | VERIFIED | Orders already called `watchOrderTxn` via `useOrderTxnCallbacks`; useEffect deps fixed to exclude status objects, preventing interval churn |
| 4  | If an operation is cancelled on-chain, the cancellation event is detected and the toast shows an error state | VERIFIED | `DEPOSIT_CANCELLED_HASH`, `WITHDRAWAL_CANCELLED_HASH`, `ORDER_CANCELLED_HASH` all polled in Phase B; `cancelledTxnHash` set; `hasError` in toast components is `Boolean(cancelledTxnHash)` |
| 5  | If an operation is neither executed nor cancelled within the timeout window, the toast transitions to an error/timeout state | VERIFIED | `MAX_WAIT_MS = 5 * 60 * 1000`; polling sets `cancelledTxnHash: EXECUTION_TIMEOUT_HASH`; GmStatusNotification and OrderStatusNotification handle this sentinel with user-friendly messages |
| 6  | Toast appears immediately after deposit submission | VERIFIED | `setPendingDeposit` is called in the `.then()` callback of `callContract` in `createDepositTxn.ts`; toast component shows creation status immediately |
| 7  | Toast appears immediately after withdrawal submission | VERIFIED | `setPendingWithdrawal` called in `.then()` of `callContract` in `createWithdrawalTxn.ts` |
| 8  | Toast appears immediately after order submission | VERIFIED | `setPendingOrder` called in `useOrderTxnCallbacks`; existing mechanism unchanged |
| 9  | Timeout toasts show user-friendly messages, not raw hashes or BaseScan links | VERIFIED | `GmStatusNotification.tsx` lines 335-337 and 361-363 show timeout-specific strings; keeper API fetch guarded with `!== EXECUTION_TIMEOUT_HASH`; `OrderStatusNotification.tsx` line 315 guards BaseScan link |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact                                                                                     | Provides                                              | Status      | Details                                                                                                                 |
|----------------------------------------------------------------------------------------------|-------------------------------------------------------|-------------|------------------------------------------------------------------------------------------------------------------------|
| `src/context/SyntheticsEvents/useExecutionPolling.ts`                                        | RPC-based polling fallback for missed WebSocket events | VERIFIED    | 409-line implementation with Phase A (receipt detection) and Phase B (eth_getLogs polling); exports `useExecutionPolling` |
| `src/context/SyntheticsEvents/types.ts`                                                      | `EXECUTION_TIMEOUT_HASH` constant                     | VERIFIED    | Exported at line 13: `export const EXECUTION_TIMEOUT_HASH = "timeout"`                                                |
| `src/context/SyntheticsEvents/SyntheticsEventsProvider.tsx`                                  | Integration of polling fallback + `watchOrderTxn`     | VERIFIED    | Imports `useExecutionPolling` (line 91), calls it at line 901; `watchOrderTxn` callback defined at line 157            |
| `src/components/StatusNotification/GmStatusNotification.tsx`                                  | Timeout-specific messages for deposits and withdrawals | VERIFIED    | Lines 335-337 (deposit timeout), 361-363 (withdrawal timeout); keeper API guarded lines 494 and 505                   |
| `src/components/StatusNotification/OrderStatusNotification.tsx`                               | Timeout-specific message for orders; no BaseScan link for timeouts | VERIFIED | Lines 315-317 handle `EXECUTION_TIMEOUT_HASH`; no `txnHash` assigned for timeout case                                |
| `src/domain/synthetics/markets/createDepositTxn.ts`                                          | `watchOrderTxn` called after deposit tx sent          | VERIFIED    | `watchOrderTxn?` in `CreateDepositParams` (line 39); called at lines 136-138 with `res?.hash` guard                  |
| `src/domain/synthetics/markets/createWithdrawalTxn.ts`                                       | `watchOrderTxn` called after withdrawal tx sent       | VERIFIED    | `watchOrderTxn?` in `CreateWithdrawalParams` (line 40); called at lines 121-123 with `res?.hash` guard               |
| `src/components/GmSwap/GmSwapBox/GmDepositWithdrawalBox/useDepositWithdrawalTransactions.tsx` | `watchOrderTxn` threaded from context to tx functions  | VERIFIED    | Destructured at line 79; passed to `createDepositTxn` (line 188) and `createWithdrawalTxn` (line 315); in both `useCallback` dep arrays |

---

### Key Link Verification

| From                                                          | To                                                         | Via                                          | Status   | Details                                                                                                             |
|---------------------------------------------------------------|------------------------------------------------------------|----------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------|
| `useExecutionPolling.ts`                                      | EventEmitter contract via `eth_getLogs`                    | `provider.getLogs` in `pollForEvents`         | WIRED    | `pollForEvents()` at line 350 calls `provider.getLogs(...)` with `address: eventEmitterAddress` and topic filters   |
| `useExecutionPolling.ts`                                      | `SyntheticsEventsProvider` state                           | `setDepositStatuses`, `setWithdrawalStatuses`, `setOrderStatuses` | WIRED | All three setters called with `updateByKey` when events found (lines 234, 254, 268, 287, 302, 304); timeout sets `cancelledTxnHash: EXECUTION_TIMEOUT_HASH` |
| `SyntheticsEventsProvider.tsx`                                | `GmStatusNotification.tsx`                                 | `useSyntheticsEvents().depositStatuses`       | WIRED    | `GmStatusNotification` imports `useSyntheticsEvents` and reads `depositStatuses`, `withdrawalStatuses`              |
| `SyntheticsEventsProvider.tsx`                                | `OrderStatusNotification.tsx`                              | `useSyntheticsEvents().orderStatuses`         | WIRED    | `OrderStatusNotification` reads `orderStatuses` via `useSyntheticsEvents()`                                         |
| `useDepositWithdrawalTransactions.tsx`                        | `createDepositTxn.ts`                                      | `watchOrderTxn` in `CreateDepositParams`      | WIRED    | `watchOrderTxn` passed at line 188; dep in `useCallback` at line 218                                               |
| `useDepositWithdrawalTransactions.tsx`                        | `createWithdrawalTxn.ts`                                   | `watchOrderTxn` in `CreateWithdrawalParams`   | WIRED    | `watchOrderTxn` passed at line 315; dep in `useCallback` at line 344                                               |

---

### Requirements Coverage

The plans reference requirements IDs `DET-01`, `DET-02`, `DET-03`, `FB-03` across plans 18-01 and 18-03. These IDs do **not exist** in `REQUIREMENTS.md` — they are plan-internal labels only. The officially tracked requirements for Phase 18 in REQUIREMENTS.md are:

| Requirement | Source Plan | Description                                               | Status      | Evidence                                                                                              |
|-------------|-------------|-----------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------|
| FB-01       | 18-02       | Toast shows "Pending..." immediately after deposit submission | SATISFIED | `setPendingDeposit` called in `createDepositTxn.ts` `.then()` callback; `GmStatusNotification` renders pending state immediately |
| FB-02       | 18-02       | Toast updates to "Executed!" when DepositExecuted event is detected | SATISFIED | `DepositExecuted` handler sets `executedTxnHash`; polling fallback also detects it via `DEPOSIT_EXECUTED_HASH`; human UAT confirmed PASS |

**Orphaned requirement IDs (plan-internal, not in REQUIREMENTS.md):** `DET-01`, `DET-02`, `DET-03`, `FB-03` — these label behaviors that are implemented (deposit/withdrawal/order detection; WS polling fallback) but were never formally added to the official requirements list. This is a documentation gap, not an implementation gap. The behaviors are fully implemented.

---

### Anti-Patterns Found

| File                                            | Line | Pattern                                  | Severity | Impact                                                                                    |
|-------------------------------------------------|------|------------------------------------------|----------|-------------------------------------------------------------------------------------------|
| `src/domain/synthetics/markets/createDepositTxn.ts` | 110 | `// TODO: Re-enable simulation after DataStore config is complete` | Info | Pre-existing; simulation disabled before Phase 18; simulation is unrelated to event detection scope |

No blockers or warnings found in Phase 18 files.

---

### Human Verification Required

All three items were already verified by a human tester during the 18-02 UAT session (2026-02-27). Results on record:

**1. Deposit Toast Lifecycle (DET-01, FB-01, FB-02)**
- **Test:** Submit a deposit of USDC on the Pools page
- **Expected:** Toast appears immediately ("Sending buy request") then updates to "Buy order executed" after keeper runs
- **Result (recorded):** PASS — 100 USDC deposit into ETH pool succeeded. Toast: Pending -> Executed.

**2. Withdrawal Toast Lifecycle (DET-02)**
- **Test:** Submit a GM token withdrawal on the Pools page
- **Expected:** Toast appears immediately ("Sending sell request") then updates to "Sell order executed"
- **Result (recorded):** PASS — Toast: Pending -> Executed.

**3. Market Order Toast Lifecycle (DET-03)**
- **Test:** Submit a market long order on the Trade page
- **Expected:** Toast appears immediately ("Sending order request") then updates to "Order executed"
- **Result (recorded):** PASS — Toast: Pending -> Executed.

---

### Gaps Summary

No gaps. All must-haves verified. The phase went through three plans: 18-01 (implementation), 18-02 (UAT — initially failed, then Plan 18-03 fixed root causes), 18-02 re-test (all passing). The final state of the codebase reflects all fixes applied:

- `useExecutionPolling` is substantive, wired, and stable (no interval churn)
- `watchOrderTxn` is called from both deposit and withdrawal transaction flows
- Timeout sentinel `EXECUTION_TIMEOUT_HASH` is used consistently across all toast components
- Keeper API fetches are guarded against the timeout sentinel
- TypeScript compiles cleanly (zero errors)

---

_Verified: 2026-02-27_
_Verifier: Claude (gsd-verifier)_
