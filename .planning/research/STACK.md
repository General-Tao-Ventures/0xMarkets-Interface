# Technology Stack: v1.5 Minimal Keeper Rewrite

**Project:** 0xMarkets Order Execution Keeper (rewrite)
**Researched:** 2026-02-25
**Overall Confidence:** HIGH

## Context

Replacing the 3,000+ line order-execution-keeper-service with a ~300 line single-loop keeper. The goal is radical simplification: no database, no ORM, no queue abstraction, no scanner/executor class hierarchy. The existing design doc (`docs/plans/2026-02-25-minimal-keeper-rewrite-design.md`) specifies Hermes HTTP over Lazer WebSocket for oracle prices.

## Recommended Stack

### Core Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | ^5.9.3 | Language | Already used across all 0xMarkets services. Same version. |
| Node.js | 22 (Docker: `node:22-slim`) | Runtime | Docker image is pinned to `node:22-slim`. Node 22 LTS is stable. All chosen deps support it. Do NOT upgrade to Node 24 -- multiple Pyth packages now require `^24` and the Docker infra is pinned to 22. |
| tsx | ^4.21.0 | Dev runner | Replaces the old `ts-node + nodemon` dev setup. Single command: `tsx watch src/index.ts`. Uses esbuild, zero config. Requires Node >=18 (satisfied). Already a devDependency in the current keeper. |

### Ethereum Client

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| viem | ^2.44.4 | Ethereum RPC, event watching, TX submission | Already used and working. The current installed version (2.44.4) is stable. No breaking changes between 2.40 and 2.46 for the APIs this keeper uses. The only 2.46 breaking change is `nonceKey: 'random' -> 'expiring'` in `viem/tempo` (not used). |

**viem API patterns for the minimal keeper (all stable, unchanged across 2.x):**

```typescript
// 1. Event watching via WebSocket -- primary detection
const unwatch = wsPublicClient.watchEvent({
  address: eventEmitterAddress,
  onLogs: (logs) => { /* decode eventName, extract request key, push to queue */ },
  onError: (error) => { /* log, viem reconnects automatically */ },
});

// 2. Polling fallback via HTTP -- safety-net every 15s
const logs = await httpPublicClient.getLogs({
  address: eventEmitterAddress,
  fromBlock: lastBlock + 1n,
  toBlock: 'latest',
});

// 3. Transaction submission -- sequential, one at a time
const txHash = await walletClient.writeContract({
  address: handlerAddress,
  abi: handlerAbi,
  functionName: 'executeDeposit',
  args: [key, oracleParams],
  account,
  gas: 2_000_000n,
});

// 4. Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({
  hash: txHash,
  timeout: 60_000,
});

// 5. WebSocket client with auto-reconnect
const wsClient = createPublicClient({
  chain,
  transport: webSocket(wsUrl, {
    keepAlive: { interval: 10_000 },
    reconnect: { attempts: Infinity, delay: 2_000 },
  }),
});
```

**CRITICAL viem pitfall (proven in existing codebase):** Do NOT wrap `webSocket()` in `fallback([webSocket(), http()])`. The resulting transport type is `"fallback"`, and `watchEvent` silently polls over HTTP instead of subscribing via WebSocket. Always verify `client.transport.type === "webSocket"` after creation. This pitfall is already documented in the existing `client.ts` and MUST carry forward to the rewrite.

### Oracle Prices

The design doc specifies Hermes HTTP. However, on-chain `oracleProviderForToken` currently points to the Pyth Lazer provider for ALL tokens. This creates a fork in the implementation path.

#### Option A: Hermes HTTP (design doc recommendation)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @pythnetwork/hermes-client | ^2.1.0 | HTTP price fetches | On-demand price fetches per execution. Adds ~200-500ms latency per execution but eliminates WebSocket connection management, reconnection logic, warm-up delays, and cache layer. Requires Node >=22.14.0 (compatible). DO NOT upgrade to v3.x (requires Node ^24). |

**Hermes HTTP pattern (from existing `pythOracle.ts`, proven working):**

```typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const client = new HermesClient("https://hermes.pyth.network", {});

// Fetch binary update data for on-chain submission
const updates = await client.getLatestPriceUpdates([priceId]);
const binaryData = updates.binary.data.map(d => `0x${d}` as Hex);

// Fetch parsed prices for validation
const parsed = updates.parsed[0];
const price = BigInt(parsed.price.price);
```

**Prerequisite:** Update on-chain DataStore `oracleProviderForToken` for ALL tokens to point to the Hermes-compatible provider (ChainlinkPriceFeedProvider or a new PythHermesFeedProvider). This is a one-time admin transaction per token.

#### Option B: Lazer WebSocket (keep current oracle provider)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @pythnetwork/pyth-lazer-sdk | 5.2.0 | WebSocket price cache | Zero additional latency (prices pre-cached). Already configured on-chain. Avoids admin transactions. More complex (~50 lines of WebSocket management). |

**Why pin to exactly 5.2.0:** v5.2.1 and v6.0.0 declare `"engines": { "node": "^24.0.0" }` in package.json. v5.2.0 declares `"node": ">=22.14.0"`. The APIs are IDENTICAL between 5.2.0, 5.2.1, and 6.0.0 (verified by diffing type definitions). v5.2.1 happens to work on Node 22 today despite the engine field, but relying on that is fragile -- npm strict mode or future CI may enforce engine constraints.

**Lazer pattern (from existing `pythLazerOracle.ts`, proven working):**

```typescript
import { PythLazerClient, type JsonOrBinaryResponse, type BinaryResponse }
  from "@pythnetwork/pyth-lazer-sdk";

const client = await PythLazerClient.create({
  token: accessToken,
  webSocketPoolConfig: {
    numConnections: 4,
    onError: (error) => log.error({ err: error }, "WS error"),
    rwsConfig: {
      heartbeatTimeoutDurationMs: 5000,
      maxRetryDelayMs: 1000,
      logAfterRetryCount: 10,
    },
  },
});

client.addMessageListener((msg: JsonOrBinaryResponse) => {
  if (msg.type === "binary" && msg.value.evm) {
    const rawUpdate = `0x${msg.value.evm.toString("hex")}` as Hex;
    // Cache rawUpdate per token for use during execution
  }
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
```

#### Recommendation

Use **Option A (Hermes HTTP)** because:
1. The design doc explicitly chose it for simplicity
2. The ~300 line target requires eliminating WebSocket management code
3. 200-500ms per execution is acceptable on testnet
4. One-time admin TX to update oracle providers is straightforward

If oracle provider update proves blocked (e.g., deployer wallet unavailable), fall back to **Option B (Lazer)** -- the code patterns are already proven and can be extracted from the existing keeper in ~50 lines.

### Server & Logging

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| express | ^5.1.0 | Health endpoint | Single `/health` route. Already used. Express 5 is current. |
| pino | ^10.3.1 | Structured logging | JSON logs for BetterStack. Already the standard across all keeper services. |
| dotenv | ^17.2.3 | Environment config | Reads .env files. Already used. |

## What to Remove (vs Current Keeper)

These dependencies are NOT needed in the minimal keeper:

| Technology | Was Used For | Why Removed |
|------------|-------------|-------------|
| @prisma/client + prisma (^7.2.0) | Database ORM | No database. On-chain DataStore is source of truth. |
| @prisma/adapter-pg (^7.2.0) | PostgreSQL adapter | No database. |
| pg (^8.17.1) | PostgreSQL driver | No database. |
| @pythnetwork/pyth-evm-js (^2.0.0) | Legacy Pyth SDK | Never actively used in execution path. |
| @pythnetwork/pyth-lazer-sdk (^5.2.0) | Lazer WebSocket cache | Replaced by Hermes HTTP (unless Option B). |
| @pythnetwork/hermes-client (^2.1.0) | Hermes fallback | KEPT -- becomes primary oracle source. |
| nodemon (^3.1.11) | Dev file watcher | Replaced by `tsx watch`. |
| ts-node (^10.9.2) | TypeScript execution | Replaced by `tsx`. |
| @vitest/ui (^4.0.16) | Test UI | Minimal keeper may not need tests initially. |
| vitest (^4.0.16) | Test runner | Re-add when tests are written. |

## Version Compatibility Matrix

| Package | Pinned Version | Node 22 | Node 24 | Notes |
|---------|---------------|---------|---------|-------|
| viem | ^2.44.4 | YES | YES | No engine restriction |
| @pythnetwork/hermes-client | ^2.1.0 | YES (>=22.14) | YES | v3.x requires ^24 -- do not upgrade |
| @pythnetwork/pyth-lazer-sdk | 5.2.0 (if Option B) | YES (>=22.14) | YES | v5.2.1+ requires ^24 -- do not upgrade |
| express | ^5.1.0 | YES | YES | No engine restriction |
| pino | ^10.3.1 | YES | YES | No engine restriction |
| dotenv | ^17.2.3 | YES | YES | No engine restriction |
| tsx | ^4.21.0 | YES (>=18) | YES | Dev only |
| typescript | ^5.9.3 | YES (>=14.17) | YES | Dev only |

## Pyth Lazer SDK API Diff: v5.2.0 vs v6.0.0

Documented because the decision between Option A and B affects whether this SDK is used.

**Client API:** Identical. `PythLazerClient.create()`, `addMessageListener()`, `subscribe()`, `shutdown()`, `addAllConnectionsDownListener()` -- all unchanged across v5.2.0, v5.2.1, and v6.0.0.

**Type changes (additive only, non-breaking):**
- `PriceFeedProperty` gained: `marketSession`, `emaPrice`, `emaConfidence`, `feedUpdateTimestamp`
- `Request.priceFeedIds` changed from `number[]` to `number[] | undefined` (now optional, can use `symbols` instead)
- `Request` gained: `symbols?: string[]` (subscribe by symbol name)
- `ParsedFeedPayload.confidence` changed from `string | undefined` to `number | undefined`
- `ParsedFeedPayload` gained: `fundingRate`, `fundingTimestamp`, `fundingRateInterval`, `marketSession`, `emaPrice`, `emaConfidence`, `feedUpdateTimestamp`
- `AssetType` gained: `"eco"`, `"kalshi"`

**Binary message format:** Unchanged. `BinaryResponse.evm` is still `Buffer | undefined`. Hex encoding of EVM payload is identical.

**Breaking engine constraint only:** v5.2.1+ declares `"node": "^24.0.0"`. v5.2.0 declares `"node": ">=22.14.0"`. The runtime code is identical.

## Installation

```bash
# Option A: Hermes HTTP (recommended)
# Production dependencies
pnpm add viem@^2.44.4 @pythnetwork/hermes-client@^2.1.0 express@^5.1.0 pino@^10.3.1 dotenv@^17.2.3

# Dev dependencies
pnpm add -D typescript@^5.9.3 tsx@^4.21.0 @types/node@^24.10.1 @types/express@^5.0.5

# Option B: Lazer WebSocket (fallback)
# Replace hermes-client with:
pnpm add @pythnetwork/pyth-lazer-sdk@5.2.0
```

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

## Docker Changes

Simplified from current Dockerfile:

```dockerfile
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS production
RUN apt-get update -y && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 37018
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:37018/health || exit 1
CMD ["node", "dist/index.js"]
```

**Removed vs current:** `openssl` apt package (was for Prisma), `prisma/` directory copy, `prisma.config.ts` copy, `pnpm db:migrate:deploy` command, `pnpm db:generate` step. Start period reduced from 120s to 30s (no database migration on boot).

## docker-compose.yml Changes

The `order-execution-keeper` service simplifies:

```yaml
order-execution-keeper:
  build: ./order-execution-keeper-service
  restart: unless-stopped
  # No depends_on postgres -- no database
  ports:
    - "0.0.0.0:37018:37018"
  environment:
    RPC_URL: ${RPC_URL:-https://sepolia.base.org}
    WS_RPC_URL: ${WS_RPC_URL}
    FLASHBLOCKS_RPC_URL: ${FLASHBLOCKS_RPC_URL}
    PRIVATE_KEY: ${PRIVATE_KEY:?Set PRIVATE_KEY in .env}
    DATA_STORE_ADDRESS: "0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E"
    READER_ADDRESS: "0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c"
    EVENT_EMITTER_ADDRESS: "0x1E4cBc2ea12B190D6222D568151b5e708e1477F8"
    DEPOSIT_HANDLER_ADDRESS: "0x9388B07f807eB870aD36d350d80DC0c214a7f04f"
    WITHDRAWAL_HANDLER_ADDRESS: "0x7aAF500d8C737076480914342F2904378fbb21B9"
    ORDER_HANDLER_ADDRESS: "0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1"
    PYTH_HERMES_ENDPOINT: "https://hermes.pyth.network"
    CHAIN_ID: "84532"
    PORT: "37018"
    POLL_INTERVAL_SECONDS: "15"
```

**Removed:** `DATABASE_URL`, `ADL_HANDLER_ADDRESS`, `PYTH_LAZER_FEED_PROVIDER_ADDRESS`, `PYTH_PRO_ACCESS_TOKEN`, `ORACLE_MODE`, `SCAN_INTERVAL_SECONDS`, `ENABLE_*` flags.

## What NOT to Add

### Do NOT upgrade to Node 24
The Docker image is `node:22-slim`. Pyth SDK v5.2.1+, v6.0.0, and hermes-client v3.x all require ^24. Upgrading the Docker base image is a separate infrastructure task with its own testing requirements. Stay on Node 22 LTS.

### Do NOT add a database
The entire point of the rewrite is eliminating the PostgreSQL/Prisma layer. On-chain DataStore tracks pending operations. If already executed, the contract reverts with EmptyDeposit/EmptyWithdrawal/EmptyOrder -- catch and skip.

### Do NOT add a queue abstraction
The current keeper has `ExecutionQueue` with dedup, TTL, retry tracking, max retries per key, drain/resume. The minimal keeper uses a plain `Array<{key, type}>` with `Set<Hex>` dedup. Items are processed via `shift()`. Retry is `push()` back with a counter.

### Do NOT add separate scanner/executor classes
Three scanner classes + three executor classes + a base executor = the class hierarchy that inflated the codebase. The minimal keeper has one function per operation type: `executeDeposit()`, `executeWithdrawal()`, `executeOrder()` -- each ~30 lines.

### Do NOT add transaction monitoring
The current keeper has a `TransactionMonitor` for tracking in-flight TXs. Sequential execution with `waitForTransactionReceipt` makes this unnecessary -- one TX at a time, wait for it, move on.

### Do NOT add multiple wallet support
Single keeper wallet means sequential nonce management is trivially correct. No mutex needed.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Oracle source | Hermes HTTP (^2.1.0) | Lazer WebSocket (5.2.0) | Hermes eliminates ~50 lines of WS management. Acceptable latency trade-off for testnet. Lazer kept as fallback if oracle provider update is blocked. |
| Dev runner | tsx (^4.21.0) | ts-node + nodemon | tsx is faster (esbuild), zero-config, single binary. ts-node requires `--loader ts-node/esm` flags. |
| Database | None | PostgreSQL + Prisma | On-chain DataStore is source of truth. Database added complexity for dedup/tracking that's unnecessary with sequential processing. |
| HTTP framework | Express 5 (^5.1.0) | Hono, Fastify, none | One route (`/health`). Express is already in use across both keepers. Switching adds no value. Could drop Express entirely and use Node's built-in `http` module for ~10 lines, but Express gives free middleware for future expansion. |
| Logging | Pino (^10.3.1) | console.log | Structured JSON is essential for BetterStack observability. Pino is already the standard. |
| Package manager | pnpm (10.22.0) | npm, yarn | Already used. Docker build uses `pnpm install --frozen-lockfile`. Consistent with rest of monorepo. |
| viem version | ^2.44.4 (current) | ^2.46.3 (latest) | No benefit. No new features needed. Current version is working. |

## Sources

- npm registry: `@pythnetwork/pyth-lazer-sdk` versions 5.2.0, 5.2.1, 6.0.0 -- downloaded tarballs, inspected `package.json` engine fields and `dist/cjs/client.d.ts` type definitions
- npm registry: `@pythnetwork/hermes-client` versions 2.1.0 (Node >=22.14.0), 3.1.0 (Node ^24)
- npm registry: `viem` version 2.46.3 (latest), 2.44.4 (installed)
- npm registry: `tsx` version 4.21.0, `pino` 10.3.1, `express` 5.2.1, `dotenv` 17.3.1
- [Pyth Developer Hub - Getting Started](https://docs.pyth.network/price-feeds/pro/getting-started) -- PythLazerClient.create API (confirmed `urls` parameter is used in docs examples but `token`-only create still works)
- [viem Releases](https://github.com/wevm/viem/releases) -- verified no breaking changes between 2.40 and 2.46 for watchEvent, writeContract, waitForTransactionReceipt
- Existing codebase: `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` -- working Lazer patterns
- Existing codebase: `order-execution-keeper-service/src/core/oracle/pythOracle.ts` -- working Hermes patterns
- Existing codebase: `order-execution-keeper-service/src/core/blockchain/client.ts` -- viem client setup with WebSocket pitfall documentation
- Existing codebase: `order-execution-keeper-service/src/core/listeners/eventListener.ts` -- watchEvent + getLogs backfill patterns
- Existing codebase: `order-execution-keeper-service/src/core/executors/baseExecutor.ts` -- submitTransaction + buildOracleParams patterns
- Existing codebase: `order-execution-keeper-service/Dockerfile` -- current Docker setup (node:22-slim)
- Design doc: `order-execution-keeper-service/docs/plans/2026-02-25-minimal-keeper-rewrite-design.md` -- approved architecture
