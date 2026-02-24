# Architecture Patterns: Per-Market Oracle Routing and Maximum Keeper Speed

**Domain:** Keeper oracle integration, per-market provider routing, execution speed optimization
**Researched:** 2026-02-24
**Confidence:** HIGH (based on full codebase analysis of order-execution-keeper-service, contracts repo oracle infrastructure, and on-chain provider architecture)

## Current Architecture (Post-v1.3)

### System Overview

The order-execution-keeper-service has a mature pipeline built across 12 phases:

```
[On-chain EventEmitter]     [DataStore polling (30s)]
         |                            |
    WebSocket events             Scanner reads
    (<2s detection)              (safety net)
         |                            |
         +----> [ExecutionQueue] <----+
                      |
                      v
              [drainQueue loop]
              (single consumer, sequential)
                      |
         +---disable background oracle---+
         |                               |
         v                               |
    [Executor: buildOracleParams]        |
         |                               |
         v                               |
    [submitTransaction]                  |
         |                               |
         v                               |
    [waitForReceipt]                     |
         |                               |
         +---re-enable background oracle--+
```

### Current Oracle Architecture

Two oracle services coexist, controlled by a **global** `ORACLE_MODE` env var:

| Service | Class | Transport | Tokens | Role |
|---------|-------|-----------|--------|------|
| Pyth Lazer | `PythLazerOracleService` | WebSocket (200ms streaming) | BTC, ETH, USDC | On-chain price storage via `updatePrice()` |
| Pyth Hermes | `PythOracleService` | REST (per-request fetch) | All 7 tokens | Fallback data in `SetPricesParams` |

The problem: `config.oracleMode` is global. It is either `"hermes"`, `"lazer"`, or `"both"` for ALL tokens. There is no way to say "use Lazer for BTC/ETH, Hermes for EUR/GBP/GOLD/JPY."

### Current buildOracleParams Flow

`BaseExecutor.buildOracleParams()` (lines 202-291) processes ALL tokens through the same oracle mode:

```
if oracleMode === "lazer" or "both":
    for EVERY token:
        if pythLazerOracle.hasFeed(token):
            check isStoredPriceFresh(token)
            if stale: updatePriceOnChain(token)   <-- SEPARATE TX

if oracleMode === "hermes" or "both":
    for EVERY token:
        if pythOracle.hasFeed(token):
            fetchPrices(token) via Hermes REST
            return SetPricesParams (tokens, providers, data)

if oracleMode === "lazer" only:
    return params with pythLazerProvider address + empty data
```

### Key Insight: On-Chain Provider Validation

The Oracle.sol contract (lines 250-280) enforces that the `provider` address in oracle params matches `oracleProviderForToken[token]` in DataStore. This means:

1. Each token has exactly ONE registered oracle provider on-chain
2. The keeper MUST pass the correct provider address per-token in `OracleParams.providers[]`
3. Mixing Lazer and Hermes providers in the same execution IS supported by the contract -- the `params.tokens[i]` / `params.providers[i]` / `params.data[i]` arrays are processed per-index

This is the architectural enabler for per-market oracle routing.

---

## Problem Statement: Three Failures to Fix

### Failure 1: FX Tokens Fail with InvalidOracleProvider (0x05d102a2)

**Root cause:** The `configureOracleTokens.ts` deploy script sets `oracleProviderForToken` to `PythLazerFeedProvider.address` for ALL tokens (including EUR, GBP, GOLD, JPY). When the keeper runs in `"both"` mode, `buildOracleParams()` falls through to the Hermes path and returns `pythContractAddress` (the Pyth/Hermes contract `0x8250f4aF`) as the provider. The on-chain Oracle contract sees:

```
params.providers[i] = 0x8250f4aF (Hermes/Pyth contract)
expectedProvider    = 0x8a3eb351 (PythLazerFeedProvider)
--> revert InvalidOracleProviderForToken
```

**What must change:** Either:
- (A) Register a Hermes-compatible oracle provider on-chain for FX tokens, OR
- (B) Keep PythLazerFeedProvider as the on-chain provider for ALL tokens, but ensure all tokens have Lazer price data stored

Option (B) is better because it means the keeper only uses one provider contract. The issue is that Lazer may not have FX feed entitlements. If Lazer gets FX entitlements, ALL tokens go through Lazer and there is no need for Hermes at all.

### Failure 2: MaxPriceAgeExceeded in Lazer-Only Mode

**Root cause:** Background oracle updater runs on a 10s interval per token (`BG_UPDATE_INTERVAL_MS = 10_000`). Between updates, the on-chain stored price ages. If execution happens near the end of the interval AND the `isStoredPriceFresh()` check passes (5s safety margin), but the actual execution TX is mined 1-2 blocks later, the on-chain price may have aged past `MAX_ORACLE_PRICE_AGE` (300s).

On testnet with 300s max age, this should rarely happen with 10s updates. The more likely cause: background updates are disabled during execution (nonce coordination), and if execution takes a long time (retries, gas estimation delays), prices go stale.

### Failure 3: Lazer Token Has Zero Entitlements

**Root cause:** The Pyth Pro access token had zero entitlements. A new key has been obtained (`QpxMy21OMvC7rap9hYxJ6GB0eb3PdOEs2WvmG0XN` -- crypto account). It needs verification that it actually provides data for crypto feeds, and determination of whether it covers FX/metals feeds.

---

## Recommended Architecture: Per-Token Oracle Provider Routing

### Core Design: Token-Level Provider Map

Replace the global `oracleMode` string with a per-token provider map:

```typescript
// NEW: Per-token oracle provider routing
interface OracleRoute {
  provider: "lazer" | "hermes";
  onChainProviderAddress: Address;  // What to pass in OracleParams.providers[]
}

// Determined at startup based on:
// 1. Which Lazer feeds actually receive data (entitlement verification)
// 2. Fallback to Hermes for any tokens without Lazer data
type OracleRouteMap = Map<Address, OracleRoute>;
```

### Architecture Diagram

```
STARTUP PHASE (one-time)
========================

[1. Initialize Lazer WebSocket]
         |
         v
[2. Register feeds, connect, wait 10s]
         |
         v
[3. Verify entitlements per feed]  <-- NEW
    For each PYTH_LAZER_FEED_CONFIGS entry:
      - Check if updateCache has data
      - If YES: route = "lazer" with PythLazerFeedProvider address
      - If NO:  route = "hermes" with HermesProvider address (if registered on-chain)
         |
         v
[4. Verify on-chain consistency]  <-- NEW
    For each token:
      - Read oracleProviderForToken from DataStore
      - Compare with route.onChainProviderAddress
      - If mismatch: LOG ERROR, may need admin script
         |
         v
[5. Build OracleRouteMap]
    Stored as module-level singleton
    Used by buildOracleParams() for per-token routing


EXECUTION PHASE (per-operation)
===============================

[buildOracleParams(market, tokens)]
         |
         v
    For each token:
      route = oracleRouteMap.get(token)
         |
         +-- route.provider === "lazer" ----+
         |                                   |
         |   Check isStoredPriceFresh()      |
         |   If stale: updatePriceOnChain()  |
         |   provider = PythLazerFeedProvider |
         |   data = "0x"                     |
         |                                   |
         +-- route.provider === "hermes" ----+
         |                                   |
         |   fetchPrice() via Hermes REST    |
         |   provider = HermesProvider addr  |
         |   data = encoded price data       |
         |                                   |
         +------- Build OracleParams --------+
                        |
                        v
              { tokens[], providers[], data[] }
              (mixed providers in same params array)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `OracleRouteMap` (NEW) | Maps token address to provider route | Used by `BaseExecutor.buildOracleParams()` |
| `StartupVerifier` (NEW) | Verifies Lazer entitlements + on-chain consistency at boot | Reads from `PythLazerOracleService.updateCache`, DataStore |
| `PythLazerOracleService` (EXISTING) | WebSocket streaming, background price updates for Lazer-routed tokens | Background updates only for Lazer-routed tokens |
| `PythOracleService` (EXISTING) | REST price fetch for Hermes-routed tokens | Called per-execution for Hermes tokens only |
| `BaseExecutor.buildOracleParams()` (MODIFIED) | Builds per-token provider arrays using route map | Consumes OracleRouteMap |
| Admin scripts in contracts repo (NEW) | Register Hermes provider on-chain, update `oracleProviderForToken` | Run against DataStore/Config contracts |

### Data Flow for Mixed-Provider Execution

Example: BTC market deposit (tokens: WETH, USDC)

```
tokens = [WETH, USDC]

oracleRouteMap:
  WETH -> { provider: "lazer", onChainProvider: 0x8a3eb351 }
  USDC -> { provider: "lazer", onChainProvider: 0x8a3eb351 }

Result:
  OracleParams {
    tokens:    [WETH,         USDC]
    providers: [0x8a3eb351,   0x8a3eb351]
    data:      ["0x",         "0x"]
  }
```

Example: EUR market withdrawal (tokens: EUR, USDC) -- IF Lazer lacks FX entitlements:

```
tokens = [EUR, USDC]

oracleRouteMap:
  EUR  -> { provider: "hermes", onChainProvider: 0xABCD... (HermesProvider) }
  USDC -> { provider: "lazer",  onChainProvider: 0x8a3eb351 }

Result:
  OracleParams {
    tokens:    [EUR,          USDC]
    providers: [0xABCD...,    0x8a3eb351]
    data:      [encodedHermes, "0x"]
  }
```

**Critical contract requirement:** The on-chain Oracle.sol processes each index independently (line 250-280). Mixed providers in the same `OracleParams` are valid as long as `params.providers[i]` matches `oracleProviderForToken[params.tokens[i]]` for every `i`.

---

## Speed Bottleneck Analysis (Post-v1.3)

### Current Execution Timeline

With event-driven detection (v1.3), the detection latency is near-zero. The bottleneck has shifted to execution:

```
Timeline for a deposit execution (measured from drainQueue dequeue):

[0ms]    Dequeue item, disable background oracle
[0-500ms] Wait for in-flight background update to finish
                                                          <-- BOTTLENECK 1
[500ms]  Read deposit from DB (Prisma)
[550ms]  Read deposit from chain (if no operationData)    <-- BOTTLENECK 2
[850ms]  Read market from chain (reader.getMarket())      <-- BOTTLENECK 3

[1150ms] buildOracleParams() starts
[1150ms]   isStoredPriceFresh() - read on-chain stored price per token
[1250ms]   If stale: updatePriceOnChain() TX              <-- BOTTLENECK 4
             - writeContract (send TX)
             - waitForTransactionReceipt (2-4s!)
             - Repeated for EACH stale token

[3250ms-5250ms] estimateGas for executeDeposit
[3550ms-5550ms] submitTransaction (writeContract)
[3600ms-5600ms] waitForTransactionReceipt (2-4s)
[5600ms-9600ms] Update DB status

TOTAL: 5.6s - 9.6s from dequeue to completion
```

### Bottleneck Breakdown

| # | Bottleneck | Current Impact | Root Cause |
|---|-----------|---------------|------------|
| 1 | Background update wait | 0-5s | `drainQueue` waits up to 5s for `isBackgroundUpdateBusy()` |
| 2 | Redundant chain read | 300ms | Event-sourced items lack `operationData`, fall back to chain read |
| 3 | Uncached market read | 300ms | `reader.getMarket()` called every execution, data never changes |
| 4 | Synchronous `updatePriceOnChain` | 2-4s per stale token | Sends TX + waits receipt BEFORE execution TX |
| 5 | Sequential token price updates | N * (2-4s) | `for...of` loop with `await` on each token |

### Speed Optimization Architecture

#### Optimization 1: Eliminate Synchronous Oracle Price TX (saves 2-4s)

The background oracle updater already keeps prices fresh on-chain every 10s. The `isStoredPriceFresh()` check in `buildOracleParams()` should almost always return `true`. The synchronous fallback (`updatePriceOnChain`) is a safety net that costs 2-4s when triggered.

**Strategy:** Reduce background update interval from 10s to 5s so prices are always fresh. This makes the synchronous path effectively dead code during normal operation.

```typescript
// Change in PythLazerOracleService:
private readonly BG_UPDATE_INTERVAL_MS = 5_000; // 5s instead of 10s
```

**Trade-off:** More on-chain price update TXs (gas cost). On testnet, gas is free. On mainnet, tune this interval to balance cost vs freshness.

#### Optimization 2: Shorter Background Update Wait (saves 0-4.9s)

The `drainQueue` loop waits up to 5s (50 * 100ms) for a busy background update to finish before executing. This is overly conservative.

**Strategy:** Reduce max wait time. If background update takes > 1s, something is wrong and we should proceed anyway (the synchronous fallback exists).

```typescript
// In drainQueue:
let waitCount = 0;
while (oracleService.isBackgroundUpdateBusy() && waitCount < 10) { // 1s max, not 5s
  await new Promise((r) => setTimeout(r, 100));
  waitCount++;
}
```

#### Optimization 3: Pre-fetch Operation Data for Event-Sourced Items (saves 300ms)

Currently, event-sourced items have no `operationData` because `EventListener` only captures the request key from the event topic. The executor falls back to a chain read.

**Strategy:** Enrich event-sourced items with operation data BEFORE they reach the executor, either:
- (A) In the EventListener itself (adds latency to event processing -- bad)
- (B) In a "pre-fetch" step in `drainQueue` after dequeue (best -- amortizes with the background update wait)

```typescript
// In drainQueue, after dequeue:
if (!item.operationData) {
  // Pre-fetch while waiting for background update to finish
  const reader = new ReaderContract();
  // ... read deposit/order/withdrawal + market data
}
```

#### Optimization 4: Cache Market Data (saves 300ms per execution)

Market data (indexToken, longToken, shortToken) does not change between contract redeployments. Cache it.

```typescript
// Module-level cache, populated on first read
const marketCache = new Map<Address, MarketInfo>();

async function getCachedMarket(reader: ReaderContract, market: Address): Promise<MarketInfo> {
  if (!marketCache.has(market)) {
    marketCache.set(market, await reader.getMarket(market));
  }
  return marketCache.get(market)!;
}
```

#### Optimization 5: Nonce Coordination Without Full Disable (architectural change)

Currently, background oracle updates are fully disabled during execution to prevent nonce collisions. This creates a gap where prices can go stale.

**Better approach:** Use a nonce-aware coordination pattern where background updates and execution TXs share a nonce manager rather than blocking each other.

This is a future optimization. For v1.4, the simpler fix (reducing BG_UPDATE_INTERVAL to 5s, reducing wait time) is sufficient.

### Optimized Timeline Target

```
[0ms]    Dequeue item, disable background oracle
[0-1s]   Wait for background update (1s max, not 5s)
[0ms]    Pre-fetch operation data (parallel with wait)

[1000ms] buildOracleParams() starts
[1000ms]   isStoredPriceFresh() per token -- almost always TRUE
[1050ms]   (skip synchronous update -- background updater keeps prices fresh)

[1050ms] estimateGas
[1350ms] submitTransaction
[1400ms] waitForTransactionReceipt (2-4s)
[3400ms-5400ms] Update DB status

TOTAL: 3.4s - 5.4s from dequeue to completion
```

---

## On-Chain Provider Registration

### Current State

Deployed on Base Sepolia:
- `PythLazerFeedProvider` at `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`
- `ChainlinkPriceFeedProvider` -- deployed but not used
- `GmOracleProvider` -- deployed for testing
- NO Hermes-specific provider deployed

`configureOracleTokens.ts` sets `oracleProviderForToken` to `PythLazerFeedProvider.address` for ALL tokens (EUR, GBP, GOLD, JPY, USDC, WBTC, WETH) on non-hardhat networks.

### What Needs to Happen for Hermes FX Support

If Lazer entitlements do NOT cover FX/metals (EUR, GBP, GOLD, JPY):

1. **Deploy a Hermes-compatible oracle provider contract** that implements `IOracleProvider` and reads from the Pyth contract (`0x8250f4aF`)
   - OR: Use `ChainlinkPriceFeedProvider` if Chainlink feeds exist for these pairs on Base Sepolia
   - OR: Extend `PythLazerFeedProvider` to accept Hermes data as a fallback

2. **Register the new provider** in DataStore:
   - Call `setOracleProviderEnabled(providerAddress, true)` via Timelock or Config contract
   - Call `setOracleProviderForToken(token, providerAddress)` for each FX token

3. **Update keeper to use the correct provider address** per token in `OracleParams.providers[]`

### What Happens if Lazer Covers Everything

If the new Pyth Pro token has entitlements for crypto + FX + metals:

1. **No new provider needed** -- PythLazerFeedProvider handles everything
2. **Uncomment FX feeds in `tokens.ts`** (EUR feedId 327, GBP 333, GOLD 346, JPY 340)
3. **Verify on-chain `oracleProviderForToken` is already PythLazerFeedProvider** for all tokens (it should be, from the deploy script)
4. **Keep `ORACLE_MODE=lazer`** -- no Hermes fallback needed

This is the preferred path and should be validated FIRST.

### Admin Script Architecture

The contracts repo already has the scripts needed. No new scripts are required:

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `scripts/printOracleConfig.ts` | Read and display on-chain oracle config for all tokens | Diagnostic -- run FIRST to understand current state |
| `scripts/initOracleConfigForTokens.ts` | Set `oracleProviderForToken` via Config contract (direct, no Timelock) | Initial setup or testnet changes |
| `scripts/updateOracleConfigForTokens.ts` | Set `oracleProviderForToken` via Timelock (signal + finalize) | Production changes with delay |
| `scripts/updateOracleProviders.ts` | Enable/disable oracle provider addresses via Timelock | Adding a new provider type |
| `deploy/configureOracleTokens.ts` | Hardhat deploy task -- sets provider for all tokens | Runs automatically during deployment |
| `deploy/configurePythLazerFeeds.ts` | Sets feedId, multiplier, inverted flag per token | Runs during deployment |

Key distinction: On testnet (Base Sepolia), `initOracleConfigForTokens.ts` can be used directly via the Config contract without Timelock delays. On mainnet, `updateOracleConfigForTokens.ts` requires signal + wait + finalize.

---

## Patterns to Follow

### Pattern 1: Startup Entitlement Verification

**What:** At keeper startup, after connecting to Pyth Lazer WebSocket and waiting for initial data, verify which feeds actually receive data. Build the oracle route map based on observed data, not assumed entitlements.

**When:** Every startup, before the first scan or execution.

**Example:**

```typescript
async function verifyEntitlementsAndBuildRoutes(
  lazerOracle: PythLazerOracleService,
  lazerConfigs: TokenPythLazerConfig[],
  hermesConfigs: TokenPythConfig[],
  lazerProviderAddress: Address,
  hermesProviderAddress: Address
): Promise<OracleRouteMap> {
  const routes = new Map<Address, OracleRoute>();

  for (const config of lazerConfigs) {
    const update = lazerOracle.getLatestUpdate(config.token);
    if (update) {
      routes.set(config.token.toLowerCase() as Address, {
        provider: "lazer",
        onChainProviderAddress: lazerProviderAddress,
      });
      logger.info({ token: config.token, feedId: config.feedId }, "Lazer feed active");
    } else {
      logger.warn({ token: config.token, feedId: config.feedId }, "Lazer feed NOT receiving data");
    }
  }

  // Tokens without Lazer data fall back to Hermes
  for (const config of hermesConfigs) {
    const tokenKey = config.token.toLowerCase() as Address;
    if (!routes.has(tokenKey)) {
      routes.set(tokenKey, {
        provider: "hermes",
        onChainProviderAddress: hermesProviderAddress,
      });
      logger.info({ token: config.token }, "routed to Hermes (no Lazer data)");
    }
  }

  return routes;
}
```

### Pattern 2: On-Chain Consistency Check

**What:** After building the route map, verify that each token's route matches the on-chain `oracleProviderForToken` in DataStore. Log mismatches as errors. Do NOT attempt to fix mismatches at runtime -- that requires admin intervention.

**When:** Every startup, after entitlement verification.

**Why:** A mismatch between keeper route and on-chain provider causes every execution for that token to revert with `InvalidOracleProviderForToken`. Early detection at startup saves debugging time.

### Pattern 3: Background Updates Only for Lazer-Routed Tokens

**What:** The background oracle updater (`triggerBackgroundUpdate`) should only update tokens routed to Lazer. Hermes-routed tokens don't need background updates because they fetch fresh data per-execution via REST.

**When:** After building the route map.

**Why:** Sending background `updatePrice` TXs for Hermes-routed tokens wastes gas and nonces. Worse, it would fail because the Lazer cache has no data for those tokens.

```typescript
// In triggerBackgroundUpdate():
for (const [tokenKey] of this.pythLazerConfigs) {
  // Skip tokens not routed to Lazer
  if (!oracleRouteMap.has(tokenKey) || oracleRouteMap.get(tokenKey).provider !== "lazer") {
    continue;
  }
  // ... existing update logic
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Deploying a Custom Hermes Oracle Provider Contract

**What:** Writing a new Solidity contract that implements `IOracleProvider` by reading from the Pyth contract for Hermes data.

**Why bad:** Adds contract deployment complexity, audit surface, and maintenance burden. The Pyth Hermes data is already available via `PythOracleService`. If Lazer gets FX entitlements, the Hermes provider is wasted work.

**Instead:** Validate Lazer entitlements first. If Lazer covers all feeds, no Hermes provider is needed. If Lazer does NOT cover FX, the ChainlinkPriceFeedProvider already exists on-chain -- check if Chainlink feeds exist for these pairs on Base Sepolia first. A custom contract should be the last resort.

### Anti-Pattern 2: Making oracleMode Dynamic Per-Request

**What:** Passing a `providerMode` parameter to `buildOracleParams()` and letting each executor decide the mode.

**Why bad:** The correct provider is determined by token, not by operation type. A deposit involving WETH+USDC and a deposit involving EUR+USDC need different provider selections for different tokens within the SAME operation.

**Instead:** Use the per-token route map. `buildOracleParams()` looks up each token's route and builds the params array with the correct provider per-index.

### Anti-Pattern 3: Hardcoding Provider Addresses in the Route Map

**What:** Putting PythLazerFeedProvider address `0x8a3eb351` directly in the token config as a constant.

**Why bad:** The address comes from deployment and can change on redeployment. It already lives in `config.pythLazerFeedProviderAddress` (from env var).

**Instead:** Read provider addresses from config (env vars), and validate them against on-chain state at startup.

### Anti-Pattern 4: Killing Background Updates Entirely During Execution

**What:** The current `drainQueue` disables ALL background updates and waits up to 5s for in-flight ones to finish.

**Why bad:** This creates price staleness gaps. During a slow execution (retry, gas estimation), prices for other tokens go stale.

**Instead (v1.4):** Reduce the wait to 1s maximum. If background is still busy after 1s, proceed anyway -- the synchronous fallback in `buildOracleParams` handles stale prices. In a future version, use nonce coordination instead of full disable.

---

## Integration Points: New vs Modified Components

### New Components

| Component | File | Purpose | Dependencies |
|-----------|------|---------|-------------|
| `OracleRouteMap` | `core/oracle/routeMap.ts` | Per-token provider routing decisions | None (data structure) |
| `StartupVerifier` | `core/oracle/startupVerifier.ts` | Entitlement verification + on-chain consistency check | PythLazerOracleService, DataStoreContract, config |
| Admin: register Hermes provider | `scripts/` in contracts repo | Register Hermes provider for FX tokens IF needed | Contracts repo Config/Timelock |

### Modified Components

| Component | File | Change |
|-----------|------|--------|
| `BaseExecutor.buildOracleParams()` | `core/executors/baseExecutor.ts` | Use OracleRouteMap for per-token provider selection instead of global oracleMode |
| `PythLazerOracleService.triggerBackgroundUpdate()` | `core/oracle/pythLazerOracle.ts` | Skip background updates for non-Lazer-routed tokens |
| `index.ts` main() | `index.ts` | Add startup verification, build route map, reduce background wait |
| `config.ts` | `config.ts` | Keep oracleMode but add hermesProviderAddress for fallback routing |
| `config/tokens.ts` | `config/tokens.ts` | Uncomment FX Lazer feeds (if entitlements confirmed) |
| `drainQueue()` | `index.ts` | Reduce background update wait from 5s to 1s |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `ExecutionQueue` | Queue logic is provider-agnostic |
| `EventListener` | Detects operations regardless of oracle provider |
| `DepositExecutor` / `OrderExecutor` / `WithdrawalExecutor` | Call `buildOracleParams()` which handles routing internally |
| `PythOracleService` (Hermes) | API stays the same, just called selectively |
| `healthState.ts` / `latencyTracker.ts` | Continue tracking execution metrics |
| `transactionMonitor.ts` | Background TX monitoring unaffected |

---

## Suggested Build Order

The dependency chain is: **Entitlement Verification -> Oracle Route Map -> On-Chain Registration (if needed) -> Modified buildOracleParams -> Speed Optimizations**

### Phase 1: Verify Entitlements (blocks everything else)

1. Deploy new Pyth Pro access token to keeper environment
2. Run keeper with `ORACLE_MODE=lazer` locally
3. After 10s, check which feeds in `PYTH_LAZER_FEED_CONFIGS` (including commented-out FX feeds) receive data
4. This determines whether Hermes fallback is needed for FX tokens

**This is the critical path.** If all 7 feeds get data, the rest of the architecture simplifies dramatically.

### Phase 2A: All Feeds via Lazer (happy path)

If entitlement verification shows all feeds active:

1. Uncomment FX feeds in `tokens.ts`
2. Verify on-chain `oracleProviderForToken` is PythLazerFeedProvider for all 7 tokens (run `printOracleConfig.ts`)
3. Remove global oracleMode branching -- all tokens use Lazer
4. Apply speed optimizations (BG_UPDATE_INTERVAL 5s, shorter wait in drainQueue)
5. Deploy and verify

### Phase 2B: Mixed Lazer + Hermes (if FX lacks entitlements)

If FX feeds have no Lazer data:

1. Build `OracleRouteMap` -- Lazer for crypto, Hermes for FX
2. Determine the Hermes on-chain provider:
   - Check if `ChainlinkPriceFeedProvider` works with Pyth Hermes data (it may not -- needs investigation)
   - If not, deploy a `PythHermesFeedProvider` contract or modify `PythLazerFeedProvider` to accept Hermes data
3. Run `initOracleConfigForTokens.ts` to set `oracleProviderForToken` for FX tokens to the Hermes provider
4. Modify `buildOracleParams()` to use route map
5. Apply speed optimizations
6. Deploy and verify

### Phase 3: Speed Optimizations (independent of oracle routing)

1. Reduce `BG_UPDATE_INTERVAL_MS` from 10s to 5s
2. Reduce `drainQueue` background wait from 5s to 1s
3. Add market data caching
4. Add operation data pre-fetch for event-sourced items
5. Measure latency improvement via `latencyTracker` percentiles

---

## Scalability Considerations

| Concern | At 7 tokens | At 20 tokens | At 50+ tokens |
|---------|-------------|--------------|---------------|
| Background price updates | 7 TXs / 5s = 1.4 TPS | 20 TXs / 5s = 4 TPS | Needs batching |
| Route map lookup | O(1) per token | O(1) per token | O(1) per token |
| Startup verification | <10s | <15s | <30s |
| Nonce contention | Low (sequential) | Medium | Needs multi-wallet |
| Hermes REST calls | 0-4 per execution | Depends on routing | Needs batch API |

---

## Sources

### Primary (HIGH confidence)
- `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` -- Full Lazer service implementation
- `order-execution-keeper-service/src/core/oracle/pythOracle.ts` -- Full Hermes service implementation
- `order-execution-keeper-service/src/core/executors/baseExecutor.ts` -- `buildOracleParams()` logic (lines 202-291)
- `order-execution-keeper-service/src/index.ts` -- Startup, drainQueue, nonce coordination
- `order-execution-keeper-service/src/config/tokens.ts` -- Feed configs, commented-out FX feeds
- `0xmarkets_contract/contracts/oracle/Oracle.sol` -- Provider validation (lines 250-280)
- `0xmarkets_contract/contracts/oracle/PythLazerFeedProvider.sol` -- On-chain price storage contract
- `0xmarkets_contract/deploy/configureOracleTokens.ts` -- Default provider = PythLazerFeedProvider
- `0xmarkets_contract/utils/oracle.ts` -- `getOracleProviderAddress()` resolves provider names to addresses
- `0xmarkets_contract/config/tokens.ts` -- All 7 tokens have `pythLazerFeedId` configured
- `0xmarkets_contract/config/types.d.ts` -- `OracleProvider` type definition

### Secondary (MEDIUM confidence)
- Phase 13 research (`13-RESEARCH.md`) -- Entitlement analysis and error selector identification
- `0xmarkets_contract/scripts/printOracleConfig.ts` -- Diagnostic script for on-chain state
- `0xmarkets_contract/scripts/initOracleConfigForTokens.ts` -- Direct provider registration via Config contract

### Derived (from codebase analysis)
- The `0x05d102a2` error is confirmed as `InvalidOracleProvider(address)` -- provider not enabled in DataStore
- The `InvalidOracleProviderForToken(provider, expectedProvider)` is the more likely error for FX tokens -- provider enabled but doesn't match the token's assigned provider
- `ChainlinkPriceFeedProvider` exists on-chain but its compatibility with Pyth Hermes data is UNVERIFIED
