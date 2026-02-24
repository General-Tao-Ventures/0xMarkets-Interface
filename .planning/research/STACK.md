# Technology Stack: Maximum Keeper Speed with Dual Oracle Configuration

**Project:** 0xMarkets v1.4 Maximum Keeper Speed
**Researched:** 2026-02-24
**Scope:** Pyth Pro API key deployment, dual oracle mode (Lazer for crypto, Hermes for FX), on-chain oracle provider registration, execution speed optimization

## Current Stack (Already Validated in v1.3)

No changes needed to these. Listed for context.

| Technology | Installed Version | Purpose |
|------------|-------------------|---------|
| viem | 2.44.4 | Blockchain interaction, tx submission |
| @pythnetwork/pyth-lazer-sdk | 5.2.1 | Binary WebSocket price feeds (Lazer/Pro) |
| @pythnetwork/hermes-client | 2.1.0 | Standard HTTP price feeds (Hermes) |
| pino | ^10.3.1 | Structured JSON logging |
| Prisma | ^7.2.0 | ORM for state management |
| Express | ^5.1.0 | Health endpoint HTTP server |
| TypeScript | ^5.9.3 | Language |
| PostgreSQL 14 | Docker | Persistence layer |

## Recommended Stack Changes

### 1. Per-Market Oracle Mode Configuration (CRITICAL)

**What:** Replace the global `ORACLE_MODE` env var with per-token oracle routing logic that selects Lazer for crypto tokens and Hermes for FX/commodity tokens.

**Why:** The current `ORACLE_MODE=lazer` applies globally. FX tokens (EUR, GBP, JPY, GOLD) fail because:
1. The Pyth Pro API key has entitlements for `[crypto, index, nav, crypto-redemption-rate]` only -- no FX/commodity entitlement (confirmed in `config/tokens.ts` comments: "key entitled for [crypto, index, nav, crypto-redemption-rate] only. Need FX entitlement from Pyth.")
2. FX Lazer feed configs are commented out in the keeper's `PYTH_LAZER_FEED_CONFIGS`
3. When the keeper tries to execute FX token operations with `ORACLE_MODE=lazer`, there is no cached Lazer update for FX tokens, causing failures

**Solution architecture:** A token-level oracle routing map, not a global mode switch.

```typescript
// New: per-token oracle mode based on feed availability
type TokenOracleMode = "lazer" | "hermes";

interface TokenOracleRouting {
  token: Address;
  mode: TokenOracleMode;
  provider: Address; // on-chain oracle provider contract address
}

// Crypto tokens: Lazer (fast, ~200ms WebSocket updates)
// FX tokens: Hermes (standard HTTP, ~1-2s)
const ORACLE_ROUTING: TokenOracleRouting[] = [
  { token: TOKEN_ADDRESSES.WETH, mode: "lazer", provider: PYTH_LAZER_FEED_PROVIDER },
  { token: TOKEN_ADDRESSES.WBTC, mode: "lazer", provider: PYTH_LAZER_FEED_PROVIDER },
  { token: TOKEN_ADDRESSES.USDC, mode: "lazer", provider: PYTH_LAZER_FEED_PROVIDER },
  { token: TOKEN_ADDRESSES.EUR,  mode: "hermes", provider: CHAINLINK_PRICE_FEED_PROVIDER },
  { token: TOKEN_ADDRESSES.GBP,  mode: "hermes", provider: CHAINLINK_PRICE_FEED_PROVIDER },
  { token: TOKEN_ADDRESSES.GOLD, mode: "hermes", provider: CHAINLINK_PRICE_FEED_PROVIDER },
  { token: TOKEN_ADDRESSES.JPY,  mode: "hermes", provider: CHAINLINK_PRICE_FEED_PROVIDER },
];
```

**What to install:** Nothing new. This is a configuration/routing change in `baseExecutor.ts` and `config/tokens.ts`.

**Impact on buildOracleParams():** The method currently branches on `config.oracleMode` globally. It needs to branch per-token: for each token in the operation, check if it has a Lazer feed or a Hermes feed, and route accordingly.

**Confidence:** HIGH -- The existing code already has both `PythOracleService` (Hermes) and `PythLazerOracleService` (Lazer) fully functional. The routing logic is the missing piece.

---

### 2. On-Chain Oracle Provider Registration for FX Tokens (CRITICAL -- BLOCKER)

**What:** Register a Hermes-compatible oracle provider (ChainlinkPriceFeedProvider) for FX tokens in the DataStore, and configure Chainlink-compatible price feeds for EUR, GBP, GOLD, JPY.

**Why:** The `InvalidOracleProvider (0x05d102a2)` error on FX withdrawals is caused by the Oracle.sol contract's validation logic:

```solidity
// Oracle.sol lines 276-279
address expectedProvider = dataStore.getAddress(Keys.oracleProviderForTokenKey(token));
if (provider != expectedProvider) {
    revert Errors.InvalidOracleProviderForToken(provider, expectedProvider);
}
```

Currently, ALL tokens (including FX) have `PythLazerFeedProvider` set as their `oracleProviderForToken` in DataStore (set by `configureOracleTokens.ts` with `defaultOracleProvider = "pythLazerFeed"`). When the keeper passes Hermes data with a different provider address, the contract reverts.

**The fix requires two things:**

1. **Change `oracleProviderForToken` in DataStore** for FX tokens to point to `ChainlinkPriceFeedProvider` (which is already deployed and enabled as an oracle provider).
2. **Configure Chainlink price feeds** for FX tokens in DataStore (price feed address, multiplier, heartbeat duration).

**How to execute this on Base Sepolia:**

Since this is testnet (no Timelock), the deployer wallet can call DataStore.setAddress directly:

```typescript
// Script: register-hermes-provider-for-fx.ts (viem-based, runs against Base Sepolia)
import { keccak256, encodeAbiParameters } from "viem";

// Key computation (matches contracts/data/Keys.sol)
const ORACLE_PROVIDER_FOR_TOKEN = keccak256(
  encodeAbiParameters([{ type: "string" }], ["ORACLE_PROVIDER_FOR_TOKEN"])
);

function oracleProviderForTokenKey(token: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }],
      [ORACLE_PROVIDER_FOR_TOKEN, token]
    )
  );
}

// For each FX token: dataStore.setAddress(oracleProviderForTokenKey(token), chainlinkPriceFeedProviderAddress)
```

**Required contract addresses (already deployed on Base Sepolia):**

| Contract | Purpose | How to Find Address |
|----------|---------|---------------------|
| ChainlinkPriceFeedProvider | Oracle provider for Hermes/price-feed tokens | `deployments/baseSepolia/ChainlinkPriceFeedProvider.json` |
| DataStore | Storage contract for oracle config | Already in keeper .env: `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` |
| PythLazerFeedProvider | Oracle provider for Lazer tokens (keep for crypto) | Already in keeper .env: `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05` |

**Additional DataStore keys to set for each FX token:**

| Key | Value | Purpose |
|-----|-------|---------|
| `priceFeedKey(token)` | Chainlink/Pyth Hermes price feed address | Where to read the price |
| `priceFeedMultiplierKey(token)` | `expandDecimals(1, 60 - tokenDecimals - feedDecimals)` | Normalize price precision |
| `priceFeedHeartbeatDurationKey(token)` | `86400` (24h for testnet) | Max acceptable price age |

**What to install:** Nothing new. This is a one-time admin script using viem (already installed). The script runs from the contracts repo using Hardhat OR from a standalone viem script.

**Confidence:** HIGH -- The exact same pattern is used in `configureOracleTokens.ts` (deploy script) and `updateOracleConfigForTokens.ts` (admin script). The Oracle.sol validation logic is unambiguous.

---

### 3. Pyth Pro API Key Verification (MEDIUM -- PRE-REQUISITE)

**What:** Verify the new Pyth Pro API key (`QpxMy21OMvC7rap9hYxJ6GB0eb3PdOEs2WvmG0XN`) has correct entitlements for the crypto feeds being used (feed IDs 1, 2, 7).

**Why:** The previous token had zero entitlements. The new key is labeled "crypto account" which should cover BTC (feed 1), ETH (feed 2), and USDC (feed 7). But entitlement verification should happen before deployment.

**How to verify:**

```typescript
// Quick verification script: connect with the token and subscribe to feeds
const client = await PythLazerClient.create({
  token: "QpxMy21OMvC7rap9hYxJ6GB0eb3PdOEs2WvmG0XN",
});

client.subscribe({
  type: "subscribe",
  subscriptionId: 1,
  priceFeedIds: [1, 2, 7], // BTC, ETH, USDC
  properties: ["price"],
  formats: ["evm"],
  deliveryFormat: "binary",
  channel: "fixed_rate@200ms",
  parsed: false,
});

// If subscription succeeds and data flows: entitlements confirmed
// If subscriptionError with "not entitled": need different key or entitlement upgrade
```

**FX feed verification (separate):**

The FX feeds (327=EUR, 333=GBP, 346=GOLD, 340=JPY) require FX entitlement which the current key does NOT have. This is why Hermes fallback is needed for FX -- not a bug to fix, but a known limitation driving the dual-oracle architecture.

**What to install:** Nothing. Uses existing `@pythnetwork/pyth-lazer-sdk`.

**Confidence:** HIGH for crypto feeds. The key type "crypto account" should entitle feeds 1, 2, 7. LOW for FX -- FX entitlement is a separate Pyth tier that requires contacting Pyth team.

---

### 4. Hermes Price Update Integration in buildOracleParams (CRITICAL)

**What:** Modify `buildOracleParams` in `baseExecutor.ts` to use Hermes `getPriceUpdateData()` for FX tokens and pass the update data as the `data` field in oracle params (instead of empty `0x`).

**Why:** The current Hermes path in `buildOracleParams` uses `pythOracle.buildSetPricesParams()` which encodes price data in a custom format. But with ChainlinkPriceFeedProvider as the on-chain provider, the `data` field is ignored (the provider reads from on-chain Chainlink feeds). So for FX tokens using ChainlinkPriceFeedProvider, the keeper passes:

```typescript
// For Hermes/ChainlinkPriceFeed tokens: provider reads price on-chain, data is empty
{
  tokens: [fxToken],
  providers: [chainlinkPriceFeedProviderAddress],
  data: ["0x"],
}
```

The ChainlinkPriceFeedProvider.getOraclePrice() reads directly from the Chainlink price feed configured in DataStore -- it does not use the `data` parameter at all.

**Key insight:** On Base Sepolia, Chainlink price feeds may not exist for all FX pairs. If they do not, we need a different approach: use the Hermes price data to store prices via a custom provider, OR set up mock price feeds. This needs validation during implementation.

**Fallback approach if no Chainlink feeds exist on Base Sepolia:** Deploy simple price feed contracts that the keeper updates via Hermes data. This is more complex but would work.

**What to install:** Nothing new.

**Confidence:** MEDIUM -- The ChainlinkPriceFeedProvider pattern is well-understood from the codebase. The uncertainty is whether Chainlink has the FX feeds deployed on Base Sepolia specifically.

---

### 5. SDK Version Consideration (LOW PRIORITY)

**What:** Optionally update `@pythnetwork/pyth-lazer-sdk` from 5.2.1 to 6.0.0 and `@pythnetwork/hermes-client` from 2.1.0 to 3.1.0.

**Why NOT to update now:**
- `pyth-lazer-sdk` 6.0.0 was published 2 days ago. Major version = breaking changes. The current 5.2.1 works.
- `hermes-client` 3.1.0 is also a major version bump from 2.1.0.
- Updating both SDKs while also changing the oracle routing architecture adds unnecessary risk.

**When to update:** After v1.4 is stable, as a separate maintenance task. Pin to current working versions for now.

**Confidence:** HIGH -- "don't fix what isn't broken" during a feature milestone.

---

### 6. Execution Speed Profiling (LOW EFFORT, HIGH VALUE)

**What:** Add granular timing instrumentation to the execution pipeline to measure where time is actually spent.

**Why:** The existing `latencyTracker` records end-to-end latency but doesn't break down the pipeline stages. To optimize further, we need to know:
- Time from event detection to queue dequeue
- Time spent on `isStoredPriceFresh()` check
- Time spent on synchronous `updatePriceOnChain()` fallback
- Time spent on gas estimation
- Time spent on TX submission
- Time spent waiting for TX confirmation

**Implementation:** Use `performance.now()` (Node.js built-in) at each stage boundary in `baseExecutor.ts` and `depositExecutor.ts`, log as structured pino fields.

```typescript
const t0 = performance.now();
const oracleParams = await this.buildOracleParams(market, tokens);
const t1 = performance.now();
log.info({ stage: "buildOracleParams", durationMs: Math.round(t1 - t0) }, "timing");
```

**What to install:** Nothing. `performance.now()` is built into Node.js.

**Confidence:** HIGH -- Standard profiling pattern.

---

## What NOT to Add

### Do NOT Upgrade Pyth SDKs (pyth-lazer-sdk 6.0.0, hermes-client 3.1.0)

**Why not:** Both are major version bumps released very recently. The existing versions (5.2.1, 2.1.0) work correctly. Upgrading during a feature milestone that changes oracle routing introduces two variables instead of one. Upgrade in a separate maintenance pass.

### Do NOT Create a Custom Hermes Oracle Provider Contract

**Why not:** The codebase already has `ChainlinkPriceFeedProvider` deployed and enabled. It reads Chainlink price feeds from DataStore. If Chainlink feeds exist on Base Sepolia for FX pairs, use them. A custom "HermesOracleProvider" would need to be written in Solidity, deployed, and enabled -- unnecessary complexity when an existing provider may work.

**Exception:** If Chainlink FX feeds are not available on Base Sepolia, a `PythHermesFeedProvider` contract would be needed. But validate first before building.

### Do NOT Add a Separate Admin Service

**Why not:** The on-chain oracle provider registration is a one-time admin operation (a script that calls `DataStore.setAddress` for 4 FX tokens). It does not need a persistent service. A standalone viem script or Hardhat task is sufficient.

### Do NOT Add Multi-Wallet Keeper Support

**Why not:** Out of scope for v1.4. The single-wallet sequential execution model works. The nonce coordination between background oracle updates and execution transactions (disable/enable pattern in `drainQueue`) is already well-implemented.

### Do NOT Replace Hermes with PythNet Direct

**Why not:** `@pythnetwork/hermes-client` is the standard, supported way to get Pyth prices via HTTP. PythNet direct access requires running a validator node. Hermes is the correct choice for non-Lazer tokens.

---

## Recommended Stack (Changes Only)

### New Configuration

| Setting | Value | Service | Purpose |
|---------|-------|---------|---------|
| `CHAINLINK_PRICE_FEED_PROVIDER_ADDRESS` | TBD (read from deployments) | order-exec | On-chain provider address for FX tokens |
| `ORACLE_MODE` | Change from `"lazer"` to `"dual"` | order-exec | Signal per-token routing logic |

### New Keys in `src/core/utils/keys.ts`

```typescript
export const ORACLE_PROVIDER_FOR_TOKEN = keccak256(
  encodeAbiParameters([{ type: "string" }], ["ORACLE_PROVIDER_FOR_TOKEN"])
);

export function oracleProviderForTokenKey(token: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }],
      [ORACLE_PROVIDER_FOR_TOKEN, token]
    )
  );
}
```

### Code Changes (No New Packages)

| Change | Service | File(s) | Impact |
|--------|---------|---------|--------|
| Per-token oracle routing map | order-exec | `src/config/tokens.ts` | Maps each token to its oracle mode + provider |
| Dual-mode `buildOracleParams` | order-exec | `src/core/executors/baseExecutor.ts` | Routes Lazer vs Hermes per token |
| Add `CHAINLINK_PRICE_FEED_PROVIDER_ADDRESS` config | order-exec | `src/config.ts` | New env var |
| Add `oracleProviderForTokenKey` to keys | order-exec | `src/core/utils/keys.ts` | For verification reads |
| On-chain provider registration script | contracts | `scripts/register-fx-oracle-provider.ts` | One-time admin setup |
| Pipeline timing instrumentation | order-exec | `src/core/executors/*.ts` | Latency breakdown logging |
| API key verification script | order-exec | `scripts/verify-pyth-entitlements.ts` | One-time validation |

### Installation

```bash
# No new packages needed. All capabilities exist in the current stack.
# Only configuration changes:

# 1. Find ChainlinkPriceFeedProvider address from deployments:
#    cat 0xmarkets_contract/deployments/baseSepolia/ChainlinkPriceFeedProvider.json | jq .address

# 2. Add to order-execution-keeper .env:
CHAINLINK_PRICE_FEED_PROVIDER_ADDRESS=<address from step 1>
ORACLE_MODE=dual

# 3. Run on-chain registration script (one-time, from contracts repo):
#    npx hardhat run scripts/register-fx-oracle-provider.ts --network baseSepolia

# 4. Run entitlement verification script (one-time):
#    npx tsx scripts/verify-pyth-entitlements.ts
```

---

## Execution Flow: Dual Oracle Mode

**Before (single Lazer mode -- breaks on FX):**

```
Every token -> Lazer WebSocket cache -> updatePriceOnChain() -> PythLazerFeedProvider
                                         ^ FX tokens have no Lazer cache = FAIL
```

**After (dual mode):**

```
Token detected in operation
  |
  +-- Has Lazer feed? (WETH, WBTC, USDC)
  |     YES -> Check isStoredPriceFresh()
  |              Fresh? -> Skip update, use PythLazerFeedProvider as provider
  |              Stale? -> Sync updatePriceOnChain(), then use PythLazerFeedProvider
  |
  +-- Has Hermes feed only? (EUR, GBP, GOLD, JPY)
        YES -> Use ChainlinkPriceFeedProvider as provider, pass empty data
               (Provider reads from on-chain Chainlink feed configured in DataStore)
```

**Oracle params for a deposit on ETH/USDC market:**

```typescript
{
  tokens: [WETH, USDC],          // Both have Lazer
  providers: [PythLazerFeedProvider, PythLazerFeedProvider],
  data: ["0x", "0x"],            // Prices pre-stored on-chain by background updater
}
```

**Oracle params for a withdrawal from EUR/USDC pool:**

```typescript
{
  tokens: [EUR, USDC],           // EUR = Hermes, USDC = Lazer
  providers: [ChainlinkPriceFeedProvider, PythLazerFeedProvider],
  data: ["0x", "0x"],            // EUR price from Chainlink feed, USDC from stored Lazer
}
```

---

## Latency Impact Analysis

**Current state (ORACLE_MODE=lazer, FX broken):**

| Token Type | Detection | Oracle | Execution | Total | Status |
|------------|-----------|--------|-----------|-------|--------|
| Crypto (ETH, BTC) | ~0.3s (event) | ~0s (pre-cached) | ~2.5s | ~3s | Working |
| FX (EUR, GBP, etc.) | ~0.3s (event) | FAIL | -- | -- | InvalidOracleProvider |

**After dual mode:**

| Token Type | Detection | Oracle | Execution | Total | Status |
|------------|-----------|--------|-----------|-------|--------|
| Crypto (ETH, BTC) | ~0.3s (event) | ~0s (pre-cached Lazer) | ~2.5s | ~3s | Working |
| FX (EUR, GBP, etc.) | ~0.3s (event) | ~0s (Chainlink on-chain) | ~2.5s | ~3s | Fixed |

FX operations will be as fast as crypto operations because ChainlinkPriceFeedProvider reads prices on-chain (no keeper-side price push needed for FX).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| FX oracle | ChainlinkPriceFeedProvider | Custom PythHermesFeedProvider contract | Existing provider already deployed; avoid new contract deployment |
| Oracle routing | Per-token config map | Global mode switch with fallback | Explicit routing prevents silent fallback bugs |
| FX Lazer feeds | Skip (use Hermes) | Request FX entitlement from Pyth | Depends on Pyth team timeline; Hermes is immediately available |
| SDK upgrade | Stay on 5.2.1 / 2.1.0 | Upgrade to 6.0.0 / 3.1.0 | Major version bumps during feature work = unnecessary risk |
| Admin scripts | Standalone viem script | Hardhat deploy task | Simpler, no Hardhat dependency in keeper repo |
| Price feed for FX | Chainlink on-chain feeds | Keeper pushes Hermes prices | On-chain reads are atomic; no extra TX needed |

## Sources

- Codebase: `0xmarkets_contract/contracts/oracle/Oracle.sol` lines 251-280 -- Oracle provider validation logic
- Codebase: `0xmarkets_contract/contracts/oracle/PythLazerFeedProvider.sol` -- Lazer stored price model
- Codebase: `0xmarkets_contract/contracts/oracle/ChainlinkPriceFeedProvider.sol` -- On-chain price feed reader
- Codebase: `0xmarkets_contract/deploy/configureOracleTokens.ts` -- Default provider = pythLazerFeed
- Codebase: `0xmarkets_contract/deploy/configurePythLazerFeeds.ts` -- Lazer feed configuration pattern
- Codebase: `order-execution-keeper-service/src/config/tokens.ts` lines 47-48 -- FX Lazer feeds commented out with entitlement note
- Codebase: `order-execution-keeper-service/src/core/executors/baseExecutor.ts` -- Current buildOracleParams logic
- [Pyth Pro Getting Started](https://docs.pyth.network/price-feeds/pro/getting-started) -- API key and entitlement setup
- [Pyth Pro Price Feed IDs](https://docs.pyth.network/price-feeds/pro/price-feed-ids) -- Feed ID reference for crypto/FX/commodity
- [Pyth Pro Subscribe to Prices](https://docs.pyth.network/price-feeds/pro/subscribe-to-prices) -- WebSocket subscription API
- [GMX Synthetics Oracle.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/oracle/Oracle.sol) -- Oracle provider validation reference
- [GMX Synthetics Errors.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/error/Errors.sol) -- Error selector reference
- npm registry: `@pythnetwork/pyth-lazer-sdk` latest=6.0.0, installed=5.2.1
- npm registry: `@pythnetwork/hermes-client` latest=3.1.0, installed=2.1.0
- npm registry: `viem` latest=2.46.3, installed=2.44.4
