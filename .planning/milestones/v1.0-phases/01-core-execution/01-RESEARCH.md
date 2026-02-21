# Phase 1: Core Execution - Research

**Researched:** 2026-02-20
**Domain:** Order-execution keeper service — deposit detection, price oracle push, on-chain execution
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Debugging approach:**
- Check keeper Docker logs on DO server for error messages from recent failures
- Create a standalone test deposit script using viem that can submit createDeposit programmatically (no dependency on Interface UI or user being present)
- Use small mUSDC deposit amount (e.g. 1 mUSDC) into ETH/USD pool for testing
- User will provide their private key for the test script
- Claude decides whether to keep the test script as a reusable tool or throw it away
- Edit code locally in the repo, then deploy to DO server via SSH + Docker rebuild — clean git history

**Execution timing:**
- Target: deposit executes within 2 minutes of mining on-chain
- Keep current 10-second scan interval — adequate for testnet
- Block until done: process one deposit at a time sequentially, don't queue

**Oracle price flow:**
- Push prices immediately before each executeDeposit call (current approach — no continuous background updates)
- Verify BOTH price update tx receipts (WETH index token + USDC collateral) landed on-chain before calling executeDeposit
- Claude decides WebSocket disconnect behavior (safer option)

**Verification method:**
- Verify BOTH: tx receipt status + event logs AND GM token balance change on user's wallet
- Test script should output a full step-by-step report: deposit created → prices pushed → execution tx → GM balance before/after
- Keeper should log successful executions with full details: tx hash, GM tokens minted, time from detection to completion

### Claude's Discretion
- Whether to keep the test deposit script as a permanent tool or discard after debugging
- WebSocket disconnect handling during deposit processing (pick the safer option)
- Exact error handling approach for price push failures

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | Keeper executes fresh deposits end-to-end (createDeposit tx mines → keeper pushes prices → executeDeposit succeeds → user receives GM tokens) | Root-cause diagnosis complete; fix identified — stale DB state + empty oracle params; test script approach defined |
| EXEC-02 | Prices are pushed on-chain within MAX_ORACLE_PRICE_AGE window (300s) before calling executeDeposit | Current code calls `waitForTransactionReceipt` before proceeding; 30s cache freshness check exists; oracle mode is "lazer" |

</phase_requirements>

---

## Summary

The `order-execution-keeper-service` is running on DigitalOcean (142.93.203.222) via Docker and is actively scanning the Base Sepolia DataStore. Live log analysis reveals the current failure mode: **6 deposit keys exist on-chain that the keeper has already recorded as "already tracked" in its Postgres DB, but no execution attempts are happening because all 6 are in a terminal state (FAILED or CANCELLED) in the DB.** When a fresh deposit is created, it will be detected as "new", the executor will be called, and the previous failure pattern will repeat: `estimateContractGas` against `DepositHandler.executeDeposit` returns the error `EmptyDeposit()` (selector `0x95b66fe9`), which means the deposit struct on-chain is zeroed out — i.e., the deposit was already executed or auto-cancelled and its key is a ghost in the DEPOSIT_LIST.

The actual execution bug appears to be a race/state mismatch: the scanner reads deposit keys from the DataStore's `DEPOSIT_LIST`, but by the time the executor calls the DepositHandler, the deposit data is already gone (zeroed out struct). This means fresh deposits ARE being created by users, but the keeper is either not reaching them in time (they expire before execution) or the oracle params being passed to `executeDeposit` are empty (`{tokens: [], providers: [], data: []}`). The oracle params are empty because in the current code, `buildOracleParams` in lazer mode ONLY returns non-empty params if the oracle has a registered feed for the deposit's tokens — but when the token list is also empty (due to the deposit being zeroed out), we get the double-empty state.

The fix requires two things: (1) a test script that submits a fresh `createDeposit` call so the keeper can catch it before it expires, and (2) ensuring the keeper's oracle parameter construction is correct and the deposit execution happens fast enough after detection.

**Primary recommendation:** Write a standalone viem test deposit script, clear stale FAILED deposits from the DB, run the keeper locally while watching logs, and fix any oracle param construction bugs revealed by the test run.

---

## Standard Stack

### Core (already in keeper — verified by reading code)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | 2.40.3 | Blockchain client — publicClient, walletClient, contract calls | Modern type-safe Ethereum client; already used throughout |
| @pythnetwork/pyth-lazer-sdk | ^5.2.0 | Pyth Lazer WebSocket price feeds | Required for oracle mode "lazer" used in production |
| @prisma/client | ^7.2.0 | PostgreSQL ORM for deposit tracking DB | Already in use; manages deposit_requests table |
| dotenv | ^17.2.3 | Environment config from .env | Standard; all config via env vars |
| express | ^5.1.0 | HTTP health check server on port 37018 | Already running |

### Test Script Stack

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| viem | 2.40.3 | Submit createDeposit multicall, read GM balance | Write as standalone `.mjs` script |
| @pythnetwork/pyth-lazer-sdk | ^5.2.0 | (Optional) verify price is available before deposit | Only if testing oracle path manually |

**Installation:** No new dependencies needed — use viem already in keeper's `node_modules` or install globally.

### Deployment

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | current | Container for keeper on DO server |
| pnpm | 10.22.0 | Package manager |
| Prisma | ^7.2.0 | DB migrations |

**Deploy pattern:**
```bash
# Local: build and push to DO
rsync -avz --exclude node_modules --exclude dist \
  /Users/ken/Projects/0xM/order-execution-keeper-service/ \
  root@142.93.203.222:/opt/0xmarkets/order-execution-keeper-service/

# On server: rebuild and restart
ssh root@142.93.203.222 "cd /opt/0xmarkets && docker compose up -d --build order-execution-keeper"
```

---

## Architecture Patterns

### Recommended Project Structure

```
order-execution-keeper-service/
├── src/
│   ├── config.ts                 # All env vars centralized here
│   ├── index.ts                  # Main loop: scan → execute cycle
│   ├── config/
│   │   └── tokens.ts             # Token addresses + Pyth feed IDs
│   ├── core/
│   │   ├── scanners/
│   │   │   └── depositScanner.ts # Reads DataStore, stores in DB
│   │   ├── executors/
│   │   │   ├── baseExecutor.ts   # buildOracleParams, submitTransaction
│   │   │   └── depositExecutor.ts # execute(key): oracle → gas → tx → DB
│   │   ├── oracle/
│   │   │   └── pythLazerOracle.ts # WebSocket, updatePriceOnChain()
│   │   └── blockchain/
│   │       └── contracts/        # Reader, DataStore wrappers + ABIs
├── scripts/
│   └── test-deposit.mjs          # Standalone test deposit tool
└── prisma/
    └── schema.prisma             # deposit_requests, deposit_executions tables
```

### Pattern 1: Scan → Execute Loop

**What:** `index.ts` runs `executePendingRequests()` every 10 seconds. This calls scanner, then iterates result.depositKeys and calls executor for each.

**Current flow:**
```typescript
// In index.ts
const depositResult = await depositScanner.scan();
for (const key of depositResult.depositKeys) {
  await depositExecutor.execute(key);
}
```

**When to use:** This sequential "scan then execute" pattern is correct. The issue is not the loop structure but what happens inside.

### Pattern 2: Oracle-then-Execute (Lazer Mode)

**What:** Before calling `DepositHandler.executeDeposit`, the keeper must push Pyth Lazer prices on-chain via `PythLazerFeedProvider.updatePrice()`. The `updatePriceOnChain()` method already calls `waitForTransactionReceipt` before returning — serializing the oracle update and the execution call.

**Current flow in `buildOracleParams`:**
```typescript
// baseExecutor.ts - LAZER mode path
for (const token of tokensToPrice) {
  if (pythLazerOracle.hasFeed(token)) {
    const txHash = await pythLazerOracle.updatePriceOnChain(token); // waits for receipt
  }
}
// Then returns: { tokens: tokensToPrice, providers: [pythLazerProvider, ...], data: [] }
```

**Critical gap:** When `tokensToPrice` is EMPTY (because the deposit was already executed/zeroed), `buildOracleParams` skips the oracle update entirely and returns `{tokens:[], providers:[], data:[]}`. The `executeDeposit` call then fails with `EmptyDeposit()` during gas estimation.

### Pattern 3: Stale DB State Cleanup

**What:** The `cleanupStaleDeposits()` method is called every 5 minutes. It finds PENDING deposit keys in DB that no longer exist in the DataStore's `DEPOSIT_LIST` and marks them CANCELLED. But FAILED deposits are NOT cleaned up — they stay as FAILED and don't block anything (since executor skips non-PENDING).

**Current cleanup logic:**
```typescript
// depositScanner.ts
async cleanupStaleDeposits(): Promise<number> {
  const pendingDeposits = await prisma.depositRequest.findMany({
    where: { status: "PENDING" },
  });
  const onChainKeys = new Set(await dataStore.getAllBytes32Values(DEPOSIT_LIST_KEY));
  const staleKeys = pendingDeposits.filter(d => !onChainKeys.has(d.requestKey));
  await prisma.depositRequest.updateMany({
    where: { requestKey: { in: staleKeys } },
    data: { status: "CANCELLED" },
  });
}
```

**Gap:** After a deposit fails gas estimation, it's marked FAILED immediately. The cleanup loop only handles PENDING→CANCELLED. This is fine for Phase 1 — FAILED deposits don't loop, they're skipped.

### Anti-Patterns to Avoid

- **Don't fire executeDeposit without verifying oracle tx receipts:** The code already uses `waitForTransactionReceipt` in `updatePriceOnChain`. Don't remove this.
- **Don't pass empty oracle params to executeDeposit:** If `tokens` array is empty (because deposit is stale/zero), gas estimation will throw `EmptyDeposit()`. Guard against this.
- **Don't mark deposits FAILED on gas estimation error for `EmptyDeposit`:** These are stale ghost keys from before, not real execution failures. They should be skipped/CANCELLED, not FAILED.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Price feed updates | Custom WebSocket client | `@pythnetwork/pyth-lazer-sdk` `PythLazerClient` | Already implemented and working; SDK handles reconnect, pool, subscription |
| Transaction submission | Custom nonce tracking | viem's `walletClient.writeContract` + `waitForTransactionReceipt` | Already in place; `waitForTransactionReceipt` prevents nonce collisions |
| Contract reads | Manual ABI encoding | viem `publicClient.readContract` | Type-safe, already used throughout |
| DB state | Raw SQL | Prisma ORM | Already in schema; migrations handled |

**Key insight:** The infrastructure is already correct. The bug is in the state management and oracle params construction, not the infrastructure layer.

---

## Common Pitfalls

### Pitfall 1: EmptyDeposit() — Ghost Keys in DEPOSIT_LIST

**What goes wrong:** The keeper calls `DepositHandler.executeDeposit(key, oracleParams)` but the deposit struct on-chain has been zeroed out (deposit already executed by another keeper run, or auto-cancelled on-chain). The contract reverts with `EmptyDeposit()` (selector `0x95b66fe9`).

**Why it happens:** GMX-style contracts store deposits in a struct array. When a deposit is executed or cancelled, the struct is deleted (zeroed), but the key may linger in the `DEPOSIT_LIST` for a block or two, or the DB has a stale PENDING record pointing to an already-consumed key.

**How to avoid:**
1. In the executor, fetch the deposit via `Reader.getDeposit(key)` and check if it returns null BEFORE building oracle params. If null, mark the DB record as CANCELLED and skip.
2. The current `depositExecutor.ts` already does this check (lines 35-38) — verify this code is running on the server (may be running old dist).

**Warning signs:** Error `0x95b66fe9` in logs, or `tokens: [], providers: [], data: []` in the executeDeposit call args.

### Pitfall 2: Stale Deposits — OracleTimestampsAreLargerThanRequestExpirationTime

**What goes wrong:** The deposit was created more than 300 seconds (MAX_ORACLE_PRICE_AGE) before the keeper attempts execution. The oracle price timestamps are newer than the deposit's expiration timestamp, so the contract rejects it.

**Why it happens:** A deposit has a `maxOracleStaleness` window. If the keeper doesn't execute within this window, the deposit expires. The previous session's last error was exactly this.

**How to avoid:** Fresh deposits must be executed within 300 seconds of creation. The keeper scans every 10s, so execution should happen within 10-20s of a fresh deposit arriving in the DEPOSIT_LIST. This requires the keeper to be running continuously and the oracle WebSocket to be delivering fresh prices.

**Warning signs:** Error `OracleTimestampsAreLargerThanRequestExpirationTime` in contract revert.

### Pitfall 3: Empty Oracle Params → executeDeposit Reverts

**What goes wrong:** `buildOracleParams` returns `{tokens:[], providers:[], data:[]}`. The DepositHandler receives no price data and cannot validate oracle timestamps, causing a generic revert.

**Why it happens:** In lazer mode, the final return statement in `buildOracleParams` is:
```typescript
return {
  tokens: tokensToPrice,
  providers: tokensToPrice.map(() => pythLazerProvider),
  data: tokensToPrice.map(() => "0x" as Hex),
};
```
If `tokensToPrice` is empty (because the deposit had zero-amount tokens), all three arrays are empty.

**How to avoid:** Validate that `tokensToPrice` is non-empty before calling `buildOracleParams`. The executor already reads deposit details and builds the token set — ensure the market's index token is always included even if long/short token amounts are zero.

### Pitfall 4: WebSocket Not Yet Connected on First Scan

**What goes wrong:** The keeper starts, waits 10 seconds for WebSocket data, then immediately scans. If the Pyth Lazer WebSocket hasn't delivered a price update yet, `getLatestUpdate(token)` returns undefined, and `updatePriceOnChain` falls back to `getLatestPrice()` (REST call). If that also fails, the oracle update is skipped.

**How to avoid:** The current 10s startup delay helps. For WebSocket disconnect handling: if the WebSocket goes down MID-execution, the cached update (30s freshness window) should still be valid. If cache is stale AND REST fallback fails, fail the individual deposit execution (don't crash the whole keeper). This is the "safer option" per Claude's discretion — fail individual executions, keep the scanner running.

### Pitfall 5: DB Has 6 FAILED/CANCELLED Deposits Blocking Understanding

**What goes wrong:** Looking at current logs, the 6 deposits are "already tracked" and the keeper is not attempting to execute them. This is expected — they're already in a terminal state (FAILED or CANCELLED). But it masks the actual issue: we can't test execution until a NEW fresh deposit arrives.

**How to avoid:** The test script creates a fresh deposit so we can observe the full execution path end-to-end. The stale DB records are harmless but confusing.

---

## Code Examples

### Test Deposit Script Pattern

```typescript
// scripts/test-deposit.mjs
// Source: keeper service existing pattern + Interface createDepositTxn.ts
import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const EXCHANGE_ROUTER = '0x...'; // from Interface sdk/src/configs/contracts.ts
const DEPOSIT_VAULT = '0x...';
const ETH_USD_MARKET = '0x...'; // from sdk/src/configs/markets.ts
const USDC = '0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b';
const WETH = '0x4200000000000000000000000000000000000006';
const EXECUTION_FEE = parseUnits('0.001', 18); // 0.001 ETH execution fee

// The createDeposit params struct passed to ExchangeRouter.createDeposit()
const depositParams = {
  receiver: account.address,
  callbackContract: '0x0000000000000000000000000000000000000000',
  uiFeeReceiver: '0x0000000000000000000000000000000000000000',
  market: ETH_USD_MARKET,
  initialLongToken: WETH,
  initialShortToken: USDC,
  longTokenSwapPath: [],
  shortTokenSwapPath: [],
  minMarketTokens: 0n,
  shouldUnwrapNativeToken: false,
  executionFee: EXECUTION_FEE,
  callbackGasLimit: 0n,
};
```

### Checking GM Token Balance

```typescript
// viem readContract for ERC20 balance
const gmBalance = await publicClient.readContract({
  address: ETH_USD_MARKET, // GM token IS the market token
  abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
  functionName: 'balanceOf',
  args: [account.address],
});
```

### Verifying a Deposit Key Is Valid On-Chain

```typescript
// Reader.getDeposit returns zeroed struct when deposit consumed
const deposit = await reader.getDeposit(key);
if (deposit === null || deposit.addresses.account === '0x0000000000000000000000000000000000000000') {
  console.log(`Deposit ${key} is stale/executed — skipping`);
  // Mark DB record CANCELLED, don't attempt execution
  return;
}
```

---

## State of the Art

### Current State of the Keeper (Live System Observed 2026-02-20)

| Aspect | Current State | Observation |
|--------|---------------|-------------|
| Scanner | Working correctly | Finds 6 deposits from DataStore, correctly identifies them as "already tracked" |
| DB state | 6 deposits in terminal state | All 6 are FAILED or CANCELLED — no execution loops happening |
| Oracle (Lazer) | Running, WebSocket connected | Logs show subscription confirmed, 7 feeds registered |
| Execution | Not being triggered | No new deposits since keeper restart 36 minutes ago |
| Error on exec attempt | `EmptyDeposit()` (0x95b66fe9) | Seen in earlier logs — deposit was zeroed out before execution |

### Key Contracts (Base Sepolia, verified from docker-compose.yml)

| Contract | Address |
|----------|---------|
| DataStore | 0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E |
| DepositHandler | 0x9388B07f807eB870aD36d350d80DC0c214a7f04f |
| Reader | 0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c |
| PythLazerFeedProvider | 0x2F00A6200853B093459BCAAee1De6648D9d672fc |
| ExchangeRouter | In Interface sdk/src/configs/contracts.ts |

### Previous Fixes Already Deployed (from STATE.md)

| Fix | Status |
|-----|--------|
| `waitForTransactionReceipt` for nonce management | Deployed, working |
| WebSocket race condition (clientReady) | Deployed, working |
| Index token inclusion in oracle params | Deployed, working |
| Fail-fast gas estimation | Deployed, working |
| 10s startup delay for WebSocket data | Deployed, working |

---

## Open Questions

1. **What are the exact contract addresses for ExchangeRouter and DepositVault?**
   - What we know: They're in `sdk/src/configs/contracts.ts` in the Interface repo
   - What's unclear: Needed for the test deposit script
   - Recommendation: Read them before writing the test script

2. **Are the 6 on-chain deposit keys actually stale (deposit struct zeroed), or do they have valid data?**
   - What we know: Keeper gets `EmptyDeposit()` error when trying to execute them
   - What's unclear: Whether the DEPOSIT_LIST hasn't been cleaned up on-chain after execution
   - Recommendation: Read the deposit keys directly via `Reader.getDeposit(key)` in the test script to confirm

3. **Does the DB need to be cleared before testing?**
   - What we know: 6 FAILED/CANCELLED records in DB won't interfere with fresh deposits (executor skips non-PENDING, scanner stores new keys as PENDING)
   - What's unclear: Whether any DB records could interfere with a fresh deposit that happens to reuse a key (unlikely — keys are unique hashes)
   - Recommendation: No DB clearing needed, but worth logging DB state at start of test script

4. **WebSocket disconnect handling — what's the safer option?**
   - What we know: `PythLazerClient` has `addAllConnectionsDownListener`. If all connections are down, there's currently only a log message.
   - What's unclear: Should we abort the current execution cycle or proceed with stale cache?
   - Recommendation: If all WebSocket connections are down AND the cache is stale (>30s), throw an error in `updatePriceOnChain` so the individual deposit execution fails. The scanner keeps running — on the next 10s cycle, if WebSocket has recovered, the execution can proceed. Do NOT crash the process.

---

## Sources

### Primary (HIGH confidence)

- Live system logs from `docker logs 0xmarkets-order-execution-keeper-1` — actual current state
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/` — full source code read directly
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/error/Errors.sol` — confirmed `EmptyDeposit()` = `0x95b66fe9`
- `/Users/ken/Projects/0xM/order-execution-keeper-service/docker-compose.yml` on server — contract addresses

### Secondary (MEDIUM confidence)

- `.planning/codebase/` docs (ARCHITECTURE.md, STACK.md, CONCERNS.md, INTEGRATIONS.md) — cross-checked with source code

---

## Metadata

**Confidence breakdown:**
- Current system state: HIGH — direct log observation, source code reading
- Bug diagnosis: HIGH — error selector decoded from Errors.sol, confirmed with ABI mismatch logs
- Fix approach: HIGH — straightforward, no unknowns
- Contract addresses needed for test script: MEDIUM — needs to be read from Interface config

**Research date:** 2026-02-20
**Valid until:** 2026-03-06 (stable infrastructure, 2 weeks validity)

---

## Implementation Guidance for Planner

The Phase 1 work breaks into exactly 3 concrete pieces:

**1. Diagnose: Read deposit key states on-chain**
Run a quick script (or extend the existing `test_send.mjs`) that reads the 6 existing deposit keys via `Reader.getDeposit()` to confirm they're zeroed-out ghost entries. This confirms the keeper is working correctly — it's just that there are no live deposits to execute.

**2. Test script: Submit a fresh createDeposit**
Write `scripts/test-deposit.mjs` as a standalone viem script that:
- Approves USDC spend to DepositVault (if needed — check whether sendTokens handles this)
- Calls `ExchangeRouter.multicall([sendWnt, sendTokens, createDeposit])` with 1 USDC into ETH/USD pool
- Waits for the tx receipt and prints the deposit key
- Polls for GM balance until it increases (or timeout after 60s)
- Prints a full step-by-step report

**3. Fix keeper: Guard against EmptyDeposit() before gas estimation**
In `depositExecutor.ts`, the code already fetches `reader.getDeposit(key)` and returns null check. Verify this check catches the zeroed-struct case (`addresses.account === ZERO_ADDRESS`). If the deposit is null/empty, mark the DB record as CANCELLED (not FAILED — this is not an execution failure, it's a stale ghost). This prevents the FAILED status from being written for ghost deposits.

The above 3 items should be sufficient for Phase 1 success. The oracle path (Pyth Lazer WebSocket → updatePriceOnChain → executeDeposit) is already fully implemented and the previous fixes (waitForTransactionReceipt for sequencing, index token inclusion) are deployed and working.
