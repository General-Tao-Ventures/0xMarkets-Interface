---
phase: 22-frontend-feedback
verified: 2026-02-27T07:30:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Deposit Pending-to-Executed toast lifecycle on live testnet"
    expected: "After submitting a deposit, a toast appears immediately with a spinner/loading state; when DepositExecuted event fires, the toast updates to show Executed; the toast auto-dismisses after ~5 seconds"
    why_human: "Cannot programmatically simulate on-chain keeper execution or observe React toast DOM transitions"
  - test: "Withdrawal Pending-to-Executed toast lifecycle on live testnet"
    expected: "After submitting a withdrawal, a toast appears immediately; when WithdrawalExecuted event fires, the toast updates to Executed; auto-dismisses after ~5 seconds"
    why_human: "Requires live testnet keeper execution to verify event detection -> toast update pathway"
  - test: "Order Pending-to-Executed toast lifecycle on live testnet"
    expected: "After submitting a market order, a toast appears immediately; when OrderExecuted event fires, the toast updates to Executed; auto-dismisses after ~5 seconds"
    why_human: "Requires live keeper execution; SUMMARY.md already records human approval but formal UAT trace is noted here"
  - test: "GM token balances auto-refresh on pools page after deposit executes"
    expected: "GM token balance updates within seconds of keeper execution without user triggering a page refresh"
    why_human: "SWR revalidation path verified in code, but actual timing and UI update cannot be confirmed without browser execution"
  - test: "Positions list auto-refresh on trade page after order executes"
    expected: "New position appears in the positions list within seconds of keeper execution without a page refresh"
    why_human: "SWR key matching (key[1] === 'usePositionsData') is the right pattern but correctness of the key against actual hook behavior needs live confirmation"
---

# Phase 22: Frontend Feedback Verification Report

**Phase Goal:** Users see real-time toast notifications for every operation and never need to manually refresh to see updated balances or positions
**Verified:** 2026-02-27T07:30:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After submitting a deposit, a "Pending..." toast appears immediately and updates to "Executed!" when DepositExecuted is detected | ? HUMAN | `setPendingDeposit()` calls `helperToast.success(<GmStatusNotification>)` immediately; GmStatusNotification uses `status="loading"` until `executedTxnHash` is set. Auto-close wired via `useToastAutoClose(isCompleted, toastTimestamp)` reading `TOAST_AUTO_CLOSE_TIME=5000`. Pending toast confirmed code-side; Executed transition requires live observation. |
| 2 | After submitting a withdrawal, a "Pending..." toast appears immediately and updates to "Executed!" when WithdrawalExecuted is detected | ? HUMAN | Same pattern as deposit: `setPendingWithdrawal()` triggers `helperToast.success(<GmStatusNotification pendingWithdrawalData>)` immediately; `WithdrawalExecuted` handler updates state to `executedTxnHash`, which GmStatusNotification renders as success. |
| 3 | After submitting a market order, a "Pending..." toast appears immediately and updates to "Executed!" when OrderExecuted is detected | ? HUMAN | `setPendingOrder()` calls `helperToast.success(<OrdersStatusNotificiation>)` immediately with `autoClose: false`; `OrderExecuted` handler calls `setOrderStatuses(... executedTxnHash)` and then `triggerPositionsRefresh()`. `isCompleted` in `OrdersStatusNotificiation` returns true only on `executedTxnHash` for market orders (line 518-519). `useToastAutoClose(isCompleted, toastTimestamp)` then fires after 5000ms. |
| 4 | GM token balances on the pools page auto-refresh after a deposit or withdrawal executes | ? HUMAN | `DepositExecuted`, `DepositCancelled`, `GlvDepositExecuted`, `GlvDepositCancelled`, `WithdrawalExecuted`, `WithdrawalCancelled`, `GlvWithdrawalExecuted`, `GlvWithdrawalCancelled` handlers all call `triggerPoolRefresh()`. This function guards on `pathname.startsWith("/pools")` and then fires `globalMutate(key => key[1] === "useMarketTokensData")` with 300ms debounce. Code is correct; actual cache invalidation effectiveness needs live verification. |
| 5 | Positions list on the trade page auto-refresh after an order executes | ? HUMAN | `OrderExecuted` and `OrderCancelled` handlers both call `triggerPositionsRefresh()`. This function guards on `pathname.startsWith("/trade")` and fires `globalMutate(key => key[1] === "usePositionsData")` with 300ms debounce. SUMMARY records human approval on live testnet (commit b3054ebcf). |

**Score:** 5/5 truths — all have correct code implementation; 5 require human confirmation for final sign-off.

**Automated evidence strength:** HIGH. All code pathways are fully implemented and wired. The `? HUMAN` status reflects that the behaviors involve live on-chain events and browser-side SWR cache behavior that cannot be simulated programmatically.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/config/ui.ts` | TOAST_AUTO_CLOSE_TIME set to 5000 | VERIFIED | Line 2: `export const TOAST_AUTO_CLOSE_TIME = 5000;` |
| `src/App/AppRoutes.tsx` | ToastContainer with limit={3} | VERIFIED | Lines 123-136: `<ToastContainer limit={3} autoClose={TOAST_AUTO_CLOSE_TIME} ...>` |
| `src/components/StatusNotification/OrderStatusNotification.tsx` | Order cancellation error reasons from keeper API, getOrderActionableMessage() | VERIFIED | Lines 48-68: `KEEPER_API_URL`, `getOrderActionableMessage()` function; lines 93, 417-431: `keeperErrorReason` state + fetch useEffect; line 346: `getOrderActionableMessage(keeperErrorReason)` used in executionStatus |
| `src/context/SyntheticsEvents/SyntheticsEventsProvider.tsx` | Page-aware SWR revalidation on execution events | VERIFIED | Lines 201-252: `useSWRConfig`, `useLocation`, `triggerBalanceRefresh`, `triggerPoolRefresh`, `triggerPositionsRefresh` with 300ms debounce and cleanup; 10 event handlers wired |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OrderStatusNotification.tsx` | `/api/order-keeper/api/orders/{key}` | fetch on cancelledTxnHash detection | WIRED | Lines 417-431: `fetch(\`${KEEPER_API_URL}/api/orders/${orderStatusKey}\`)` fires when `cancelledTxnHash` is set, is not EXECUTION_TIMEOUT_HASH, and txnType !== "cancel" |
| `SyntheticsEventsProvider.tsx` | SWR globalMutate("useMarketTokensData") | triggerPoolRefresh() in deposit/withdrawal handlers | WIRED | 8 handlers (GlvDepositExecuted:550, DepositExecuted:566, DepositCancelled:582, GlvDepositCancelled:599, WithdrawalExecuted:695, GlvWithdrawalExecuted:712, WithdrawalCancelled:730, GlvWithdrawalCancelled:748) all call `triggerPoolRefresh()` |
| `SyntheticsEventsProvider.tsx` | SWR globalMutate("usePositionsData") | triggerPositionsRefresh() in order handlers | WIRED | OrderExecuted:377, OrderCancelled:450 both call `triggerPositionsRefresh()` |
| `useToastAutoClose` | toast.dismiss() after 5000ms | TOAST_AUTO_CLOSE_TIME = 5000 | WIRED | `useToastAutoClose.ts` line 14 reads `TOAST_AUTO_CLOSE_TIME` from `config/ui`; `ui.ts` value is 5000 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FB-01 | 22-01 | Toast shows "Pending..." immediately after deposit submission | SATISFIED | `setPendingDeposit()` in SyntheticsEventsProvider calls `helperToast.success(<GmStatusNotification pendingDepositData>)` immediately with `autoClose: false` |
| FB-02 | 22-01 | Toast updates to "Executed!" when DepositExecuted event detected | SATISFIED | `DepositExecuted` handler sets `executedTxnHash`; GmStatusNotification renders success state; `useToastAutoClose` fires after 5s |
| FB-03 | 22-01 | Toast shows "Pending..." immediately after withdrawal submission | SATISFIED | `setPendingWithdrawal()` calls `helperToast.success(<GmStatusNotification pendingWithdrawalData>)` immediately |
| FB-04 | 22-01 | Toast updates to "Executed!" when WithdrawalExecuted event detected | SATISFIED | `WithdrawalExecuted` handler sets `executedTxnHash`; same lifecycle as FB-02 |
| FB-05 | 22-01 | Toast shows "Pending..." immediately after order submission | SATISFIED | `setPendingOrder()` calls `helperToast.success(<OrdersStatusNotificiation>)` immediately with `autoClose: false` |
| FB-06 | 22-01 | Toast updates to "Executed!" when OrderExecuted event detected | SATISFIED | `OrderExecuted` handler sets `executedTxnHash`; `isCompleted` for market orders requires `executedTxnHash`; `useToastAutoClose` fires |
| FB-07 | 22-02 | Balances auto-refresh when deposit/withdrawal executes | SATISFIED | 8 deposit/withdrawal event handlers call `triggerPoolRefresh()` → `globalMutate("useMarketTokensData")` + universal `triggerBalanceRefresh()` → `globalMutate("useTokenBalances")` |
| FB-08 | 22-02 | Positions auto-refresh when order executes | SATISFIED | OrderExecuted and OrderCancelled handlers call `triggerPositionsRefresh()` → `globalMutate("usePositionsData")` when on `/trade` |

**Note on FB-01/FB-02:** REQUIREMENTS.md traceability table assigns FB-01 and FB-02 to Phase 18 (both marked Complete). Phase 22 Plan 01 also claims them. The CONTEXT.md clarifies: "Phase 18 already built the polling infrastructure and deposit toast lifecycle." Phase 22 extended the pattern to withdrawals and orders. The requirement is satisfied regardless of which phase gets credit.

**No orphaned requirements found.** All FB-01 through FB-08 are accounted for across Plans 22-01 and 22-02.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `OrderStatusNotification.tsx` | 239 | `return null` | INFO | Legitimate: `externalSwapStatus` returns null when no external swap quote exists. Not a stub. |
| `OrderStatusNotification.tsx` | 311 | `return null` | INFO | Legitimate: `executionStatus` returns null when order is not a market order type. Not a stub. |

No blocker or warning anti-patterns found. Both `return null` instances are intentional conditional renders with substantive logic in the active path.

### Human Verification Required

#### 1. Deposit Toast Lifecycle (FB-01, FB-02)

**Test:** Submit a deposit into an ETH/USD GM pool on the live testnet
**Expected:** Pending toast appears immediately with spinner; when keeper executes the deposit (DepositExecuted event detected), toast updates to show "Executed" status; toast auto-dismisses after approximately 5 seconds
**Why human:** On-chain event detection + React DOM toast state transition cannot be verified programmatically

#### 2. Withdrawal Toast Lifecycle (FB-03, FB-04)

**Test:** Submit a withdrawal of GM tokens
**Expected:** Pending toast appears immediately; toast updates to Executed on WithdrawalExecuted event; auto-dismisses after ~5 seconds
**Why human:** Same as above — requires live keeper interaction

#### 3. Market Order Toast Lifecycle (FB-05, FB-06)

**Test:** Submit a market long or short order
**Expected:** Pending toast appears immediately; when OrderExecuted fires, toast updates to Executed; auto-dismisses after ~5 seconds
**Why human:** SUMMARY.md records prior human approval on this scenario but formal verification is noted here; repeat if desired for sign-off

#### 4. GM Token Balance Auto-Refresh (FB-07)

**Test:** While on the pools page, submit and complete a deposit or withdrawal. Do not touch the page.
**Expected:** GM token balance column updates within 1-2 seconds of execution without any page interaction
**Why human:** SWR cache invalidation behavior depends on actual SWR key match at runtime. The key matcher `key[1] === "useMarketTokensData"` must match the actual SWR key used by `useMarketTokensData`. Code inspection confirms the pattern is correct, but runtime verification establishes certainty.

#### 5. Positions List Auto-Refresh (FB-08)

**Test:** While on the trade page, submit a market order. Wait for execution.
**Expected:** New position appears in the positions list without refreshing the page
**Why human:** `key[1] === "usePositionsData"` must match actual SWR key from `usePositions.ts`. SUMMARY records successful human verification (commit b3054ebcf), but recorded here for completeness.

### Toast UX Configuration Verified

The following UX decisions from CONTEXT.md are confirmed implemented:

| Decision | Value | Evidence |
|----------|-------|----------|
| Executed toast auto-dismiss | 5 seconds | `TOAST_AUTO_CLOSE_TIME = 5000` in `ui.ts`; `useToastAutoClose` reads this value |
| Max visible toasts | 3 | `ToastContainer limit={3}` in `AppRoutes.tsx` line 124 |
| Error toasts require manual dismiss | Yes | `isCompleted` for market orders is `false` when `cancelledTxnHash` is set (only `executedTxnHash` makes it true); `useToastAutoClose` never fires |
| Order cancellation error reasons | Human-readable | `getOrderActionableMessage(keeperErrorReason)` maps raw error strings to user-friendly messages; keeper API fetch wired |
| Debounce on rapid events | 300ms | `poolRefreshTimerRef` and `positionsRefreshTimerRef` guard against rapid re-triggering |
| Page-aware refresh | Yes | `/pools` guard for pool data, `/trade` guard for positions, no guard for token balances |
| Cancellation also triggers refresh | Yes | `DepositCancelled`, `GlvDepositCancelled`, `WithdrawalCancelled`, `GlvWithdrawalCancelled`, `OrderCancelled` all call respective refresh functions |

### Gaps Summary

No gaps found. All code-verifiable artifacts are implemented, substantive, and wired. The phase status is `human_needed` because the core user-facing behaviors (toast lifecycle transitions and SWR cache invalidation visibility) require live testnet interaction to confirm end-to-end correctness. The automated code evidence is strong: all event handlers are wired, all SWR mutate calls are present, all toast components have correct state transitions, and all commits are verified in git history.

---

_Verified: 2026-02-27T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
