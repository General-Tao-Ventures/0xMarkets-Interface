# Domain Pitfalls

**Domain:** Per-market oracle routing, dual oracle mode configuration, and maximum keeper execution speed for DeFi perpetual futures
**Researched:** 2026-02-24
**Confidence:** HIGH for pitfalls derived from our own debugging history and codebase analysis; MEDIUM for Pyth Pro entitlement model (external dependency with limited documentation)

---

## Critical Pitfalls

Mistakes that cause complete execution failures, reverts on every transaction, or require coordinated multi-service fixes.

### Pitfall 1: Oracle Provider Mismatch Between Keeper Config and On-Chain DataStore

**What goes wrong:** Every execution reverts with `InvalidOracleProvider (0x05d102a2)` or `InvalidOracleProviderForToken (0x68b49e6c)`. The keeper appears connected, healthy, and detecting operations correctly, but 100% of executions fail at gas estimation.

**Why it happens:** The on-chain Oracle contract reads `oracleProviderForToken` from the DataStore for each token and validates that the provider address in the keeper's oracle params matches. There are TWO provider addresses in play:
- `PythLazerFeedProvider` (e.g., `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`) -- used in Lazer and "both" modes
- `PythContractAddress` / Hermes provider (e.g., `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a`) -- used in Hermes mode

The `configureOracleTokens.ts` deploy script sets ALL non-hardhat tokens to `pythLazerFeed` provider by default (line 10). But the keeper's `buildOracleParams()` in `baseExecutor.ts` sends the Hermes `pythContractAddress` when running in "hermes" or "both" mode (line 259-273). If the on-chain config says "PythLazerFeedProvider" but the keeper sends "PythContractAddress" as the provider, the contract rejects it.

**This already happened:** FX token withdrawals failed with `0x05d102a2` because the keeper was running in "both" mode (which falls through to Hermes for oracle params) while on-chain provider was set to PythLazerFeedProvider. The fix requires BOTH: (1) updating on-chain `oracleProviderForToken` via `updateOracleConfigForTokens.ts` AND (2) matching the keeper's oracle mode.

**Consequences:**
- All executions for affected tokens fail immediately
- Deposits, withdrawals, and orders pile up as PENDING, then expire
- Users see operations stuck indefinitely with no useful error message
- Retries are futile -- the error is deterministic until config is fixed

**Prevention:**
1. Add a startup consistency check that reads `oracleProviderForToken` from DataStore for every configured token and compares against the keeper's expected provider address. Log a FATAL error if any mismatch is found. (This is planned in Phase 13-01.)
2. When switching `ORACLE_MODE`, always update on-chain provider mapping FIRST (via deploy script), THEN update the keeper. Never change one without the other.
3. Document the three-way coordination requirement: on-chain DataStore mapping + keeper `ORACLE_MODE` + keeper provider address env vars.
4. For "both" mode specifically: understand that `buildOracleParams()` returns Hermes-style params (line 259-273), so the on-chain provider must be set to the Hermes/Pyth contract for "both" mode to work. The Lazer part only does background `updatePriceOnChain()` calls.

**Detection:** Gas estimation reverts on first execution attempt after startup. Error message contains `0x05d102a2` or `0x68b49e6c`. Health endpoint shows `oracleConnected: true` but zero successful executions.

**Phase to address:** Phase 1 -- startup verification must run before first execution.

---

### Pitfall 2: Per-Market Oracle Routing Creates Inconsistent Provider Requirements

**What goes wrong:** Crypto markets (ETH, BTC) execute successfully via Lazer, but FX markets (EUR, GBP, JPY, GOLD) fail because on-chain they need a different oracle provider. Or vice versa: you register Hermes for FX tokens on-chain, but the keeper sends Lazer provider for those tokens.

**Why it happens:** Per-market oracle routing means different tokens need different `oracleProviderForToken` values in the DataStore. Currently, `configureOracleTokens.ts` sets ALL tokens to `pythLazerFeed` provider (line 10-11). But if Lazer does not support FX feeds (due to entitlements), those tokens need Hermes provider on-chain instead. This creates a split configuration:
- Crypto tokens: `oracleProviderForToken` = PythLazerFeedProvider
- FX tokens: `oracleProviderForToken` = PythContractAddress (Hermes)

The keeper's `buildOracleParams()` currently uses a single oracle mode for ALL tokens. There is no per-token routing logic. When building oracle params for a deposit that involves both WETH (crypto, Lazer) and USDC (crypto, Lazer), it works. But a withdrawal from the EUR/USDC pool involves EUR (FX, needs Hermes provider) and USDC -- the keeper cannot send different providers for different tokens in the same execution call.

**Consequences:**
- Crypto markets work, FX markets do not (or vice versa)
- The keeper cannot handle mixed-provider executions without refactoring `buildOracleParams()`
- Operations involving FX tokens accumulate as PENDING/FAILED

**Prevention:**
1. Modify `buildOracleParams()` to route per-token: for each token, check whether it has a Lazer feed registered. If yes, use PythLazerFeedProvider as provider. If no (FX tokens without Lazer entitlements), use PythContractAddress (Hermes).
2. On-chain: run a MODIFIED `configureOracleTokens.ts` that sets `oracleProviderForToken` to PythLazerFeedProvider for crypto tokens and PythContractAddress for FX tokens. The current script uses a single default -- it needs per-token `oracleProvider` overrides in the token config.
3. The contract-side token config already supports `oracleProvider` per token (see `BaseTokenConfig.oracleProvider` in `config/tokens.ts` line 33), but the type definition only includes `"gmOracle" | "chainlinkDataStream" | "chainlinkPriceFeed"` -- NOT `"pythLazerFeed"`. The deploy script uses `"pythLazerFeed"` as an untyped string, bypassing TypeScript validation. Add `"pythLazerFeed" | "pythHermes"` to the `OracleProvider` type.
4. For FX tokens specifically, set `oracleProvider: "pythHermes"` in `config/tokens.ts` baseSepolia section, and update the deploy script to handle this new provider type.

**Detection:** Crypto market operations succeed, FX market operations revert with `InvalidOracleProvider`. Check keeper logs for which token triggered the error.

**Phase to address:** Phase 1 -- per-token routing in `buildOracleParams()` is the core feature of this milestone.

---

### Pitfall 3: Pyth Pro API Key With Wrong Asset Class Entitlements

**What goes wrong:** The Pyth Lazer WebSocket connects successfully, subscription is accepted, but only crypto feeds (BTC feedId 1, ETH feedId 2, USDC feedId 7) receive price data. FX feeds (EUR feedId 327, GBP feedId 333, JPY feedId 340, GOLD feedId 346) receive nothing. The keeper runs with partial oracle coverage: crypto markets work, FX markets have stale/missing prices.

**Why it happens:** Pyth Pro (formerly Pyth Lazer) uses asset-class-based entitlements. A "crypto" account subscription may only grant access to crypto, index, nav, and crypto-redemption-rate feed types. FX (forex) and commodity (metals) feeds require separate entitlements or a higher subscription tier. The previous Pyth token had ZERO entitlements for all asset types. The new token (noted in PROJECT.md as "crypto account") may only have crypto entitlements.

**This already happened:** The commented-out FX feeds in `PYTH_LAZER_FEED_CONFIGS` (tokens.ts lines 47-51) include the note: "key entitled for [crypto, index, nav, crypto-redemption-rate] only. Need FX entitlement from Pyth." This was discovered empirically -- the WebSocket connected but sent no data for FX feed IDs.

**Consequences:**
- FX markets (4 out of 6 non-USDC markets) cannot use Lazer, must fall back to Hermes
- The "maximum keeper speed" goal is only achievable for crypto markets
- If the keeper is configured for Lazer-only mode, FX markets break completely
- Background oracle updates for FX tokens silently skip (no cache data), creating a slow failure mode where prices go stale over time

**Prevention:**
1. Before deploying the new API key, test it locally with a standalone script that subscribes to ALL 7 feed IDs and verifies data arrives for each. Do not assume "crypto account" includes FX.
2. After enabling Lazer in production, add startup feed verification (planned in Phase 13-01): wait 10s after connect, check `updateCache` for each registered feed. If any FX feeds are missing, log a clear warning identifying the missing asset class.
3. Design the system to gracefully handle partial Lazer coverage: Lazer for crypto tokens, Hermes fallback for FX tokens. Do not require all-or-nothing Lazer support.
4. Contact the Pyth Data Distributor to explicitly request FX and commodity entitlements if they are not included in the current subscription.

**Detection:** After startup, check `pythLazerOracle.getLatestUpdate(token)` for each FX token. Returns `undefined` = no entitlement. The health endpoint should expose per-feed status, not just aggregate `oracleConnected: true/false`.

**Phase to address:** Phase 1 -- verify entitlements before any other work. This is an external blocker.

---

### Pitfall 4: MaxPriceAgeExceeded From Race Between Freshness Check and TX Execution

**What goes wrong:** The keeper checks that the stored on-chain price is fresh (within `MAX_ORACLE_PRICE_AGE - 5s safety margin`), decides to skip `updatePriceOnChain()`, then submits `executeDeposit()`. Between the freshness check and the actual execution transaction being mined, time passes (gas estimation, transaction submission, block confirmation). The price that was "fresh" when checked becomes stale by the time the Oracle contract validates it during execution. The transaction reverts with `MaxPriceAgeExceeded`.

**Why it happens:** `MAX_ORACLE_PRICE_AGE` is 300 seconds (5 minutes) for both Base and Base Sepolia (oracle.ts lines 30, 39). The safety margin in `isStoredPriceFresh()` is only 5 seconds (baseExecutor.ts line 185). In practice, the time between freshness check and transaction mining can be 10-30+ seconds:
- Gas estimation: 1-3s
- Transaction submission: 1-2s
- Block inclusion: 2-12s (Base Sepolia block times vary)
- Total: 4-17s typical, 30s+ under congestion

With only 5s safety margin, any execution delay can push the price past the age threshold.

**This already happened:** PROJECT.md lists "MaxPriceAgeExceeded errors when using Lazer-only mode (stored prices went stale between freshness check and TX execution)" as a known issue.

**Consequences:**
- Intermittent execution failures that are hard to reproduce (timing-dependent)
- More likely under network congestion or when Base Sepolia is slow
- Background updater keeps prices fresh, but the 10s minimum interval (`BG_UPDATE_INTERVAL_MS`) can miss the window
- Retries may succeed (price gets updated between attempts) but waste gas and time

**Prevention:**
1. Increase the safety margin from 5s to at least 30s. Better: make it `MAX_ORACLE_PRICE_AGE / 2` (150s) so the keeper always updates if the price is more than halfway to expiry.
2. When the freshness check passes but is close to the margin (e.g., price age > 200s out of 300s), proactively update anyway. "Fresh enough to skip" should mean "very fresh" not "barely fresh."
3. Consider always doing `updatePriceOnChain()` before execution regardless of freshness. The cost is one extra transaction per execution, but the reliability improvement is significant. Only skip if the price was updated within the last 30 seconds.
4. Reduce `BG_UPDATE_INTERVAL_MS` from 10s to 5s to keep prices fresher on-chain between executions.

**Detection:** Execution failures with error messages containing "MaxPriceAgeExceeded" or the corresponding error selector. Check the time delta between the last `updatePriceOnChain` TX and the failed `executeX` TX.

**Phase to address:** Phase 2 -- tune the freshness margin and background update interval after per-market routing is working.

---

### Pitfall 5: Nonce Collision Between Background Oracle Updates and Execution Transactions

**What goes wrong:** The background oracle updater (`triggerBackgroundUpdate()`) sends an `updatePriceOnChain()` transaction at the exact moment the drain loop starts an execution. Both use the same keeper wallet. The background TX grabs nonce N, the execution TX also grabs nonce N (or N+1 before the background TX is mined). One of the two fails with "nonce too low" or "replacement transaction underpriced."

**Why it happens:** The current system has a coordination mechanism: `drainQueue()` calls `disableBackgroundUpdates()` before execution and `enableBackgroundUpdates()` after (index.ts lines 89-117). However, there is a race window: the background update might be in-flight when `disableBackgroundUpdates()` is called. The code handles this by waiting up to 5 seconds for `isBackgroundUpdateBusy()` to clear (lines 93-96). But:
- The busy flag is only set while `triggerBackgroundUpdate()` is running, not while its transactions are pending in the mempool
- If a background `updatePriceOnChain()` TX is submitted but not yet mined, and execution starts, the execution's `getTransactionCount({ blockTag: "pending" })` should return the correct next nonce. But "pending" nonce depends on the RPC node's mempool view, which can be inconsistent
- The 3-second sleep in `updatePriceOnChain()` nonce retry (line 349) can overlap with execution's 4-second nonce retry (baseExecutor.ts line 134)

**This already happened:** The retry logic in both `updatePriceOnChain()` and `submitTransaction()` was added specifically to handle nonce conflicts. The existence of this retry code is evidence that the race condition occurs in practice.

**Consequences:**
- Execution latency increases by 3-7 seconds per nonce conflict (retry + backoff)
- Under load (multiple operations queued), nonce conflicts cascade: each retry delays the next operation
- In worst case, a nonce gap forms and blocks all transactions until it resolves

**Prevention:**
1. Keep the current disable/enable pattern but extend it: track whether the background updater's last TX is confirmed (mined), not just whether the function returned. Add a `lastBackgroundTxHash` field and wait for its receipt before starting execution.
2. Alternative: eliminate background updates entirely and always update prices synchronously before each execution. This adds 3-5s per execution but eliminates all nonce coordination complexity. For a single-wallet testnet keeper, reliability beats speed.
3. If keeping background updates: use an explicit nonce manager that tracks the next available nonce atomically across both the background updater and the executor. The simplest version is a mutex-protected counter:

```typescript
let nextNonce: number | null = null;
const nonceMutex = new Mutex();

async function getNextNonce(): Promise<number> {
  return nonceMutex.runExclusive(async () => {
    if (nextNonce === null) {
      nextNonce = await publicClient.getTransactionCount({
        address: account, blockTag: "pending"
      });
    }
    return nextNonce++;
  });
}
```

4. Log every nonce conflict with the source (background vs execution) to measure how often this occurs. If it is rare (< 1% of executions), the retry logic is sufficient. If frequent, invest in proper nonce management.

**Detection:** "nonce too low" or "replacement transaction underpriced" in logs. Check if the preceding log entry is from `pythLazerOracle` (background update) vs `baseExecutor` (execution).

**Phase to address:** Phase 2 -- measure frequency first. If nonce conflicts are rare with the current disable/enable pattern, defer. If frequent, implement proper nonce management.

---

## Moderate Pitfalls

Mistakes that cause partial failures, degraded performance, or require non-trivial debugging.

### Pitfall 6: "Both" Mode Sends Hermes Prices for Tokens That Require Lazer Provider On-Chain

**What goes wrong:** In "both" mode, `buildOracleParams()` first updates Lazer prices on-chain (lines 222-256), then falls through to the Hermes code path (lines 259-273) which fetches ALL token prices via Hermes and returns them as oracle params with `pythContractAddress` as the provider. But if the on-chain `oracleProviderForToken` is set to `PythLazerFeedProvider`, the Hermes-style params are rejected because the provider does not match.

**Prevention:** "Both" mode must be redesigned for per-token routing. For tokens with Lazer feeds: do `updatePriceOnChain()` and pass `PythLazerFeedProvider` as provider with empty data. For tokens without Lazer feeds (FX fallback): fetch from Hermes and pass `PythContractAddress` as provider with Hermes data. The current "update Lazer, return Hermes params" pattern only works if ALL tokens have their on-chain provider set to Hermes/Pyth contract.

**Phase to address:** Phase 1 -- this is the core refactoring of `buildOracleParams()`.

---

### Pitfall 7: FX Feed IDs Use Different Decimal Precision Than Crypto Feeds

**What goes wrong:** Price multiplier calculations are wrong for FX/commodity tokens, causing the Oracle contract to derive incorrect USD prices. Deposits and withdrawals succeed but with wrong pool share calculations, or revert with price validation errors.

**Why it happens:** The contract-side token config (`config/tokens.ts`) sets different `pythLazerFeedDecimals` per token:
- Crypto: `pythLazerFeedDecimals: 8` (BTC, ETH, USDC)
- FX: `pythLazerFeedDecimals: 5` (EUR, GBP)
- Commodity: `pythLazerFeedDecimals: 3` (GOLD, JPY)

The `configurePythLazerFeeds.ts` deploy script computes a multiplier: `expandDecimals(1, 60 - token.decimals - token.pythLazerFeedDecimals)`. If the keeper-side feed config does not match these decimals, prices will be scaled incorrectly.

The keeper-side `PYTH_LAZER_FEED_CONFIGS` in `tokens.ts` does NOT track `feedDecimals` -- it only has `token`, `feedId`, and `inverted`. The decimal handling happens on-chain in the PythLazerFeedProvider contract. However, if you ever need to validate or log prices in the keeper, using the wrong decimals will produce misleading values.

**Prevention:**
1. Verify that `configurePythLazerFeeds.ts` has been run after any token config changes. The on-chain multiplier must match the actual feed decimals.
2. When re-enabling FX feeds in the keeper, verify the on-chain multiplier by reading `pythLazerFeedMultiplierKey(token)` from DataStore and checking it matches the expected value.
3. Add a comment in the keeper's `PYTH_LAZER_FEED_CONFIGS` documenting the decimal precision per feed for developer reference.

**Phase to address:** Phase 1 -- verify on-chain config when enabling FX feeds.

---

### Pitfall 8: Inverted Feed Flag Mismatch Between Keeper and On-Chain Config

**What goes wrong:** JPY feed is inverted (feedId 340, `inverted: true` -- the feed provides JPYUSD but the system needs USDJPY). If the `pythLazerFeedInverted` flag is set correctly on-chain but not in the keeper config (or vice versa), the price is interpreted as the reciprocal of the correct value. JPY markets show absurdly wrong prices.

**Why it happens:** The inversion is handled on-chain by the PythLazerFeedProvider contract (via `pythLazerFeedInvertedKey`). The keeper-side `inverted` flag in `PYTH_LAZER_FEED_CONFIGS` is metadata for the keeper's own use. If these two get out of sync -- for example, the deploy script runs with `pythLazerFeedInverted: false` but the keeper config has `inverted: true` -- the keeper might skip price validation thinking the price is inverted when it is not.

**Prevention:**
1. The authoritative source of truth for the inverted flag is the contract config (`config/tokens.ts` in the contracts repo). The keeper config must mirror it exactly.
2. Add the inverted flag to the startup consistency check: read `pythLazerFeedInvertedKey(token)` from DataStore and compare with the keeper's config.
3. After running any deploy script, verify JPY prices manually by comparing the keeper's logged price against a known FX rate source.

**Phase to address:** Phase 1 -- include in the oracle config verification at startup.

---

### Pitfall 9: Pyth Lazer WebSocket Silently Disconnects Under Load

**What goes wrong:** The Pyth Lazer WebSocket pool drops all 4 connections simultaneously. The `allConnectionsDownListener` fires (pythLazerOracle.ts line 108) and logs an error, but the keeper continues running. The `updateCache` contains stale data. Background updates fail silently (stale cache, skipped). Execution uses the stale cached price for `updatePriceOnChain()`, which either fails on-chain (price too old for the Lazer verifier) or succeeds but is rejected later by the Oracle contract's `MAX_ORACLE_PRICE_AGE` check.

**Why it happens:** The SDK uses `heartbeatTimeoutDurationMs: 5000` (pythLazerOracle.ts line 61) which disconnects if no heartbeat within 5 seconds. Under Pyth service maintenance or network issues, all 4 connections can drop. The SDK has exponential backoff reconnection (`maxRetryDelayMs: 1000`) but during the reconnection window, the cache goes stale.

**Prevention:**
1. Track the timestamp of the last received price update per token. In `updatePriceOnChain()`, check this timestamp against a strict threshold (e.g., 10s). If the cached update is older than the threshold, refuse to send the stale data and fall back to Hermes instead.
2. The current cache freshness check (`isCacheFresh` at line 263, 30s threshold) is too generous. Reduce to 10s or less.
3. Set `healthState.oracleConnected = false` when `allConnectionsDownListener` fires, and only set it back to `true` when a new price update is received (not just when the connection re-establishes).
4. Consider adding Hermes as an automatic fallback when Lazer cache is stale, even in "lazer" mode. The goal is execution reliability, not oracle purity.

**Phase to address:** Phase 2 -- resilience hardening after basic routing works.

---

### Pitfall 10: updateOracleProviders vs updateOracleConfigForTokens Confusion

**What goes wrong:** Developer runs `updateOracleProviders.ts` (which enables/disables provider contracts globally) instead of `updateOracleConfigForTokens.ts` (which sets per-token provider mappings). Global provider is enabled, but per-token mapping still points to the wrong provider. Or: developer updates the per-token mapping but forgets to enable the provider globally first.

**Why it happens:** The contract system has TWO layers of oracle provider configuration:
1. **Global provider enablement:** `isOracleProviderEnabled[providerAddress]` -- whether the provider contract is allowed to supply prices at all
2. **Per-token provider mapping:** `oracleProviderForToken[token]` -- which specific provider is expected for each token

Both must be correctly set. Running only one deploy script leaves the other misconfigured. The scripts have similar names and purposes, making it easy to confuse them.

**Prevention:**
1. Create a single "oracle setup" script or checklist that runs both operations in sequence: first enable the provider globally, then set per-token mappings.
2. Add the startup verification check to detect BOTH failure modes: (a) expected provider is not globally enabled, and (b) per-token mapping does not match expected provider.
3. Document the two-layer model clearly in the deployment runbook.

**Phase to address:** Phase 1 -- must be understood before any on-chain config changes.

---

## Minor Pitfalls

Issues that cause confusion, waste developer time, or produce misleading diagnostics.

### Pitfall 11: OracleProvider TypeScript Type Excludes pythLazerFeed

**What goes wrong:** The `OracleProvider` type in `config/types.d.ts` is defined as `"gmOracle" | "chainlinkDataStream" | "chainlinkPriceFeed"`. It does NOT include `"pythLazerFeed"`. Yet `configureOracleTokens.ts` uses `"pythLazerFeed"` as the default provider key (line 10). This works because the deploy script accesses it as a string key, but TypeScript does not catch typos or misconfigurations in the token config's `oracleProvider` field when set to `"pythLazerFeed"` or `"pythHermes"`.

**Prevention:** Update the `OracleProvider` type to include all provider types actually in use: `"gmOracle" | "chainlinkDataStream" | "chainlinkPriceFeed" | "pythLazerFeed" | "pythHermes"`. This makes misconfigurations a compile-time error.

**Phase to address:** Phase 1 -- quick type fix when modifying the contract config.

---

### Pitfall 12: REQUEST_EXPIRATION_TIME Set to 3600s Masks Slow Execution

**What goes wrong:** Operations have a full hour to execute on testnet. This hides execution delays that would be unacceptable on mainnet. A keeper that takes 60 seconds to execute a deposit "works" on testnet but would fail on mainnet where REQUEST_EXPIRATION_TIME is typically 60-300 seconds.

**Prevention:** After achieving maximum speed on testnet, reduce REQUEST_EXPIRATION_TIME to a realistic mainnet value (e.g., 300s) and verify all operations still complete within that window. Log execution latency percentiles (already implemented via `latencyTracker`) and set alerting thresholds.

**Phase to address:** Phase 3 -- tuning and validation after speed optimization is complete.

---

### Pitfall 13: Background Update 10s Interval Means Prices Can Be 10s Stale at Execution

**What goes wrong:** The background updater runs at `BG_UPDATE_INTERVAL_MS = 10_000` (10s minimum between on-chain updates per token). If an execution starts 9.9s after the last background update, the on-chain price is 9.9s old. Add 5-10s for execution, and the price is 15-20s old when the Oracle validates it. This is within MAX_ORACLE_PRICE_AGE (300s) but suboptimal for "maximum speed" goals.

**Prevention:** Reduce `BG_UPDATE_INTERVAL_MS` to 3-5 seconds for tokens that have active Lazer feeds. For FX tokens using Hermes (no background update path), this is N/A -- those prices are fetched synchronously per execution.

**Phase to address:** Phase 2 -- tuning after per-market routing works.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Deploy new Pyth Pro API key | Key has crypto-only entitlements, FX feeds receive no data (Pitfall 3) | Test all 7 feed IDs locally before deploying to production |
| Enable Lazer for crypto, Hermes for FX | buildOracleParams sends wrong provider per token (Pitfall 2, 6) | Refactor buildOracleParams for per-token routing; test with mixed operations |
| Register Hermes provider for FX tokens on-chain | Run wrong deploy script (Pitfall 10) | Run both updateOracleProviders AND updateOracleConfigForTokens in sequence |
| Tune background update interval | Background TX collides with execution nonce (Pitfall 5) | Measure nonce conflict frequency before and after interval change |
| Optimize end-to-end latency | Freshness check passes but price goes stale before TX mines (Pitfall 4) | Increase safety margin to 30s minimum; consider always updating |
| Verify with mixed market operations | FX decimal precision causes wrong prices (Pitfall 7) | Read on-chain multiplier and compare against expected value |

---

## "Looks Done But Isn't" Checklist

- [ ] **All 7 feeds receive data:** After deploying new API key, verify each of BTC, ETH, USDC, EUR, GBP, GOLD, JPY feed IDs individually
- [ ] **On-chain providers match keeper for ALL tokens:** Not just crypto tokens -- check FX tokens too. Different tokens may need different providers.
- [ ] **buildOracleParams handles mixed providers:** A EUR/USDC withdrawal needs EUR via Hermes provider and USDC via Lazer provider -- both in the same oracle params
- [ ] **Inverted feeds produce correct prices:** Check JPY price against known FX rate; wrong inversion produces reciprocal (e.g., 0.0067 instead of 149)
- [ ] **Background updater disabled during execution:** Nonce coordination pattern still works after refactoring buildOracleParams
- [ ] **Health endpoint reflects per-feed status:** Not just "oracle connected" but which specific feeds are receiving data
- [ ] **FX operations work end-to-end:** Not just deposits -- test withdrawals and limit orders on FX markets specifically
- [ ] **No nonce conflicts under load:** Submit crypto deposit + FX withdrawal simultaneously; both execute without nonce errors

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Oracle provider mismatch (Pitfall 1) | HIGH | Run updateOracleConfigForTokens.ts to fix on-chain mapping; restart keeper. All pending operations must be re-tried. |
| Per-market routing wrong provider (Pitfall 2) | MEDIUM | Fix buildOracleParams routing logic; redeploy keeper. Pending operations retry automatically. |
| Wrong API key entitlements (Pitfall 3) | HIGH | Contact Pyth Data Distributor for correct entitlements; cannot be self-served. Meanwhile, use Hermes for unentitled feeds. |
| MaxPriceAgeExceeded (Pitfall 4) | LOW | Increase safety margin or always update prices; redeploy keeper. Operations retry automatically. |
| Nonce collision (Pitfall 5) | LOW | Existing retry logic handles it. If nonce gap forms, send a zero-value TX to fill the gap. |
| "Both" mode provider confusion (Pitfall 6) | MEDIUM | Refactor buildOracleParams for per-token routing. Until then, switch to per-token mode or Hermes-only. |
| Wrong decimal multiplier (Pitfall 7) | HIGH | Rerun configurePythLazerFeeds.ts with correct decimals. Any executions with wrong prices may have caused incorrect pool share calculations. |
| Inverted feed mismatch (Pitfall 8) | HIGH | Fix on-chain or keeper config. Any JPY operations executed with wrong inversion have incorrect prices -- manual review needed. |

---

## Sources

### Primary (HIGH confidence -- codebase analysis)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/baseExecutor.ts` -- buildOracleParams(), isStoredPriceFresh(), nonce handling
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` -- WebSocket pool config, background updates, cache freshness
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/oracle/pythOracle.ts` -- Hermes provider integration
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/config/tokens.ts` -- Feed configs, commented-out FX feeds with entitlement notes
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/config.ts` -- Oracle mode configuration
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/index.ts` -- Startup sequence, nonce coordination in drainQueue()
- `/Users/ken/Projects/0xM/0xmarkets_contract/deploy/configureOracleTokens.ts` -- On-chain provider mapping logic, default provider
- `/Users/ken/Projects/0xM/0xmarkets_contract/deploy/configurePythLazerFeeds.ts` -- Feed decimal multiplier computation
- `/Users/ken/Projects/0xM/0xmarkets_contract/config/tokens.ts` -- Per-token pythLazerFeedId, decimals, inverted flags
- `/Users/ken/Projects/0xM/0xmarkets_contract/config/oracle.ts` -- maxOraclePriceAge (300s), pythLazerFeedVerifier address
- `/Users/ken/Projects/0xM/0xmarkets_contract/config/types.d.ts` -- OracleProvider type definition (missing pythLazerFeed)
- `.planning/phases/13-production-lazer-deployment-and-keeper-optimization/13-RESEARCH.md` -- Prior debugging findings
- `.planning/PROJECT.md` -- Known issues, constraints, key decisions

### Secondary (MEDIUM confidence -- verified documentation)
- [Pyth Developer Hub - Best Practices](https://docs.pyth.network/price-feeds/core/best-practices) -- Staleness checks, MaxPriceAge guidance
- [Pyth Developer Hub - Price Feed IDs](https://docs.pyth.network/price-feeds/pro/price-feed-ids) -- Pro feed ID catalog
- [Pyth Network Launches Pyth Pro](https://www.businesswire.com/news/home/20250923720158/en/) -- Pro subscription model, asset class coverage
- [@pythnetwork/pyth-lazer-sdk (npm)](https://www.npmjs.com/package/@pythnetwork/pyth-lazer-sdk) -- WebSocket pool config, heartbeat, reconnection
- [GMX Synthetics Oracle.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/oracle/Oracle.sol) -- oracleProviderForToken validation pattern
- [QuickNode - Nonce Management](https://www.quicknode.com/guides/ethereum-development/transactions/how-to-manage-nonces-with-ethereum-transactions) -- EVM nonce collision strategies

### Tertiary (LOW confidence -- needs validation)
- Pyth Pro entitlement tiers per asset class -- no official documentation found. Understanding based on observed behavior (crypto feeds work, FX feeds silent) and keeper token config comments. Must be verified empirically with Pyth Data Distributor.

---
*Pitfalls research for: Per-market oracle routing, dual oracle mode, and maximum keeper speed (v1.4)*
*Researched: 2026-02-24*
