# FX Lazer Migration & Keeper Reliability Issues

**Date:** 2025-02-25
**Branch:** ken/integration
**Status:** FX Lazer migration COMPLETE, reliability fixes IN PROGRESS

---

## What Was Done

### FX Markets Migrated to Pyth Lazer (from Hermes)

Previously, FX markets (EUR, GBP, GOLD, JPY) were exclusively routed through Pyth Hermes (slow HTTP REST API) while crypto markets (BTC, ETH, USDC) used Pyth Lazer (fast WebSocket). The Pyth Pro access token now has FX feed entitlements, so all markets use Lazer.

**Files changed:**

1. **`order-execution-keeper-service/src/config/tokens.ts`**
   - Added EUR (feedId 327), GBP (333), GOLD (346), JPY (340 inverted) to `PYTH_LAZER_FEED_CONFIGS`
   - Removed "not entitled" comments

2. **`0xmarkets_contract/config/tokens.ts`**
   - Removed `oracleProvider: "pythHermesFeed"` from EUR, GBP, GOLD, JPY in both `base` and `baseSepolia` configs
   - They now use the default provider (`pythLazerFeed`) like crypto tokens

3. **On-chain (Base Sepolia):**
   - Ran `pnpm verify-oracle --fix` in order-execution-keeper-service
   - Updated `oracleProviderForToken` mapping for all 4 FX tokens from PythHermesFeedProvider (`0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a`) to PythLazerFeedProvider (`0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`)
   - Confirmed: all 7/7 tokens now match on-chain

4. **Both keepers restarted:**
   - order-execution-keeper (port 37018) — verified 7/7 Lazer feeds, 7/7 oracle providers consistent
   - keeper-service (port 37017) — already had FX feeds configured, just restarted

**Note:** The `keeper-service/src/config/tokens.ts` already had all FX feeds in `PYTH_LAZER_FEED_CONFIGS` — no changes needed there.

---

## Keeper Reliability Fixes

Investigation found multiple code paths causing transactions to silently fail or timeout. These explain why some users see fast execution while others timeout.

### Critical — Fix First

#### 1. `isPermanentError` is too broad — PARTIALLY FIXED
**Files:** All three executors in `order-execution-keeper-service/src/core/executors/`
- `depositExecutor.ts` — `isPermanentError()`
- `withdrawalExecutor.ts` — `isPermanentWithdrawalError()`
- `orderExecutor.ts` — `isPermanentOrderError()`

**Problem:** `lower.includes("execution reverted")` catches ALL contract reverts as permanent. This includes `OracleTimestampsAreSmallerThanRequired` (selector `0x7d677abf`) which is transient — Pyth WebSocket prices catch up within 1-2 seconds.

**What was fixed (2025-02-25):**
Added `0x7d677abf` as explicit transient exception BEFORE the `execution reverted` catch-all in all 3 executors. Keeper rebuilt and restarted (PID 73676). The oracle timestamp race condition now retries correctly.

**What still needs to be done:**
The doc originally recommended removing the broad `execution reverted` catch entirely and only listing known permanent selectors. Current fix is conservative — only the oracle timestamp error is excluded. To fully implement:

```typescript
// CURRENT (partially fixed) — still catches unknown reverts as permanent
if (msg.includes("0x7d677abf")) return false; // OracleTimestampsAreSmallerThanRequired (transient)
// ... specific permanent checks ...
if (lower.includes("execution reverted")) return true; // ← still catches everything else

// RECOMMENDED — flip the default, only catch KNOWN permanent selectors
private isPermanentError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  // Known permanent contract errors — will never succeed on retry
  if (msg.includes("0x95b66fe9")) return true; // EmptyDeposit
  if (msg.includes("0xd84b8ee8")) return true; // OracleTimestampsAreLargerThanRequestExpirationTime (expired)
  if (msg.includes("0x05d102a2")) return true; // InvalidOracleProvider (config mismatch)
  if (msg.includes("0x68b49e6c")) return true; // InvalidOracleProviderForToken (config mismatch)
  if (lower.includes("no tokens to price")) return true;
  // Everything else (including unknown reverts) → retry
  return false;
}
```

Apply same pattern to all 3 executors. The queue's MAX_QUEUE_RETRIES (5) prevents infinite retries.

**Error selector reference:**
| Selector | Error | Permanent? |
|----------|-------|------------|
| `0x7d677abf` | `OracleTimestampsAreSmallerThanRequired(uint256,uint256)` | No — Pyth prices catch up |
| `0xd84b8ee8` | `OracleTimestampsAreLargerThanRequestExpirationTime(uint256,uint256,uint256)` | Yes — request expired |
| `0x95b66fe9` | `EmptyDeposit()` | Yes — already consumed |
| `0x05d102a2` | `InvalidOracleProvider` | Yes — config mismatch |
| `0x68b49e6c` | `InvalidOracleProviderForToken(address,address)` | Yes — config mismatch |

#### 2. Queue dedup TTL too long (1 hour) — NOT YET FIXED
**File:** `order-execution-keeper-service/src/core/queue/executionQueue.ts:8`

```typescript
const KNOWN_ENTRY_TTL = 3600; // 1 hour — too long
```

**Problem:** After an item is processed (success OR failure), its key stays in `allKnown` for 1 hour. If the keeper crashes mid-execution or the item fails after all retries, re-enqueue attempts from the event listener or scanner are silently rejected for the full hour.

**Fix:** Change to `300` (5 minutes). The scanner runs every 5 minutes as a safety net, so items will be re-discovered on the next cycle.

### High Priority

#### 3. Max 50 items per scan — NOT YET FIXED
**File:** `order-execution-keeper-service/src/config.ts:28`

**Problem:** Scanner only reads the first 50 items from on-chain lists. If backlog exceeds 50, remaining items are invisible until the queue drains.

**Fix:** Increase to 200 or remove the limit entirely for small deployments.

#### 4. No execution fee validation — NOT YET FIXED
**Problem:** The keeper doesn't check if the user's execution fee covers gas costs before attempting execution. If gas is insufficient, the TX reverts and is marked permanent failure.

**Fix:** Read `MIN_EXECUTION_FEE` from DataStore and compare against the request's `executionFee` before attempting execution. Skip with a clear log message if insufficient.

#### 5. Stale request cleanup too aggressive — NOT YET FIXED
**Files:** `*Scanner.ts` — `cleanupStaleDeposits()`, `cleanupStaleOrders()`, `cleanupStaleWithdrawals()`

**Problem:** If a request key isn't found on-chain during cleanup, it's marked CANCELLED. But RPC lag or reorgs can cause temporary absence.

**Fix:** Require 2+ consecutive "not found" checks before marking CANCELLED. Add a `notFoundCount` field to DB records, increment on each scan where key is missing, only CANCEL when count >= 2.

### Medium Priority

#### 6. Background oracle update nonce collision — NOT YET FIXED
**Problem:** The background oracle updater and execution TX use the same wallet. Even with `disableBackgroundUpdates()` + `waitForIdle()`, there's a race window.

#### 7. 60-second TX confirmation timeout — NOT YET FIXED
**Problem:** `waitForTransactionReceipt` has a hard 60s timeout across all executors. During congestion, legitimate TXs timeout.

#### 8. Withdrawal/Order CANCELLED items can't be retried — NOT YET FIXED
**Problem:** Only PENDING and FAILED statuses are retried. CANCELLED is terminal with no manual recovery path.

---

## Liquidation Scanner Issues (2025-02-25)

Investigated why liquidations never fire for account `0x415c7F9824Acc1EE0DFf85640Cb24BF0087d6d61`.

### Issue A: Scanner never scheduled — FIXED
**File:** `keeper-service/src/index.ts`
`scanner.scan()` was configured but never called in a loop. Added `setInterval(runScan, scanIntervalSeconds * 1000)` with overlap guard. Scan runs immediately on startup then every 30s.

### Issue B: OracleWatcher passes address where bytes32 expected — NOT FIXED (BLOCKING)
**File:** `keeper-service/src/core/oracle.ts` → `fetchFromChain()` line 52-57
**File:** `keeper-service/src/core/scanner.ts` → `getTokenPrice()` line 321-343

The scanner calls `oracleWatcher.getMarketData(tokenAddress)` which calls `Oracle.getPrice(bytes32 marketId)` with a 20-byte address. Viem rejects it: `AbiEncodingBytesSizeMismatchError: Size of bytes (bytes20) does not match expected size (bytes32)`.

**Result:** Scanner discovers 4 positions across 3 accounts but ALL fail at "failed to get market prices". No position ever reaches the `isPositionLiquidatable` check.

**Fix:** Rewrite `getTokenPrice()` to use `PythLazerFeedProvider.getStoredPrice(address token)` instead of the Oracle contract. The Lazer background updater already pushes prices for all 7 tokens every 5s, so stored prices are always fresh. Implementation:

```typescript
// In scanner.ts — replace getTokenPrice()
private async getTokenPrice(tokenAddress: Address): Promise<PriceProps | null> {
  try {
    const [ok, storedPrice] = await publicClient.readContract({
      address: PYTH_LAZER_FEED_PROVIDER_ADDRESS,
      abi: pythLazerFeedProviderAbi,
      functionName: "getStoredPrice",
      args: [tokenAddress],  // address type — no bytes32 mismatch
    }) as [boolean, { token: Address; min: bigint; max: bigint; timestamp: bigint; provider: Address }];

    if (!ok) return null;

    // Check freshness (reject if older than 60s)
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    if (nowSeconds - storedPrice.timestamp > 60n) return null;

    return { min: storedPrice.min, max: storedPrice.max };
  } catch (error) {
    log.error({ err: error, tokenAddress }, "error fetching stored price");
    return null;
  }
}
```

Also need to add `PYTH_LAZER_FEED_PROVIDER_ADDRESS` to keeper-service config/contract.ts and import the ABI.

**Keeper-service is STOPPED** to prevent error spam. Do not restart until Issue B is fixed.

### Issue C: Executor uses Hermes for liquidation oracle params
**File:** `keeper-service/src/core/executor.ts` → `buildOracleParams()`
The liquidation executor still builds oracle params via Hermes. After fixing Issue B (scanner can detect), the executor should also use Lazer for speed. Lower priority — Hermes will work, just slower.

---

## Next Session: Implementation Plan

**Priority order (updated):**
1. **Fix liquidation scanner price fetching (Issue B)** — rewrite `getTokenPrice()` to use PythLazerFeedProvider.getStoredPrice()
2. Rebuild and restart keeper-service, verify scan loop detects liquidatable positions
3. Finish isPermanentError (#1 full implementation)
4. Queue dedup TTL (#2)
5. Stale cleanup (#5)

---

## Architecture Reference

### Oracle Routing (after migration)

All 7 tokens now use the same path:
```
WebSocket → PythLazerOracle cache → buildOracleParams() → PythLazerFeedProvider on-chain
```

Hermes is still available as fallback if a Lazer feed goes down (the `isTokenLazerEntitled()` check + Hermes fallback in `baseExecutor.ts:219-258` remains intact).

### Key Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| PythLazerFeedProvider | `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05` |
| PythHermesFeedProvider | `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a` |
| DataStore | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` |
| EventEmitter | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` |

### Pyth Lazer Feed IDs

| Token | Feed ID | Inverted | Decimals |
|-------|---------|----------|----------|
| EUR   | 327     | no       | 5        |
| GBP   | 333     | no       | 5        |
| GOLD  | 346     | no       | 3        |
| JPY   | 340     | yes      | 3        |
| USDC  | 7       | no       | 8        |
| WBTC  | 1       | no       | 8        |
| WETH  | 2       | no       | 8        |

### Keeper Services

| Service | Port | Purpose |
|---------|------|---------|
| keeper-service | 37017 | Price feeds, liquidation scanning, candle data |
| order-execution-keeper | 37018 | Executes deposits, withdrawals, orders |

### On-chain Config Commands

```bash
# Verify oracle providers match
cd order-execution-keeper-service
pnpm verify-oracle

# Fix mismatches
pnpm fix-oracle

# Full redeploy via contracts repo
cd 0xmarkets_contract
npx hardhat deploy --tags ConfigureOracleTokens --network baseSepolia
```

---

## Pre-existing Issue

The keeper-service has a missing `price_candles` table error — DB migration not run. Non-blocking (candle collector only), unrelated to FX migration.
