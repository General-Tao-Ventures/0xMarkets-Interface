# Phase 3: UI Feedback - Research

**Researched:** 2026-02-20
**Domain:** React frontend — deposit status tracking, toast notifications, timeout detection, keeper status API
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIFE-02 | Deposit status tracked through full lifecycle: pending → executing → complete/failed/expired | The existing `depositStatuses` state in `SyntheticsEventsProvider` tracks `createdTxnHash`, `executedTxnHash`, `cancelledTxnHash`. The "executing" sub-state (after `createdTxnHash` but before `executedTxnHash`) is where the spinner shows. Enriching this state with a text label and timestamp enables LIFE-02 |
| UI-01 | Clear status messaging during "Fulfilling buy request" phase (not just an infinite spinner) | `GmStatusNotification.tsx` sets `text = t\`Fulfilling buy request.\`` and `status = "loading"` once `createdTxnHash` exists. Changing this text and adding elapsed-time display satisfies UI-01 without architectural changes |
| UI-02 | Actionable error messages when deposit fails (user knows what happened and what to do) | `DepositCancelled` event sets `cancelledTxnHash`. The keeper's `errorReason` field in the DB is NOT surfaced to the frontend. A keeper status API endpoint (`GET /api/deposits/:key`) can expose it. Frontend polls this endpoint on cancellation to show a detailed message |
| UI-03 | Timeout detection — if deposit sits pending too long, show warning with option to cancel | The `createdAt: Date.now()` field is already stored in each `depositStatus` object. A `useEffect` with `setInterval` inside `GmStatusNotification` can compare `Date.now() - depositStatus.createdAt` against a threshold (e.g. 60s) to show a warning |

</phase_requirements>

---

## Summary

The frontend deposit flow uses `SyntheticsEventsProvider` which listens to on-chain events via WebSocket (`subscribeToV2Events` on the `EventEmitter` contract). When `DepositCreated` fires, `depositStatuses[key].createdTxnHash` is set. When `DepositExecuted` fires, `executedTxnHash` is set. When `DepositCancelled` fires, `cancelledTxnHash` is set. The `GmStatusNotification` component renders these states as a two-row toast: "Buy request sent" (creation) and "Fulfilling buy request" (execution).

The current problem is that during the execution phase — between `DepositCreated` and `DepositExecuted` — the UI shows only an infinite spinner with static text. No elapsed time, no sub-state, no timeout warning. This is the core problem all four requirements address. The good news: the data model already has `createdAt: Date.now()` on every `depositStatus`, so timeout detection requires no new state — just a `useEffect` timer inside `GmStatusNotification`. Actionable error messages on cancellation require a small keeper API endpoint to expose `errorReason` from the Prisma DB, since the on-chain event alone contains no error text.

The keeper side (port 37018 at 142.93.203.222) already has an Express server with only `/health` and `/api/health` routes. Adding a `GET /api/deposits/:key` route that queries Prisma for a deposit's status and `errorReason` is straightforward. The frontend can fetch this on cancellation to construct a meaningful error message. For real-time status during the waiting phase, a timer-based approach inside the React component is preferred over polling — it avoids network calls and the keeper scan interval is 10s anyway, so polling adds little value beyond what the on-chain events already provide.

**Primary recommendation:** Make all four changes in two plans: (1) keeper API endpoint for deposit status + frontend polling/fetch on cancellation, and (2) enhanced `GmStatusNotification` with elapsed-time messaging, timeout detection, and cancel button.

---

## Standard Stack

### Core (already in project — verified from source)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2.0 | UI framework | Already used throughout |
| @lingui/macro | 4.11.3 | i18n string extraction | `t\`...\`` tagged templates for all UI strings |
| react-toastify | 10.0.5 | Toast notifications | `GmStatusNotification` already renders inside toasts |
| ethers.js | 6.x | Blockchain provider, event subscriptions | `SyntheticsEventsProvider` uses ethers Provider |
| @tanstack/react-query | 5.25.0 | Data fetching | Already in project — available for keeper API polling |
| Express 5.x | ^5.1.0 | HTTP server in keeper | Already running; just add a route |
| @prisma/client | ^7.2.0 | DB queries in keeper | Already used; `depositRequest` model has `errorReason` field |

### No New Dependencies Needed

All Phase 3 functionality uses the existing stack:
- Status text: modify `GmStatusNotification.tsx` (already exists)
- Elapsed time: `useState` + `useEffect` + `setInterval` inside existing component
- Timeout detection: same timer pattern, compare against `depositStatus.createdAt`
- Cancel action: `ExchangeRouter.cancelDeposit(key)` — ABI already in `sdk/src/abis/ExchangeRouter.json` (verified: function exists at line 382)
- Keeper API: add `GET /api/deposits/:key` Express route (no new libraries)
- Frontend fetch: `fetch()` or `@tanstack/react-query useQuery` — both available

**Installation:** None required.

---

## Architecture Patterns

### Current Deposit Status Data Flow (verified from source)

```
User submits → createDepositTxn.ts → ExchangeRouter.multicall()
  → callContract() → setPendingDeposit(data) [called in .then()]
  → SyntheticsEventsProvider.setPendingDeposit() triggers helperToast.success(<GmStatusNotification>)
  → GmStatusNotification renders inside react-toastify toast (autoClose: false)

On-chain DepositCreated event (EventEmitter WebSocket):
  → subscribeToV2Events fires eventLogHandlers.current.DepositCreated
  → setDepositStatuses: adds { key, data, createdTxnHash, createdAt: Date.now() }

On-chain DepositExecuted event:
  → setDepositStatuses: updateByKey → adds executedTxnHash
  → GmStatusNotification re-renders with "Buy order executed." + success icon

On-chain DepositCancelled event:
  → setDepositStatuses: updateByKey → adds cancelledTxnHash
  → GmStatusNotification re-renders with "Buy order cancelled." + error icon
  → toast.update(toastTimestamp, { type: "error" })
```

### Recommended Project Structure (Phase 3 changes)

```
src/
├── components/
│   └── StatusNotification/
│       ├── GmStatusNotification.tsx          # MODIFIED: add timer, timeout, cancel
│       └── useDepositTimeout.ts              # NEW: timer hook (elapsed time + timeout)
├── domain/synthetics/markets/
│   └── cancelDepositTxn.ts                   # NEW: ExchangeRouter.cancelDeposit() wrapper
└── ...

order-execution-keeper-service/src/server/
├── controllers/
│   ├── healthController.ts                    # existing
│   └── depositController.ts                  # NEW: GET /api/deposits/:key
└── routes/
    └── index.ts                              # MODIFIED: add deposit route
```

### Pattern 1: Elapsed-Time Status During Execution

**What:** Inside `GmStatusNotification`, when a deposit has `createdTxnHash` but no `executedTxnHash` or `cancelledTxnHash`, track elapsed seconds with a `useEffect`/`setInterval` and display meaningful text instead of the static "Fulfilling buy request."

**When to use:** After deposit creation tx is confirmed; before execution event fires.

**Example:**
```typescript
// src/components/StatusNotification/useDepositTimeout.ts
import { useEffect, useState } from "react";

export function useDepositElapsed(createdAt: number | undefined): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!createdAt) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - createdAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  return elapsed;
}
```

**Updated execution status text in `GmStatusNotification`:**
```typescript
// In executionStatus useMemo for deposit case
if (depositStatus?.createdTxnHash && !depositStatus.executedTxnHash && !depositStatus.cancelledTxnHash) {
  // Active waiting state — show elapsed time
  const elapsed = elapsedSeconds; // from useDepositElapsed hook
  if (elapsed < 15) {
    text = t`Waiting for keeper to execute...`;
  } else if (elapsed < 60) {
    text = t`Keeper executing... (${elapsed}s)`;
  } else {
    text = t`Still waiting... (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`;
  }
  status = "loading";
}
```

### Pattern 2: Timeout Warning with Cancel Option

**What:** When elapsed seconds exceed a threshold (e.g., 120 seconds — well within the ~300s oracle window), show a warning row with a "Cancel" button. The cancel button calls `ExchangeRouter.cancelDeposit(key)` — this is the user-facing cancel (different from the keeper's `DepositHandler.cancelDeposit` which requires CONTROLLER role). ExchangeRouter's `cancelDeposit` requires `msg.sender === deposit.account`, which is exactly the user's wallet.

**Threshold logic:**
- 0–60s: normal waiting, show elapsed time
- 60–120s: show yellow warning "Taking longer than expected"
- 120s+: show orange warning with "Cancel" button

**Cancel transaction:**
```typescript
// src/domain/synthetics/markets/cancelDepositTxn.ts
import { ethers } from "ethers";
import { getContract } from "config/contracts";
import { abis } from "sdk/abis";

export async function cancelDepositTxn(chainId: ContractsChainId, signer: Signer, depositKey: string) {
  const contract = new ethers.Contract(getContract(chainId, "ExchangeRouter"), abis.ExchangeRouter, signer);
  // ExchangeRouter.cancelDeposit(bytes32 key) exists in ABI (verified)
  // Requires msg.sender === deposit.addresses.account (user's wallet)
  // No execution fee required for cancellation
  return contract.cancelDeposit(depositKey);
}
```

**Why ExchangeRouter.cancelDeposit (not DepositHandler.cancelDeposit):**
- ExchangeRouter.cancelDeposit: requires `msg.sender === deposit.account` — user's wallet. This is the correct user-facing cancel.
- DepositHandler.cancelDeposit: requires CONTROLLER role. The user's wallet does NOT have CONTROLLER. This is the keeper-side cancel (already implemented in Phase 2).
- Both paths ultimately cancel the deposit on-chain and emit `DepositCancelled` event. The frontend's existing `DepositCancelled` event handler will fire and update the UI automatically.

### Pattern 3: Keeper Status API for Error Reason (UI-02)

**What:** When a deposit is cancelled, the user sees "Buy order cancelled." The keeper has a `errorReason` string in the DB (from Phase 2) that explains WHY it failed. The frontend should fetch this reason after cancellation and show it.

**Keeper API endpoint:**
```typescript
// order-execution-keeper-service/src/server/controllers/depositController.ts
import { Request, Response } from "express";
import { getOrCreatePrismaClient } from "../../core/store.js";

export const getDepositStatus = async (req: Request, res: Response) => {
  const { key } = req.params;
  const prisma = await getOrCreatePrismaClient();

  try {
    const deposit = await prisma.depositRequest.findUnique({
      where: { requestKey: key },
      select: {
        requestKey: true,
        account: true,
        status: true,
        errorReason: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    res.json({
      key: deposit.requestKey,
      status: deposit.status, // "PENDING" | "EXECUTED" | "FAILED" | "CANCELLED"
      errorReason: deposit.errorReason ?? null,
      retryCount: deposit.retryCount,
      createdAt: deposit.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
```

**Frontend fetch on cancellation:**
```typescript
// In GmStatusNotification, when cancelledTxnHash appears and depositKey is known:
const KEEPER_API_URL = import.meta.env.VITE_APP_KEEPER_API_URL || "http://142.93.203.222:37018";

async function fetchDepositErrorReason(key: string): Promise<string | null> {
  try {
    const response = await fetch(`${KEEPER_API_URL}/api/deposits/${key}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.errorReason ?? null;
  } catch {
    return null;
  }
}

// Usage: call this in useEffect when cancelledTxnHash appears
useEffect(() => {
  if (depositStatus?.cancelledTxnHash && depositStatusKey) {
    fetchDepositErrorReason(depositStatusKey).then((reason) => {
      setKeeperErrorReason(reason);
    });
  }
}, [depositStatus?.cancelledTxnHash, depositStatusKey]);
```

**Error reason → user-friendly message mapping:**
```typescript
function getActionableMessage(errorReason: string | null): string {
  if (!errorReason) return t`Your deposit was cancelled. Your USDC has been returned.`;

  const lower = errorReason.toLowerCase();

  if (lower.includes("oracletimestamps") || lower.includes("expired") || lower.includes("expiration")) {
    return t`Deposit expired before the keeper could execute it. Your USDC has been returned. Try again with a larger execution fee.`;
  }
  if (lower.includes("emptydeposit") || lower.includes("0x95b66fe9")) {
    return t`Your deposit was already processed. Check your wallet balance.`;
  }
  if (lower.includes("execution reverted")) {
    return t`Deposit execution failed. Your USDC has been returned. Please try again.`;
  }
  // Generic fallback
  return t`Your deposit was cancelled and your USDC has been returned.`;
}
```

### Pattern 4: CORS for Keeper API

**What:** The Interface frontend (different origin) calling the keeper API requires CORS headers.

**Implementation:**
```typescript
// order-execution-keeper-service/src/server/httpServer.ts — add CORS
import cors from "cors";

app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  methods: ["GET"],
}));
```

**Note:** `cors` npm package — needs to be added to keeper's package.json. Alternatively, set CORS headers manually (no extra dependency):
```typescript
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ALLOWED_ORIGINS || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  next();
});
```

The manual approach avoids adding a new dependency. Use this.

### Anti-Patterns to Avoid

- **Don't poll the keeper API continuously for status:** On-chain events (WebSocket) already fire `DepositExecuted`/`DepositCancelled` reliably. Polling would add network traffic with no benefit. Only fetch the keeper API once, when cancellation occurs.
- **Don't block the cancel button until error reason loads:** Show the cancel option immediately at timeout threshold. Fetch errorReason lazily after cancellation.
- **Don't show cancel option before the timeout threshold:** Showing it immediately creates confusion ("why can I cancel immediately?"). Gate it behind 120s.
- **Don't mutate `depositStatuses` in `SyntheticsEventsProvider` for the elapsed time:** The elapsed timer state lives only in the notification component — it's ephemeral display state, not persistent application state.
- **Don't use the keeper's `DepositHandler.cancelDeposit` from the frontend:** That requires CONTROLLER role. Use `ExchangeRouter.cancelDeposit` (msg.sender === user's wallet).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status polling | Custom WebSocket to keeper | On-chain event subscription (already works) | `subscribeToV2Events` already handles DepositExecuted/Cancelled |
| Error message storage | Local state persistence | Keeper DB's `errorReason` field | Already populated by Phase 2; fetch-on-demand |
| Cancel transaction | Custom ABI encoding | `ExchangeRouter.cancelDeposit` (in existing ABI) | ABI already verified in `sdk/src/abis/ExchangeRouter.json` |
| Toast management | Custom notification system | react-toastify (already used) | `GmStatusNotification` already renders in toasts |
| Timer | Third-party library | Native `setInterval` in `useEffect` | The project uses this pattern already (see `useDisabledCancelMarketOrderMessage.ts`) |

**Key insight:** The infrastructure for all four requirements already exists. UI-01 and UI-03 are purely React component changes with no new dependencies. UI-02 requires a small keeper API endpoint but no new libraries on the keeper side. LIFE-02 requires no code changes — it emerges from the combination of UI-01, UI-02, and UI-03.

---

## Common Pitfalls

### Pitfall 1: DepositStatusKey vs DepositKey Mismatch

**What goes wrong:** The `depositStatusKey` in `GmStatusNotification` is the `depositStatus.key` (set from `DepositCreated` event data). The on-chain deposit key is `bytes32`. The keeper DB stores it as `requestKey`. These must match exactly for the API call to return data.

**Why it happens:** The deposit key is derived from a hash of the deposit params. If the keeper has not yet scanned the deposit into its DB when the cancellation happens (race condition), the API returns 404.

**How to avoid:** Handle 404 gracefully — fall back to a generic "cancelled" message. The API call is best-effort enrichment, not required.

**Warning signs:** API returns 404 even for deposits that were CANCELLED in the keeper logs.

### Pitfall 2: CORS Blocking Keeper API Calls

**What goes wrong:** The frontend (served from localhost:3000 or production domain) calls `http://142.93.203.222:37018/api/deposits/:key`. Browser blocks with CORS error because the keeper doesn't set CORS headers.

**Why it happens:** Express servers don't set CORS headers by default. The keeper's current `httpServer.ts` has no CORS middleware.

**How to avoid:** Add manual CORS headers to the Express app using `Access-Control-Allow-Origin`. Do this before adding the deposit route. Test with a browser fetch() call before declaring the feature done.

**Warning signs:** Network tab shows `CORS error` on the fetch request in browser devtools.

### Pitfall 3: Stale Toast Component After Cancellation

**What goes wrong:** The user cancels the deposit. The `DepositCancelled` on-chain event fires and `cancelledTxnHash` is set. The `GmStatusNotification` still shows the old "Taking too long" warning UI because the component's `useEffect` hasn't re-run yet.

**Why it happens:** The timer `useEffect` runs on an interval but the cancellation state check is in the same `executionStatus` memo. The memo re-renders when `cancelledTxnHash` changes, which is correct — but local state from the timer (like `showTimeoutWarning`) may still be `true`.

**How to avoid:** In the `executionStatus` memo, check `cancelledTxnHash` FIRST before any timeout warning logic. If cancelled, show the cancellation state regardless of local timer state.

### Pitfall 4: Cancel Button Appearing for Expired Deposits the Keeper Already Cancelled

**What goes wrong:** The keeper cancels an expired deposit on-chain via `DepositHandler.cancelDeposit`. The `DepositCancelled` event fires, and the UI correctly shows "Buy order cancelled." However, the timeout UI was shown briefly before the event arrived, confusing the user.

**Why it happens:** The on-chain cancellation by the keeper emits the same `DepositCancelled` event as user-initiated cancellation. The UI cannot distinguish who cancelled it.

**How to avoid:** This is acceptable behavior — when the keeper cancels, the event fires quickly (within 5 min cleanup cycle). The UI shows the timeout warning briefly, then switches to the cancelled state when the event arrives. This is correct — the user was informed of the delay.

### Pitfall 5: i18n — Forgetting to Run Locale Extraction After Adding New Strings

**What goes wrong:** New `t\`...\`` strings added to `GmStatusNotification.tsx` don't appear in the locale catalog. CI or runtime shows untranslated keys.

**Why it happens:** @lingui/macro requires `yarn lingui extract` to update `src/locales/en/messages.po` after adding new `t\`\`` strings. The project uses this pattern throughout.

**How to avoid:** After adding all new `t\`...\`` strings, run `yarn lingui extract && yarn lingui compile`. The project's `CLAUDE.md` or CI should document this step.

**Warning signs:** Text appears as `Waiting for keeper to execute...` (the raw string) instead of being wrapped in the translation layer.

---

## Code Examples

Verified patterns from official sources:

### The Existing Execution Status Block (from source)

```typescript
// GmStatusNotification.tsx lines 281-353 (current state)
const executionStatus = useMemo(() => {
  let text = "";
  let status: TransactionStatusType = "muted";
  let txnHash: string | undefined;

  if (operation === "deposit") {
    text = t`Fulfilling buy request.`;      // ← STATIC TEXT (problem)

    if (depositStatus?.createdTxnHash) {
      status = "loading";                   // ← INFINITE SPINNER with no context
    }

    if (depositStatus?.executedTxnHash) {
      text = t`Buy order executed.`;
      status = "success";
      txnHash = depositStatus?.executedTxnHash;
    }

    if (depositStatus?.cancelledTxnHash) {
      text = t`Buy order cancelled.`;       // ← NO EXPLANATION WHY
      status = "error";
      txnHash = depositStatus?.cancelledTxnHash;
    }
  }
  // ...
```

### Timer Pattern (verified from useDisabledCancelMarketOrderMessage.ts)

```typescript
// This exact pattern is already used in the codebase
useEffect(() => {
  if (!startTime) return;
  const interval = setInterval(() => {
    setElapsed(Math.floor((Date.now() - startTime) / 1000));
  }, 1000);
  return () => clearInterval(interval);
}, [startTime]);
```

### ExchangeRouter.cancelDeposit ABI (verified from sdk/src/abis/ExchangeRouter.json)

```json
{
  "name": "cancelDeposit",
  "type": "function",
  "inputs": [{ "name": "key", "type": "bytes32" }],
  "outputs": [],
  "stateMutability": "payable"
}
```

The ABI exists — no new ABI file needed. `contract.cancelDeposit(key)` can be called directly.

### Keeper Prisma Query (verified from schema.prisma)

```typescript
// DepositRequest model has: requestKey, status, errorReason, retryCount
const deposit = await prisma.depositRequest.findUnique({
  where: { requestKey: key },        // bytes32 hex string
  select: { status: true, errorReason: true, retryCount: true },
});
// deposit.status: "PENDING" | "EXECUTED" | "FAILED" | "CANCELLED"
// deposit.errorReason: string | null (max 500 chars, set on FAILED/CANCELLED)
```

---

## Critical Architecture Findings

### Finding 1: On-Chain Events Are the Source of Truth for Status Transitions

The `SyntheticsEventsProvider` subscribes to `EventEmitter` contract events via WebSocket (`subscribeToV2Events`). When the keeper calls `DepositHandler.executeDeposit`, the contract emits `DepositExecuted(key, ...)` which flows through `EventEmitter`. The frontend's WebSocket subscription captures this and sets `executedTxnHash`.

**This means:** No keeper polling is needed for the happy path. The UI updates automatically when execution succeeds. The only case where the keeper API is needed is to explain WHY a cancellation happened (UI-02).

### Finding 2: `depositStatus.createdAt` Already Exists

In `SyntheticsEventsProvider.tsx` line 452:
```typescript
setDepositStatuses((old) =>
  setByKey(old, depositData.key, {
    key: depositData.key,
    data: depositData,
    createdTxnHash: txnParams.transactionHash,
    createdAt: Date.now(),    // ← ALREADY THERE
  })
);
```

The `createdAt` timestamp is set when the `DepositCreated` event fires (not when the user clicks submit — this is the confirmed on-chain creation time). This is the correct timestamp to measure "time in execution" from.

**This means:** UI-03 (timeout detection) requires NO new state — just read `depositStatus.createdAt` and compare to `Date.now()` in a timer.

### Finding 3: The Keeper Has No Status API Yet — But Adding One Is Trivial

The keeper's `httpServer.ts` has a minimal Express setup. The routes file only has `/api/health`. Adding `/api/deposits/:key` requires:
- 1 new file: `src/server/controllers/depositController.ts`
- 1 line in `routes/index.ts`: `router.get("/deposits/:key", getDepositStatus)`
- CORS headers in `httpServer.ts`

No new npm packages needed. No schema changes needed.

### Finding 4: ExchangeRouter.cancelDeposit Is User-Facing Cancel

Confirmed: `sdk/src/abis/ExchangeRouter.json` contains `cancelDeposit(bytes32 key)` as a `payable` function. The contract requires `msg.sender === deposit.addresses.account` — so only the depositing user can call this. This is correct behavior for the "Cancel" button.

The ABI is already imported as `abis.ExchangeRouter` throughout the codebase. No new ABI file needed.

### Finding 5: The Toast Lifecycle — autoClose:false and toastTimestamp

When `setPendingDeposit` is called, it creates a toast with `autoClose: false` and `toastId = Date.now()`. The `GmStatusNotification` component manages the toast lifecycle via `useToastAutoClose` (auto-dismiss after 7s when completed) and `toast.update(toastTimestamp, { type: "error" })` on cancellation.

The `toastTimestamp` is passed down as a prop. This prop doubles as the toastId and lets the component update its own toast's appearance (switching to error red on cancellation). The cancel button in the timeout warning can call `toast.dismiss(toastTimestamp)` after the cancel tx succeeds — or let the `DepositCancelled` event handle that automatically.

---

## State of the Art

| Current State | Phase 3 Target |
|---------------|----------------|
| "Fulfilling buy request." + infinite spinner (static) | Elapsed-time text: "Waiting for keeper to execute... (23s)" |
| "Buy order cancelled." with no explanation | "Deposit expired before execution. Your USDC was returned." (from keeper errorReason) |
| No timeout detection | Warning shown after 60s; cancel button after 120s |
| Status only transitions at Executed/Cancelled events | Same transitions, but with elapsed-time context in between |

---

## Implementation Plan (Two Plans Recommended)

**Plan 1: Keeper Status API** (keeper side — ~15 min)
1. Add `GET /api/deposits/:key` route to keeper Express server
2. Add CORS headers to `httpServer.ts`
3. Deploy to DO server

**Plan 2: Enhanced GmStatusNotification** (frontend — ~30 min)
1. Add `useDepositElapsed` hook (timer)
2. Update `executionStatus` memo to use elapsed time in text
3. Add timeout warning at 60s threshold
4. Add cancel button at 120s threshold (calls `cancelDepositTxn`)
5. Fetch keeper API errorReason on cancellation, show actionable message
6. Run `yarn lingui extract && yarn lingui compile`

---

## Open Questions

1. **What is the CORS_ALLOWED_ORIGINS for the production keeper?**
   - What we know: The Interface will be served from a custom domain or Vercel URL
   - What's unclear: The production domain hasn't been configured
   - Recommendation: Use `"*"` for now (testnet only, no sensitive data exposed). Add a `CORS_ALLOWED_ORIGINS` env var for future hardening.

2. **Should the cancel button initiate the tx in-page or redirect to the wallet?**
   - What we know: `useWallet()` returns `signer` throughout the codebase
   - What's unclear: `GmStatusNotification` doesn't currently have access to `signer`
   - Recommendation: Add a `onCancel?: () => void` prop to `GmStatusNotification` and wire the cancel transaction in `SyntheticsEventsProvider.setPendingDeposit` closure (which already has access to the signer via context). Alternatively, use the same pattern as `useDepositWithdrawalTransactions` — but this is simpler.

3. **What timeout threshold is appropriate for testnet?**
   - What we know: The keeper scans every 10 seconds; execution typically completes in 13 seconds (verified from STATE.md). A 120s timeout is 12x normal execution time.
   - What's unclear: Whether users expect slower execution on testnet
   - Recommendation: Show warning at 60s, cancel button at 120s. These are conservative and won't false-alarm on normal behavior.

4. **Should `createdAt` be deposit-created-event time or user-submit time?**
   - What we know: `createdAt: Date.now()` is set in the `DepositCreated` event handler (when the on-chain event fires, not when the user clicks submit). The creation tx can take 5–30s to mine.
   - Recommendation: This is fine — measuring "time waiting for execution" from when the deposit is confirmed on-chain is semantically correct. If the user clicks submit and waits 30s for the creation tx, that's not "execution waiting time."

---

## Sources

### Primary (HIGH confidence)

- `/Users/ken/Projects/0xM/0xMarkets-Interface/src/components/StatusNotification/GmStatusNotification.tsx` — full source read; current status text and data flow confirmed
- `/Users/ken/Projects/0xM/0xMarkets-Interface/src/context/SyntheticsEvents/SyntheticsEventsProvider.tsx` — full source read; confirmed `createdAt: Date.now()` on depositStatuses, confirmed event handlers for DepositCreated/Executed/Cancelled
- `/Users/ken/Projects/0xM/0xMarkets-Interface/src/context/WebsocketContext/subscribeToEvents.ts` — full source read; confirmed on-chain event subscription mechanism
- `/Users/ken/Projects/0xM/0xMarkets-Interface/sdk/src/abis/ExchangeRouter.json` (grep verified) — confirmed `cancelDeposit` function exists at line 382
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/server/httpServer.ts` — confirmed Express setup, no CORS, only `/health` route
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/server/routes/index.ts` — confirmed only `/api/health` route exists
- `/Users/ken/Projects/0xM/order-execution-keeper-service/prisma/schema.prisma` — confirmed `errorReason String?` and `status RequestStatus` on DepositRequest model
- `/Users/ken/Projects/0xM/0xMarkets-Interface/src/domain/synthetics/orders/useDisabledCancelMarketOrderMessage.ts` — confirmed `setInterval` timer pattern already used in codebase

### Secondary (MEDIUM confidence)

- `@tanstack/react-query` 5.25.0 in `package.json` — available for use but not required; plain `fetch` is simpler for one-off API call

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from package.json and source imports
- Architecture (event-driven status): HIGH — read from source, traced full data flow
- ExchangeRouter.cancelDeposit: HIGH — ABI confirmed present in ExchangeRouter.json
- Keeper API design: HIGH — Prisma schema read, Express pattern clear, no new dependencies
- Timeout thresholds: MEDIUM — 60s/120s based on reasoning, not empirical testing
- CORS approach: MEDIUM — manual headers approach is simple and correct; `cors` package alternative also valid

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable library versions, 30-day window; contracts won't change)
