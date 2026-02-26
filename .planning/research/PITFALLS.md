# Pitfalls Research

**Domain:** Minimal keeper rewrite -- replacing 3,000+ line order-execution-keeper with ~300 line single-loop keeper
**Researched:** 2026-02-25
**Confidence:** HIGH (based on actual codebase analysis, known production incidents, and verified library documentation)

---

## Critical Pitfalls

### Pitfall 1: Nonce Gap on Failed estimateGas / Pre-Send Revert

**What goes wrong:**
Viem's `nonceManager` (introduced in v2.15.0) increments the nonce atomically BEFORE the transaction is submitted. If `writeContract` fails during gas estimation (before the TX hits the mempool), the nonce is consumed but no transaction exists on-chain for that nonce. All subsequent transactions queue behind the gap forever. The current keeper already encountered this -- it uses a manual `getTransactionCount({ blockTag: "pending" })` call per attempt instead of the built-in nonceManager specifically to avoid this.

**Why it happens:**
The natural reflex when rewriting is to use viem's built-in `createNonceManager` since it was designed for exactly this use case. But viem issue #3142 documented that the nonce increments even when `estimateGas` fails, creating an unrecoverable gap. The fix (PR #3153) was merged, but only for the case where `prepareTransactionRequest` throws. If the transaction reverts at the RPC level (not estimateGas), the gap can still occur depending on the error path.

**How to avoid:**
Do NOT use viem's built-in `createNonceManager` for the minimal keeper. Instead, use the proven pattern from the current `baseExecutor.ts`: fetch nonce via `getTransactionCount({ blockTag: "pending" })` before each transaction, pass it explicitly, and retry with a fresh nonce fetch on `nonce too low` / `replacement transaction underpriced` errors. The sequential execution guarantee (single consumer loop + txMutex) means we never need parallel nonce management.

**Warning signs:**
- Transactions hang indefinitely after a single revert
- Logs show "nonce too low" errors that don't self-heal
- Health check shows items stuck in processing state

**Phase to address:**
Phase 1 (Core Architecture) -- the transaction submission function must be implemented correctly from day one. No recovery path exists once nonce gaps occur in production.

---

### Pitfall 2: Stale Pyth Lazer Cache After Silent WebSocket Disconnect

**What goes wrong:**
The Pyth Lazer WebSocket pool maintains 4 redundant connections. When ALL connections drop simultaneously (network blip, Pyth server maintenance, token expiry), the `updateCache` Map still holds the last received price data. The keeper reads "valid" cached data, includes it in oracle params, and submits the transaction. The on-chain contract checks `MAX_ORACLE_PRICE_AGE` (300 seconds) and reverts with `MaxPriceAgeExceeded` (or `0x5c0e53f0`). This is not hypothetical -- it was a production issue documented in `PROJECT.md` as a known issue.

**Why it happens:**
The cache has no TTL. `getLatestUpdate()` returns whatever is stored, regardless of age. The `allConnectionsDownListener` fires a log message but does not invalidate the cache or set a flag that prevents execution. The existing keeper's `handlePriceUpdate` sets `timestamp: BigInt(Math.floor(Date.now() / 1000))` using local time, NOT the Pyth-provided timestamp, so even the timestamp is unreliable for staleness detection.

**How to avoid:**
1. Add a TTL check in `getLatestUpdate()` -- if the cached entry is older than `MAX_ORACLE_PRICE_AGE - SAFETY_MARGIN` (e.g., 300s - 30s = 270s), return `undefined` and force fallback or skip execution.
2. Use Pyth's recommended `feedUpdateTimestamp` property (add it to the subscription `properties` array) instead of `Date.now()` for the timestamp. This tells you whether the price was freshly generated or carried forward.
3. Track a `lastUpdateReceived` timestamp that resets on every WebSocket message. If no message for >10s, set an `oracleStale` flag that blocks execution.
4. When `allConnectionsDownListener` fires, immediately set `oracleStale = true` and clear or mark the cache.

**Warning signs:**
- Oracle build times drop to 0ms (reading from stale cache, no WS messages)
- Executions revert with `MaxPriceAgeExceeded` in bursts
- Health endpoint shows `oracleConnected: true` but no new prices for minutes

**Phase to address:**
Phase 1 (Core Architecture) -- the oracle cache design must include TTL from the start. Retrofitting TTL after deployment means a period of silent price staleness.

---

### Pitfall 3: Losing In-Flight Queue Items on Docker Restart

**What goes wrong:**
The current keeper persists `lastProcessedBlock` to PostgreSQL and uses it to backfill missed events on restart (DETECT-03 pattern). The minimal rewrite removes the database. If the keeper restarts (Docker restart, OOM kill, crash), the in-memory queue and the `lastProcessedBlock` are both lost. Without a backfill mechanism, any events that arrived between the crash and restart are permanently missed. Those deposits/withdrawals/orders sit on-chain forever, unexecuted.

**Why it happens:**
The appeal of "no database" is simplicity -- the on-chain DataStore IS the source of truth for pending operations. The mistake is assuming that polling the DataStore on startup catches everything. It does, IF the polling scan reads the full pending list. But if the scan only reads new events (like the current event-based detection), items created during downtime are invisible.

**How to avoid:**
The "no database" design works ONLY if every scan cycle reads the full pending operation list from on-chain DataStore (deposit keys, withdrawal keys, order keys), not just new events. The scan-based safety net at 15s intervals already does this in the current keeper via `depositScanner.scan()` which reads `DEPOSIT_LIST` from DataStore. The minimal rewrite MUST preserve this full-list scan pattern.

Specifically:
1. On startup, immediately scan ALL pending keys from DataStore (deposit list, withdrawal list, order list)
2. Every safety-net poll cycle, re-scan the full lists (not just listen for new events)
3. Event-based detection is an optimization for speed, not the source of truth
4. No need to persist block numbers -- the DataStore pending lists ARE the recovery mechanism

**Warning signs:**
- After restart, known pending deposits are not picked up
- Users report deposits stuck after keeper downtime
- Health endpoint shows 0 pending items when frontend shows pending operations

**Phase to address:**
Phase 1 (Core Architecture) -- the scan loop must be designed as full-list-scan from the start. Switching from event-only to full-scan later requires rethinking the entire detection model.

---

### Pitfall 4: Ghost Deposits Create Infinite Retry Loops Without DB State

**What goes wrong:**
A "ghost deposit" is a key that exists in the DataStore's `DEPOSIT_LIST` but has zeroed data on-chain (account = 0x0, amounts = 0). These occur when a deposit is cancelled or already executed but the key cleanup is delayed. The current keeper detects ghosts by reading the full deposit struct and checking `account === ZERO_ADDRESS`, then marks them CANCELLED in the database so they are never retried. Without the database, the keeper has no memory that a key was already classified as a ghost. Every 15-second scan cycle rediscovers the ghost, tries to execute it, reads the zeroed data, skips it... then rediscovers it again next cycle. This is not a crash risk but it is wasted RPC calls and log noise.

**Why it happens:**
The on-chain DataStore key list is eventually consistent -- keys may linger after the operation data is cleared. The database served as "I already looked at this and it's dead" memory. Without it, there is no dedup across restarts.

**How to avoid:**
Use the existing `allKnown` Set from the `ExecutionQueue` pattern. When a ghost is detected (zeroed account), add it to an in-memory `ignoredKeys` set with a TTL. This prevents re-reading the same ghost every cycle. On restart, the ghost will be re-evaluated once (cheap -- one RPC read), classified as ghost again, and re-added to the ignore set. This is acceptable overhead.

Additionally, add a `MIN_DEPOSIT_AMOUNT` check -- if both `initialLongTokenAmount` and `initialShortTokenAmount` are 0, skip without even fetching the full deposit struct.

**Warning signs:**
- Logs show repeated "deposit is stale (zeroed on-chain) -- skipping" for the same key
- RPC call count is disproportionately high relative to actual pending operations
- Scan cycle duration increases linearly with ghost count

**Phase to address:**
Phase 2 (Executor Implementation) -- ghost detection is part of the execution path, not the core architecture.

---

### Pitfall 5: Docker Deployment Creates Duplicate Keeper During Restart Window

**What goes wrong:**
`docker compose up -d --build order-execution-keeper` rebuilds the image and recreates the container. Docker's default behavior with `restart: unless-stopped` means the OLD container runs until the NEW one is ready. During this overlap window (10-30 seconds for image build, startup, Pyth connection), both keepers are running with the SAME private key. Both detect the same pending operations. Both try to submit transactions. Result: nonce conflicts, "replacement transaction underpriced" errors, doubled gas costs, and potential double-execution if timing aligns.

**Why it happens:**
Docker Compose does not implement blue-green deployment by default. `docker compose up -d` stops the old container THEN starts the new one (brief downtime). But with complex health checks and startup delays, the exact ordering depends on Docker version and configuration. The real danger is when using `docker compose up -d --scale order-execution-keeper=2` accidentally, or when the old container's shutdown takes longer than expected due to `waitForTransactionReceipt` blocking.

**How to avoid:**
1. Explicitly stop the old container before starting the new one: `docker compose stop order-execution-keeper && docker compose up -d --build order-execution-keeper`
2. Add a SIGTERM handler that sets `shuttingDown = true` immediately, drains the current execution (waits for `waitForTransactionReceipt` to finish), then exits. The current keeper already has this pattern.
3. Set `stop_grace_period: 120s` in docker-compose.yml to give the keeper time to finish in-flight transactions before Docker sends SIGKILL.
4. Never use `--scale` for the keeper -- it MUST be a singleton.
5. Consider a startup lock: on boot, read the pending nonce. If it doesn't match `getTransactionCount({ blockTag: "latest" })`, there may be a pending TX from the old instance. Wait for it to confirm before starting execution.

**Warning signs:**
- Nonce errors spike immediately after deployment
- Two containers with the same image appear in `docker ps` briefly
- Transactions appear to execute twice (double gas charges)

**Phase to address:**
Phase 3 (Docker Deployment) -- must be addressed as part of the deployment procedure, not afterthought.

---

### Pitfall 6: WebSocket Event Subscription Silently Falls Back to HTTP Polling

**What goes wrong:**
Viem's `createPublicClient` with a `fallback([webSocket(), http()])` transport produces a transport with `type: "fallback"`, NOT `type: "webSocket"`. When `watchContractEvent` (or `watchEvent`) is called on this client, it silently degrades to HTTP polling instead of using WebSocket subscriptions. The keeper appears to work but detects events at poll intervals (seconds) instead of real-time (milliseconds).

**Why it happens:**
This is a known viem footgun (documented in the current codebase's `client.ts` comments referencing "viem issue #776"). The natural instinct when building a resilient client is to wrap WebSocket in a fallback -- but this defeats the purpose of WebSocket entirely.

**How to avoid:**
The current keeper's `getWsPublicClient()` already implements the correct pattern: create a SEPARATE WebSocket-only client (no fallback transport), and verify `transport.type === "webSocket"` after creation. If it's not "webSocket", return null and fall back to poll-only mode explicitly. The minimal rewrite must preserve this pattern:
1. Create HTTP client for reads and transaction submission
2. Create separate WebSocket client for event watching ONLY
3. Verify transport type after creation
4. If WebSocket unavailable, degrade to poll-only with a clear log warning

**Warning signs:**
- Event detection latency is 2-4 seconds instead of <500ms
- Logs show no WebSocket subscription confirmation message
- `transport.type` is "fallback" or "http" instead of "webSocket"

**Phase to address:**
Phase 1 (Core Architecture) -- client setup is the first thing built.

---

### Pitfall 7: Oracle Provider Address Mismatch With On-Chain Config

**What goes wrong:**
The on-chain `DataStore` has a mapping `ORACLE_PROVIDER_FOR_TOKEN` that maps each token address to its authorized oracle provider contract. If the keeper passes oracle data signed for the wrong provider (e.g., Pyth Hermes data to a token configured for Pyth Lazer, or vice versa), the execution reverts with `InvalidOracleProvider (0x05d102a2)`. This was a production-blocking bug that required v1.4 to fully resolve with per-token oracle routing.

**Why it happens:**
During the rewrite, it is tempting to simplify oracle handling by assuming all tokens use the same provider (e.g., all Lazer). But the on-chain config may have some tokens set to Hermes and others to Lazer, especially for FX tokens that lack Lazer entitlements. The current system has a complex per-token routing system (`isTokenLazerEntitled` + Hermes fallback) that must be preserved or simplified correctly.

**How to avoid:**
1. At startup, verify oracle provider consistency using `verifyOracleProviderConsistency()` -- read the on-chain `ORACLE_PROVIDER_FOR_TOKEN` for every configured token and compare against the keeper's configured provider addresses.
2. If any token's on-chain provider doesn't match the keeper's Lazer provider, either: (a) skip that token, or (b) route it through the correct provider.
3. Log mismatches as ERRORS, not warnings. A mismatch means that token's operations WILL fail.
4. The simplest approach for the minimal rewrite: assume all tokens use PythLazerFeedProvider (since that's what's configured on-chain for all 6 markets). If a token fails verification, log an error and exclude it from executable operations.

**Warning signs:**
- Executions revert with `0x05d102a2` or `0x68b49e6c` error codes
- Some markets work while others consistently fail
- Oracle verification at startup shows mismatches

**Phase to address:**
Phase 1 (Core Architecture) -- oracle provider verification must run at startup before any execution begins.

---

### Pitfall 8: Pyth Lazer Reconnection Storm After Token Expiry

**What goes wrong:**
When the Pyth Pro access token expires or is revoked, all 4 WebSocket connections drop simultaneously. The SDK's reconnection logic (exponential backoff, `maxRetryDelayMs: 1000`) tries to reconnect every connection aggressively. Each reconnection attempt fails with an auth error, generating 4 error logs per second. Meanwhile, the oracle cache goes stale (Pitfall 2), executions start failing, and the error log volume fills disk space on the DigitalOcean droplet.

**Why it happens:**
The Pyth Lazer SDK reconnects with `attempts: Infinity` by default. Auth failures are not distinguished from transient network errors, so the client never gives up. The `maxRetryDelayMs: 1000` (currently configured) caps backoff at 1 second, meaning even with 4 connections, that is at minimum 4 failed connection attempts per second, indefinitely.

**How to avoid:**
1. Set `maxRetryDelayMs` to something reasonable like `30000` (30s) to reduce reconnection storm intensity.
2. Monitor the `allConnectionsDownListener` callback. If it fires and stays down for >60 seconds, the token is likely expired, not a transient issue. Log a FATAL-level message with the action to take ("check PYTH_PRO_ACCESS_TOKEN validity").
3. Add a circuit breaker: after N consecutive failed connections across all pools (e.g., 20), stop reconnecting and set the keeper to "degraded mode" (poll-only with Hermes fallback, or pause execution entirely).
4. Monitor Pyth Pro token expiry proactively. Set a calendar reminder before the token expires.

**Warning signs:**
- Log output volume spikes dramatically
- All oracle cache entries go stale simultaneously
- `allConnectionsDownListener` fires but connections never recover
- Disk usage on droplet increases rapidly

**Phase to address:**
Phase 2 (Executor Implementation) -- when building the Pyth Lazer integration.

---

### Pitfall 9: viem `waitForTransactionReceipt` Blocks Drain Loop During Congestion

**What goes wrong:**
The current keeper calls `waitForTransactionReceipt({ timeout: 60_000 })` after every transaction submission. During chain congestion, a transaction may sit in the mempool for the full 60 seconds before confirming. The drain loop is blocked for this entire time, unable to process any other pending operations. If 5 deposits arrive during this window, they queue up and execute 60s apart instead of in rapid succession.

**Why it happens:**
The sequential execution design correctly prevents nonce conflicts, but `waitForTransactionReceipt` is a blocking call that holds the txMutex. The intent is to confirm success before moving on, but the confirmation is not necessary for correctness -- the nonce was already consumed, and the next transaction can use the next nonce immediately.

**How to avoid:**
For the minimal rewrite, consider a fire-and-confirm pattern:
1. Submit transaction, capture the txHash
2. Immediately release the execution slot and move to the next pending item
3. Track submitted txHashes in a separate "confirmations pending" list
4. A parallel confirmation checker polls for receipts and logs results
5. If a receipt shows `status: "reverted"`, the operation needs re-evaluation (but the on-chain state already reflects the revert, so the next scan will re-discover it if needed)

HOWEVER, this adds complexity. For the ~300 line minimal rewrite, the simpler approach is to accept the blocking wait but reduce the timeout to 15-20 seconds (on Base Sepolia with Flashblocks, transactions confirm in <2 seconds normally) and treat timeout as a transient error that triggers retry.

**Warning signs:**
- Queue depth grows while a single item is being processed
- Execution latency shows 60000ms for individual items
- Users report long waits between submitting and seeing execution

**Phase to address:**
Phase 2 (Executor Implementation) -- this is an execution design choice that affects throughput.

---

### Pitfall 10: Losing the keccak256/encodeAbiParameters Pattern for DataStore Keys

**What goes wrong:**
Reading DataStore keys requires constructing the correct `bytes32` key using `keccak256(encodeAbiParameters(...))`. Solidity's `abi.encode` is NOT the same as viem's `encodePacked`. Using `encodePacked` produces a different hash, silently returning wrong data (empty arrays, zero values) from the DataStore. This was already a production bug documented in the project MEMORY.md.

**Why it happens:**
During a rewrite, the developer sees Solidity code like `keccak256(abi.encode("DEPOSIT_LIST"))` and translates it to viem using `encodePacked` because "packed" feels like it matches "encode". But `abi.encode` pads each argument to 32 bytes, while `abi.encodePacked` concatenates without padding. The hashes are completely different.

**How to avoid:**
Copy the existing `keys.ts` pattern exactly. Use `encodeAbiParameters([{ type: 'string' }], ['DEPOSIT_LIST'])` (NOT `encodePacked`). The existing keeper already has this correct -- the rewrite must not "simplify" it.

Test the key construction at startup: read a known DataStore key (like `DEPOSIT_LIST` count) and verify it returns a non-zero value. If it returns 0 and there are known pending deposits, the key construction is wrong.

**Warning signs:**
- Scanner returns 0 pending deposits when the frontend shows pending operations
- DataStore reads return empty arrays or zero values
- No errors thrown -- just silently wrong data

**Phase to address:**
Phase 1 (Core Architecture) -- DataStore key construction is the foundation of the scanner.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip DB entirely | -500 lines of Prisma/migration code, no postgres dependency | No execution history, no block tracking for backfill, no audit trail | Acceptable for v1.5 -- on-chain DataStore is the audit trail. Add structured logging to file for post-mortem analysis. |
| Fixed 2M gas limit for all TXs | Saves an estimateGas RPC call per execution | Overpays gas on simple operations, underpays on complex ones | Acceptable on Base Sepolia (low gas costs). Revisit for mainnet. |
| Single-process design | Simplicity, no IPC, no coordination | Cannot scale to multiple keeper instances | Acceptable until transaction volume exceeds ~1 TX/second throughput |
| `Date.now()` for oracle timestamps | Avoids parsing Pyth's timestamp format | Clock skew between keeper machine and chain validators causes MaxPriceAgeExceeded | Never acceptable. Use `feedUpdateTimestamp` from Pyth response. |
| Hardcoded contract addresses | No config file parsing | Address changes require code changes and rebuild | Acceptable for testnet. Use env vars for all addresses from day one. |
| No Hermes fallback in minimal rewrite | Simpler oracle code (Lazer only) | FX tokens without Lazer entitlements become unexecutable | Acceptable ONLY if all 6 markets are verified to have Lazer entitlements. Otherwise, must include Hermes fallback path. |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Pyth Lazer WebSocket | Subscribing before SDK client is fully initialized (race condition in `PythLazerClient.create`) | Await `clientReady` promise before calling `subscribe()`. Current code does this correctly via the `connect()` method. |
| Pyth Lazer WebSocket | Not including all 3 endpoints for redundancy | Pyth docs: "you must connect to all endpoints" -- `pyth-lazer-0`, `pyth-lazer-1`, `pyth-lazer-2`. The SDK handles this with `numConnections: 4` across the endpoint pool. |
| Pyth Lazer binary format | Assuming each binary message contains data for a single feed | Binary responses contain data for ALL subscribed feeds. Cache the raw update for every registered token, not just the one that "matches" the feed ID. Current `handlePriceUpdate` does this correctly. |
| Base Sepolia RPC (Flashblocks) | Using the Flashblocks RPC URL for WebSocket subscriptions | Flashblocks RPC is HTTP-only for preconfirmations. Use standard WS_RPC_URL for event subscriptions. |
| Docker + Pyth WebSocket | Container restart causes 4 WebSocket reconnection attempts before data flows | Add a startup wait (current: 10 seconds) after Pyth connection before first scan. Verify feed data actually arrived with `verifyLazerFeeds()` pattern. |
| viem WebSocket transport | Using `fallback([webSocket(), http()])` for event watching | Creates "fallback" transport type that silently polls via HTTP. Use separate WebSocket-only client. |
| DataStore key encoding | Using viem `encodePacked` to match Solidity `abi.encode` | Must use `encodeAbiParameters` -- different encoding, different hash, silently wrong results. |
| viem nonceManager | Using `createNonceManager` for sequential keeper transactions | Nonce gap on estimateGas failure. Use manual `getTransactionCount({ blockTag: "pending" })` instead. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full deposit struct for every key in DEPOSIT_LIST each scan cycle | Scan cycle takes 2-5 seconds with 50+ pending keys | Batch reads using multicall. Pre-filter by checking if key is already in `allKnown` set before fetching details. | >20 simultaneous pending operations |
| Synchronous `waitForTransactionReceipt` in the drain loop | Queue backs up during chain congestion; 5 pending items take 5 minutes | Reduce timeout to 15s; accept that confirmation is best-effort. On-chain state is the source of truth. | Any period of >5s block times |
| Restarting full WebSocket subscription on every reconnection | Pyth Lazer SDK creates new subscription, old one still active on server side | Let SDK handle reconnection internally. Don't call `subscribe()` again in `allConnectionsDownListener`. | Frequent network blips (>1/minute) |
| Reading `getTransactionCount({ blockTag: "pending" })` before every TX | Adds 100-200ms RPC latency per execution | For sequential execution, track nonce locally: fetch once at startup, increment after each successful submission, reset to on-chain value on any nonce error. | >5 TXs in rapid succession |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Private key in docker-compose.yml or committed to git | Key theft, fund drainage | Use `.env` file (already in `.gitignore`). Never hardcode in compose file. Current setup correctly uses `${PRIVATE_KEY}` env var reference. |
| No gas balance monitoring | Keeper wallet runs out of ETH, all executions fail silently, users' deposits stuck | Add a startup check: if keeper wallet balance < 0.01 ETH, log FATAL and refuse to start. Check balance periodically and alert when low. |
| Executing operations without validating oracle data freshness | Stale oracle prices lead to incorrect execution prices, potential economic loss | Always check timestamp of cached oracle data against `MAX_ORACLE_PRICE_AGE` before including in execution params. |
| Not verifying transaction receipt status after execution | TX reverts on-chain but keeper marks it as "executed" | Always check `txReceipt.status === "success"`. If "reverted", mark for retry or investigation. |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Keeper goes down with no user-facing indication | Users submit deposits that sit pending forever, assume the platform is broken | Health endpoint exposed at `/health`. Frontend should poll keeper health and show "Execution service unavailable" banner when unhealthy. |
| Ghost deposits stuck in UI pending state | Users see "Pending" for deposits that were already cancelled on-chain | Frontend should check on-chain deposit state directly, not rely on keeper DB status. With no DB, this becomes the only option -- which is actually better. |
| Execution latency visible as "pending" to user | User submits deposit, sees "Pending" for 10-30 seconds, panics | Frontend should show "Processing..." with a progress indicator. Display "Submitted to chain" as soon as the createDeposit TX confirms, "Executing..." when keeper picks it up. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Scanner reads all pending keys:** Verify the scan reads the FULL DataStore list (deposit + withdrawal + order keys), not just new events. Test by creating a deposit while the keeper is stopped, then starting the keeper -- it should pick it up.
- [ ] **Oracle cache has TTL:** Verify that stale cache entries (>270s old) are NOT used for execution. Test by disconnecting the Pyth WebSocket and waiting 5 minutes -- executions should fail with "no oracle data" not with "MaxPriceAgeExceeded".
- [ ] **Graceful shutdown completes in-flight TX:** Verify that `SIGTERM` waits for the current `waitForTransactionReceipt` to finish before exiting. Test by sending SIGTERM during an active execution -- the TX should confirm, not be abandoned.
- [ ] **All 6 markets execute:** Verify deposits/withdrawals work for ETH, BTC, EUR, GBP, GOLD, and JPY markets. FX markets historically fail with oracle errors -- do not assume "it works for ETH so it works for all".
- [ ] **Nonce recovery after crash:** Verify that after a process crash (kill -9), the keeper recovers the correct nonce on restart. Test by killing the process during execution and restarting -- the next TX should use the correct nonce.
- [ ] **Docker health check passes:** Verify the `/health` endpoint returns 200 after startup wait + oracle initialization. The Dockerfile HEALTHCHECK has `start-period: 120s` -- ensure the keeper is fully initialized within this window.
- [ ] **Event listener reconnects after WS drop:** Verify that if the WebSocket connection drops, the event listener reconnects AND the poll safety net catches events during the gap. Test by restarting the WS RPC endpoint.
- [ ] **Ghost key dedup works across scan cycles:** Verify that after a ghost is detected once, subsequent scan cycles do NOT re-fetch and re-log it.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Nonce gap (stuck transactions) | LOW | SSH into droplet, restart the keeper container. On restart, `getTransactionCount({ blockTag: "pending" })` fetches the correct nonce. If a TX is stuck in mempool, submit a zero-value TX with the stuck nonce and higher gas to unstick it. |
| Stale oracle cache | LOW | Restart the keeper. Pyth WebSocket reconnects, cache repopulates in 10 seconds. Pending operations will be re-discovered by the scanner. |
| Ghost deposit infinite loop | LOW | Add the ghost key to an ignore list, or cancel it on-chain via the DepositHandler. Restart keeper to clear in-memory state. |
| Docker duplicate keeper | MEDIUM | `docker compose stop order-execution-keeper` to stop both instances. Wait 30 seconds for any in-flight TXs to confirm. Then `docker compose up -d order-execution-keeper`. Check `getTransactionCount` matches expected nonce. |
| Oracle provider mismatch | MEDIUM | Run the `configureOracleTokens.ts` deploy script to update on-chain DataStore mappings. Or update the keeper's configured provider address to match what's on-chain. Restart keeper after fix. |
| DataStore key hash mismatch (wrong encoding) | HIGH | This is a code bug, not a runtime issue. Fix the encoding function, rebuild Docker image, redeploy. All pending operations are safe on-chain -- they just weren't being discovered. |
| Private key compromise | CRITICAL | Immediately transfer all funds from the keeper wallet. Deploy new keeper wallet. Update on-chain RoleStore to revoke old keeper and authorize new one. Update .env and redeploy. |
| Pyth token expired / reconnection storm | LOW | Replace `PYTH_PRO_ACCESS_TOKEN` in .env, restart keeper. If disk is full from log spam, `docker logs --tail 0` to truncate, then restart. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Nonce gap on failed estimateGas | Phase 1: Core Architecture | Unit test: mock a reverted estimateGas, verify next TX uses correct nonce |
| Stale oracle cache | Phase 1: Core Architecture | Integration test: disconnect WS, wait 5 min, verify execution is blocked |
| In-flight queue loss on restart | Phase 1: Core Architecture | E2E test: create deposit, kill keeper, restart, verify deposit executes |
| Ghost deposit infinite retry | Phase 2: Executor Implementation | Log analysis: after 3 scan cycles, ghost key should appear in logs only once |
| Docker duplicate keeper | Phase 3: Docker Deployment | Deployment runbook with explicit stop-then-start procedure |
| WebSocket HTTP fallback | Phase 1: Core Architecture | Startup assertion: verify `transport.type === "webSocket"` |
| Oracle provider mismatch | Phase 1: Core Architecture | Startup verification: `verifyOracleProviderConsistency()` with hard failure on mismatch |
| Pyth reconnection storm | Phase 2: Executor Implementation | Config review: verify `maxRetryDelayMs >= 10000`, circuit breaker implemented |
| waitForTransactionReceipt blocking | Phase 2: Executor Implementation | Load test: submit 5 deposits rapidly, verify all execute within 60s total |
| keccak256/encodeAbiParameters mismatch | Phase 1: Core Architecture | Startup smoke test: read DEPOSIT_LIST count, verify it matches expected value |

## Sources

### Primary (HIGH confidence -- codebase analysis and production incidents)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/index.ts` -- TxMutex, drainQueue, scanAndEnqueue, shutdown handler
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/baseExecutor.ts` -- nonce management, submitTransaction retry logic, buildOracleParams per-token routing
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` -- WebSocket pool config, cache architecture, allConnectionsDownListener
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/queue/executionQueue.ts` -- dedup via allKnown, retry with backoff, ghost handling
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/listeners/eventListener.ts` -- backfill from lastProcessedBlock, DB dependency for recovery
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/core/blockchain/client.ts` -- WebSocket transport type verification, fallback transport pitfall
- `/Users/ken/Projects/0xM/order-execution-keeper-service/Dockerfile` -- health check config, startup period
- `/Users/ken/Projects/0xM/docker-compose.yml` -- service definitions, restart policy, postgres dependency
- `.planning/PROJECT.md` -- Known issues (MaxPriceAgeExceeded, InvalidOracleProvider, nonce conflicts, ghost deposits)

### Secondary (MEDIUM confidence -- verified library documentation)
- [viem createNonceManager documentation](https://viem.sh/docs/accounts/local/createNonceManager)
- [viem issue #3142: nonceManager still incrementing if tx was not sent](https://github.com/wevm/viem/issues/3142)
- [viem discussion #1338: Better nonce handling with parallel transactions](https://github.com/wevm/viem/discussions/1338)
- [Pyth Lazer Getting Started documentation](https://docs.pyth.network/lazer/getting-started)
- [Pyth Pro Subscribe to Prices documentation](https://docs.pyth.network/price-feeds/pro/subscribe-to-prices)
- [@pythnetwork/pyth-lazer-sdk npm package](https://www.npmjs.com/package/@pythnetwork/pyth-lazer-sdk)
- [Docker Rollout: Zero Downtime Deployment for Docker Compose](https://github.com/wowu/docker-rollout)
- [GMX Synthetics keeper documentation](https://github.com/gmx-io/gmx-synthetics)

### Tertiary (LOW confidence -- training data only)
- Docker Compose stop/start behavior during `up -d --build` -- verified against Docker documentation but exact behavior may vary by Docker version

---
*Pitfalls research for: Minimal keeper rewrite (v1.5)*
*Researched: 2026-02-25*
