# Phase 15: Project Skeleton and Oracle - Research

**Researched:** 2026-02-26
**Domain:** TypeScript project reset + Pyth Lazer WebSocket oracle cache for order-execution-keeper-service
**Confidence:** HIGH

## Summary

Phase 15 guts the existing 3,000+ line order-execution-keeper-service and replaces it with a minimal ~5-file TypeScript skeleton plus a working Pyth Lazer oracle cache. The work operates on `/Users/ken/Projects/0xM/order-execution-keeper-service` -- not the Interface project. All existing source code (Prisma, class hierarchies, TransactionMonitor, scanners, executors, queue) is deleted and replaced with `config.ts`, `keys.ts`, `abis.ts`, `oracle.ts`, and a minimal `index.ts` that proves the oracle works.

The existing codebase has been thoroughly analyzed. Every source file that needs porting (keys.ts, ABIs, token configs, oracle patterns) has been read and documented below with exact code patterns. The CONTEXT.md locks the implementation to Pyth Lazer WebSocket (not Hermes HTTP) because all 7 tokens already point to the Lazer provider on-chain (`0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`). The oracle cache must enforce a 270-second TTL to prevent `MaxPriceAgeExceeded` errors that plagued v1.3-v1.4.

**Primary recommendation:** Delete everything, rebuild from proven patterns already in the codebase, and verify with `pnpm build` + `pnpm dev` showing 7 cached token prices.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Gut existing `order-execution-keeper-service/` directory -- same directory, same git history, Docker Compose refs unchanged
- Delete everything Prisma/PostgreSQL related -- prisma/ directory, schema, migrations, all imports. Database stays on server but keeper no longer touches it
- Strip down existing package.json -- remove Prisma and unused deps, keep viem/pino/pyth/express/dotenv. Preserves lockfile for unchanged deps
- Replace ts-node + nodemon with tsx watch -- single dep, `pnpm dev` runs `tsx watch src/index.ts`
- On WebSocket disconnect: set stale flag, skip execution of new operations until reconnected. Already-cached prices still usable within 270s TTL
- FATAL log after 60 seconds of sustained disconnection -- BetterStack picks this up for alerting. Keeper stays running but stale-flagged
- Evict prices from cache when they hit 270s TTL -- buildOracleParams sees no price and skips the operation. Clean signal that data is too old
- Log state transitions only (connect, disconnect, stale, recovery) -- not individual price updates. Testnet volume would flood logs without value
- Wait for all 7 token prices (EUR, GBP, GOLD, JPY, USDC, WBTC, WETH) cached before accepting operations
- 30 second timeout -- if any token still missing after 30s, log FATAL with which tokens failed and exit. Docker will restart
- Fail fast on any missing environment variable (PRIVATE_KEY, WS_RPC_URL, PYTH_LAZER_TOKEN, etc.) -- immediate FATAL exit with clear message
- Log full config summary at INFO on startup: keeper address, chain ID, number of tokens, RPC endpoints (masked), oracle provider
- Verify with `pnpm dev` + watch structured logs for 'cache populated' messages for all 7 tokens
- Completion gate: `pnpm build` succeeds (no TS errors) AND `pnpm dev` connects to Pyth Lazer and shows 7 token prices in logs
- Local verification only for Phase 15 -- deployment to droplet is Phase 17's concern
- Minimal index.ts that imports oracle, calls startOracle(), logs when cache is populated -- proves end-to-end. Phase 16 expands index.ts with keeper logic

### Claude's Discretion
- Exact file structure within the 5-file target (config.ts, keys.ts, abis.ts, oracle.ts, index.ts)
- tsconfig.json simplification details
- Exact pino logger configuration
- Which existing utility code to preserve vs rewrite

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCL-01 | Pyth Lazer WebSocket connects and caches price updates for all 7 tokens | Oracle module patterns documented below -- PythLazerClient.create + subscribe + messageListener with binary EVM data cached in Map; startup gate waits for all 7 tokens with 30s timeout |
| ORCL-02 | buildOracleParams reads from cache (synchronous) and includes correct provider address per token | buildOracleParams pattern documented below -- all tokens use same Lazer provider `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05`; no per-token routing needed since all 7 confirmed on-chain |
| ORCL-03 | Cache rejects prices older than 270 seconds (safety margin below 300s MAX_ORACLE_PRICE_AGE) | TTL eviction pattern documented below -- cache entries timestamped with Date.now(), entries older than 270s return undefined from getLatestUpdate |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Language | Already used across all 0xMarkets services. Same version as existing keeper. |
| viem | ^2.44.4 | Ethereum types (Address, Hex, keccak256, encodeAbiParameters) | Already in use. Phase 15 uses only type imports and key computation utilities -- no RPC calls yet (that's Phase 16). |
| @pythnetwork/pyth-lazer-sdk | 5.2.0 (pin exactly) | Pyth Lazer WebSocket client | All 7 tokens use Lazer provider on-chain. MUST pin to exactly 5.2.0 -- v5.2.1+ declares `"node": "^24.0.0"` engine. Currently the lockfile resolves `^5.2.0` to 5.2.1 so the specifier MUST change to exact `5.2.0`. |
| pino | ^10.3.1 | Structured JSON logging | Standard across both keeper services. BetterStack integration. |
| express | ^5.1.0 | Health endpoint (minimal, Phase 16 expands) | Single `/health` route. Already in use. Not needed in Phase 15's index.ts but stays in package.json for Phase 16. |
| dotenv | ^17.2.3 | Environment config | Reads .env files. Already used. |

### Dev Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.21.0 | Dev runner (`tsx watch src/index.ts`) | Replaces ts-node + nodemon. Already a devDependency. |
| typescript | ^5.9.3 | Build (`tsc -p tsconfig.json`) | Already in use. |
| @types/node | ^24.10.1 | Node.js type definitions | Already in use. |
| @types/express | ^5.0.5 | Express type definitions | Already in use. |

### What to Remove

| Library | Why Removed |
|---------|-------------|
| @prisma/client (^7.2.0) | No database |
| @prisma/adapter-pg (^7.2.0) | No database |
| prisma (^7.2.0, dev) | No database |
| pg (^8.17.1) | No database |
| @pythnetwork/hermes-client (^2.1.0) | Not needed -- all tokens use Lazer |
| @pythnetwork/pyth-evm-js (^2.0.0) | Never used in execution path |
| nodemon (^3.1.11, dev) | Replaced by tsx |
| ts-node (^10.9.2, dev) | Replaced by tsx |
| @vitest/ui (^4.0.16, dev) | Tests deferred |
| vitest (^4.0.16, dev) | Tests deferred |

### Installation

```bash
# From /Users/ken/Projects/0xM/order-execution-keeper-service

# Production
pnpm add viem@^2.44.4 @pythnetwork/pyth-lazer-sdk@5.2.0 express@^5.1.0 pino@^10.3.1 dotenv@^17.2.3

# Dev
pnpm add -D typescript@^5.9.3 tsx@^4.21.0 @types/node@^24.10.1 @types/express@^5.0.5

# Remove
pnpm remove @prisma/client @prisma/adapter-pg prisma pg @pythnetwork/hermes-client @pythnetwork/pyth-evm-js nodemon ts-node @vitest/ui vitest
```

**CRITICAL: Lockfile pinning.** The current lockfile resolves `^5.2.0` to `5.2.1` (which declares Node ^24 engine). Specifier MUST be exact `"5.2.0"` (no caret) in package.json, then run `pnpm install` to regenerate lockfile. Verify after install: `cat node_modules/@pythnetwork/pyth-lazer-sdk/package.json | grep version` should show `5.2.0`.

## Architecture Patterns

### Recommended Project Structure (Post-Phase 15)

```
order-execution-keeper-service/
  src/
    config.ts        # ~30 lines: env var loading, fail-fast validation
    keys.ts          # ~15 lines: DataStore key constants (port verbatim)
    abis.ts          # ~180 lines: all contract ABIs consolidated
    oracle.ts        # ~80 lines: Pyth Lazer cache with TTL, buildOracleParams
    index.ts         # ~20 lines: minimal startup proving oracle works
  package.json       # stripped deps, new scripts
  tsconfig.json      # simplified
  Dockerfile         # stays for now (simplified in Phase 17)
  .env               # unchanged
  docs/              # preserved (design docs)
```

### What Gets Deleted

```
DELETED (preserved in git history):
  prisma/                          # schema, migrations, config
  prisma.config.ts                 # Prisma config
  src/core/                        # entire directory
    blockchain/                    # client.ts, contracts/, abis/
    executors/                     # deposit/withdrawal/order executors, base
    listeners/                     # eventListener.ts
    monitor/                       # transactionMonitor.ts
    oracle/                        # pythOracle.ts, pythLazerOracle.ts
    queue/                         # executionQueue.ts
    scanners/                      # deposit/withdrawal/order scanners, types
    store.ts                       # database connection
    utils/                         # datastore-utils.ts, keys.ts (ported to new keys.ts)
  src/server/                      # httpServer.ts
  src/utils/healthState.ts         # replaced by inline state
  src/utils/latencyTracker.ts      # deferred
  src/utils/latencyTracker.test.ts # deferred
  src/utils/keys.ts                # duplicate of core/utils/keys.ts
  src/utils/keys.test.ts           # deferred
  src/config/                      # tokens.ts (absorbed into oracle.ts)
  src/test/                        # all tests (new tests when Phase 16 ships)
```

### Pattern 1: Fail-Fast Config

**What:** Load all required env vars at module initialization. Throw immediately if any are missing.
**Why:** The existing config.ts uses `logger.warn` for missing vars, allowing the keeper to start in a broken state. The new approach crashes immediately with a clear error.
**Source:** CONTEXT.md locked decision.

```typescript
// src/config.ts
import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function requiredHex(name: string): `0x${string}` {
  const value = required(name);
  return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
}

export const config = {
  // RPC
  rpcUrl: required("RPC_URL"),
  wsRpcUrl: required("WS_RPC_URL"),
  chainId: parseInt(required("CHAIN_ID"), 10),

  // Wallet
  privateKey: requiredHex("PRIVATE_KEY"),

  // Contracts
  dataStoreAddress: requiredHex("DATA_STORE_ADDRESS"),
  readerAddress: requiredHex("READER_ADDRESS"),
  eventEmitterAddress: requiredHex("EVENT_EMITTER_ADDRESS"),
  depositHandlerAddress: requiredHex("DEPOSIT_HANDLER_ADDRESS"),
  withdrawalHandlerAddress: requiredHex("WITHDRAWAL_HANDLER_ADDRESS"),
  orderHandlerAddress: requiredHex("ORDER_HANDLER_ADDRESS"),

  // Oracle
  pythLazerFeedProviderAddress: requiredHex("PYTH_LAZER_FEED_PROVIDER_ADDRESS"),
  pythProAccessToken: required("PYTH_PRO_ACCESS_TOKEN"),

  // Server
  port: Number(process.env.PORT || "37018"),

  // Optional
  flashblocksRpcUrl: process.env.FLASHBLOCKS_RPC_URL,
} as const;
```

**Key differences from existing config.ts:**
- `required()` helper exits immediately on missing vars (not warn)
- No `databaseUrl`, `oracleMode`, `enableDeposits/Withdrawals/Orders`, `adlHandlerAddress`, `scanIntervalSeconds`, `pythHermesEndpoint`, `pythHermesFeedProviderAddress`, `pythContractAddress`
- `WS_RPC_URL` is now required (was optional)
- `PYTH_PRO_ACCESS_TOKEN` is now required (was optional)
- `PYTH_LAZER_FEED_PROVIDER_ADDRESS` renamed from `pythLazerFeedProviderAddress` env var for clarity

### Pattern 2: Verbatim Key Encoding

**What:** DataStore key constants using `keccak256(encodeAbiParameters(...))`.
**Why:** Solidity `abi.encode` is NOT the same as viem `encodePacked`. Using the wrong encoding silently returns wrong data. This was a documented production bug.
**Source:** Existing `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/utils/keys.ts` -- port verbatim.

```typescript
// src/keys.ts -- MUST be exact copy of encoding pattern
import { keccak256, encodeAbiParameters } from "viem";

export const DEPOSIT_LIST = keccak256(
  encodeAbiParameters([{ type: "string" }], ["DEPOSIT_LIST"])
);

export const WITHDRAWAL_LIST = keccak256(
  encodeAbiParameters([{ type: "string" }], ["WITHDRAWAL_LIST"])
);

export const ORDER_LIST = keccak256(
  encodeAbiParameters([{ type: "string" }], ["ORDER_LIST"])
);

// Used for oracle provider verification (Phase 15 startup check)
export const ORACLE_PROVIDER_FOR_TOKEN = keccak256(
  encodeAbiParameters([{ type: "string" }], ["ORACLE_PROVIDER_FOR_TOKEN"])
);

// Needed by Phase 16 for expired deposit cancellation
export const REQUEST_EXPIRATION_TIME = keccak256(
  encodeAbiParameters([{ type: "string" }], ["REQUEST_EXPIRATION_TIME"])
);
```

**NEVER use `encodePacked` for DataStore keys.** The hashes are completely different and produce silent wrong data.

### Pattern 3: Pyth Lazer Oracle with TTL Cache

**What:** WebSocket connection to Pyth Lazer that caches binary EVM price updates per token, with a 270-second TTL.
**Why:** The existing oracle has no TTL (documented production bug causing MaxPriceAgeExceeded). The new version must evict stale entries.
**Source:** Adapted from existing `pythLazerOracle.ts` with TTL added.

```typescript
// src/oracle.ts -- key patterns (not complete file)
import { type Address, type Hex } from "viem";
import { PythLazerClient, type JsonOrBinaryResponse, type BinaryResponse } from "@pythnetwork/pyth-lazer-sdk";

const CACHE_TTL_MS = 270_000; // 270 seconds (300s MAX_ORACLE_PRICE_AGE - 30s safety margin)

interface CacheEntry {
  rawUpdate: Hex;       // Binary EVM data for on-chain submission
  cachedAt: number;     // Date.now() when received
  feedId: number;
}

// Token config -- feeds for all 7 tokens
const FEEDS: { token: Address; feedId: number }[] = [
  { token: "0x86e6ab05217318Db4A63f0361BADBf5aF0c69270", feedId: 327 }, // EUR
  { token: "0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e", feedId: 333 }, // GBP
  { token: "0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4", feedId: 346 }, // GOLD
  { token: "0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A", feedId: 340 }, // JPY
  { token: "0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b", feedId: 7 },   // USDC
  { token: "0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39", feedId: 1 },   // WBTC
  { token: "0x4200000000000000000000000000000000000006", feedId: 2 },   // WETH
];

// Cache: lowercase token address -> CacheEntry
const cache = new Map<string, CacheEntry>();

// State flags
let isStale = false;
let disconnectedAt: number | null = null;

function getLatestUpdate(token: Address): CacheEntry | undefined {
  const entry = cache.get(token.toLowerCase());
  if (!entry) return undefined;

  // TTL check -- ORCL-03
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(token.toLowerCase());
    return undefined;
  }

  return entry;
}

function buildOracleParams(tokens: Address[]): {
  tokens: Address[];
  providers: Address[];
  data: Hex[];
} {
  const providerAddress = config.pythLazerFeedProviderAddress;
  const resultTokens: Address[] = [];
  const resultProviders: Address[] = [];
  const resultData: Hex[] = [];

  for (const token of tokens) {
    const entry = getLatestUpdate(token);
    if (!entry) {
      throw new Error(`No cached price for token ${token}`);
    }
    resultTokens.push(token);
    resultProviders.push(providerAddress);  // Same provider for ALL tokens
    resultData.push(entry.rawUpdate);
  }

  return { tokens: resultTokens, providers: resultProviders, data: resultData };
}
```

**Key differences from existing pythLazerOracle.ts:**
1. **TTL check in getLatestUpdate** -- entries older than 270s are evicted (existing code has NO TTL)
2. **Date.now() for cache timestamps** -- v5.2.0 does NOT have `feedUpdateTimestamp` as a PriceFeedProperty (only available in v6.0.0+). The on-chain contract validates the actual Pyth timestamp in the binary payload, so Date.now() for local cache eviction is sufficient.
3. **No class** -- plain functions and module-level state
4. **No Hermes fallback** -- all 7 tokens use Lazer (CONTEXT.md decision)
5. **Single provider address** -- no per-token routing needed (all 7 tokens confirmed Lazer on-chain)
6. **Stale flag + disconnectedAt tracking** -- for FATAL log after 60s sustained disconnect

### Pattern 4: Binary Message Handling

**What:** The Pyth Lazer SDK sends binary messages containing EVM-compatible price data for ALL subscribed feeds in a single blob.
**Why:** Each binary message is cached for EVERY registered token because the on-chain contract filters by feedId from the blob.
**Source:** Existing `pythLazerOracle.ts` lines 128-165.

```typescript
// Inside message listener
function handleMessage(message: JsonOrBinaryResponse): void {
  if (message.type !== "binary") {
    // Handle JSON messages (subscription confirmation, errors)
    return;
  }

  const binaryResponse = message.value as BinaryResponse;
  if (!binaryResponse.evm) return;

  const rawUpdate = `0x${binaryResponse.evm.toString("hex")}` as Hex;
  const now = Date.now();

  // Cache for ALL registered tokens -- each update contains all subscribed feeds
  for (const feed of FEEDS) {
    cache.set(feed.token.toLowerCase(), {
      rawUpdate,
      cachedAt: now,
      feedId: feed.feedId,
    });
  }
}
```

### Pattern 5: Subscription Configuration

**What:** Pyth Lazer subscription with correct feed IDs and properties.
**Source:** Existing `pythLazerOracle.ts` lines 109-118.

```typescript
client.subscribe({
  type: "subscribe",
  subscriptionId: 1,
  priceFeedIds: FEEDS.map(f => f.feedId),  // [327, 333, 346, 340, 7, 1, 2]
  properties: ["price"],  // Minimal -- only need price for execution
  formats: ["evm"],       // Binary EVM format for on-chain submission
  deliveryFormat: "binary",
  channel: "fixed_rate@200ms",
  parsed: false,
});
```

**Note:** Existing code subscribes to `["price", "bestBidPrice", "bestAskPrice"]` but only `"price"` is needed for execution. The `bestBidPrice` and `bestAskPrice` add unnecessary data. Use just `["price"]`.

### Pattern 6: Minimal Index (Proves Oracle Works)

**What:** Phase 15's index.ts is intentionally minimal -- just imports oracle, starts it, and logs results.
**Source:** CONTEXT.md decision.

```typescript
// src/index.ts (Phase 15 version -- Phase 16 expands this)
import { config } from "./config.js";
import { startOracle, getCachedTokenCount, isOracleStale } from "./oracle.js";
import pino from "pino";

const log = pino({ name: "order-keeper" });

async function main() {
  // Log startup config
  log.info({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl.replace(/\/\/.*@/, "//<masked>@"),
    wsRpcUrl: config.wsRpcUrl.replace(/\/\/.*@/, "//<masked>@"),
    oracleProvider: config.pythLazerFeedProviderAddress,
    port: config.port,
    tokenCount: 7,
  }, "starting order-execution-keeper");

  // Start oracle -- waits for all 7 token prices
  await startOracle();

  log.info({ cachedTokens: getCachedTokenCount() }, "oracle cache populated -- ready");

  // Phase 16 adds: event watcher, poller, executor, health endpoint
  // For now, just keep the process alive to observe oracle behavior
  process.on("SIGINT", () => {
    log.info("shutting down");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log.info("shutting down");
    process.exit(0);
  });
}

main().catch((err) => {
  log.fatal({ err }, "startup failed");
  process.exit(1);
});
```

### Anti-Patterns to Avoid

- **Class hierarchies for oracle:** The existing `PythLazerOracleService` is a class with constructor, instance methods, and a singleton pattern. The new oracle.ts uses module-level state and exported functions. Classes add indirection without benefit in a ~80 line module.
- **Singleton factory pattern:** The existing `createPythLazerOracle()` / `getPythLazerOracle()` pattern is unnecessary when the module IS the singleton. Module state in Node.js ESM is already a singleton.
- **Warn on missing env vars:** The existing config.ts uses `logger.warn` when critical vars are missing. This allows the keeper to start in a broken state. Use `process.exit(1)` instead.
- **Dual oracle (Hermes + Lazer):** The existing system has complex per-token routing between Hermes and Lazer. All 7 tokens confirmed Lazer on-chain. Single-provider simplicity.
- **4 WebSocket connections:** Existing uses `numConnections: 4` for redundancy. Testnet volume does not need this. Use `numConnections: 1`.
- **Using `^5.2.0` specifier for pyth-lazer-sdk:** This resolves to 5.2.1 which declares Node ^24 engine. Pin to exactly `"5.2.0"` (no caret).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DataStore key hashing | Custom keccak256 logic | Copy existing `keys.ts` verbatim using `encodeAbiParameters` | Wrong encoding silently returns zero values. Production bug documented in MEMORY.md. |
| WebSocket reconnection | Custom reconnection logic | Pyth Lazer SDK's built-in reconnection | SDK handles reconnection with configurable backoff. Don't reinvent. |
| Token address/feedId mapping | Dynamic lookup from chain | Hardcode all 7 feed configs in oracle.ts | There are exactly 7 tokens on Base Sepolia. They don't change at runtime. |
| ABI type generation | Parse from Solidity source | Copy existing ABI definitions from existing codebase | ABIs are static. The existing files have the exact right shape. |
| Binary price parsing | Decode Pyth binary data | Pass raw binary blob to on-chain contract | The contract decodes it. Keeper just caches and forwards. |

## Common Pitfalls

### Pitfall 1: Stale Cache Without TTL (MaxPriceAgeExceeded)
**What goes wrong:** WebSocket disconnects silently, cache holds last price indefinitely, on-chain contract rejects prices older than 300s.
**Why it happens:** Existing code has NO TTL in getLatestUpdate(). Cache returns stale data forever.
**How to avoid:** Every getLatestUpdate() call checks `Date.now() - entry.cachedAt > 270_000` and returns undefined if stale. Delete the entry from the Map.
**Warning signs:** Executions revert with `MaxPriceAgeExceeded` after network blips.

### Pitfall 2: Pyth Lazer SDK Version Pinning
**What goes wrong:** `^5.2.0` resolves to 5.2.1 which requires Node ^24. `pnpm install` may warn or fail in CI/Docker.
**Why it happens:** Pyth bumped the engine constraint in a patch version (5.2.0 -> 5.2.1).
**How to avoid:** Pin exactly `"5.2.0"` in package.json (no caret). Verify after install.
**Warning signs:** `pnpm install` engine warnings, Docker build failures on node:22-slim.

### Pitfall 3: DataStore Key Encoding (encodePacked vs encodeAbiParameters)
**What goes wrong:** Using `encodePacked` instead of `encodeAbiParameters` produces a different hash. DataStore reads return zero silently.
**Why it happens:** Solidity `abi.encode` pads to 32 bytes; `abi.encodePacked` does not. Viem's `encodePacked` matches the wrong one.
**How to avoid:** Port keys.ts EXACTLY from the existing codebase. Never "simplify" the encoding.
**Warning signs:** DataStore getBytes32Count returns 0 when pending deposits exist.

### Pitfall 4: feedUpdateTimestamp Not Available in v5.2.0
**What goes wrong:** Attempting to subscribe to `feedUpdateTimestamp` property causes a type error or silent ignore.
**Why it happens:** `feedUpdateTimestamp` was added as a `PriceFeedProperty` only in v6.0.0 of pyth-lazer-sdk (requires Node ^24). It does NOT exist in v5.2.0.
**How to avoid:** Use `Date.now()` for local cache TTL eviction. The actual Pyth timestamp is embedded in the binary EVM payload and validated by the on-chain contract. Local TTL just prevents stale data from being submitted.
**Warning signs:** TypeScript type errors when adding `feedUpdateTimestamp` to properties array.

### Pitfall 5: Pyth Lazer Reconnection Storm on Token Expiry
**What goes wrong:** When PYTH_PRO_ACCESS_TOKEN expires, all connections fail auth. SDK retries aggressively, flooding logs.
**Why it happens:** Existing config uses `maxRetryDelayMs: 1000` (1 second). Auth failures are indistinguishable from transient errors.
**How to avoid:** Set `maxRetryDelayMs: 30000` (30 seconds). Track `allConnectionsDownListener` -- if down for >60s, log FATAL ("check PYTH_PRO_ACCESS_TOKEN validity").
**Warning signs:** Log output volume spikes, all cache entries go stale simultaneously.

### Pitfall 6: Module Type Mismatch
**What goes wrong:** The existing project uses `"type": "module"` in package.json with NodeNext moduleResolution. File imports MUST use `.js` extensions.
**Why it happens:** TypeScript with ESM requires explicit `.js` extensions in import paths (even though the source is `.ts`).
**How to avoid:** All imports use `./config.js`, `./keys.js`, etc. The existing codebase already does this.
**Warning signs:** "Cannot find module" errors at runtime despite successful `tsc` build.

## Code Examples

### ABI Consolidation Pattern
All ABIs from 6 separate files consolidated into one. Port these exactly.

```typescript
// src/abis.ts (consolidated from existing scattered ABI files)
// Source: order-execution-keeper-service/src/core/blockchain/contracts/abis/

export const dataStoreAbi = [
  {
    name: "getBytes32Count",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "setKey", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getBytes32ValuesAt",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "setKey", type: "bytes32" },
      { name: "start", type: "uint256" },
      { name: "end", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "getUint",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const eventEmitterAbi = [
  {
    type: "event",
    name: "EventLog1",
    inputs: [
      { name: "msgSender", type: "address", indexed: true },
      { name: "eventName", type: "string", indexed: false },
      { name: "eventNameHash", type: "string", indexed: true },
      { name: "topic1", type: "bytes32", indexed: true },
      { name: "eventData", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EventLog2",
    inputs: [
      { name: "msgSender", type: "address", indexed: true },
      { name: "eventName", type: "string", indexed: false },
      { name: "eventNameHash", type: "string", indexed: true },
      { name: "topic1", type: "bytes32", indexed: true },
      { name: "topic2", type: "bytes32", indexed: true },
      { name: "eventData", type: "bytes", indexed: false },
    ],
  },
] as const;

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
    type: "function",
    name: "cancelDeposit",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const withdrawalHandlerAbi = [
  {
    type: "function",
    name: "executeWithdrawal",
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
] as const;

export const orderHandlerAbi = [
  {
    type: "function",
    name: "executeOrder",
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
] as const;

// Reader ABI is large -- includes getDeposit, getWithdrawal, getOrder, getMarket
// Full reader ABI follows same pattern as existing reader.ts ABI file
export const readerAbi = [
  // ... (port verbatim from existing src/core/blockchain/contracts/abis/reader.ts)
] as const;
```

### Oracle Startup Sequence

```typescript
// Inside startOracle() -- the startup gate pattern
export async function startOracle(): Promise<void> {
  const client = await PythLazerClient.create({
    token: config.pythProAccessToken,
    webSocketPoolConfig: {
      numConnections: 1,  // Sufficient for testnet
      onError: (error: Error) => {
        log.error({ err: error }, "ws error");
      },
      rwsConfig: {
        heartbeatTimeoutDurationMs: 5000,
        maxRetryDelayMs: 30000,  // 30s -- prevent reconnection storm
        logAfterRetryCount: 10,
      },
    },
  });

  client.addMessageListener(handleMessage);

  client.addAllConnectionsDownListener(() => {
    if (!disconnectedAt) {
      disconnectedAt = Date.now();
      isStale = true;
      log.error("all connections down -- oracle stale");
    }
  });

  client.subscribe({
    type: "subscribe",
    subscriptionId: 1,
    priceFeedIds: FEEDS.map(f => f.feedId),
    properties: ["price"],
    formats: ["evm"],
    deliveryFormat: "binary",
    channel: "fixed_rate@200ms",
    parsed: false,
  });

  // Wait for all 7 token prices -- 30s timeout
  const startTime = Date.now();
  const TIMEOUT_MS = 30_000;

  while (cache.size < FEEDS.length) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      const missing = FEEDS
        .filter(f => !cache.has(f.token.toLowerCase()))
        .map(f => f.token);
      log.fatal({ missing, cached: cache.size, expected: FEEDS.length },
        "oracle startup timeout -- not all token prices received");
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Start background stale-check interval
  setInterval(() => {
    if (disconnectedAt && Date.now() - disconnectedAt > 60_000) {
      log.fatal("oracle disconnected for >60s -- check PYTH_PRO_ACCESS_TOKEN");
    }
  }, 10_000);
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

### tsconfig.json (Simplified)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src"]
}
```

**Changes from existing tsconfig:**
- `target` bumped from ES2020 to ES2022 (Node 22 supports ES2022 fully)
- `lib` bumped to match
- Added `declaration: false`, `sourceMap: false` (not needed)
- No Prisma-related paths to remove (there were none)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node + nodemon for dev | tsx watch | Already a devDep since v1.4 | Single command, faster startup, no --loader flags |
| Prisma + PostgreSQL for state | On-chain DataStore (no DB) | v1.5 decision | Removes 500+ lines, one fewer container dependency |
| Dual oracle (Hermes + Lazer) | Lazer only | v1.5 decision (all 7 tokens confirmed Lazer) | Removes per-token routing complexity |
| Class hierarchies (Base/Deposit/Withdrawal/Order) | Inline functions | v1.5 decision | ~1,200 lines reduced to ~80 lines |
| 4 WebSocket connections to Pyth | 1 connection | v1.5 decision (testnet volume) | Less resource usage, simpler reconnection |

## Open Questions

1. **PYTH_PRO_ACCESS_TOKEN env var name**
   - What we know: The existing config uses `PYTH_PRO_ACCESS_TOKEN` in .env. The CONTEXT.md mentions `PYTH_LAZER_TOKEN` as the env var name.
   - What's unclear: Which name to use in the new config.
   - Recommendation: Keep `PYTH_PRO_ACCESS_TOKEN` to avoid changing the existing .env file on the server. The CONTEXT.md reference may just be a shorthand.

2. **Pyth Lazer SDK logger parameter**
   - What we know: The existing code passes `console` as the logger. The SDK accepts a `Logger` interface.
   - What's unclear: Whether passing pino directly works as the SDK logger (different interface than console).
   - Recommendation: Pass `console` as the SDK logger (proven working). Log SDK-level events via the message listener and connection down listener instead.

3. **Buffer import for binary data handling**
   - What we know: The Pyth Lazer SDK returns `binaryResponse.evm` as a `Buffer`. The `Buffer` type exists in Node.js but may need explicit import in strict TS.
   - What's unclear: Whether `Buffer.toString("hex")` works without explicit import in the new stripped-down project.
   - Recommendation: Node.js globals include `Buffer`. No explicit import needed. Test during implementation.

## Sources

### Primary (HIGH confidence -- direct codebase analysis)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/config.ts` -- existing config pattern, env var names
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/config/tokens.ts` -- all 7 token addresses and feed IDs
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` -- complete Lazer WebSocket cache implementation (216 lines)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/oracle/pythOracle.ts` -- Hermes implementation (being removed, for reference)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/utils/keys.ts` -- DataStore key encoding (MUST port verbatim)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/blockchain/client.ts` -- viem client setup, WebSocket transport verification
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/baseExecutor.ts` -- buildOracleParams, submitTransaction, OracleParams type
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/blockchain/contracts/abis/` -- all 6 ABI files
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/index.ts` -- current startup sequence, oracle initialization
- `/Users/ken/Projects/0xM/order-execution-keeper-service/package.json` -- current dependencies, scripts
- `/Users/ken/Projects/0xM/order-execution-keeper-service/tsconfig.json` -- current TypeScript config
- `/Users/ken/Projects/0xM/order-execution-keeper-service/Dockerfile` -- current Docker build
- npm tarball inspection: `@pythnetwork/pyth-lazer-sdk` v5.2.0 confirms `PriceFeedProperty` does NOT include `feedUpdateTimestamp`
- npm tarball inspection: `@pythnetwork/pyth-lazer-sdk` v6.0.0 confirms `feedUpdateTimestamp` was added there (requires Node ^24)
- Installed lockfile: `^5.2.0` resolved to 5.2.1 (Node ^24 engine) -- must pin exactly to 5.2.0

### Secondary (MEDIUM confidence -- project research docs)
- `.planning/research/SUMMARY.md` -- overall research synthesis
- `.planning/research/STACK.md` -- technology stack decisions
- `.planning/research/FEATURES.md` -- feature landscape
- `.planning/research/ARCHITECTURE.md` -- integration architecture
- `.planning/research/PITFALLS.md` -- domain pitfalls
- `order-execution-keeper-service/docs/plans/2026-02-25-minimal-keeper-rewrite-design.md` -- approved architecture

### Correction to Prior Research
- SUMMARY.md states "`feedUpdateTimestamp` from the Pyth Lazer response" should be used instead of `Date.now()`. This is WRONG for v5.2.0: `feedUpdateTimestamp` only exists as a `PriceFeedProperty` in v6.0.0+ (verified by tarball inspection). For the binary delivery format used by this keeper, the Pyth timestamp is embedded in the binary payload and validated on-chain. Local cache TTL using `Date.now()` is the correct approach for v5.2.0.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via npm registry, exact versions confirmed, engine constraints inspected
- Architecture: HIGH -- all source files read, patterns extracted from working code
- Pitfalls: HIGH -- 5 of 6 pitfalls derive from documented production incidents or verified library constraints
- Oracle: HIGH -- existing implementation analyzed line-by-line, SDK type definitions inspected at the tarball level

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- no breaking changes expected in pinned versions)
