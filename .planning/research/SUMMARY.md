# Project Research Summary

**Project:** 0xMarkets Order Execution Keeper — Minimal Rewrite (v1.5)
**Domain:** DeFi order execution keeper for a GMX-fork perpetual futures protocol
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

The existing order-execution-keeper-service is a 3,000+ line system built iteratively across v1.0–v1.4, accumulating a PostgreSQL/Prisma layer, six scanner/executor classes, a TransactionMonitor, and an ExecutionQueue with TTL/retry machinery. Research confirms that this entire structure is unnecessary complexity: the on-chain DataStore is already the authoritative record of pending operations, sequential single-wallet execution eliminates nonce contention, and inline `waitForTransactionReceipt` replaces the TransactionMonitor. The rewrite target is a ~300-line single-loop keeper using the same proven viem, Pyth Lazer, and pino dependencies already in use — with Hermes HTTP as the oracle source (pending a one-time on-chain oracle provider update per token), or Pyth Lazer WebSocket as the fallback if that update proves blocked.

The recommended approach is a clean-slate rewrite in a fixed phase sequence driven by hard dependencies: project skeleton first, then config/constants (viem types needed), then the oracle module (most fragile external dependency, must be isolated and tested standalone), then the main keeper loop, and finally Docker/deployment. Each phase produces a verifiable artifact before the next begins. The rewrite is a straightforward "do it all in one pass" — not a phased rollout — because all table stakes features are needed from day one for the keeper to be useful.

The key risks are all well-documented from production incidents in v1.0–v1.4 and are preventable by copying proven patterns from the existing codebase rather than rewriting them from scratch. Nonce management, oracle cache TTL, DataStore key encoding (encodeAbiParameters not encodePacked), and WebSocket transport type verification are four patterns that MUST be preserved verbatim. The research identifies exactly which source files contain the correct implementations, reducing risk to near zero if those patterns are ported faithfully.

---

## Key Findings

### Recommended Stack

The stack is essentially the same as the current keeper — just with fewer dependencies. TypeScript 5.9.3 on Node 22 (Docker: `node:22-slim`), viem ^2.44.4, pino ^10.3.1, express ^5.1.0, and dotenv ^17.2.3 are all retained. The critical version constraint is Pyth: `@pythnetwork/hermes-client` must stay at ^2.1.0 (v3.x requires Node ^24), and if Option B Lazer is used, `@pythnetwork/pyth-lazer-sdk` must be pinned exactly to `5.2.0` (v5.2.1+ declares Node ^24 engine). Do NOT upgrade to Node 24 — the Docker infra is pinned to `node:22-slim` and that is a separate infrastructure task.

The `tsx` dev runner replaces `ts-node + nodemon`. The entire Prisma/PostgreSQL stack (`@prisma/client`, `@prisma/adapter-pg`, `pg`) is removed. The dev experience simplifies to `tsx watch src/index.ts`.

**Core technologies:**
- **TypeScript ^5.9.3 + Node 22:** Language and runtime — already used across all 0xMarkets services, no change
- **viem ^2.44.4:** Ethereum RPC, event watching, TX submission — current installed version, no breaking changes in 2.x for the APIs used
- **@pythnetwork/hermes-client ^2.1.0:** Oracle price fetches via HTTP — recommended primary oracle (Option A); eliminates WebSocket management overhead; requires one-time on-chain provider update
- **@pythnetwork/pyth-lazer-sdk 5.2.0 (pinned exactly):** Lazer WebSocket oracle cache — fallback if Hermes oracle provider update is blocked (Option B); must NOT upgrade to 5.2.1+ (Node ^24 engine constraint)
- **express ^5.1.0:** Single `/health` route — already in use, kept for monitoring compatibility
- **pino ^10.3.1:** Structured JSON logging — standard across all keeper services for BetterStack observability
- **tsx ^4.21.0:** Dev runner — replaces ts-node + nodemon, esbuild-based, zero config
- **Removed:** `@prisma/client`, `@prisma/adapter-pg`, `pg`, `nodemon`, `ts-node`, `@pythnetwork/pyth-evm-js`

### Expected Features

The keeper must deliver all table stakes features in a single shipment — this is a rewrite, not a phased feature rollout. Research identified 9 table stakes features, 3 differentiators worth keeping (they add ~50 lines collectively), and a clear list of anti-features that caused the existing 3,000+ line bloat.

**Must have (table stakes):**
- **EventEmitter WebSocket watcher** — primary detection path; without it all operations have 15s+ latency
- **DataStore polling safety net (15s)** — full-list scan of DEPOSIT_LIST / WITHDRAWAL_LIST / ORDER_LIST; covers missed events and restart recovery
- **Sequential single-consumer execution loop** — single wallet means single nonce; parallelism causes irreversible nonce gaps
- **In-memory dedup Set** — prevents double-execution from event+poll detection overlap
- **Pyth oracle integration (Lazer cache or Hermes HTTP)** — prices must be bundled with every execution call
- **Per-token oracle routing** — crypto vs. FX tokens may use different oracle providers on-chain
- **Fixed gas limit (2M, skip estimateGas)** — saves RPC round-trip, proven sufficient for all handler contracts
- **Nonce-aware TX submission with 3 retries** — manual `getTransactionCount({ blockTag: "pending" })` pattern; do NOT use viem's nonceManager
- **Health endpoint for BetterStack** — `/health` returns JSON with HTTP 200; required for monitoring

**Should have (differentiators — worth ~50 extra lines):**
- **Startup oracle provider + feed entitlement verification** — catches misconfiguration immediately instead of producing hours of silent failures
- **Expired request cancellation (periodic)** — returns stuck user funds when deposits exceed on-chain expiration time
- **Execution timing instrumentation** — per-stage latency logging via `performance.now()`, zero runtime cost, proven valuable for diagnostics

**Defer (not needed for v1.5):**
- Database-backed execution history — on-chain DataStore and structured logs serve this purpose
- Block number persistence — full-list DataStore scan on startup handles restart recovery
- Pre-fetched operation data passthrough — one extra RPC call at execution time is negligible at testnet volume
- Per-type scanner/executor class hierarchies — a single parameterized function replaces ~1,200 lines
- Transaction monitoring — inline `waitForTransactionReceipt` handles this
- Multiple WebSocket pool connections (reduce 4 → 1) — testnet volume does not require redundancy
- Feature flags per operation type — not needed when all three types are always enabled

**Anti-features to explicitly delete (primary sources of the 3,000+ line count):**
PostgreSQL/Prisma stack (6 models, 148-line schema), TransactionMonitor (240 lines), ExecutionQueue class (151 lines), BaseExecutor/Scanner class hierarchies (~1,200 lines across 6 files), EventListener with DB-persisted block numbers (326 lines), separate HTTP server with controllers (~200 lines), configurable feature flags.

### Architecture Approach

The new keeper is a flat, ~5-file TypeScript project running as a single Docker container with no database dependency. The postgres container continues running for keeper-service (port 37017) only. The execution keeper (port 37018) connects to: Pyth Lazer WebSocket or Hermes HTTP (price data), Base Sepolia RPC/WebSocket (chain reads + event watching), and EventEmitter/DataStore/Reader/Handler contracts (the on-chain protocol). Data flows from user action → on-chain event OR DataStore poll → in-memory dedup Set → sequential executor loop → oracle params build → handler contract call → confirmation log.

**New components (created from scratch):**
1. **`config.ts` (~30 lines):** Env var loading with required/optional helpers — replaces 150-line config with feature flags
2. **`keys.ts` (~15 lines):** DataStore key constants using `keccak256(encodeAbiParameters(...))` — MUST be ported verbatim from existing keys.ts
3. **`abis.ts` (~180 lines):** Consolidated contract ABIs — replaces scattered ABI files across 6 directories
4. **`oracle.ts` (~50 lines):** Pyth oracle integration with cache TTL — replaces 500-line dual-oracle module
5. **`index.ts` (~250 lines):** Event watcher, safety-net poller, sequential executor, health endpoint — replaces entire scanner/executor/queue/listener/monitor hierarchy

**Patterns to follow:** Inline functions (no class hierarchies), plain `Array<QueueItem>` as queue with `Set<Hex>` for dedup, on-chain DataStore as sole source of truth, fail-fast with structured error logging.

**Deleted:** `src/core/scanners/`, `src/core/executors/`, `src/core/queue/`, `src/core/listeners/`, `src/core/monitor/`, `src/core/oracle/`, `src/core/blockchain/`, `src/server/`, `prisma/`, `src/utils/healthState.ts`, `src/utils/latencyTracker.ts`

### Critical Pitfalls

1. **Nonce gap via viem nonceManager** — viem's `createNonceManager` increments the nonce before TX submission; if gas estimation fails, the nonce is consumed but no TX exists on-chain, blocking all subsequent transactions forever. Prevention: do NOT use `createNonceManager`. Use manual `getTransactionCount({ blockTag: "pending" })` per attempt; retry with fresh nonce fetch on nonce errors. Port `submitTransaction()` from `baseExecutor.ts` verbatim.

2. **Stale Pyth Lazer cache (MaxPriceAgeExceeded)** — the cache has no TTL; when WebSocket disconnects, stale prices remain in the Map; on-chain contracts reject prices older than 300s. Prevention: add TTL check — reject cache entries older than 270s (300s MAX_ORACLE_PRICE_AGE minus 30s safety margin); set `oracleStale = true` immediately when `allConnectionsDownListener` fires.

3. **WebSocket event subscription silently falling back to HTTP polling** — wrapping `webSocket()` in `fallback([webSocket(), http()])` produces `transport.type === "fallback"`, which polls via HTTP instead of subscribing via WebSocket. Prevention: create a separate WebSocket-only client; assert `transport.type === "webSocket"` after creation; if wrong type, fail explicitly. Source: `client.ts` (documented production pitfall).

4. **DataStore key encoding mismatch** — Solidity `abi.encode` produces different bytes than viem `encodePacked`; using the wrong function silently returns zero values from DataStore with no error. Prevention: use `encodeAbiParameters([{ type: 'string' }], ['DEPOSIT_LIST'])` — never `encodePacked`. Port `keys.ts` verbatim. Source: existing `keys.ts` + project MEMORY.md.

5. **In-flight queue loss on restart** — removing the database only works if every poll cycle reads the FULL DataStore pending key lists (not just new events). Prevention: on startup, immediately scan all three DataStore lists before entering the event-driven loop; every 15s safety-net poll re-reads full lists; events are a speed optimization, not the recovery mechanism.

---

## Implications for Roadmap

Based on research, the rewrite follows a strict dependency-driven build order. Each phase has a hard dependency on all prior phases. This is not iterative feature delivery — it is a single-pass rewrite that must be functionally complete before deployment.

### Phase 1: Project Reset and Core Infrastructure

**Rationale:** All subsequent work depends on a clean project skeleton with correct dependencies installed and foundational constants (config, keys, ABIs) that every other module imports. viem types are needed to write `oracle.ts` and `index.ts`. This phase is entirely subtractive (remove Prisma) and additive with direct ports (tsx, keys, ABIs).

**Delivers:** Clean TypeScript project that compiles; `pnpm dev` starts without errors; all contract addresses, ABI definitions, and DataStore key constants are correct and verified against live chain.

**Addresses:** Foundation for all table stakes features — EventEmitter watcher, DataStore poller, health endpoint all depend on ABIs and config being correct.

**Avoids:**
- DataStore key encoding mismatch (port `keys.ts` exactly; verify at startup with a live `getBytes32Count` call)
- Oracle provider mismatch (startup verification reads on-chain `oracleProviderForToken` for all tokens)
- WebSocket transport type bug (create WebSocket client with type assertion from the start)

**Includes:** Updated `package.json` (Prisma removed, tsx added), `config.ts`, `keys.ts`, `abis.ts`, simplified `tsconfig.json`

### Phase 2: Oracle Module

**Rationale:** The oracle is the most fragile external dependency and the source of two of the most severe production incidents (MaxPriceAgeExceeded, InvalidOracleProvider). Isolating it as a separate phase lets it be tested standalone before the execution logic depends on it. If the Hermes oracle provider update (Option A) proves blocked, the fallback path (Option B Lazer) is decided here without touching the execution logic.

**Delivers:** `oracle.ts` exporting `startOracle()`, `buildOracleParams(tokens)`, `hasCachedPrice()`, `isOracleStale()`. Oracle connects, populates cache, and rejects stale entries (>270s). Startup entitlement verification passes for all 6 configured markets.

**Addresses:** Per-token oracle routing (crypto vs. FX), startup feed entitlement verification, oracle stale detection.

**Avoids:**
- Stale cache causing MaxPriceAgeExceeded (TTL on cache entries, `oracleStale` flag)
- Pyth Lazer reconnection storm (set `maxRetryDelayMs: 30000`, log FATAL if all connections down >60s)
- Oracle provider address mismatch (startup check compares on-chain mapping vs. configured provider)

**Uses:** `@pythnetwork/hermes-client ^2.1.0` (Option A primary) or `@pythnetwork/pyth-lazer-sdk@5.2.0` (Option B fallback)

**Gate before starting:** Confirm whether the on-chain `oracleProviderForToken` admin update is feasible (deployer wallet availability). This determines Option A vs. Option B.

### Phase 3: Main Keeper Logic

**Rationale:** All dependencies are available (config, constants, ABIs, oracle). This phase implements the complete execution path: event watcher, DataStore poller, sequential executor, health endpoint, graceful shutdown. This is the bulk of the rewrite and the phase where the ~300 line target is validated.

**Delivers:** Fully functional keeper in `index.ts`. Event watcher detects operations in real time (<1s). Poller catches missed events every 15s. Executor processes one item at a time. Health endpoint returns `{"status":"ok",...}` at `/health`. Graceful shutdown completes in-flight TX before exit.

**Addresses:** All 9 table stakes features plus 3 differentiators (startup verification, expired request cancellation, timing instrumentation).

**Avoids:**
- Nonce gap (manual `getTransactionCount`, no viem nonceManager)
- Queue loss on restart (startup performs full DataStore scan before entering event loop)
- Ghost deposit infinite retry (in-memory `ignoredKeys` Set with TTL)
- `waitForTransactionReceipt` blocking (use 15–20s timeout; Base Sepolia with Flashblocks confirms in <2s normally)

**Critical implementation order within this phase:**
1. Event watcher (test independently by watching EventEmitter logs)
2. DataStore poller (test independently by reading DataStore count)
3. Executor (requires oracle connected — test end-to-end)
4. Health endpoint (trivial, add last)

### Phase 4: Docker and Deployment

**Rationale:** Deployment changes are isolated to avoid contaminating the source code phase. Docker changes are low-risk but the deployment procedure must explicitly prevent the "duplicate keeper" pitfall where both old and new containers run simultaneously with the same private key.

**Delivers:** Simplified Dockerfile (no Prisma, no OpenSSL, `start-period: 30s` not 120s), updated `docker-compose.yml` (no `depends_on: postgres`, `WS_RPC_URL` added to environment block, unused env vars removed), explicit deployment runbook with stop-then-start procedure.

**Avoids:**
- Duplicate keeper during restart window (explicit `docker compose stop order-execution-keeper && docker compose up -d --build order-execution-keeper`)
- Missing `WS_RPC_URL` in container (it exists in local `.env` but was never in `docker-compose.yml`)
- Rollback blocked (postgres container and `order_execution_keeper` DB remain intact — git checkout + rebuild restores old keeper)

### Phase 5: End-to-End Verification

**Rationale:** Integration issues surface only with a live chain. Each operation type must be tested individually because FX markets (EUR, GBP, GOLD, JPY) historically fail with oracle errors even when ETH/BTC work.

**Delivers:** Verified keeper executing all 6 market types (ETH, BTC, EUR, GBP, GOLD, JPY) for all 3 operation types (deposit, withdrawal, market order). All 8 items in the PITFALLS.md "Looks Done But Isn't" checklist pass.

**Test sequence (do not skip any step):**
1. Clean startup logs — no crashes, oracle connected, entitlement verification passed
2. Deposit on frontend → keeper picks up and executes within 30s
3. Withdrawal → executes
4. Market order → executes
5. Kill keeper → restart → pre-existing pending deposit executes (restart recovery test)
6. All 6 market types verified individually (do not assume ETH success = FX success)
7. Docker health check passes without manual intervention

### Phase Ordering Rationale

- **Foundation before logic:** config/keys/ABIs must compile before oracle.ts can import viem types; oracle must connect before executor can build oracle params
- **External dependency isolation:** the oracle is the most likely failure point (Pyth connectivity, token expiry, provider mismatch); isolating it in Phase 2 means Phase 3 starts with a known-good, tested oracle
- **Source before Docker:** the Dockerfile builds from source — Docker changes must follow source changes to avoid circular dependency
- **Incremental verification:** each phase produces a testable artifact, reducing the risk that Phase 5 reveals a fundamental design error requiring a Phase 3 rewrite

### Research Flags

**Standard patterns — implement directly without additional research:**
- **Phase 1 (Project Reset):** All changes are subtractive (removing Prisma) or replacements for known-equivalent tools (tsx for ts-node). Port constants verbatim.
- **Phase 4 (Docker):** Docker Compose patterns are standard. Changes are primarily subtractive. One critical addition (`WS_RPC_URL`) is fully documented.
- **Phase 5 (Verification):** The test procedure is explicit in PITFALLS.md "Looks Done But Isn't" checklist — use it as a literal acceptance checklist.

**Phases requiring careful implementation judgment (not external research, but close attention):**
- **Phase 2 (Oracle):** The oracle provider choice (Option A Hermes vs. Option B Lazer) is unresolved — it depends on whether the on-chain admin transaction to update `oracleProviderForToken` is feasible. Verify this before starting Phase 2.
- **Phase 3 (Main Loop):** Ghost deposit handling, TTL eviction, and nonce recovery paths have subtle edge cases. Reference `executionQueue.ts` and `baseExecutor.ts` implementations during coding; do not invent new patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm registry; version constraints validated by downloading and inspecting `package.json` engine fields of candidate versions. No ambiguity. |
| Features | HIGH | Direct codebase analysis of all 3,000+ lines of existing keeper. Feature inventory is exhaustive. GMX keeper model cross-referenced against GMX synthetics README and Chainlink Automation patterns. |
| Architecture | HIGH | All integration points verified by reading actual source files: `docker-compose.yml`, `Dockerfile`, all keeper source, `init-db.sql`. No inferred integration points. |
| Pitfalls | HIGH | 7 of 10 pitfalls derive from documented production incidents (MaxPriceAgeExceeded, InvalidOracleProvider, nonce conflicts, ghost deposits, WebSocket fallback). 3 derive from verified library documentation (viem issue #3142). |

**Overall confidence:** HIGH

### Gaps to Address

- **Oracle provider update feasibility:** STACK.md recommends Option A (Hermes HTTP) but it requires an admin transaction per token to update `oracleProviderForToken` in the on-chain DataStore. If the deployer wallet is unavailable, Option B (Lazer) becomes the only path. Confirm oracle provider update feasibility before starting Phase 2 to avoid mid-phase pivot.

- **`WS_RPC_URL` value in production:** Architecture research confirmed this env var is missing from docker-compose.yml but present in the local `.env`. The value on the production droplet must be verified before Phase 4 deploys. If it was never set in production, the event watcher will fail to start silently.

- **Pyth Lazer access token expiry date:** PITFALLS.md flags token expiry as a reconnection storm risk. The current token expiry date is not documented in the codebase. Verify the expiry date and set a calendar reminder before deploying the rewrite.

- **feedUpdateTimestamp vs. Date.now():** PITFALLS.md identifies using `Date.now()` for oracle cache timestamps as "never acceptable" (clock skew causes MaxPriceAgeExceeded). The rewrite's `oracle.ts` must use `feedUpdateTimestamp` from the Pyth Lazer response. Confirm the Lazer SDK surfaces this property in the version being used (it was added to `PriceFeedProperty` in the 5.2.0 API diff).

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)

- `order-execution-keeper-service/src/` — all scanner, executor, queue, listener, monitor, oracle, config, and blockchain client code read in full
- `/Users/ken/Projects/0xM/docker-compose.yml` — all service definitions, environment blocks, dependencies
- `/Users/ken/Projects/0xM/order-execution-keeper-service/Dockerfile` — current Docker setup (node:22-slim, prisma steps, health check timing)
- `/Users/ken/Projects/0xM/init-db.sql` — database initialization confirming both databases remain safe to keep
- `order-execution-keeper-service/docs/plans/2026-02-25-minimal-keeper-rewrite-design.md` — approved architecture and oracle choice rationale
- `.planning/PROJECT.md` — documented production incidents (MaxPriceAgeExceeded, InvalidOracleProvider, nonce conflicts, ghost deposits)
- npm registry: tarball inspection of `@pythnetwork/pyth-lazer-sdk` versions 5.2.0, 5.2.1, 6.0.0 — engine field and API diffs confirmed identical client interface
- npm registry: `@pythnetwork/hermes-client` versions 2.1.0, 3.1.0 — engine field comparison

### Secondary (MEDIUM confidence — official documentation)

- [GMX Synthetics README](https://github.com/gmx-io/gmx-synthetics/blob/main/README.md) — two-step execution model, keeper responsibilities
- [Cyfrin/chainlink-gmx-automation](https://github.com/Cyfrin/chainlink-gmx-automation) — reference GMX keeper implementation
- [viem Releases](https://github.com/wevm/viem/releases) — no breaking changes between v2.40–v2.46 for watchEvent, writeContract, waitForTransactionReceipt
- [viem issue #3142](https://github.com/wevm/viem/issues/3142) — nonceManager gap on failed estimateGas
- [Pyth Developer Hub](https://docs.pyth.network/price-feeds/pro/getting-started) — Lazer SDK API, Hermes HTTP patterns
- [Chainlink Automation Best Practices](https://docs.chain.link/chainlink-automation/concepts/best-practice) — checkUpkeep/performUpkeep pattern (analogous to scan/execute)

### Tertiary (LOW confidence)

- Docker Compose stop/start behavior during `docker compose up -d --build` — documented against Docker docs but exact behavior may vary by Docker version in production

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
