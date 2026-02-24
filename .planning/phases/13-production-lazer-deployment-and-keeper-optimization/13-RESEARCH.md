# Phase 13: Production Lazer Deployment and Keeper Optimization - Research

**Researched:** 2026-02-24
**Domain:** Production infrastructure, Pyth Lazer oracle integration, Docker deployment
**Confidence:** MEDIUM (external dependency on Pyth Network for token entitlements is the primary unknown)

## Summary

Phase 13 is a production deployment and hardening phase, not a feature development phase. The core codebase work from Phases 10-12 is complete. The outstanding issues are:

1. **Pyth Lazer token entitlements** -- the access token (`PYTH_PRO_ACCESS_TOKEN`) currently has zero entitlements, meaning the WebSocket subscription silently fails (no price data flows). This is an external dependency on Pyth Network's distribution partners. Without a properly entitled token, Lazer mode cannot function.

2. **Oracle provider mismatch** -- The `0x05d102a2` error is `InvalidOracleProvider(address)`, meaning the contract's DataStore has a different oracle provider address set for the token than what the keeper passes. This occurs when switching between Hermes and Lazer modes if the on-chain `oracleProviderForToken` mapping doesn't match the provider address the keeper sends in `buildOracleParams()`.

3. **FX feed re-enablement** -- EUR, GBP, GOLD, JPY feeds are commented out in `PYTH_LAZER_FEED_CONFIGS` (tokens.ts) because even crypto feeds weren't entitled. Once entitlements are resolved, these must be uncommented.

4. **Keeper robustness** -- The infinite retry loop for permanently failed orders has been fixed (MAX_QUEUE_RETRIES = 5 cap in ExecutionQueue, plus isPermanentOrderError classification), but production verification is needed.

5. **Docker/environment management** -- Production runs via Docker compose on a cloud server. Environment variables were partially hardcoded as workarounds during debugging.

**Primary recommendation:** This phase should be structured as verification-first -- confirm external dependencies (Pyth token), then systematically enable Lazer mode, re-enable FX feeds, clean up Docker configuration, and add a dedicated metrics endpoint.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @pythnetwork/pyth-lazer-sdk | 5.2.1 | Pyth Lazer WebSocket price streaming | Official Pyth SDK for low-latency price feeds |
| @pythnetwork/hermes-client | 2.1.0 | Pyth Hermes REST price feeds (fallback) | Standard Pyth oracle for non-Lazer mode |
| viem | 2.40.3 | Ethereum client, contract interactions | Standard Web3 library for TypeScript |
| express | 5.1.0 | HTTP server for health/status endpoints | Lightweight, already in use |
| pino | 10.3.1 | Structured JSON logging | Production-grade logger already in use |
| prisma | 7.2.0 | Database ORM, migrations | Already manages keeper state persistence |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.0.16 | Unit testing | Existing test infrastructure |
| dotenv | 17.2.3 | Environment variable loading | Already used for config |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom metrics | prom-client (Prometheus) | Full metrics stack; overkill for single-keeper testnet -- simple JSON endpoint is sufficient for now |
| Docker hardcoded env | Docker secrets / .env file | Docker secrets add complexity but are more secure for production private keys |

**Installation:** No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Current Project Structure (order-execution-keeper-service)
```
src/
├── config.ts              # Environment variable config object
├── config/
│   └── tokens.ts          # Token addresses, Hermes & Lazer feed configs
├── core/
│   ├── blockchain/        # Viem clients, contract ABIs, contract wrappers
│   ├── executors/         # Deposit/Withdrawal/Order executors with oracle param building
│   ├── listeners/         # WebSocket event listener for on-chain events
│   ├── monitor/           # Transaction monitor
│   ├── oracle/            # PythOracleService (Hermes) + PythLazerOracleService
│   ├── queue/             # ExecutionQueue with dedup and retry cap
│   └── scanners/          # Polling scanners for pending operations
├── server/
│   └── httpServer.ts      # Express server with /health endpoint
└── utils/
    ├── healthState.ts     # Singleton health state + latency tracker
    └── latencyTracker.ts  # Circular buffer percentile calculator
```

### Pattern 1: Oracle Mode Switching
**What:** The keeper supports three oracle modes via `ORACLE_MODE` env var: `hermes`, `lazer`, or `both`
**When to use:** Toggle between oracle providers without code changes
**Current state:** Production runs in `hermes` mode as workaround for Lazer token issues

```typescript
// config.ts
oracleMode: (process.env.ORACLE_MODE || "hermes") as "hermes" | "lazer" | "both",
```

The `baseExecutor.buildOracleParams()` method branches on `config.oracleMode`:
- **hermes**: Fetches prices via HermesClient REST API, passes them in oracle params
- **lazer**: Uses pre-cached WebSocket prices, sends `updatePriceOnChain()` TX, passes provider address in oracle params with empty data
- **both**: Does Lazer update first, then Hermes for oracle params

### Pattern 2: Background Oracle Updates with Nonce Coordination
**What:** PythLazerOracleService updates prices on-chain proactively in the background (every 10s per token). During execution, background updates are disabled to prevent nonce collisions.
**When to use:** Already implemented -- this is the Phase 11 architecture
**Key detail:** `drainQueue()` calls `disableBackgroundUpdates()` before each execution and `enableBackgroundUpdates()` after, ensuring the single keeper wallet doesn't have competing nonce sequences.

### Pattern 3: Permanent vs Transient Error Classification
**What:** Executors classify errors to decide retry behavior. Permanent errors (contract reverts, expired operations) are not retried. Transient errors (network, nonce collision) are retried with backoff.
**Current state:** Already implemented with `isPermanentError()` / `isPermanentOrderError()` methods.
**Key error selectors:**
- `0x05d102a2` = `InvalidOracleProvider(address)` -- provider not enabled in DataStore
- `0x68b49e6c` = `InvalidOracleProviderForToken(address, address)` -- wrong provider for token
- `0x95b66fe9` = `EmptyDeposit()` selector
- `0xd84b8ee8` = Expiry selector

### Anti-Patterns to Avoid
- **Hardcoding env vars in docker-compose.yml:** Use `.env` file or Docker secrets instead. Hardcoded values get stale and create mismatch with local development config.
- **Running Lazer mode without verifying token entitlements first:** The WebSocket connects successfully but sends no data if the token lacks entitlements. Always verify feed data flows before enabling in production.
- **Switching oracle mode without updating on-chain provider mapping:** If `oracleProviderForToken` in DataStore points to PythLazerFeedProvider but keeper runs in Hermes mode (or vice versa), `InvalidOracleProvider` errors occur.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pyth Lazer WebSocket connection | Custom WebSocket client | `@pythnetwork/pyth-lazer-sdk` PythLazerClient | SDK handles connection pooling, reconnection, heartbeats, dedup across redundant connections |
| Docker health checks | Custom health script | Docker `healthcheck` with `curl` to `/health` endpoint | Already have heartbeat-based health endpoint (Phase 12) |
| Prometheus metrics format | Custom formatting | `prom-client` npm package | If Prometheus integration is needed later; for now, JSON endpoint is sufficient |

**Key insight:** This phase is primarily about configuration and deployment, not new code. Most work involves verifying external dependencies, toggling configuration, and cleaning up the production environment.

## Common Pitfalls

### Pitfall 1: Pyth Lazer Token Looks Connected But Has No Entitlements
**What goes wrong:** PythLazerClient.create() succeeds, subscribe() succeeds, but no price data ever arrives. The keeper logs show "connected and subscribed" but updateCache never gets populated. Background updates silently skip tokens because getLatestUpdate() returns undefined.
**Why it happens:** The access token authenticates the WebSocket connection but has zero feed entitlements. The server accepts the connection and subscription request but never sends data for unentitled feeds.
**How to avoid:** After connecting, wait a few seconds and verify that at least one price update has been received. If `updateCache` is empty after 10s, log a clear error and fail fast rather than running indefinitely with stale prices.
**Warning signs:** Health endpoint shows `oracleConnected: true` but background oracle updates never succeed. Executions fail with stale/missing prices.

### Pitfall 2: InvalidOracleProvider When Switching Oracle Modes
**What goes wrong:** Keeper sends oracle params with the wrong provider address. Contract reverts with `0x05d102a2`.
**Why it happens:** The on-chain DataStore has `oracleProviderForToken[token] = PythLazerFeedProvider.address` but the keeper is running in Hermes mode and passes `pythContractAddress` (the Hermes/Pyth contract) as the provider. Or vice versa.
**How to avoid:** Oracle mode switching must be coordinated between:
  1. The on-chain `oracleProviderForToken` mapping (set via contract deploy scripts / Timelock)
  2. The keeper's `ORACLE_MODE` env var
  3. The keeper's `PYTH_LAZER_FEED_PROVIDER_ADDRESS` and `PYTH_CONTRACT_ADDRESS` env vars
**Warning signs:** All executions fail immediately with gas estimation revert.

### Pitfall 3: FX Feeds Have Different Entitlement Tiers
**What goes wrong:** Crypto feeds (BTC, ETH) work but FX feeds (EUR, GBP, JPY) and metal feeds (GOLD/XAU) don't receive data.
**Why it happens:** Pyth Lazer entitlements may be granted per asset class. Crypto entitlements don't automatically include FX or metals.
**How to avoid:** When obtaining a new Pyth access token, explicitly request entitlements for ALL asset classes: crypto, FX, and metals. Verify each feed ID receives data before enabling in production.
**Warning signs:** Crypto markets (BTC, ETH) execute successfully but FX/metals markets fail with stale oracle prices.

### Pitfall 4: Docker Environment Variable Drift
**What goes wrong:** Local `.env` file and production Docker compose environment get out of sync. One has updated addresses, the other doesn't.
**Why it happens:** Contract addresses, access tokens, or RPC endpoints are updated in one place but not the other. Some values were hardcoded directly in docker-compose.yml as a quick fix.
**How to avoid:** Use a single `.env` file approach for Docker compose (`env_file` directive). Keep contract addresses in a single source of truth. After any address change, use the checklist in `.claude/contract-address-update-guide.md`.
**Warning signs:** Keeper works locally but fails in production, or vice versa.

### Pitfall 5: Node.js Engine Mismatch for Pyth Lazer SDK
**What goes wrong:** `@pythnetwork/pyth-lazer-sdk@5.2.1` declares `"engines": { "node": "^24.0.0" }` in its package.json. The Dockerfile uses `node:22-slim`.
**Why it happens:** The SDK was published with a Node.js 24+ engine requirement. This may be enforced by pnpm's `engine-strict` mode.
**How to avoid:** Either update the Dockerfile to `node:24-slim` or verify that the SDK works correctly on Node 22 (it currently does -- the engine constraint may be overly restrictive). Monitor for runtime issues.
**Warning signs:** `pnpm install` may warn about engine incompatibility. Runtime crypto or WebSocket issues.

## Code Examples

### Verifying Lazer Token Entitlements
```typescript
// Pattern: Startup verification that Lazer feeds are actually receiving data
// Add to main() after pythLazerOracle.connect() and the 10s wait

const verifyFeeds = () => {
  const receivedFeeds: string[] = [];
  const missingFeeds: string[] = [];

  for (const feedConfig of PYTH_LAZER_FEED_CONFIGS) {
    const update = pythLazerOracle.getLatestUpdate(feedConfig.token);
    if (update) {
      receivedFeeds.push(`${feedConfig.token} (feedId: ${feedConfig.feedId})`);
    } else {
      missingFeeds.push(`${feedConfig.token} (feedId: ${feedConfig.feedId})`);
    }
  }

  if (missingFeeds.length > 0) {
    logger.error(
      { missingFeeds, receivedFeeds },
      "Pyth Lazer feeds missing data -- check token entitlements"
    );
  }
};
```

### Re-enabling FX Feeds in tokens.ts
```typescript
// In src/config/tokens.ts, uncomment the FX feed configs:
export const PYTH_LAZER_FEED_CONFIGS: TokenPythLazerConfig[] = [
  { token: TOKEN_ADDRESSES.EUR, feedId: 327, inverted: false },
  { token: TOKEN_ADDRESSES.GBP, feedId: 333, inverted: false },
  { token: TOKEN_ADDRESSES.GOLD, feedId: 346, inverted: false },
  { token: TOKEN_ADDRESSES.JPY, feedId: 340, inverted: true },
  { token: TOKEN_ADDRESSES.USDC, feedId: 7, inverted: false },
  { token: TOKEN_ADDRESSES.WBTC, feedId: 1, inverted: false },
  { token: TOKEN_ADDRESSES.WETH, feedId: 2, inverted: false },
];
```

### Docker Compose env_file Pattern
```yaml
# docker-compose.yml -- use env_file instead of hardcoded environment
services:
  keeper:
    build: .
    env_file: .env.production
    ports:
      - "37018:37018"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:37018/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s
```

### Oracle Provider Consistency Check
```typescript
// Verify that the keeper's configured provider matches on-chain oracleProviderForToken
// This could be added to startup or as a diagnostic script
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";

async function verifyOracleProviderConsistency(
  publicClient: PublicClient,
  dataStoreAddress: Address,
  tokens: Address[],
  expectedProvider: Address
) {
  for (const token of tokens) {
    // Read oracleProviderForToken from DataStore
    const key = keccak256(
      encodeAbiParameters(
        parseAbiParameters("bytes32, address"),
        [keccak256(encodeAbiParameters([{ type: "string" }], ["ORACLE_PROVIDER_FOR_TOKEN"])), token]
      )
    );

    const onChainProvider = await publicClient.readContract({
      address: dataStoreAddress,
      abi: parseAbi(["function getAddress(bytes32 key) view returns (address)"]),
      functionName: "getAddress",
      args: [key],
    });

    if (onChainProvider.toLowerCase() !== expectedProvider.toLowerCase()) {
      console.error(`MISMATCH for ${token}: on-chain=${onChainProvider}, keeper=${expectedProvider}`);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PythLazerClient(urls[], token) constructor | PythLazerClient.create({ token, webSocketPoolConfig }) | SDK v5.x | The keeper already uses the new config-object API |
| Pyth Hermes (REST, per-execution fetch) | Pyth Lazer (WebSocket streaming, pre-cached) | Phase 11 | Reduces oracle latency from 2-8s to near-zero per execution |
| Polling-only detection (5-10s average) | WebSocket event detection (<2s) with polling fallback | Phase 10 | Primary detection path is sub-2s |
| Execution-timestamp health (false alerts) | Heartbeat-based health (scan-cycle liveness) | Phase 12 | Eliminates false-positive BetterStack alerts during idle |

**Deprecated/outdated:**
- The older `PythLazerClient.create(urls[], token)` positional API is still shown in some Pyth docs but the SDK v5.2.1 uses the config object pattern. The keeper already uses the correct API.

## Open Questions

1. **Pyth Lazer Token Entitlements (CRITICAL -- EXTERNAL BLOCKER)**
   - What we know: The current access token `ZeJb1TSzVmrHrRiiLWhJjHwgRtfcX1EELqM` has zero entitlements. STATE.md notes "new key obtained, needs deployment."
   - What's unclear: Has a new properly-entitled token been obtained? Does it cover crypto, FX, AND metals asset classes?
   - Recommendation: This must be confirmed before any implementation work. Contact Pyth Data Distributor. Verify the new token by running `scripts/test-oracle.ts` locally with `ORACLE_MODE=lazer`.

2. **On-Chain Oracle Provider Configuration**
   - What we know: `configureOracleTokens.ts` sets `oracleProviderForToken` to `PythLazerFeedProvider.address` for all tokens on non-hardhat networks. The `0x05d102a2` error means this provider isn't enabled OR the wrong provider is being passed.
   - What's unclear: Is the on-chain `isOracleProviderEnabled` flag set for the PythLazerFeedProvider? Has the deployment script been run since the provider was deployed?
   - Recommendation: Run `scripts/printOracleConfig.ts` from the contracts repo to verify on-chain state for all tokens. Compare `oracleProviderForToken` with the keeper's `PYTH_LAZER_FEED_PROVIDER_ADDRESS`.

3. **Docker Compose Production Configuration**
   - What we know: Docker compose is at `/opt/0xmarkets/docker-compose.yml` on the cloud server. Some env vars were hardcoded as workaround.
   - What's unclear: What is the current state of the production Docker compose file? Who manages deployments (Michael Wallert)?
   - Recommendation: Get the current production docker-compose.yml. Migrate to `.env.production` file for all environment variables.

4. **Node.js Version for Docker**
   - What we know: Dockerfile uses `node:22-slim`. SDK declares `engines: { node: "^24.0.0" }`. SDK works on Node 22 in practice.
   - What's unclear: Will future SDK updates break on Node 22?
   - Recommendation: Consider upgrading to `node:24-slim` when Node 24 reaches LTS. For now, monitor but don't block.

5. **Metrics Endpoint Scope**
   - What we know: The health endpoint currently includes execution counts, latency percentiles, and connection status. There is no dedicated `/metrics` endpoint.
   - What's unclear: What monitoring tools are being used in production besides BetterStack? Is Prometheus-compatible metrics format needed?
   - Recommendation: Add a simple `/metrics` JSON endpoint that exposes queue stats, feed freshness, and execution rates. Only add Prometheus format if actively using Prometheus.

## Sources

### Primary (HIGH confidence)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/` -- Full keeper service codebase examined
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/oracle/Oracle.sol` -- Oracle provider validation logic (lines 250-280)
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/error/Errors.sol` -- Error selector definitions
- `/Users/ken/Projects/0xM/0xmarkets_contract/deploy/configureOracleTokens.ts` -- Oracle provider configuration
- `@pythnetwork/pyth-lazer-sdk@5.2.1` -- SDK API (client.d.ts examined directly)

### Secondary (MEDIUM confidence)
- [Pyth Developer Hub - Subscribe to Prices](https://docs.pyth.network/price-feeds/pro/subscribe-to-prices) -- WebSocket subscription API, access token usage
- [Pyth Developer Hub - Acquire Access Token](https://docs.pyth.network/price-feeds/pro/acquire-access-token) -- Token acquisition process via Data Distributors
- [Pyth Developer Hub - Getting Started](https://docs.pyth.network/price-feeds/pro/getting-started) -- PythLazerClient initialization patterns

### Tertiary (LOW confidence)
- Pyth Lazer entitlement model details -- No official documentation found on per-asset-class entitlements. Understanding based on observed behavior (crypto feeds attempted, no data received) and STATE.md notes.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, versions verified from package.json and node_modules
- Architecture: HIGH - Full codebase examined, patterns documented from source code
- Oracle provider errors: HIGH - Error selector `0x05d102a2` confirmed as `InvalidOracleProvider(address)` via keccak256 computation against Errors.sol
- Pyth entitlements: LOW - External dependency, no official docs on entitlement tiers found. Must be verified empirically with Pyth Data Distributor
- Docker/production config: MEDIUM - Know the structure but don't have access to production docker-compose.yml

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (standard stack is stable; entitlement status is the volatile factor)
