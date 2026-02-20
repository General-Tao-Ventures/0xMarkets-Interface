# Phase 2: Keeper Resilience - Research

**Researched:** 2026-02-20
**Domain:** Node.js keeper service — retry logic, error recording, deposit expiry cancellation, restart recovery, nonce management
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-03 | Keeper retries transient failures (nonce collisions, RPC timeouts) with exponential backoff | Current executor has zero retry logic; failure goes straight to FAILED status. Need retry loop with backoff in depositExecutor.ts |
| EXEC-04 | Failed deposits are marked in DB with specific error reason for debugging | `DepositRequest` model has no `errorReason` field; `DepositExecution.failureReason` exists but is never populated. Need schema migration + executor to write error message on failure |
| LIFE-01 | Expired deposits are detected and auto-cancelled on-chain (freeing locked funds) | Critical constraint found: keeper wallet is ORDER_KEEPER only, NOT CONTROLLER. `DepositHandler.cancelDeposit()` requires CONTROLLER role. On testnet we can grant keeper CONTROLLER role. Need to add `cancelDeposit` ABI to keeper and call `DepositHandler.cancelDeposit()` directly (not ExchangeRouter) |
| LIFE-03 | Deposits created while keeper is restarting are picked up on next scan cycle | Already works by design: scanner reads PENDING from DB AND re-scans DEPOSIT_LIST. New deposits created during downtime appear in DEPOSIT_LIST on restart. Gap: need to confirm no "EXECUTING" intermediate state blocks this |
| LIFE-04 | Concurrent deposits from different users don't cause nonce collisions | Current loop is fully sequential (await for each key), so zero concurrency = zero nonce collisions. Confirmed correct. Needs a guard comment, not code change |

</phase_requirements>

---

## Summary

Phase 2 adds the resilience layer that makes the keeper reliable in production: it must survive transient failures, record actionable error information, and handle the full deposit lifecycle including expiry. The current keeper (post Phase 1) correctly executes fresh deposits but has three meaningful gaps: (1) any RPC timeout or gas estimation failure immediately marks the deposit FAILED with no retry, (2) no error reason is stored in the DB so debugging requires reading Docker logs, and (3) expired deposits sit in the DEPOSIT_LIST indefinitely with no mechanism to cancel them and free locked user funds.

The most architecturally interesting finding is LIFE-01 (deposit cancellation). The keeper wallet (0x48Cb0d738C9B3F44F60f7338F788fa093FD25828) holds ORDER_KEEPER and FROZEN_ORDER_KEEPER roles. `DepositHandler.cancelDeposit()` requires the CONTROLLER role. On Base Sepolia, the deployer has all roles and can grant CONTROLLER to the keeper wallet via `grantRole`. Once granted, the keeper can call `DepositHandler.cancelDeposit(key)` directly. This is the correct approach — simpler than ExchangeRouter which requires `msg.sender == deposit.account()`.

For LIFE-03 (restart recovery), the good news is the system already handles this correctly by design: the scanner reads PENDING deposits from DB on every cycle and also picks up new keys from the DEPOSIT_LIST. There is no "EXECUTING" intermediate state — deposits in-flight during a crash remain PENDING in the DB and will be retried on the next scan. The only refinement needed is a test to verify this behavior and a comment in code confirming it is intentional.

**Primary recommendation:** Add retry with exponential backoff to depositExecutor.ts, add `errorReason` field to DepositRequest schema, implement expired deposit detection and cancellation via DepositHandler.cancelDeposit() (after granting CONTROLLER role), and confirm LIFE-03/LIFE-04 work as-is with documentation.

---

## Standard Stack

### Core (already in keeper — confirmed by reading source)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.40.3 | Blockchain client — contract calls, transaction submission | Already in use; modern type-safe client |
| @prisma/client | ^7.2.0 | PostgreSQL ORM | Already managing deposit_requests table |
| prisma | ^7.2.0 | Schema migrations | Already in devDependencies |
| dotenv | ^17.2.3 | Environment config | Already in use |

### No New Dependencies Needed

All Phase 2 functionality can be implemented with the existing stack:
- Retry logic: plain TypeScript with `await new Promise(resolve => setTimeout(resolve, delay))`
- Error recording: Prisma schema migration to add `errorReason` field
- Deposit cancellation: extend existing ABI with `cancelDeposit` function
- Expiry detection: read `deposit.numbers.updatedAtTime` (already in `DepositProps`) + read `REQUEST_EXPIRATION_TIME` from DataStore

**No npm installs required.**

---

## Architecture Patterns

### Current Project Structure (post Phase 1)

```
order-execution-keeper-service/
├── src/
│   ├── config.ts                     # All env vars
│   ├── index.ts                      # Main loop: scan (10s) → execute → cleanup (5m)
│   ├── config/tokens.ts              # Token addresses + Pyth feed IDs
│   └── core/
│       ├── scanners/
│       │   ├── depositScanner.ts     # Reads DEPOSIT_LIST, stores PENDING in DB
│       │   └── types.ts              # DepositProps has updatedAtTime (expiry timestamp)
│       ├── executors/
│       │   ├── baseExecutor.ts       # buildOracleParams, submitTransaction, estimateGas
│       │   └── depositExecutor.ts    # execute(key): guard → oracle → gas → tx → receipt
│       ├── oracle/pythLazerOracle.ts # WebSocket price feeds
│       ├── monitor/transactionMonitor.ts # Checks SUBMITTED tx statuses every 30s
│       └── blockchain/
│           ├── client.ts             # walletClient, publicClient singletons
│           └── contracts/
│               ├── reader.ts         # getDeposit, getMarket
│               ├── dataStore.ts      # getAllBytes32Values
│               └── abis/
│                   └── deposit-handler.ts  # Currently only has executeDeposit
├── prisma/schema.prisma              # deposit_requests (no errorReason yet)
└── scripts/test-deposit.mjs         # E2E test tool
```

### Pattern 1: Retry with Exponential Backoff

**What:** Wrap the execute body in a retry loop. On transient error (RPC timeout, nonce issue), wait and retry up to N times before marking FAILED.

**When to use:** For errors from `submitTransaction` and `waitForTransactionReceipt` that are clearly transient: network timeouts, `nonce too low`, `replacement transaction underpriced`.

**Transient vs. permanent error classification:**
- TRANSIENT (retry): RPC timeout, `fetch failed`, `network error`, `nonce too low`, `replacement transaction underpriced`, `intrinsic gas too low` (gas spike)
- PERMANENT (fail immediately): `EmptyDeposit()`, gas estimation fails with contract error, `OracleTimestampsAreLargerThanRequestExpirationTime` (deposit expired — cancel instead)

**Example:**
```typescript
// In depositExecutor.ts execute() method
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000; // 2 seconds

async function executeWithRetry(key: Hex): Promise<void> {
  let lastError: Error | unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await executeOnce(key, attempt);
      return; // success
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === MAX_RETRIES) {
        throw error;
      }
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[DepositExecutor] Attempt ${attempt} failed, retrying in ${backoffMs}ms`, error);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('nonce too low') ||
    msg.includes('replacement transaction underpriced') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}
```

### Pattern 2: Error Reason Recording

**What:** On failure, write the error message into `DepositRequest.errorReason` in the DB. Also populate `DepositExecution.failureReason` (field already exists in schema but is never written).

**Schema change needed:**
```prisma
model DepositRequest {
  // ... existing fields ...
  errorReason   String?   // NEW: reason for FAILED status
  retryCount    Int       @default(0)  // NEW: how many times retried
}
```

**Usage pattern:**
```typescript
// In the FAILED path of depositExecutor.ts
const reason = error instanceof Error ? error.message : String(error);
await prisma.depositRequest.update({
  where: { requestKey: key },
  data: {
    status: "FAILED",
    errorReason: reason.slice(0, 500), // truncate to avoid DB column overflow
  },
});

// Also populate DepositExecution.failureReason if execution was attempted
if (executionId) {
  await prisma.depositExecution.update({
    where: { id: executionId },
    data: { failureReason: reason.slice(0, 500) },
  });
}
```

### Pattern 3: Expired Deposit Detection and Cancellation

**What:** During each scan cycle, check if a PENDING deposit has expired (current time > `updatedAtTime + REQUEST_EXPIRATION_TIME`). If expired, call `DepositHandler.cancelDeposit(key)` to cancel on-chain and mark CANCELLED in DB.

**Critical constraint:** `DepositHandler.cancelDeposit()` requires CONTROLLER role. The keeper wallet currently only has ORDER_KEEPER. **Must grant CONTROLLER role to keeper wallet on Base Sepolia before this works.**

**How expiry is calculated:**
- `deposit.numbers.updatedAtTime` — the block timestamp when deposit was created (already in `DepositProps` TypeScript type)
- `REQUEST_EXPIRATION_TIME` — stored in DataStore as a uint256 (seconds). Read once at startup or cache with 1-hour TTL.
- Deposit is expired when: `Date.now() / 1000 > updatedAtTime + requestExpirationTime`

**`cancelDeposit` ABI to add to `abis/deposit-handler.ts`:**
```typescript
{
  type: "function",
  name: "cancelDeposit",
  inputs: [{ name: "key", type: "bytes32" }],
  outputs: [],
  stateMutability: "nonpayable",
},
```

**Implementation location:** `depositScanner.ts` cleanup method OR a new `depositCanceller.ts`. Cleaner to add to `cleanupStaleDeposits()` since it already runs every 5 minutes.

**Execution flow:**
```typescript
// In cleanupStaleDeposits() or a new cancelExpiredDeposits()
async cancelExpiredDeposits(): Promise<number> {
  const prisma = await this.getPrisma();
  const pendingDeposits = await prisma.depositRequest.findMany({
    where: { status: "PENDING" },
  });

  const requestExpirationTime = await this.dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY);
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

  let cancelled = 0;
  for (const dbDeposit of pendingDeposits) {
    const deposit = await this.reader.getDeposit(dbDeposit.requestKey as Hex);
    if (!deposit) continue; // already gone

    const expiredAt = deposit.numbers.updatedAtTime + requestExpirationTime;
    if (nowSeconds < expiredAt) continue; // not yet expired

    console.log(`[DepositScanner] Deposit ${dbDeposit.requestKey} expired, cancelling on-chain`);
    try {
      // Call DepositHandler.cancelDeposit() — requires CONTROLLER role
      const txHash = await walletClient.writeContract({
        address: config.depositHandlerAddress,
        abi: depositHandlerAbi,
        functionName: "cancelDeposit",
        args: [dbDeposit.requestKey as Hex],
        account: getAccount(),
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      await prisma.depositRequest.update({
        where: { requestKey: dbDeposit.requestKey },
        data: { status: "CANCELLED", errorReason: "Deposit expired — cancelled on-chain" },
      });
      cancelled++;
    } catch (error) {
      console.error(`[DepositScanner] Failed to cancel expired deposit ${dbDeposit.requestKey}:`, error);
    }
  }
  return cancelled;
}
```

### Pattern 4: LIFE-03 — Restart Recovery (Already Correct)

**What:** On restart, the keeper re-reads the DEPOSIT_LIST from DataStore AND gets PENDING deposits from DB. New deposits created during downtime will be in the DEPOSIT_LIST but NOT in the DB. The scanner stores them as PENDING. On the next scan cycle (10s), they are executed.

**Current flow (already works):**
```
Restart → scan() called → depositKeys from DEPOSIT_LIST
  → newKeys = depositKeys not in DB → store as PENDING
  → pendingKeys = all PENDING in DB (includes pre-restart PENDING)
  → all returned for execution
```

**No code change required.** Just verify there is no "EXECUTING" intermediate state that would block retry. The current schema has no EXECUTING status — deposits are PENDING until the transaction receipt is confirmed, then EXECUTED or FAILED. A crash mid-execution leaves them PENDING, which is correct behavior.

**Documentation to add:** A comment in `depositScanner.ts` explaining that no EXECUTING state is intentional — PENDING means "needs execution attempt", and idempotency is handled by the on-chain `EmptyDeposit()` guard.

### Pattern 5: LIFE-04 — Sequential Execution Prevents Nonce Collisions

**What:** The current loop in `index.ts` is fully sequential:
```typescript
for (const key of depositResult.depositKeys) {
  await depositExecutor.execute(key); // awaits completion before next
}
```

Because `execute()` awaits `waitForTransactionReceipt` (which waits for on-chain confirmation), each deposit is fully complete before the next one starts. viem's `walletClient.writeContract` fetches the current pending nonce from the RPC at submission time. Since there is only one in-flight transaction at a time, the nonce is always correct.

**No code change required.** Document this as explicit design choice.

### Anti-Patterns to Avoid

- **Don't retry on permanent errors:** `EmptyDeposit()`, contract-level validation errors (malformed deposit params) should fail immediately. Retrying wastes time and gas.
- **Don't retry on expiry errors:** `OracleTimestampsAreLargerThanRequestExpirationTime` means the deposit is expired. Cancel it instead of retrying.
- **Don't use ExchangeRouter.cancelDeposit() from the keeper:** It requires `msg.sender == deposit.account()`. The keeper is not the user. Use `DepositHandler.cancelDeposit()` (CONTROLLER role) instead.
- **Don't use Promise.all() for deposit execution:** Parallel execution would cause nonce collisions on the single keeper wallet. Keep the sequential loop.
- **Don't store errorReason without truncation:** Long Solidity revert messages or stack traces can exceed VARCHAR column limits. Truncate to 500 chars.
- **Don't check expiry before the REQUEST_EXPIRATION_TIME window closes:** Must wait until `now > updatedAtTime + requestExpirationTime`, not just `now > updatedAtTime`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff | Custom retry library | Plain `setTimeout` + loop | Stack is too simple to justify a library; 3-attempt backoff is 10 lines |
| Error classification | Complex error parser | Simple string matching on `error.message` | RPC and viem errors have predictable message patterns |
| Nonce management | Manual nonce tracking | Let viem fetch pending nonce at `writeContract` time | viem already handles this correctly; manual tracking adds complexity and bugs |
| Expiry detection | Event subscription | Polling-based check in cleanupStaleDeposits() | Simpler; same 5-minute cleanup loop already runs; events would require additional WebSocket |

**Key insight:** This phase is about adding behavior to existing code, not introducing new infrastructure. All four requirements can be satisfied with TypeScript logic changes and one Prisma migration.

---

## Common Pitfalls

### Pitfall 1: Retrying FAILED Status While Deposit Is Already Terminal

**What goes wrong:** A deposit is marked FAILED during retry attempt 1. On retry attempt 2, the executor checks `request.status !== "PENDING"` and returns early. The retry loop sees a "successful" return (no throw) and thinks the deposit is done.

**Why it happens:** The current pattern marks FAILED inside the catch block before re-throwing. If retry logic wraps the outer try/catch, it intercepts the throw but the DB is already set to FAILED.

**How to avoid:** Only update status to FAILED when the retry budget is exhausted. During retries, don't update the DB status — leave it PENDING. Only on final failure set FAILED + errorReason.

**Warning signs:** DB shows FAILED after first execution attempt even though retries were configured.

### Pitfall 2: Retrying Expired Deposits Instead of Cancelling

**What goes wrong:** A deposit is older than REQUEST_EXPIRATION_TIME. The keeper tries to execute it, gets `OracleTimestampsAreLargerThanRequestExpirationTime`, classifies it as transient (because it looks like an oracle error), and retries 3 more times — all failing.

**Why it happens:** The expiry error looks like an oracle error. Without explicit classification, retry logic might retry it.

**How to avoid:** Explicitly check for this error selector in `isTransientError()` and return false. The cancellation path (cleanupStaleDeposits) will handle it.

**Warning signs:** Repeated attempts logged for same key with same oracle timestamp error.

### Pitfall 3: Grant CONTROLLER Role Forgetting to Update ENV

**What goes wrong:** The CONTROLLER role is granted to the keeper wallet on-chain. But the keeper's `depositHandlerAbi` doesn't include `cancelDeposit`. The ABI call fails at TypeScript level.

**Why it happens:** The ABI in `deposit-handler.ts` currently only has `executeDeposit`. Adding `cancelDeposit` requires updating the ABI file.

**How to avoid:** Add `cancelDeposit` to `depositHandlerAbi` at the same time as implementing the cancellation logic. Test with a TypeScript compile check.

### Pitfall 4: REQUEST_EXPIRATION_TIME Read from DataStore — Wrong Key Encoding

**What goes wrong:** Reading `REQUEST_EXPIRATION_TIME` from DataStore returns 0 or wrong value because the key encoding is wrong.

**Why it happens:** DataStore keys are `keccak256(abi.encode("REQUEST_EXPIRATION_TIME"))`. The keeper's existing `keys.ts` utility must be checked for this key.

**How to avoid:** Verify the key against the Solidity definition:
```solidity
// Keys.sol line 252
bytes32 public constant REQUEST_EXPIRATION_TIME = keccak256(abi.encode("REQUEST_EXPIRATION_TIME"));
```

Implement as:
```typescript
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
const REQUEST_EXPIRATION_TIME_KEY = keccak256(
  encodeAbiParameters(parseAbiParameters('string'), ['REQUEST_EXPIRATION_TIME'])
);
```

### Pitfall 5: Prisma Migration on Production DB

**What goes wrong:** Adding `errorReason` and `retryCount` fields to the schema requires running `prisma migrate deploy` on the DO server's PostgreSQL. If this step is missed, the runtime fails with "column does not exist" errors.

**Why it happens:** Prisma enforces schema vs. DB alignment at query time.

**How to avoid:** Migration must be part of the deployment plan. Add it to the Docker build or run it as a startup step. The migration is additive (new nullable columns) and is safe for the existing data.

---

## Code Examples

### Exponential Backoff Retry Pattern

```typescript
// src/core/executors/depositExecutor.ts — retry wrapper
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

async execute(key: Hex): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await this.executeOnce(key, attempt);
      return; // success
    } catch (error) {
      lastError = error;
      const isPermanent = this.isPermanentError(error);
      const isLastAttempt = attempt >= MAX_RETRIES;

      if (isPermanent || isLastAttempt) {
        // Record failure reason in DB
        await this.recordFailure(key, error);
        throw error;
      }

      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1); // 2s, 4s
      console.warn(
        `[DepositExecutor] Deposit ${key} attempt ${attempt} failed, ` +
        `retrying in ${backoffMs}ms:`, error
      );
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

private isPermanentError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error);
  // Permanent: contract-level errors (EmptyDeposit, expiry, access control)
  // All 4-byte selectors are permanent contract errors
  if (msg.includes('0x95b66fe9')) return true; // EmptyDeposit
  if (msg.includes('OracleTimestampsAreLargerThanRequestExpirationTime')) return true;
  if (msg.includes('No tokens to price')) return true; // malformed deposit
  return false;
}

private async recordFailure(key: Hex, error: unknown): Promise<void> {
  const prisma = await getOrCreatePrismaClient();
  const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  const current = await prisma.depositRequest.findUnique({ where: { requestKey: key }, select: { status: true } });
  if (current?.status === 'PENDING') {
    await prisma.depositRequest.update({
      where: { requestKey: key },
      data: { status: 'FAILED', errorReason: reason },
    });
  }
}
```

### Expiry Check Pattern

```typescript
// src/core/scanners/depositScanner.ts — added to cleanupStaleDeposits
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { getWalletClient, getAccount, getPublicClient } from '../blockchain/client.js';
import { depositHandlerAbi } from '../blockchain/contracts/abis/deposit-handler.js';
import { config } from '../../config.js';

const REQUEST_EXPIRATION_TIME_KEY = keccak256(
  encodeAbiParameters(parseAbiParameters('string'), ['REQUEST_EXPIRATION_TIME'])
) as `0x${string}`;

async cancelExpiredDeposits(): Promise<number> {
  const prisma = await this.getPrisma();
  const pendingDeposits = await prisma.depositRequest.findMany({
    where: { status: 'PENDING' },
    select: { requestKey: true },
  });
  if (pendingDeposits.length === 0) return 0;

  // Read expiration time from DataStore (seconds as bigint)
  const requestExpirationTime = await this.dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY);
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

  const walletClient = getWalletClient();
  const publicClient = getPublicClient();
  const account = getAccount();
  let cancelled = 0;

  for (const { requestKey } of pendingDeposits) {
    const deposit = await this.reader.getDeposit(requestKey as `0x${string}`);
    if (!deposit) continue; // already removed from chain

    const expiredAt = deposit.numbers.updatedAtTime + requestExpirationTime;
    if (nowSeconds <= expiredAt) continue; // not yet expired

    console.log(`[DepositScanner] Deposit ${requestKey} expired at ${expiredAt}, cancelling on-chain`);
    try {
      const txHash = await walletClient.writeContract({
        address: config.depositHandlerAddress,
        abi: depositHandlerAbi, // must include cancelDeposit
        functionName: 'cancelDeposit',
        args: [requestKey as `0x${string}`],
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      await prisma.depositRequest.update({
        where: { requestKey },
        data: { status: 'CANCELLED', errorReason: 'Deposit expired — cancelled on-chain by keeper' },
      });
      cancelled++;
      console.log(`[DepositScanner] Cancelled expired deposit ${requestKey}: txHash=${txHash}`);
    } catch (error) {
      console.error(`[DepositScanner] Failed to cancel deposit ${requestKey}:`, error);
    }
  }
  return cancelled;
}
```

### Prisma Schema Addition

```prisma
// prisma/schema.prisma — add to DepositRequest model
model DepositRequest {
  id            String        @id @default(uuid())
  requestKey    String        @unique
  account       String
  market        String
  status        RequestStatus @default(PENDING)
  errorReason   String?       // NEW: populated on FAILED status
  retryCount    Int           @default(0)  // NEW: tracks retry attempts
  createdAt     DateTime      @default(now()) @db.Timestamptz
  updatedAt     DateTime      @default(now()) @db.Timestamptz
  executedAt    DateTime?     @db.Timestamptz

  executions DepositExecution[]

  @@index([status, createdAt(sort: Desc)], name: "idx_deposit_requests_status_created")
  @@index([account, status], name: "idx_deposit_requests_account_status")
  @@index([market, status], name: "idx_deposit_requests_market_status")
  @@map("deposit_requests")
}
```

### cancelDeposit ABI Addition

```typescript
// src/core/blockchain/contracts/abis/deposit-handler.ts
export const depositHandlerAbi = [
  {
    type: "function",
    name: "executeDeposit",
    inputs: [
      { name: "key", type: "bytes32" },
      {
        name: "oracleParams",
        type: "tuple",
        components: [
          { name: "tokens", type: "address[]" },
          { name: "providers", type: "address[]" },
          { name: "data", type: "bytes[]" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    // NEW: requires CONTROLLER role on keeper wallet
    type: "function",
    name: "cancelDeposit",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
```

### Grant CONTROLLER Role Script Pattern

```typescript
// scripts/grant-keeper-controller-role.mjs
// Run once against Base Sepolia to grant keeper CONTROLLER role
// The deployer wallet (which has ROLE_ADMIN) must sign this transaction
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';

const ROLE_STORE_ADDRESS = '0x...'; // from contract deployment
const KEEPER_ADDRESS = '0x48Cb0d738C9B3F44F60f7338F788fa093FD25828';
const CONTROLLER_ROLE = keccak256(encodePacked(['string'], ['CONTROLLER']));

// grantRole(bytes32 roleKey, address account)
```

---

## Critical Contract Architecture Finding

### LIFE-01: Keeper Cannot Cancel Deposits With Current Roles

The `DepositHandler.cancelDeposit(key)` function has modifier `onlyController`. The keeper wallet is granted `ORDER_KEEPER` and `FROZEN_ORDER_KEEPER` roles — not `CONTROLLER`.

**This means:** Without a role change, the keeper CANNOT cancel expired deposits on-chain.

**Solution path (two options):**

**Option A: Grant CONTROLLER role to keeper wallet (RECOMMENDED for testnet)**
- Run a one-time script using the deployer wallet (which has ROLE_ADMIN) to call `RoleStore.grantRole(CONTROLLER, keeperWallet)`
- Keeper can then call `DepositHandler.cancelDeposit(key)` directly
- Risk: CONTROLLER is a powerful role that also allows createDeposit, createWithdrawal etc. On testnet this is acceptable.

**Option B: DB-only tracking (no on-chain cancellation)**
- Detect expiry by comparing `deposit.numbers.updatedAtTime + REQUEST_EXPIRATION_TIME` against current time
- Mark the DB record as CANCELLED without an on-chain tx
- The funds are NOT freed — they remain in DepositVault until the user manually cancels via the UI
- This satisfies LIFE-01 partially (detects and marks, doesn't free funds)

**Research verdict:** Option A is the correct implementation for LIFE-01 as written (success criteria says "freeing the user's locked funds"). Implement Option A. The research confirms this is achievable on Base Sepolia testnet where we control the deployer key.

### LIFE-03: Restart Recovery Already Works — Confirmed

The scanner flow is:
1. `getAllBytes32Values(DEPOSIT_LIST_KEY)` — gets all current on-chain keys
2. Filter for keys not in DB → store as PENDING
3. `getPendingDepositKeys()` — returns all PENDING from DB

A deposit created during keeper downtime will be in step 1 (it's in DEPOSIT_LIST) but not in step 2 filter (not in DB) → stored as PENDING → executed. This is correct.

**No code change needed for LIFE-03.** Add documentation comment only.

### LIFE-04: Sequential Loop Prevents Nonce Collisions — Confirmed

```typescript
// index.ts — sequential execution is the design
for (const key of depositResult.depositKeys) {
  await depositExecutor.execute(key); // waits for receipt before next key
}
```

With `waitForTransactionReceipt` inside `execute()`, each transaction is confirmed before the next one starts. viem fetches pending nonce at `writeContract` call time. Sequential = safe.

**No code change needed for LIFE-04.** Add a code comment only.

---

## State of the Art

| Current State | Phase 2 Target | Impact |
|---------------|----------------|--------|
| Failure goes straight to FAILED | Up to 3 retries with 2s/4s backoff | Transient RPC blips don't permanently fail deposits |
| No error reason in DB | `errorReason` field on DepositRequest | Engineers can debug failures without reading Docker logs |
| Expired deposits sit in DEPOSIT_LIST indefinitely | Keeper detects expiry, calls cancelDeposit, funds freed | Users' locked USDC is returned without manual intervention |
| Restart loses in-flight deposits (PENDING re-detected immediately) | Confirmed correct — PENDING on crash = retry on restart | No change needed; architecture is already correct |
| Sequential loop = no nonce collision possible | Confirmed correct — documented intent | No change needed; architecture is already correct |

---

## Open Questions

1. **What is the actual REQUEST_EXPIRATION_TIME value on Base Sepolia?**
   - What we know: It's stored in DataStore as `keccak256(abi.encode("REQUEST_EXPIRATION_TIME"))`. Contract defaults vary.
   - What's unclear: The specific value configured on-chain for our deployment.
   - Recommendation: Read it at start of Phase 2 implementation: `await dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY)`. The expiry scanner needs this value. If it returns 0, that means expiry is disabled (no need for LIFE-01 implementation).

2. **Does the keeper wallet already have CONTROLLER role, or does it need to be granted?**
   - What we know: The `grantKeeperRoles.ts` script only grants ORDER_KEEPER and FROZEN_ORDER_KEEPER.
   - What's unclear: Whether the deployer wallet was used as the keeper wallet (deployer has all roles on baseSepolia) or whether the separate 0x48Cb wallet was used.
   - Recommendation: Check on-chain: `roleStore.hasRole(keeperAddress, keccak256("CONTROLLER"))`. If false, run grant script before implementing LIFE-01.

3. **Should retry count be tracked per-execution or per-deposit?**
   - What we know: The schema would have `retryCount` on DepositRequest.
   - What's unclear: Whether resetting retryCount on restart (new PENDING cycle) is desired.
   - Recommendation: Track per-deposit in DB. On restart, retryCount remains from previous session — if 3 retries were exhausted, deposit is already FAILED. If deposit is still PENDING after restart (crash mid-retry), retryCount reflects previous attempts. Set MAX_RETRIES to be per execution session (not cumulative across restarts) by checking retryCount only within the in-memory retry loop, not from DB.

---

## Deployment Pattern

Phase 2 requires one manual pre-flight step (grant CONTROLLER role) and a DB migration:

```bash
# Step 1: Grant CONTROLLER role (one-time, requires deployer key)
# Run locally: node scripts/grant-keeper-controller-role.mjs

# Step 2: Deploy keeper code changes (standard rsync + docker compose)
rsync -avz --exclude node_modules --exclude dist \
  /Users/ken/Projects/0xM/order-execution-keeper-service/ \
  root@142.93.203.222:/opt/0xmarkets/order-execution-keeper-service/

# Step 3: Run Prisma migration on server (new errorReason, retryCount columns)
ssh root@142.93.203.222 "cd /opt/0xmarkets/order-execution-keeper-service && npx prisma migrate deploy"

# Step 4: Rebuild and restart keeper Docker container
ssh root@142.93.203.222 "cd /opt/0xmarkets && docker compose up -d --build order-execution-keeper"
```

---

## Sources

### Primary (HIGH confidence)

- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/depositExecutor.ts` — full source read; confirmed no retry logic, no errorReason writes
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/baseExecutor.ts` — confirmed submitTransaction has no retry
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/scanners/depositScanner.ts` — confirmed cleanupStaleDeposits has no expiry detection, only PENDING→CANCELLED for keys not in DEPOSIT_LIST
- `/Users/ken/Projects/0xM/order-execution-keeper-service/prisma/schema.prisma` — confirmed DepositRequest has no errorReason field; DepositExecution has failureReason but it's never written
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/index.ts` — confirmed sequential await loop for deposit execution
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/exchange/DepositHandler.sol` — confirmed cancelDeposit requires `onlyController`; executeDeposit requires `onlyOrderKeeper`
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/exchange/BaseHandler.sol` — confirmed validateRequestCancellation logic: `requestAge >= requestExpirationTime`
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/deposit/ExecuteDepositUtils.sol` — confirmed OracleTimestampsAreLargerThanRequestExpirationTime is the expiry error
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/oracle/OracleUtils.sol` — confirmed OracleTimestampsAreLargerThanRequestExpirationTime is classified as oracle error (causes re-revert, not auto-cancel)
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/router/ExchangeRouter.sol` — confirmed ExchangeRouter.cancelDeposit requires `msg.sender == deposit.account()`; cannot be called by keeper
- `/Users/ken/Projects/0xM/0xmarkets_contract/config/roles.ts` — confirmed baseSepolia deployer has all roles including CONTROLLER; keeper wallet must be explicitly granted
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/scanners/types.ts` — confirmed DepositNumbers includes `updatedAtTime: bigint`
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/blockchain/client.ts` — confirmed single walletClient singleton; viem fetches nonce at writeContract time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed; existing stack is sufficient
- Retry pattern (EXEC-03): HIGH — plain TypeScript, verified against source code
- Error recording (EXEC-04): HIGH — schema field addition + write in catch block; straightforward
- Deposit cancellation (LIFE-01): HIGH — contract roles verified from source, solution path clear; one external dependency (grant CONTROLLER role) is a prerequisite
- Restart recovery (LIFE-03): HIGH — scanner flow traced from source; confirmed no blocking state issue
- Concurrent deposits (LIFE-04): HIGH — sequential loop traced in index.ts; confirmed no nonce risk

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable contracts and infrastructure; 30-day window)
