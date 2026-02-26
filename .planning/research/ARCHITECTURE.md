# Architecture: Minimal Keeper Rewrite Integration

**Domain:** Order execution keeper rewrite for GMX-fork perpetual futures protocol
**Researched:** 2026-02-25
**Confidence:** HIGH (based on direct codebase analysis of all integration points)

## Current System Architecture

The production deployment runs on a single DigitalOcean droplet (142.93.203.222) via Docker Compose with three containers sharing a common `.env`:

```
docker-compose.yml (root: /opt/0xmarkets/)
  |
  +-- postgres (postgres:16)
  |     - Two databases: keeper_service, order_execution_keeper
  |     - Shared volume: pgdata
  |     - Healthcheck: pg_isready
  |
  +-- keeper-service (port 37017) -- STAYS
  |     - Price feeds, liquidation scanning, candle data
  |     - Depends on: postgres (service_healthy)
  |     - Has its own Prisma ORM, migrations
  |     - Has its own Pyth Lazer WebSocket connection
  |     - DATABASE_URL points to keeper_service DB
  |
  +-- order-execution-keeper (port 37018) -- BEING REPLACED
        - Deposits, withdrawals, order execution
        - Depends on: postgres (service_healthy)
        - Has Prisma ORM, migrations, 6 models, 1 state table
        - Has its own Pyth Lazer WebSocket connection
        - DATABASE_URL points to order_execution_keeper DB
```

Both services share the same keeper wallet (PRIVATE_KEY), the same RPC endpoints, and the same Pyth Pro API token. Both maintain independent Pyth Lazer WebSocket connections. The keeper-service does NOT execute deposits/withdrawals/orders -- it only reads prices and scans for liquidation opportunities.

## Recommended Architecture (Post-Rewrite)

```
docker-compose.yml (root: /opt/0xmarkets/)
  |
  +-- postgres (postgres:16)
  |     - ONE database: keeper_service (only)
  |     - order_execution_keeper DB becomes unused
  |     - init-db.sql can keep both CREATE DATABASE stmts harmlessly
  |
  +-- keeper-service (port 37017) -- UNCHANGED
  |     - Price feeds, liquidation scanning, candle data
  |     - Depends on: postgres (service_healthy)
  |
  +-- order-execution-keeper (port 37018) -- REPLACED (minimal)
        - Deposits, withdrawals, order execution
        - NO depends_on postgres (no database dependency)
        - Single TypeScript process, ~5 source files
        - Own Pyth Lazer WebSocket for price cache
        - Health endpoint at /health
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **postgres** | Persistent storage for keeper-service | keeper-service only (post-rewrite) |
| **keeper-service** | Price feeds, liquidation scanning, candle OHLC data | postgres, Pyth Lazer WS, Base Sepolia RPC, EventEmitter contract |
| **order-execution-keeper** (new) | Execute pending deposits/withdrawals/orders | Pyth Lazer WS, Base Sepolia RPC/WS, EventEmitter, DataStore, Reader, Handler contracts |
| **Frontend (Vercel)** | User interface | Both keepers via health/metrics endpoints (proxied), Base Sepolia RPC |

### Data Flow

```
User submits deposit/withdrawal/order on frontend
  -> Frontend calls createDeposit/createWithdrawal/createOrder on Exchange Router
  -> On-chain: operation added to DataStore list, EventEmitter fires event
  -> TWO detection paths (new keeper):
     (a) WebSocket event: EventEmitter emits DepositCreated/WithdrawalCreated/OrderCreated
         -> keeper parses event, extracts request key, enqueues
     (b) Safety-net poll (every 15s): keeper reads DataStore lists
         -> any keys not already queued get enqueued
  -> Sequential executor loop:
     1. shift() item from in-memory array
     2. Read operation struct from Reader contract
     3. Read cached Pyth Lazer price from in-memory Map
     4. Call executeDeposit/executeWithdrawal/executeOrder on Handler contract
     5. waitForTransactionReceipt (60s timeout)
     6. Log result
     7. Next item
```

## Integration Points: Detailed Analysis

### 1. Docker Compose (MODIFIED)

**File:** `/opt/0xmarkets/docker-compose.yml` (server) / `/Users/ken/Projects/0xM/docker-compose.yml` (local)

**Changes required:**

```yaml
# REMOVE: depends_on postgres (new keeper has no database)
order-execution-keeper:
  build: ./order-execution-keeper-service
  restart: unless-stopped
  # depends_on: REMOVED -- no database dependency
  ports:
    - "0.0.0.0:37018:37018"
  environment:
    # REMOVE: DATABASE_URL (no database)
    RPC_URL: ${RPC_URL:-https://sepolia.base.org}
    WS_RPC_URL: ${WS_RPC_URL}  # NEW -- needed for event watcher
    PRIVATE_KEY: ${PRIVATE_KEY:?Set PRIVATE_KEY in .env}
    DATA_STORE_ADDRESS: "0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E"
    READER_ADDRESS: "0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c"
    EVENT_EMITTER_ADDRESS: "0x1E4cBc2ea12B190D6222D568151b5e708e1477F8"
    DEPOSIT_HANDLER_ADDRESS: "0x9388B07f807eB870aD36d350d80DC0c214a7f04f"
    WITHDRAWAL_HANDLER_ADDRESS: "0x7aAF500d8C737076480914342F2904378fbb21B9"
    ORDER_HANDLER_ADDRESS: "0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1"
    PYTH_LAZER_FEED_PROVIDER_ADDRESS: "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05"
    PYTH_PRO_ACCESS_TOKEN: ${PYTH_PRO_ACCESS_TOKEN}
    CHAIN_ID: "84532"
    PORT: "37018"
    # REMOVE: ORACLE_MODE (keeper only uses Lazer, hardcoded)
    # REMOVE: PYTH_HERMES_ENDPOINT (not used)
    # REMOVE: SCAN_INTERVAL_SECONDS (replaced by POLL_INTERVAL_MS)
    # REMOVE: ENABLE_DEPOSITS/WITHDRAWALS/ORDERS/ADL (all always enabled)
```

**Critical note:** The `WS_RPC_URL` env var is NOT in the current docker-compose.yml for the order-execution-keeper. The current keeper reads it from its local `.env` file. The docker-compose environment block overrides `.env`, so `WS_RPC_URL` MUST be added to docker-compose.yml or it will be missing in the container.

### 2. Postgres Container (NO CHANGE, but relationship changes)

The postgres container stays. The `init-db.sql` creates both databases (`keeper_service` and `order_execution_keeper`). This is harmless -- the new keeper simply never connects to `order_execution_keeper`. No changes needed to postgres config.

The `order_execution_keeper` database will contain stale historical data (deposit/withdrawal/order execution records from v1.0-v1.4). This data is not valuable for production but could be kept for reference. No cleanup action required.

### 3. Keeper-Service (NO CHANGE)

The keeper-service at port 37017 is completely unaffected. It:
- Has its own Pyth Lazer WebSocket connection (independent of the execution keeper)
- Reads from keeper_service database (unchanged)
- Scans for liquidations (unchanged)
- Serves candle data (unchanged)

Zero modifications needed. The two services share the same PRIVATE_KEY (same wallet) but the keeper-service only sends liquidation transactions, which are rare on testnet and will not conflict with the execution keeper's sequential nonce management.

**Risk:** Both services sending transactions from the same wallet could cause nonce conflicts. However, this is the existing behavior and has been manageable because liquidations are rare on testnet. The new keeper's sequential execution loop actually reduces nonce conflict risk compared to the old system (which had concurrent drain loop + cancel expired loop even with the TxMutex).

### 4. Dockerfile (NEW -- simplified)

**Current Dockerfile problems being eliminated:**
- Prisma client generation (`pnpm db:generate`)
- Database migration on startup (`pnpm db:migrate:deploy`)
- OpenSSL dependency (required by Prisma)
- 120s start-period for healthcheck (was needed for DB init + WebSocket warm-up)

**New Dockerfile:**
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

Start-period drops from 120s to 30s. The Pyth Lazer WebSocket connects in ~2-5s; there is no database migration step.

### 5. Health Endpoint (SIMPLIFIED)

**Current:** Returns detailed health state including DB connection, oracle entitlement status, WebSocket status, execution counts, latency percentiles, queue stats.

**New:** Returns minimal JSON:
```json
{
  "status": "ok",
  "uptime": 12345,
  "queueLength": 0,
  "lastExecTime": "2026-02-25T23:00:00Z",
  "keeper": "0x48Cb0d738C9B3F44F60f7338F788fa093FD25828"
}
```

**BetterStack impact:** BetterStack uptime monitoring pings `/health` and checks for HTTP 200. The new endpoint returns 200 with JSON -- fully compatible. No BetterStack config changes needed.

**Frontend proxy impact:** The interface proxies `/keeper-health` to the execution keeper's `/health`. The response shape changes but the frontend only checks for HTTP 200 status, not response body fields. No frontend changes needed.

### 6. On-Chain Contracts (NO CHANGE)

All on-chain contracts remain identical. The new keeper calls the same functions with the same ABI:
- `DataStore.getBytes32Count(setKey)` + `getBytes32ValuesAt(setKey, start, end)` -- for polling
- `Reader.getDeposit/getWithdrawal/getOrder(dataStore, key)` -- for reading operation structs
- `Reader.getMarket(dataStore, market)` -- for resolving index/long/short tokens
- `DepositHandler.executeDeposit(key, oracleParams)` -- for executing deposits
- `WithdrawalHandler.executeWithdrawal(key, oracleParams)` -- for executing withdrawals
- `OrderHandler.executeOrder(key, oracleParams)` -- for executing orders

The oracle params format is unchanged: `{ tokens: Address[], providers: Address[], data: bytes[] }`.

### 7. Oracle Integration (SIMPLIFIED)

**Current:** Complex oracle module with:
- Pyth Lazer WebSocket (primary) with 4-connection pool, entitlement verification, warm-up gate
- Pyth Hermes REST (fallback) for tokens without Lazer entitlements
- Per-token routing based on entitlement status
- Separate `pythOracle.ts` and `pythLazerOracle.ts` modules (combined ~500 lines)

**New:** Single `oracle.ts` (~50 lines):
- Pyth Lazer WebSocket (only) -- single connection is sufficient for testnet
- No Hermes fallback (all 7 tokens confirmed to have Lazer entitlements as of 2026-02-25)
- No entitlement verification gate
- Cache in simple `Map<string, Hex>` -- all tokens get the same binary update blob
- `buildOracleParams()` is synchronous -- reads from cache, throws if cache miss

**Risk:** If Pyth Lazer entitlements change or a new token is added without Lazer support, executions for that token will fail. This is acceptable for testnet -- the error is visible in logs and the fix is to add the entitlement.

### 8. Env Vars (REDUCED)

**Removed env vars (no longer needed):**

| Env Var | Why Removed |
|---------|-------------|
| `DATABASE_URL` | No database |
| `ORACLE_MODE` | Always Lazer, hardcoded |
| `PYTH_HERMES_ENDPOINT` | No Hermes fallback |
| `PYTH_HERMES_FEED_PROVIDER_ADDRESS` | No Hermes fallback |
| `SCAN_INTERVAL_SECONDS` | Replaced by `POLL_INTERVAL_MS` (default 15000) |
| `ENABLE_DEPOSITS` | Always enabled |
| `ENABLE_WITHDRAWALS` | Always enabled |
| `ENABLE_ORDERS` | Always enabled |
| `ENABLE_ADL` | ADL not implemented in new keeper |
| `ADL_HANDLER_ADDRESS` | ADL not implemented |
| `MAX_REQUESTS_PER_SCAN` | Retained as optional, default 50 |

**Added env vars:**

| Env Var | Why Added |
|---------|-----------|
| `WS_RPC_URL` | Already in local .env but NOT in docker-compose.yml -- must be added |
| `POLL_INTERVAL_MS` | Optional, default 15000. Replaces SCAN_INTERVAL_SECONDS |

**Retained env vars:**
- `RPC_URL`, `PRIVATE_KEY`, `CHAIN_ID`, `PORT`
- `DATA_STORE_ADDRESS`, `READER_ADDRESS`, `EVENT_EMITTER_ADDRESS`
- `DEPOSIT_HANDLER_ADDRESS`, `WITHDRAWAL_HANDLER_ADDRESS`, `ORDER_HANDLER_ADDRESS`
- `PYTH_LAZER_FEED_PROVIDER_ADDRESS`, `PYTH_PRO_ACCESS_TOKEN`

## New vs Modified Components

### New Components (to create from scratch)

| Component | File | Lines (est.) | Purpose |
|-----------|------|--------------|---------|
| Config | `src/config.ts` | ~30 | Env var loading with required/optional helpers |
| Keys | `src/keys.ts` | ~15 | DataStore key constants (DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST) |
| ABIs | `src/abis.ts` | ~180 | Contract ABIs (deposit/withdrawal/order handlers, DataStore, Reader, EventEmitter) |
| Oracle | `src/oracle.ts` | ~50 | Pyth Lazer WebSocket cache: connect, subscribe, cache in Map |
| Main | `src/index.ts` | ~250 | Event watcher, safety-net poller, sequential executor, health endpoint |
| Dockerfile | `Dockerfile` | ~20 | Simplified Docker build (no Prisma, no DB migration) |

### Modified Components (in-place changes to existing files)

| Component | File | Change |
|-----------|------|--------|
| Docker Compose | `/docker-compose.yml` | Remove postgres dependency for order-execution-keeper, add WS_RPC_URL, remove DATABASE_URL and unused env vars |
| Package.json | `package.json` | Remove prisma/@prisma/client/@prisma/adapter-pg/pg deps, remove db:* scripts, bump version to 2.0.0 |
| tsconfig.json | `tsconfig.json` | Minor simplification (remove Prisma-related paths if any) |

### Deleted Components (removed, preserved in git history)

| Component | Path | Why Removed |
|-----------|------|-------------|
| Prisma schema | `prisma/schema.prisma` | No database |
| Prisma config | `prisma.config.ts` | No database |
| Prisma migrations | `prisma/migrations/` | No database |
| Scanner classes | `src/core/scanners/` | Replaced by inline `getKeys()` + `pollForPending()` |
| Executor classes | `src/core/executors/` | Replaced by inline `executeItem()` |
| Execution queue | `src/core/queue/` | Replaced by `const queue: QueueItem[] = []` |
| Event listener | `src/core/listeners/` | Replaced by inline `startEventWatcher()` |
| Transaction monitor | `src/core/monitor/` | Removed (unnecessary for sequential execution) |
| Pyth Lazer oracle | `src/core/oracle/pythLazerOracle.ts` | Replaced by `oracle.ts` (~50 lines) |
| Pyth Hermes oracle | `src/core/oracle/pythOracle.ts` | Removed (no Hermes fallback) |
| Store module | `src/core/store.ts` | No database |
| Health state | `src/utils/healthState.ts` | Replaced by inline `lastExecTime` variable |
| Latency tracker | `src/utils/latencyTracker.ts` | Removed (premature optimization for testnet) |
| HTTP server | `src/server/` | Replaced by inline `startHealthServer()` |
| Blockchain client | `src/core/blockchain/client.ts` | Replaced by inline `publicClient`/`walletClient` creation |
| Token configs | `src/config/tokens.ts` | Moved into `oracle.ts` as `FEEDS` constant |
| ABIs (scattered) | `src/core/blockchain/contracts/abis/` | Consolidated into single `abis.ts` |

## Patterns to Follow

### Pattern 1: Inline Everything
**What:** No class hierarchies, no dependency injection, no abstraction layers. Functions that call each other directly.
**When:** The entire codebase is ~500 lines. Abstraction adds indirection without benefit.
**Example:**
```typescript
// YES: inline function
async function getDepositTokens(key: Hex): Promise<{ market: Address; tokens: Address[] } | null> {
  const deposit = await publicClient.readContract({ ... });
  if (!deposit.addresses.account || deposit.addresses.account === ZERO_ADDRESS) return null;
  // ...
  return { market, tokens: [...tokenSet] };
}

// NO: class with constructor, dependency injection, methods
class DepositScanner {
  private dataStore: DataStoreContract;
  private reader: ReaderContract;
  constructor() { ... }
  async scan(): Promise<ScanResult> { ... }
}
```

### Pattern 2: Array as Queue
**What:** A plain JavaScript array with `push()` and `shift()` is the execution queue. A `Set<Hex>` provides deduplication.
**When:** Single-consumer, single-producer, in-memory only.
**Why:** The current `ExecutionQueue` class (152 lines) with TTL, fail counts, cleanup timers, and stats is unnecessary complexity. The array provides the same FIFO guarantee with zero overhead.

### Pattern 3: On-Chain Source of Truth
**What:** No database. If the keeper restarts, the 15s polling loop re-discovers all pending operations from the DataStore contract.
**When:** The DataStore already maintains DEPOSIT_LIST, WITHDRAWAL_LIST, ORDER_LIST. Items are removed when executed.
**Why:** The current Prisma schema (148 lines, 7 models, 13 indexes) duplicates state that already exists on-chain. The database was used for: (a) tracking execution status -- now tracked by log output, (b) backfill block tracking -- now handled by re-polling on restart, (c) stale deposit detection -- now handled by checking if the struct is zeroed on-chain.

### Pattern 4: Fail Fast, Log Clearly
**What:** Permanent errors (EmptyDeposit, expired, InvalidOracleProvider) cause the item to be dropped with an error log. Transient errors retry up to 3 times.
**When:** Every execution attempt.
**Why:** The current system has complex status tracking (PENDING -> EXECUTING -> EXECUTED/FAILED/CANCELLED) across database records. The new system has no persistent state -- if a permanent error occurs, it logs and moves on. The item is gone from the DataStore when re-polled (already consumed or still there for retry).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Re-introducing Database State
**What:** Adding a database to track execution history, retry counts, or last-processed block.
**Why bad:** The entire point of the rewrite is that on-chain DataStore is the source of truth. A database reintroduces the Prisma dependency, migration steps, startup delay, and state synchronization bugs that plagued v1.0-v1.4.
**Instead:** Log to stdout (pino JSON). If execution history is needed later, add it to the keeper-service (which already has a database) or query on-chain events.

### Anti-Pattern 2: Adding Hermes Fallback "Just In Case"
**What:** Keeping the Pyth Hermes REST fallback alongside Lazer.
**Why bad:** Per-token oracle routing was the number one source of bugs in v1.3-v1.4. The dual-oracle system required entitlement checks, warm-up verification, fallback logic, and different provider addresses per token. All 7 tokens have Lazer entitlements -- there is no "just in case" scenario on testnet.
**Instead:** If a token loses Lazer entitlements, fix the entitlement. Do not build fallback infrastructure for a testnet.

### Anti-Pattern 3: Class Hierarchies for Executors
**What:** Creating BaseExecutor, DepositExecutor, WithdrawalExecutor, OrderExecutor classes.
**Why bad:** The three executor types share 95% of their logic (read struct, get tokens, build oracle params, submit tx, wait receipt). The only difference is the handler address, ABI, function name, and how tokens are extracted from the struct. A single `executeItem()` function with a switch on type handles this cleanly.
**Instead:** One function, three branches.

### Anti-Pattern 4: Complex Reconnection Logic
**What:** Building WebSocket reconnection orchestration with backfill, block tracking, and state recovery.
**Why bad:** viem's WebSocket transport already handles reconnection (configured with `reconnect: { attempts: Infinity, delay: 2_000 }`). The 15s polling safety net catches anything missed during reconnection gaps. The old EventListener's backfill logic (reading from a database-persisted block number) was necessary because there was no polling fallback -- now there is.
**Instead:** Let viem handle reconnection. If events are missed, the poll catches them within 15s.

## Suggested Build Order

The build order is dictated by dependency chains. Each task depends on the one before it.

### Phase 1: Project Reset (Task 1)
**What:** Clean out old source files, update package.json, install reduced dependencies.
**Dependencies:** None.
**Risk:** Low -- git history preserves everything.
**Deliverable:** Clean project skeleton that compiles.

### Phase 2: Config + Constants (Task 2)
**What:** Create `config.ts`, `keys.ts`, `abis.ts`.
**Dependencies:** Package.json from Task 1 (viem must be installed for key computation and ABI types).
**Risk:** Low -- these are direct ports from the existing codebase with simplification.
**Deliverable:** All configuration and ABI constants compile.

### Phase 3: Oracle Module (Task 3)
**What:** Create `oracle.ts` with Pyth Lazer WebSocket cache.
**Dependencies:** Config from Task 2 (needs `pythProAccessToken` and `pythLazerFeedProviderAddress`).
**Risk:** Medium -- the Pyth Lazer SDK WebSocket connection is the most fragile external dependency. Test locally before deploying.
**Deliverable:** Oracle module compiles and exports `startOracle()`, `buildOracleParams()`, `hasCachedPrice()`.

### Phase 4: Main Keeper Logic (Task 4)
**What:** Create `index.ts` with event watcher, poller, executor, health endpoint.
**Dependencies:** All of Tasks 1-3 (config, keys, ABIs, oracle).
**Risk:** Medium -- this is the core logic. The execution path (read struct -> build oracle params -> submit tx -> wait receipt) must be tested end-to-end.
**Critical ordering within this task:**
1. Event watcher (can be tested independently by watching EventEmitter logs)
2. Polling (can be tested independently by reading DataStore)
3. Executor (requires oracle to be connected, end-to-end test)
4. Health endpoint (trivial, test last)

### Phase 5: Dockerfile + Docker Compose (Task 5)
**What:** Simplified Dockerfile (no Prisma), updated docker-compose.yml.
**Dependencies:** All source code from Tasks 1-4.
**Risk:** Low -- straightforward Docker changes.
**Critical:** Add `WS_RPC_URL` to docker-compose.yml environment block.

### Phase 6: Deploy + End-to-End Test (Task 6)
**What:** Push to server, rebuild Docker, verify all operation types.
**Dependencies:** Everything.
**Risk:** High -- this is where integration issues surface.
**Test sequence:**
1. Check logs for clean startup (no crashes, oracle connected)
2. Submit a deposit on frontend -> verify keeper executes it
3. Submit a withdrawal -> verify keeper executes it
4. Submit a market order -> verify keeper executes it

## Rollback Plan

If the new keeper fails in production:

```bash
# On the server
cd /opt/0xmarkets/order-execution-keeper-service
git checkout <previous-commit-hash>
cd /opt/0xmarkets
docker compose build order-execution-keeper
docker compose up -d order-execution-keeper
```

The old code (with its database dependency) will still work because:
- The postgres container is still running
- The `order_execution_keeper` database still exists with its schema and data
- The old Dockerfile includes `pnpm db:migrate:deploy` which is idempotent

## Scalability Considerations

| Concern | Current (testnet) | At 100 users | At 1M users |
|---------|-------------------|--------------|-------------|
| Operation throughput | ~1 op/min | ~10 ops/min | Needs parallel keepers |
| Nonce management | Single wallet, sequential | Still fine | Multiple keeper wallets |
| Oracle freshness | 200ms Lazer updates | Still fine | Still fine |
| Queue depth | 0-3 items typical | 10-50 items | Needs priority queue |
| Memory | ~50MB | ~50MB | ~50MB (in-memory queue) |

For testnet with fewer than 10 concurrent users, the minimal keeper is appropriate. The sequential execution model becomes a bottleneck only at high throughput, which is a mainnet concern, not a testnet concern.

## Sources

- Direct codebase analysis of:
  - `/Users/ken/Projects/0xM/docker-compose.yml` (root Docker Compose)
  - `/Users/ken/Projects/0xM/order-execution-keeper-service/` (current keeper, all source files)
  - `/Users/ken/Projects/0xM/keeper-service/` (keeper that stays)
  - `/Users/ken/Projects/0xM/init-db.sql` (database initialization)
  - `/Users/ken/Projects/0xM/order-execution-keeper-service/docs/plans/` (existing design docs)
- Confidence: HIGH -- all integration points verified by reading actual source code and configuration files
