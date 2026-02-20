---
phase: 02-keeper-resilience
verified: 2026-02-20T18:30:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 2: Keeper Resilience Verification Report

**Phase Goal:** The keeper handles transient failures, restarts, concurrency, and expired deposits without manual intervention
**Verified:** 2026-02-20T18:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A deposit that fails due to an RPC timeout or nonce collision is retried automatically | VERIFIED | `depositExecutor.ts` has `for (let attempt = 1; attempt <= MAX_RETRIES; attempt++)` loop with `isTransientError()` classification and exponential backoff at `BASE_BACKOFF_MS * Math.pow(2, attempt - 1)` |
| 2 | Deposits created while the keeper is down are picked up on next scan cycle after restart | VERIFIED | `depositScanner.ts scan()` reads DEPOSIT_LIST from DataStore on every cycle and stores unseen keys as PENDING; LIFE-03 comment documents this behavior explicitly |
| 3 | Two concurrent deposits from different users complete without nonce collisions | VERIFIED | `index.ts` sequential `for` loop with `await depositExecutor.execute(key)` and LIFE-04 comment: "Sequential execution is intentional... Do NOT use Promise.all() here" |
| 4 | An expired deposit is detected and cancelled on-chain, freeing the user's locked funds | VERIFIED | `depositScanner.cancelExpiredDeposits()` reads `REQUEST_EXPIRATION_TIME` from DataStore, compares `deposit.numbers.updatedAtTime + requestExpirationTime` against `nowSeconds`, calls `walletClient.writeContract({ functionName: "cancelDeposit" })` |
| 5 | Failed deposits have a specific error reason recorded in DB | VERIFIED | `depositExecutor.recordFailure()` truncates error message to 500 chars and writes `errorReason` + `retryCount` to `deposit_requests` table on FAILED status |
| 6 | A transient error causes retry, not immediate FAILED status | VERIFIED | DB status stays PENDING during retry loop; `recordFailure()` (which sets FAILED) is only called on permanent error OR last attempt exhausted |
| 7 | A permanent error (EmptyDeposit, oracle expiry, contract revert) fails immediately | VERIFIED | `isPermanentError()` checks `0x95b66fe9`, `oracletimestampsarelargerthanrequestexpirationtime`, `no tokens to price`, `execution reverted`; permanent errors skip retry and call `recordFailure` immediately |
| 8 | After all retries exhausted, deposit is marked FAILED with truncated error reason | VERIFIED | `recordFailure(key, error, attempt)` sets `status: "FAILED"`, `errorReason: reason.slice(0, 500)`, `retryCount: attempts` |
| 9 | Sequential execution loop in index.ts is documented as intentional | VERIFIED | LIFE-04 comment present at lines 26-31 of `src/index.ts` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | `errorReason String?` and `retryCount Int @default(0)` on DepositRequest | VERIFIED | Lines 31-32: `errorReason  String?` and `retryCount   Int  @default(0)` present |
| `prisma/migrations/20260220172547_add_error_reason_retry_count/migration.sql` | ALTER TABLE adding errorReason and retryCount columns | VERIFIED | `ALTER TABLE "deposit_requests" ADD COLUMN "errorReason" TEXT, ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0` |
| `src/core/executors/depositExecutor.ts` | Retry loop, error classification, error recording | VERIFIED | Contains `execute()`, `executeOnce()`, `isPermanentError()`, `isTransientError()`, `recordFailure()` — all substantive implementations |
| `src/index.ts` | LIFE-04 comment + `cancelExpiredDeposits()` call in cleanup | VERIFIED | LIFE-04 comment on lines 26-31; `cancelExpiredDeposits()` called in `cleanupStaleRequests()` at line 72 |
| `src/core/blockchain/contracts/abis/deposit-handler.ts` | `cancelDeposit` ABI entry alongside `executeDeposit` | VERIFIED | Both `executeDeposit` and `cancelDeposit` present in `depositHandlerAbi` array |
| `src/core/blockchain/contracts/dataStore.ts` | `getUint(key: Hex)` method | VERIFIED | `getUint` method at lines 37-44 calls `readContract` with `functionName: "getUint"` |
| `src/core/blockchain/contracts/abis/dataStore.ts` | `getUint` function in ABI | VERIFIED | `getUint` entry at lines 31-36 with correct `view` stateMutability |
| `src/core/utils/keys.ts` | `REQUEST_EXPIRATION_TIME_KEY` constant | VERIFIED | Exported at lines 30-32 using `keccak256(encodeAbiParameters(...))` matching Solidity `abi.encode` pattern |
| `src/core/scanners/depositScanner.ts` | `cancelExpiredDeposits()` method + LIFE-03 doc | VERIFIED | Method at lines 225-292; LIFE-03 JSDoc at lines 31-43 of `scan()` |
| `scripts/grant-keeper-controller-role.mjs` | One-time CONTROLLER role grant script | VERIFIED | Exists with actual `ROLE_STORE_ADDRESS = '0x2b76Cf1aEc8972a12B228e69d53efc9a4e486Dd8'` (not a TODO placeholder); uses `encodeAbiParameters` (not `encodePacked`) to match Solidity `abi.encode` hash |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `depositExecutor.ts execute()` | `prisma.depositRequest.update` | `recordFailure` writes `errorReason` on final failure | WIRED | `recordFailure()` at lines 266-296 calls `prisma.depositRequest.update` with `errorReason: reason` and `status: "FAILED"` |
| `depositExecutor.ts retry loop` | `isTransientError` / `isPermanentError` | Error classification determines retry vs fail-fast | WIRED | `isPermanentError(error)` called at line 31; controls branch between immediate failure and retry loop |
| `depositScanner.ts cancelExpiredDeposits()` | `DepositHandler.cancelDeposit(key)` | `walletClient.writeContract` with `depositHandlerAbi` | WIRED | `walletClient.writeContract({ functionName: "cancelDeposit", args: [requestKey as Hex] })` at line 268 |
| `depositScanner.ts cancelExpiredDeposits()` | `dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY)` | Reads expiration window to compare against deposit age | WIRED | `this.dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY)` at line 235; result used in `expiredAt` comparison at line 259 |
| `index.ts cleanupStaleRequests()` | `depositScanner.cancelExpiredDeposits()` | Called during 5-minute cleanup cycle | WIRED | `await depositScanner.cancelExpiredDeposits()` at line 72; cleanup interval set to `5 * 60 * 1000` at line 176 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXEC-03 | 02-01-PLAN | Keeper retries transient failures with exponential backoff | SATISFIED | `depositExecutor.ts`: retry loop (MAX_RETRIES=3, BASE_BACKOFF_MS=2000ms); `isTransientError()` covers timeout, nonce, network, econnreset |
| EXEC-04 | 02-01-PLAN | Failed deposits marked in DB with specific error reason | SATISFIED | `recordFailure()`: `errorReason` written to `deposit_requests` table, truncated to 500 chars; migration applied |
| LIFE-01 | 02-02-PLAN | Expired deposits detected and auto-cancelled on-chain | SATISFIED | `cancelExpiredDeposits()` reads DataStore expiry, calls `cancelDeposit`, marks DB CANCELLED with errorReason "Deposit expired — cancelled on-chain by keeper" |
| LIFE-03 | 02-02-PLAN | Deposits created while keeper is restarting are picked up on next cycle | SATISFIED | `scan()` reads DEPOSIT_LIST from DataStore on every call; no EXECUTING state means in-flight deposits at crash remain PENDING and are retried; documented in JSDoc |
| LIFE-04 | 02-01-PLAN | Concurrent deposits don't cause nonce collisions | SATISFIED | Sequential `for` loop in `executePendingRequests()` with LIFE-04 comment explicitly prohibiting `Promise.all()` |

**Orphaned requirements check:** REQUIREMENTS.md maps EXEC-03, EXEC-04, LIFE-01, LIFE-03, LIFE-04 to Phase 2. All five appear in plan frontmatter. No orphaned requirements.

**Note:** LIFE-02 (deposit status tracked through full lifecycle: pending → executing → complete/failed/expired) is NOT claimed by Phase 2 — it maps to Phase 3 per REQUIREMENTS.md and the traceability table. This is correct; the intermediate "executing" state is not implemented here and is not a gap for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODO/FIXME/placeholder comments found in any Phase 2 modified files. The `ROLE_STORE_ADDRESS` TODO from the plan template was replaced with the actual address `0x2b76Cf1aEc8972a12B228e69d53efc9a4e486Dd8` before commit. No empty implementations or stub return values detected.

### Human Verification Required

#### 1. CONTROLLER Role On-Chain Verification

**Test:** Run `node scripts/grant-keeper-controller-role.mjs` (set DEPLOYER_KEY) or query the RoleStore contract directly for `hasRole(0x48Cb0d738C9B3F44F60f7338F788fa093FD25828, CONTROLLER_ROLE)`.
**Expected:** Returns `true`. The SUMMARY states this was completed (commit `cf9ad93`) and output showed "Verified: keeper has CONTROLLER = true".
**Why human:** On-chain state cannot be verified programmatically from this codebase — requires a live RPC call to Base Sepolia.

#### 2. Deployed Keeper Running with Phase 2 Changes

**Test:** SSH to `root@142.93.203.222` and run `docker logs --tail 50 0xmarkets-order-execution-keeper-1`.
**Expected:** Logs show `[DepositScanner]` scan cycles active, `[Main] Cancelled N expired deposits` in cleanup output, no Prisma column errors on startup.
**Why human:** Deployment state on remote server cannot be verified from local codebase inspection.

#### 3. Retry Behavior Under Actual RPC Failure

**Test:** Simulate a transient RPC failure (e.g., temporarily point to a bad RPC endpoint) and submit a deposit. Observe keeper logs.
**Expected:** Logs show "Attempt 1/3 failed... retrying in 2000ms", then "Attempt 2/3 failed... retrying in 4000ms", and either eventual success or FAILED with `errorReason` populated in DB.
**Why human:** Retry logic requires live RPC failure simulation to observe behavior end-to-end.

### Commit Verification

All four phase commits confirmed in git log of `order-execution-keeper-service`:

| Commit | Plan | Description |
|--------|------|-------------|
| `cb6cbff` | 02-01 Task 1 | feat: add errorReason and retryCount fields to DepositRequest schema |
| `3033305` | 02-01 Task 2 | feat: add retry loop with backoff and error recording to depositExecutor |
| `1c56f7f` | 02-02 Task 1 | feat: implement expired deposit cancellation and LIFE-03 documentation |
| `cf9ad93` | 02-02 Task 2 | fix: use encodeAbiParameters for CONTROLLER role hash |

### Gaps Summary

No gaps. All 9 observable truths verified, all 10 artifacts substantive and wired, all 5 key links confirmed, all 5 requirement IDs satisfied.

The only items flagged for human verification are live operational checks (on-chain role state, deployed container health, retry behavior under real RPC failure) — these cannot be verified statically and are not blocking automated goal achievement.

---

_Verified: 2026-02-20T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
