# Phase 14: Execution Speed - Research

**Researched:** 2026-02-24
**Domain:** Keeper execution latency optimization (Flashblocks RPC, background oracle updates, timing instrumentation)
**Confidence:** HIGH

## Summary

Phase 14 addresses four requirements that together reduce keeper execution latency from ~6-8 seconds per operation to under 1 second. The changes are confined to the order-execution-keeper-service codebase and require no contract changes or frontend modifications.

The primary latency sources in the current pipeline are: (1) standard Base Sepolia RPC with 2-second block times causing 2-4s confirmation waits, (2) synchronous `updatePriceOnChain()` calls in the execution hot path that each take 2-4s to confirm, and (3) a 10-second background update interval that is too infrequent relative to the on-chain `MAX_ORACLE_PRICE_AGE`, causing prices to go stale between updates and triggering synchronous fallback updates.

The solution stack is straightforward: switch to Base Flashblocks-enabled RPC (`baseSepoliaPreconf` chain from viem 2.44.4, already installed), reduce the background oracle update interval from 10s to 5s with an increased safety margin of 30s, ensure the normal execution path never calls `updatePriceOnChain()` synchronously, and add `performance.now()` instrumentation at each execution stage. All four requirements map cleanly to isolated, well-scoped changes.

**Primary recommendation:** Use viem's built-in `baseSepoliaPreconf` chain definition (already available in installed viem 2.44.4) for the Flashblocks RPC endpoint, and restructure `buildOracleParams()` to trust the background updater rather than calling `updatePriceOnChain()` inline.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPEED-01 | Keeper uses Flashblocks-enabled RPC endpoint for TX submission, reducing confirmation time from ~2-4s to ~200ms | viem 2.44.4 exports `baseSepoliaPreconf` chain with `experimental_preconfirmationTime: 200` and RPC `https://sepolia-preconf.base.org`. The chain uses `pending` block tag automatically for `waitForTransactionReceipt`, `estimateGas`, `getBalance`, etc. Client module needs new config env vars (`FLASHBLOCKS_RPC_URL`) and conditional chain selection. |
| SPEED-02 | MaxPriceAgeExceeded prevented by increasing safety margin to 30s and reducing background oracle update interval from 10s to 5s | Current `BG_UPDATE_INTERVAL_MS = 10_000` in `pythLazerOracle.ts` line 41 and `safetyMargin = 5n` in `baseExecutor.ts` line 184. Both are simple constant changes. The 5s interval with 30s margin means prices are always at most ~5s old when an execution starts, well within any reasonable `MAX_ORACLE_PRICE_AGE`. |
| SPEED-03 | Synchronous `updatePriceOnChain()` TX eliminated from normal execution path | Current `buildOracleParams()` in `baseExecutor.ts` lines 239-278 calls `isStoredPriceFresh()` and falls back to synchronous `updatePriceOnChain()` when stale. With SPEED-02's tighter background updates, the normal path should trust the background updater and skip the synchronous call entirely, logging a warning if prices are unexpectedly stale instead of blocking on a TX. |
| SPEED-04 | Per-stage execution timing logged via `performance.now()` instrumentation | Currently `depositExecutor.ts` uses `Date.now()` for coarse timing (line 61). Need to add `performance.now()` timing at 4 stages: detection (already tracked via `detectedAt`), oracle param build, TX submission, and TX confirmation. Log each stage duration in the execution-complete log line. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | 2.44.4 | Blockchain client, chain definitions, TX submission | Already installed; exports `baseSepoliaPreconf` chain with Flashblocks support since v2.33 |
| pino | 10.3.1 | Structured logging for timing data | Already installed; child loggers enable per-module context |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `performance.now()` | Node.js built-in | Sub-millisecond monotonic timing | For per-stage execution timing (SPEED-04); available globally in Node.js, no import needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `performance.now()` | `process.hrtime.bigint()` | hrtime provides nanosecond precision but BigInt arithmetic is cumbersome; millisecond precision from `performance.now()` is sufficient for 200ms-scale measurements |
| `baseSepoliaPreconf` chain | Custom chain with Flashblocks RPC URL | Built-in chain handles `pending` block tag automatically for `waitForTransactionReceipt`, `estimateGas`, etc.; custom chain would require manual configuration |
| Separate Flashblocks RPC URL env var | Hardcoded URL | Env var is better for production/testnet flexibility and allows using provider-specific Flashblocks endpoints (Alchemy, QuickNode, Chainstack) |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Changes Structure
```
order-execution-keeper-service/src/
├── config.ts                        # Add FLASHBLOCKS_RPC_URL env var
├── core/
│   ├── blockchain/
│   │   └── client.ts                # Use baseSepoliaPreconf chain, conditional Flashblocks RPC
│   ├── executors/
│   │   ├── baseExecutor.ts          # Remove synchronous updatePriceOnChain from buildOracleParams
│   │   ├── depositExecutor.ts       # Add per-stage performance.now() timing
│   │   ├── orderExecutor.ts         # Add per-stage performance.now() timing
│   │   └── withdrawalExecutor.ts    # Add per-stage performance.now() timing
│   └── oracle/
│       └── pythLazerOracle.ts       # Change BG_UPDATE_INTERVAL_MS from 10_000 to 5_000
├── index.ts                         # Log per-stage timing in drainQueue
└── .env.production.example          # Document new env vars
```

### Pattern 1: Flashblocks Client Configuration
**What:** Use `baseSepoliaPreconf` chain definition from viem for Flashblocks-aware client creation
**When to use:** When creating `publicClient` and `walletClient` for TX submission and receipt waiting
**Example:**
```typescript
// Source: viem/chains (verified in installed viem 2.44.4)
import { baseSepoliaPreconf } from "viem/chains";

// The chain definition includes:
// - experimental_preconfirmationTime: 200
// - rpcUrls.default.http: ["https://sepolia-preconf.base.org"]
// - Automatically uses "pending" block tag for waitForTransactionReceipt, estimateGas, etc.

const flashblocksChain: Chain = {
  ...baseSepoliaPreconf,
  rpcUrls: {
    default: { http: [config.flashblocksRpcUrl || "https://sepolia-preconf.base.org"] },
  },
};

// Use for both publicClient and walletClient
publicClient = createPublicClient({
  chain: flashblocksChain,
  transport: http(config.flashblocksRpcUrl || config.rpcUrl),
  batch: { multicall: true },
});
```

### Pattern 2: Background-Only Oracle Updates (No Synchronous Hot Path)
**What:** Remove `updatePriceOnChain()` from `buildOracleParams()`, relying entirely on background updater for price freshness
**When to use:** When background updates run at 5s intervals with 30s safety margin, ensuring prices are always fresh
**Example:**
```typescript
// BEFORE (current code in baseExecutor.ts lines 239-278):
// Synchronous updatePriceOnChain() called when isStoredPriceFresh() returns false
// This blocks execution for 2-4 seconds per token

// AFTER:
// buildOracleParams() checks freshness but only logs a warning if stale
// Never calls updatePriceOnChain() — background updater handles it
for (const token of lazerTokens) {
  const isFresh = await this.isStoredPriceFresh(token);
  if (!isFresh) {
    log.warn({ token }, "stored price unexpectedly stale — background updater may be behind");
    // Fall back to Hermes for this token instead of blocking on updatePriceOnChain
    hermesTokens.push(token);
    continue;
  }
  // Price is fresh — use Lazer provider (no synchronous TX needed)
  resultTokens.push(token);
  resultProviders.push(pythLazerProvider);
  resultData.push("0x" as Hex);
}
```

### Pattern 3: Per-Stage Timing Instrumentation
**What:** Use `performance.now()` to measure each execution stage and log structured timing data
**When to use:** In every executor's execution method
**Example:**
```typescript
// Source: Node.js built-in performance API
const t0 = performance.now();

// Stage 1: Detection (already tracked via item.detectedAt in queue)
const detectionMs = Date.now() - item.detectedAt;

// Stage 2: Oracle param build
const t1 = performance.now();
const oracleParams = await this.buildOracleParams(market, tokens);
const oracleBuildMs = performance.now() - t1;

// Stage 3: TX submission
const t2 = performance.now();
const result = await this.submitTransaction(...);
const txSubmitMs = performance.now() - t2;

// Stage 4: TX confirmation
const t3 = performance.now();
const receipt = await publicClient.waitForTransactionReceipt({ hash: result.txHash });
const txConfirmMs = performance.now() - t3;

const totalMs = performance.now() - t0;

log.info({
  key,
  timing: { detectionMs, oracleBuildMs, txSubmitMs, txConfirmMs, totalMs },
}, "execution timing breakdown");
```

### Anti-Patterns to Avoid
- **Mixing Flashblocks and standard RPC for the same client:** If using `baseSepoliaPreconf`, the `pending` block tag is applied automatically. Don't create one client with Flashblocks and another without for the same operations — use Flashblocks consistently for all TX-related operations.
- **Keeping synchronous `updatePriceOnChain()` "just in case":** This defeats the purpose of SPEED-03. If background updates are working at 5s intervals with 30s margin, the sync path adds latency for no benefit. Fall back to Hermes instead.
- **Using `Date.now()` for timing:** `Date.now()` has ~1ms precision and is subject to clock adjustments. `performance.now()` is monotonic and has microsecond precision, which matters when measuring 200ms confirmations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flashblocks chain configuration | Custom chain definition with manual `pending` tag handling | `baseSepoliaPreconf` from `viem/chains` | Built-in chain automatically applies `pending` block tag to all relevant methods; custom chain risks missing methods or getting the configuration wrong |
| Monotonic timing | Custom `hrtime`-based timer class | `performance.now()` | Built into Node.js, returns floating-point milliseconds, monotonic, sufficient precision for 200ms-scale measurements |
| Latency percentile tracking | Custom histogram implementation | Existing `LatencyTracker` class in `src/utils/latencyTracker.ts` | Already implemented with circular buffer and p50/p95 computation; just needs per-stage data fed into it |

**Key insight:** This phase is primarily about configuration changes and code removal (removing the synchronous oracle update path), not about building new systems. The complexity budget should go toward correct Flashblocks client configuration and ensuring the background updater is reliable enough to eliminate the synchronous fallback.

## Common Pitfalls

### Pitfall 1: Nonce Collisions Between Background Updates and Execution
**What goes wrong:** Background `updatePriceOnChain()` and execution TXs use the same wallet. If both fire simultaneously, one gets a nonce conflict and fails.
**Why it happens:** The current code in `drainQueue()` (index.ts lines 86-98) already handles this by disabling background updates during execution. This pattern MUST be preserved even after SPEED-02/SPEED-03 changes.
**How to avoid:** Keep the existing `disableBackgroundUpdates()` / `enableBackgroundUpdates()` coordination in `drainQueue()`. Do NOT remove it even though SPEED-03 removes sync updates from `buildOracleParams`.
**Warning signs:** `replacement transaction underpriced` or `nonce too low` errors in logs during execution.

### Pitfall 2: Flashblocks Rate Limiting on Public Endpoint
**What goes wrong:** `https://sepolia-preconf.base.org` is rate-limited. High-frequency keeper operations may hit limits.
**Why it happens:** Public Flashblocks endpoints are meant for development. Production keepers need provider-grade endpoints.
**How to avoid:** Support a `FLASHBLOCKS_RPC_URL` env var that defaults to the public endpoint but can be overridden with a provider URL (QuickNode, Alchemy, Chainstack all support Flashblocks).
**Warning signs:** HTTP 429 responses, increased TX confirmation times, timeout errors.

### Pitfall 3: Removing Sync Oracle Updates Without Ensuring Background Reliability
**What goes wrong:** SPEED-03 removes `updatePriceOnChain()` from `buildOracleParams()`, but if background updates silently fail (e.g., WebSocket disconnects, nonce errors), prices go stale and executions revert with `MaxPriceAgeExceeded`.
**Why it happens:** Background updates are fire-and-forget in the current architecture (errors are logged but don't propagate).
**How to avoid:** When the sync path is removed, the `isStoredPriceFresh()` check should fall back to Hermes for stale tokens rather than proceeding with stale Lazer data. This is a graceful degradation path, not a hard failure.
**Warning signs:** Increasing Hermes fallback rate in logs, `MaxPriceAgeExceeded` errors.

### Pitfall 4: Safety Margin Math Error
**What goes wrong:** Changing the safety margin from 5s to 30s in `isStoredPriceFresh()` could make the freshness check too lenient, allowing truly stale prices to be used.
**Why it happens:** The requirement says "increasing safety margin to 30s" but the current code uses `(maxOraclePriceAge - safetyMargin)` as the freshness threshold. Increasing the subtracted margin from 5 to 30 would make the threshold STRICTER (more aggressive about calling prices stale), not more lenient.
**How to avoid:** Re-read the requirement carefully. SPEED-02 says "increasing safety margin to 30s and reducing background oracle update interval from 10s to 5s." The 30s margin means prices must be 30s YOUNGER than `MAX_ORACLE_PRICE_AGE` to be considered fresh. With 5s update intervals, this is easily met. The current 5s margin is too tight — prices updated 6s ago are marked stale even though they may have 55+ seconds of validity remaining.
**Warning signs:** Unnecessary Hermes fallbacks even when Lazer background updates are running correctly.

### Pitfall 5: WebSocket RPC URL for Flashblocks
**What goes wrong:** The existing `WS_RPC_URL` is used for event listener WebSocket subscriptions. A Flashblocks-aware WebSocket URL may be different from the Flashblocks HTTP URL.
**Why it happens:** Flashblocks has both HTTP (`https://sepolia-preconf.base.org`) and WebSocket (`wss://sepolia.flashblocks.base.org/ws`) endpoints. The event listener needs WebSocket for `watchContractEvent`, but the TX submission path uses HTTP.
**How to avoid:** Keep `WS_RPC_URL` separate from `FLASHBLOCKS_RPC_URL`. The event listener's WebSocket connection does not need to be Flashblocks-aware (it detects events, not confirmation speed). Only the TX submission and receipt-waiting paths benefit from Flashblocks.
**Warning signs:** Event listener connecting to wrong endpoint, or Flashblocks HTTP being used for WebSocket subscriptions.

## Code Examples

### Current Client Creation (to be modified)
```typescript
// Source: order-execution-keeper-service/src/core/blockchain/client.ts
// Current implementation — uses custom chain with standard RPC
const customChain: Chain = {
  id: config.chainId,
  name: "Custom",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl!] },
  },
};

publicClient = createPublicClient({
  chain: customChain,
  transport: http(config.rpcUrl),
  batch: { multicall: true },
});
```

### Target Client Creation (Flashblocks-aware)
```typescript
// Use baseSepoliaPreconf for Flashblocks support
import { baseSepoliaPreconf } from "viem/chains";

const flashblocksRpcUrl = config.flashblocksRpcUrl || config.rpcUrl;

// Override default RPC URL with env-configured one
const flashblocksChain: Chain = {
  ...baseSepoliaPreconf,
  rpcUrls: {
    default: { http: [flashblocksRpcUrl!] },
  },
};

publicClient = createPublicClient({
  chain: flashblocksChain,
  transport: http(flashblocksRpcUrl),
  batch: { multicall: true },
});

walletClient = createWalletClient({
  account,
  chain: flashblocksChain,
  transport: http(flashblocksRpcUrl),
});
```

### Background Update Interval Change
```typescript
// Source: order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts line 41
// BEFORE:
private readonly BG_UPDATE_INTERVAL_MS = 10_000; // 10s minimum between on-chain updates per token

// AFTER:
private readonly BG_UPDATE_INTERVAL_MS = 5_000; // 5s minimum between on-chain updates per token
```

### Safety Margin Change
```typescript
// Source: order-execution-keeper-service/src/core/executors/baseExecutor.ts line 184
// BEFORE:
const safetyMargin = 5n; // 5 seconds buffer for block propagation

// AFTER:
const safetyMargin = 30n; // 30 seconds safety margin — generous buffer ensures background updater keeps prices fresh
```

### Removing Synchronous updatePriceOnChain from buildOracleParams
```typescript
// Source: order-execution-keeper-service/src/core/executors/baseExecutor.ts lines 239-278
// BEFORE: calls updatePriceOnChain synchronously when isStoredPriceFresh returns false
// AFTER: falls back to Hermes instead of blocking

if (lazerTokens.length > 0) {
  const pythLazerOracle = getPythLazerOracle();
  if (pythLazerOracle) {
    for (const token of lazerTokens) {
      const isFresh = await this.isStoredPriceFresh(token);
      if (isFresh) {
        log.info({ token }, "stored price is fresh, using Lazer provider");
        // Add directly to results — no synchronous TX needed
      } else {
        // Background updater should have kept this fresh. If not, fall back to Hermes.
        log.warn({ token }, "stored price unexpectedly stale — falling back to Hermes");
        hermesTokens.push(token);
        // Remove from lazerTokens
        const idx = lazerTokens.indexOf(token);
        if (idx >= 0) lazerTokens.splice(idx, 1);
      }
    }
  }
}
```

### Per-Stage Timing in DepositExecutor
```typescript
// Source: order-execution-keeper-service/src/core/executors/depositExecutor.ts
// Add to executeOnce() method

const execStart = performance.now();

// ... (DB lookup, deposit read) ...

const oracleStart = performance.now();
const oracleParams = await this.buildOracleParams(request.market, tokens);
const oracleBuildMs = +(performance.now() - oracleStart).toFixed(1);

const gasStart = performance.now();
const gasLimit = await this.estimateGas(...);
const gasEstimateMs = +(performance.now() - gasStart).toFixed(1);

const txStart = performance.now();
const result = await this.submitTransaction(...);
const txSubmitMs = +(performance.now() - txStart).toFixed(1);

const confirmStart = performance.now();
const txReceipt = await publicClient.waitForTransactionReceipt({ hash: result.txHash, timeout: 60_000 });
const txConfirmMs = +(performance.now() - confirmStart).toFixed(1);

const totalMs = +(performance.now() - execStart).toFixed(1);

log.info({
  key,
  txHash: result.txHash,
  blockNumber: txReceipt.blockNumber,
  timing: { oracleBuildMs, gasEstimateMs, txSubmitMs, txConfirmMs, totalMs },
}, "deposit executed successfully");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Standard 2s block times | Flashblocks 200ms preconfirmations | Base Flashblocks launched on mainnet/sepolia (2025) | 10x faster TX confirmation |
| Manual `pending` block tag | `baseSepoliaPreconf` chain auto-applies `pending` | viem 2.33 (2025) | No manual configuration needed |
| Synchronous oracle price updates in hot path | Background proactive updates (already partially implemented) | Phase 11 (v1.3) | Eliminates 2-4s blocking per execution |
| `Date.now()` coarse timing | `performance.now()` monotonic timing | Always available in Node.js | Microsecond precision for sub-second measurements |

**Deprecated/outdated:**
- Standard Base Sepolia RPC (`https://sepolia.base.org`) for TX-sensitive paths: Flashblocks endpoint is strictly better for confirmation speed
- Synchronous `updatePriceOnChain()` in execution hot path: Phase 11 introduced background updates; Phase 14 completes the migration by removing the synchronous fallback

## Open Questions

1. **What is the on-chain `MAX_ORACLE_PRICE_AGE` value?**
   - What we know: It's read from DataStore and cached in `baseExecutor.ts` line 177. The code uses it as `(maxOraclePriceAge - safetyMargin)` for freshness checks.
   - What's unclear: The exact on-chain value. If it's 60s, a 30s safety margin leaves 30s of effective freshness window. If it's 120s, there's 90s.
   - Recommendation: The 5s update interval ensures freshness regardless of the exact value. The implementation should log the cached value at startup for verification. No blocker.

2. **Should the Flashblocks RPC URL also be used for the WebSocket event listener?**
   - What we know: Flashblocks has both HTTP and WebSocket endpoints. The event listener uses WebSocket for `watchContractEvent`.
   - What's unclear: Whether `wss://sepolia.flashblocks.base.org/ws` provides faster event delivery than the standard WebSocket endpoint.
   - Recommendation: Keep the event listener on the existing `WS_RPC_URL` for now. Event detection latency is dominated by scan interval (30s polling) or WebSocket event propagation, not block confirmation time. Flashblocks primarily benefits TX confirmation, not event detection. Can be revisited later.

3. **Will the public Flashblocks endpoint be sufficient for the keeper's throughput?**
   - What we know: `https://sepolia-preconf.base.org` is rate-limited for development use.
   - What's unclear: Exact rate limits. The keeper submits ~1-10 TXs per minute during normal operation plus background oracle updates every 5s.
   - Recommendation: Start with public endpoint, add `FLASHBLOCKS_RPC_URL` env var for easy switching to a provider endpoint if rate limiting occurs. Document recommended providers (QuickNode, Alchemy, Chainstack) in `.env.production.example`.

## Sources

### Primary (HIGH confidence)
- viem 2.44.4 installed in project — verified `baseSepoliaPreconf` export with `experimental_preconfirmationTime: 200` and RPC `https://sepolia-preconf.base.org` via direct Node.js import
- [Base Flashblocks Documentation](https://docs.base.org/base-chain/flashblocks/apps) — RPC integration, `pending` block tag behavior, viem configuration examples
- [Base Flashblocks Overview](https://docs.base.org/chain/flashblocks) — Architecture, 200ms preconfirmation guarantees
- Source code analysis of `order-execution-keeper-service/src/` — current client.ts, baseExecutor.ts, pythLazerOracle.ts, depositExecutor.ts, index.ts
- [viem baseSepolia.ts chain definition](https://github.com/wevm/viem/blob/main/src/chains/definitions/baseSepolia.ts) — `baseSepoliaPreconf` chain ID 84532 with Flashblocks configuration

### Secondary (MEDIUM confidence)
- [Base Build Twitter announcement](https://x.com/buildonbase/status/1895223267914580358) — Confirmed Base Sepolia Flashblocks RPC endpoints
- [viem 2.33 Flashblocks announcement](https://x.com/_jxom/status/1946961084125954476) — First-class Flashblocks support with sub-200ms confirmations
- [Node.js Performance Measurement APIs](https://nodejs.org/api/perf_hooks.html) — `performance.now()` monotonic timing in Node.js
- [Chainstack Flashblocks on Base](https://chainstack.com/flashblocks-base-rpc/) — Provider-grade Flashblocks endpoints available

### Tertiary (LOW confidence)
- None. All findings verified against primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - viem 2.44.4 with `baseSepoliaPreconf` verified locally; no new dependencies needed
- Architecture: HIGH - Changes are isolated constant tweaks, code removal, and client configuration; pattern is well-understood from Phase 11/13 work
- Pitfalls: HIGH - Nonce collision and safety margin pitfalls identified from direct source code analysis; Flashblocks rate limiting documented in official docs

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain; Flashblocks and viem chain definitions are production-stable)
