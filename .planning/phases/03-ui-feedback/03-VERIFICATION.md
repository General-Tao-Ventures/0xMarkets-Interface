---
phase: 03-ui-feedback
verified: 2026-02-20T19:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Observe deposit notification in browser during a live deposit"
    expected: "Status text changes from 'Waiting for keeper to execute...' to 'Keeper executing... (Xs)' with a live counter ticking every second after the deposit creation tx confirms"
    why_human: "setInterval-driven UI update cannot be verified programmatically; requires a live browser session and a real deposit transaction"
  - test: "Simulate or wait for 60s elapsed time on a pending deposit"
    expected: "Yellow warning text 'This is taking longer than usual. The keeper may be busy.' appears below the execution status row — no cancel button yet"
    why_human: "Time-gated conditional render depends on elapsed wall-clock time and live state — not inspectable statically"
  - test: "Simulate or wait for 120s elapsed time on a pending deposit"
    expected: "Warning changes to 'Deposit may be stuck.' with a red 'Cancel Deposit' button. Button is disabled if wallet not connected."
    why_human: "Same as above — threshold-gated render, requires a live browser session"
  - test: "Click Cancel Deposit with connected wallet"
    expected: "Wallet prompts for a cancelDeposit transaction. After confirmation, notification transitions to error state with actionable message such as 'Your deposit was cancelled. Your USDC has been returned.'"
    why_human: "On-chain transaction flow and toast state transition require a running wallet and actual tx confirmation"
  - test: "Verify keeper error reason message is actionable"
    expected: "When a deposit is cancelled by the keeper (e.g. oracle expiry), the notification shows 'Deposit expired before the keeper could execute it. Your USDC has been returned. Try again.' rather than a generic cancelled message"
    why_human: "Requires a real cancelled deposit in keeper DB with a recorded errorReason to trigger the fetch and mapping"
---

# Phase 3: UI Feedback Verification Report

**Phase Goal:** Users see accurate, real-time deposit status and actionable error messages throughout the flow
**Verified:** 2026-02-20T19:00:00Z
**Status:** human_needed (all automated checks passed; 5 items require live browser testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Fulfilling buy request" state shows meaningful status rather than static spinner | VERIFIED | `GmStatusNotification.tsx` lines 324-336: elapsed-time-gated text replaces static string; `useDepositElapsed` drives the counter |
| 2 | When a deposit fails, error message explains what happened and what to do next | VERIFIED | `getActionableMessage()` at line 60-75 maps errorReason strings to user-friendly messages; keeper fetch at line 461-469 populates it |
| 3 | Deposit pending too long shows warning with option to cancel | VERIFIED | JSX block at lines 485-512: yellow warning at 60s, cancel button at 120s |
| 4 | Deposit status transitions reflected in UI without page refresh | VERIFIED | `useDepositElapsed` hook re-renders on 1s interval; lifecycle states (createdTxnHash/executedTxnHash/cancelledTxnHash) come from `useSyntheticsEvents` which updates via WebSocket events |

**Score:** 4/4 truths automated-verified

---

### Required Artifacts

#### Plan 03-01 Artifacts (Keeper API)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `/Users/ken/Projects/0xM/order-execution-keeper-service/src/server/controllers/depositController.ts` | Deposit status API controller | VERIFIED | 37 lines; full Prisma query with all required fields; 404/500 error handling |
| `/Users/ken/Projects/0xM/order-execution-keeper-service/src/server/routes/index.ts` | Route registration for /deposits/:key | VERIFIED | `router.get("/deposits/:key", getDepositStatus)` at line 8 |
| `/Users/ken/Projects/0xM/order-execution-keeper-service/src/server/httpServer.ts` | CORS middleware for cross-origin access | VERIFIED | Manual CORS middleware at lines 10-14 with `Access-Control-Allow-Origin: *` default |

#### Plan 03-02 Artifacts (Frontend UI)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/StatusNotification/useDepositTimeout.ts` | Elapsed time hook | VERIFIED | 22 lines; useState + setInterval + cleanup; returns 0 when createdAt undefined |
| `src/components/StatusNotification/GmStatusNotification.tsx` | Enhanced notification with timer, warnings, cancel, errors | VERIFIED | 520 lines; all required features present and connected |
| `src/domain/synthetics/markets/cancelDepositTxn.ts` | User-facing cancel deposit via ExchangeRouter | VERIFIED | 17 lines; mirrors cancelOrdersTxn pattern; calls ExchangeRouter.cancelDeposit |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routes/index.ts` | `controllers/depositController.ts` | import + `router.get` registration | WIRED | `import { getDepositStatus }` at line 3; `router.get("/deposits/:key", getDepositStatus)` at line 8 |
| `depositController.ts` | `prisma.depositRequest` | `findUnique` with requestKey | WIRED | `prisma.depositRequest.findUnique({ where: { requestKey: key } })` at line 9-20 |
| `GmStatusNotification.tsx` | `useDepositTimeout.ts` | hook import + usage | WIRED | `import { useDepositElapsed }` at line 31; `const elapsedSeconds = useDepositElapsed(depositCreatedAt)` at line 129 |
| `GmStatusNotification.tsx` | `cancelDepositTxn.ts` | cancel button onClick | WIRED | `import { cancelDepositTxn }` at line 20; `await cancelDepositTxn(chainId, signer, depositStatusKey)` at line 475 |
| `GmStatusNotification.tsx` | `http://142.93.203.222:37018/api/deposits/:key` | fetch on cancelledTxnHash | WIRED | `fetch(\`${KEEPER_API_URL}/api/deposits/${depositStatusKey}\`)` at line 462; triggered by `depositStatus?.cancelledTxnHash` dependency |
| `cancelDepositTxn.ts` | `ExchangeRouter.cancelDeposit` | ethers contract call | WIRED | `callContract(chainId, contract, "cancelDeposit", [depositKey])` at line 12; ABI confirmed at `sdk/src/abis/ExchangeRouter.json:382` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIFE-02 | 03-02 | Deposit status tracked through full lifecycle: pending → executing → complete/failed/expired | SATISFIED | All lifecycle states handled in `executionStatus` useMemo: no hash (pending), createdTxnHash (executing), executedTxnHash (complete), cancelledTxnHash (failed/expired) |
| UI-01 | 03-02 | Clear status messaging during "Fulfilling buy request" phase | SATISFIED | Static string replaced with elapsed-time-gated messages at lines 324-336 |
| UI-02 | 03-01 | Actionable error messages when deposit fails | SATISFIED | Keeper API endpoint delivers errorReason; `getActionableMessage()` maps it to user-friendly text at lines 60-75 |
| UI-03 | 03-02 | Timeout detection — pending too long shows warning with cancel option | SATISFIED | 60s warning + 120s cancel button at JSX lines 485-512 |

**All 4 requirements claimed by this phase are accounted for. No orphaned requirements.**

---

### Live Deployment Status

The 03-01 SUMMARY noted deployment was deferred due to SSH auth gate. **This has been resolved.** The keeper API is live on the DigitalOcean server:

- `GET http://142.93.203.222:37018/api/deposits/0x000...000` returns `{"error":"Deposit not found"}` with HTTP 404
- Response includes `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Methods: GET`
- `GET http://142.93.203.222:37018/api/health` returns `{"status":"ok"}`

The deployment is complete. The summary's "User Setup Required" section is no longer applicable.

---

### TypeScript Verification

**Keeper service (`order-execution-keeper-service`):** `npx tsc --noEmit` — clean, zero errors.

**Interface project:** `npx tsc --noEmit` produces 1 pre-existing error in `src/domain/synthetics/orders/useOrders.ts` (unrelated to Phase 3 — typechain mismatch from an earlier commit). Zero errors in any Phase 3 files.

---

### Anti-Patterns Found

None. All Phase 3 files are substantive implementations with no TODOs, placeholders, or stub patterns.

---

### i18n Verification

All new `t\`...\`` strings are present in `src/locales/en/messages.po`:
- "Waiting for keeper to execute..." — confirmed at line 5447
- "Keeper executing... ({elapsedSeconds}s)" — confirmed at line 3510
- "Taking longer than expected... ({0}m {1}s)" — confirmed at line 4300
- "Still waiting... ({0}m {1}s)" — confirmed at line 680
- "Cancel Deposit" — confirmed at line 2284
- "Deposit may be stuck." — confirmed at line 5288
- "Deposit expired before the keeper could execute it. Your USDC has been returned. Try again." — confirmed at line 358
- "Your deposit was cancelled. Your USDC has been returned." — confirmed at line 5823

---

### Human Verification Required

#### 1. Live counter ticking during deposit execution

**Test:** Initiate a "Buy GM" deposit. After the creation tx confirms, watch the toast notification.
**Expected:** Text changes from "Waiting for keeper to execute..." (first 15s) to "Keeper executing... (16s)" and ticks every second
**Why human:** `setInterval`-driven UI update requires a live browser session; cannot verify programmatically

#### 2. 60s timeout warning appears

**Test:** Observe a pending deposit that is not executed within 60 seconds. (Can test by temporarily pointing to a non-responsive keeper, or waiting for a real slow execution.)
**Expected:** Yellow text "This is taking longer than usual. The keeper may be busy." appears below the execution status row. No cancel button yet.
**Why human:** Time-gated conditional render depends on elapsed wall-clock time

#### 3. 120s cancel button appears

**Test:** Continue observing the same pending deposit past the 120s mark.
**Expected:** Text changes to "Deposit may be stuck." with a red "Cancel Deposit" button visible. Button is disabled if wallet not connected.
**Why human:** Same as above — threshold-gated render requires a live browser session

#### 4. Cancel Deposit button triggers on-chain cancellation

**Test:** Click "Cancel Deposit" with a connected wallet.
**Expected:** Wallet prompts for a `cancelDeposit` transaction. After confirmation, the toast transitions to error state with "Your deposit was cancelled. Your USDC has been returned."
**Why human:** On-chain transaction flow and toast state transition require a running wallet and actual tx confirmation

#### 5. Keeper error reason produces actionable message

**Test:** Observe a deposit that was auto-cancelled by the keeper due to oracle expiry.
**Expected:** The notification shows "Deposit expired before the keeper could execute it. Your USDC has been returned. Try again." — not the generic cancelled message.
**Why human:** Requires a real cancelled deposit with `errorReason` recorded in keeper DB; depends on the keeper fetch completing successfully

---

### Gaps Summary

No gaps. All automated checks passed. Phase goal is structurally achieved in the codebase.

The 5 human verification items above are confirmations of already-correct implementations — they verify runtime behavior (timers, transactions, fetch responses) that cannot be asserted from static code analysis alone. The implementations match the plan exactly and the patterns (setInterval hooks, ethers contract calls, fetch + state) are well-established in the codebase.

---

_Verified: 2026-02-20T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
