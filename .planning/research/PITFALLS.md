# Pitfalls Research

**Domain:** Event-driven execution optimization for DeFi keeper services
**Researched:** 2026-02-23
**Confidence:** HIGH (based on codebase analysis + verified ecosystem patterns)

## Critical Pitfalls

### Pitfall 1: Nonce Collision When Event-Driven Triggers Overlap With Oracle Price Updates

**What goes wrong:**
The current system sends TWO sequential transactions per execution: (1) `updatePriceOnChain` for the Pyth Lazer oracle, then (2) `executeDeposit`/`executeWithdrawal`/`executeOrder`. Both use the same wallet and both call `getTransactionCount({ blockTag: "pending" })` to get the nonce. When switching to event-driven detection, an event fires and triggers execution immediately. If the previous execution's `updatePriceOnChain` transaction is still pending (not yet mined), the new execution reads the same pending nonce and submits a conflicting transaction. The second transaction either replaces the first (if gas is higher) or gets rejected with "nonce too low."

The existing code in `baseExecutor.ts` (line 93) fetches the nonce fresh per transaction. This works with sequential polling because the `isExecuting` mutex (line 25 of `index.ts`) prevents overlapping cycles. Event-driven execution removes this serialization guarantee.

**Why it happens:**
Polling naturally serializes: the `isExecuting` flag in `executePendingRequests()` ensures only one cycle runs at a time. Events arrive asynchronously and can trigger execution mid-cycle. Developers add event listeners alongside the existing polling loop during migration, and the `isExecuting` guard does not protect event-triggered executions because they bypass the main loop.

**How to avoid:**
Implement a transaction queue with a single consumer. All execution requests (from events or polling fallback) enqueue into an async FIFO queue. A single worker dequeues and executes one at a time. This preserves the sequential nonce guarantee without changing the executor logic.

```typescript
// Conceptual pattern
class ExecutionQueue {
  private queue: Array<{ type: string; key: Hex }> = [];
  private processing = false;

  enqueue(item: { type: string; key: Hex }) {
    this.queue.push(item);
    this.process(); // non-blocking
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      await this.executeItem(item); // sequential
    }
    this.processing = false;
  }
}
```

Alternatively, use viem's `createNonceManager` with `jsonRpc()` source attached to the account. This auto-increments nonces for parallel transactions. However, be aware of the known bug: if `estimateGas` fails, the nonce is consumed but no transaction is sent, creating a nonce gap that blocks all subsequent transactions until the nonce is manually reset. Given that gas estimation failures are expected (EmptyDeposit, expired requests), the queue approach is safer.

**Warning signs:**
- "nonce too low" errors appearing in logs after adding event listeners
- "replacement transaction underpriced" errors increasing
- 4-second retry waits in `submitTransaction` becoming frequent (the existing retry at line 128 of `baseExecutor.ts` fires on nonce conflicts)
- Deposits executing but oracle price updates getting dropped, or vice versa

**Phase to address:**
Phase 1 (Event-Driven Detection) -- must be solved BEFORE adding event listeners. The execution queue should be the first thing built, tested in isolation, then event listeners plugged into it.

---

### Pitfall 2: Silent WebSocket Death Without Backfill Causes Missed Operations

**What goes wrong:**
WebSocket connections to the RPC node drop silently (no error event, no close event). The event listener in `watchContractEvent` stops receiving events but the keeper has no way to know. New deposits, withdrawals, and orders sit unexecuted indefinitely. The health check still reports "ok" because it checks `lastExecutionTime` which reflects the last successful cycle, not whether the event stream is alive.

This is a well-documented viem issue. Users report that "WebSocket connections sometimes silently die and never reconnect." The existing Pyth Lazer SDK handles this better (it has a connection pool with 4 connections and heartbeat monitoring), but the RPC WebSocket for on-chain event listening does not benefit from the Pyth SDK's resilience.

**Why it happens:**
Network interruptions, RPC node restarts, or Base Sepolia infrastructure maintenance silently close TCP connections. viem's WebSocket transport has `reconnect` options but reconnection does not replay missed events between the disconnect and reconnect. The gap is permanent. Developers assume "reconnect = no missed events" but reconnection only means new events are received going forward.

**How to avoid:**
Never rely solely on WebSocket event listeners. Keep a polling fallback that runs on a longer interval (e.g., every 30-60 seconds) to catch anything the event listener missed. This is the hybrid architecture:

1. Event listener triggers immediate execution (fast path, sub-2s detection)
2. Polling fallback runs every 30s as a safety net (slow path, catches gaps)
3. Both paths feed into the same execution queue, which deduplicates by request key

Track the last block number seen by the event listener. If no events arrive for N seconds, proactively call `getLogs` from the last known block to current block to backfill the gap. This is the "gap detection + backfill" pattern documented in Chainstack's guide to reliable event monitoring.

**Warning signs:**
- No events received for an extended period but polling still finds pending operations
- `lastEventBlock` stops advancing while `getBlockNumber()` continues to advance
- Health check passes but users report long wait times
- WebSocket transport error count increases then goes silent (the error stream itself dies)

**Phase to address:**
Phase 1 (Event-Driven Detection). The hybrid architecture is not optional -- it is the core design. Do NOT remove the polling loop; reduce its frequency and make it the safety net.

---

### Pitfall 3: Health Check Staleness Assumption Breaks With Event-Driven Architecture

**What goes wrong:**
The current health check in `healthState.ts` uses `lastExecutionTime` (updated by `recordScanCycle()` at the end of each polling cycle). BetterStack pings `/health` every 5 minutes. The implicit contract is: "if `lastExecutionTime` is within 2-3x the scan interval, the keeper is alive." When polling runs every 10s, a stale `lastExecutionTime` older than 30s means the keeper is stuck.

With event-driven architecture, execution only happens when events arrive. During idle periods (no user activity), no events fire, no executions happen, `lastExecutionTime` goes stale, and BetterStack alerts on a healthy but idle keeper. Alternatively, if the polling fallback is kept but at a 30s interval, the staleness threshold must change accordingly, or false alerts fire constantly.

**Why it happens:**
The health check was designed around the polling loop's guarantee: "a cycle always runs every N seconds regardless of activity." Event-driven systems break this guarantee. Developers update the event listener and execution pipeline but forget to update the health check's liveness model.

**How to avoid:**
Separate liveness from execution activity:

1. **Liveness signal**: A heartbeat that fires every N seconds regardless of activity. This replaces `recordScanCycle()`. The heartbeat proves the process is running and the event listener is connected.
2. **Event stream health**: Track `lastEventBlockSeen` and compare against current block number. If the delta exceeds a threshold, the event stream may be dead.
3. **Execution activity**: Keep `recordExecution()` for metrics but do not use it as the primary liveness signal.

```typescript
// New health model
export const healthState = {
  startedAt: new Date(),
  lastHeartbeat: null as Date | null,       // fires every 10s unconditionally
  lastEventBlockSeen: 0n,                    // tracks event stream health
  lastExecutionTime: null as Date | null,    // tracks execution activity (metric only)
  oracleConnected: false,
  eventStreamConnected: false,
  executionCounts: { deposits: 0, withdrawals: 0, orders: 0 },
};
```

Update the `/health` endpoint to return 503 if `lastHeartbeat` is stale OR if `lastEventBlockSeen` is more than N blocks behind the current tip.

**Warning signs:**
- False health alerts during idle periods (no user activity)
- Health check flapping between ok and stale
- BetterStack alerting at 3am when no one is trading
- Removing health alerts out of frustration (defeats the purpose)

**Phase to address:**
Phase 2 (Health Check Overhaul) -- immediately after event listeners are working. The health model must be redesigned before deployment; otherwise the monitoring system generates noise that gets ignored, hiding real failures.

---

### Pitfall 4: Double Execution From Event + Polling Race Condition

**What goes wrong:**
Both the event listener and the polling fallback detect the same pending operation (e.g., a deposit). The event triggers immediate execution. The polling cycle, running concurrently, also finds the same deposit key in its scan. Both attempt to execute the same deposit. The first succeeds. The second fails with "EmptyDeposit" (the on-chain struct is zeroed after first execution) but wastes gas on the failed transaction and logs a misleading error.

In the worst case, both executions send `updatePriceOnChain` for the same token, consuming two nonces. The first execution's `executeDeposit` succeeds. The second execution's `updatePriceOnChain` succeeds (redundant but harmless), then its `executeDeposit` reverts (deposit already consumed). The wasted nonce and gas are the real cost.

**Why it happens:**
The current `depositScanner.scan()` reads from `DEPOSIT_LIST` on-chain and the local DB. If an event-triggered execution is in-flight (not yet committed to DB as EXECUTED), the polling scanner does not know about it. There is no shared "in-flight" state between the event path and the polling path.

**How to avoid:**
Use an in-memory "in-flight" set of request keys. When a key enters the execution queue, mark it as in-flight. The scanner checks this set before adding keys to the queue. After execution completes (success or failure), remove from in-flight.

```typescript
const inFlight = new Set<Hex>();

// Before enqueueing
if (inFlight.has(key)) return; // skip, already being handled
inFlight.add(key);

// After execution completes
inFlight.delete(key);
```

This is simpler and faster than a DB-level lock. The existing `isExecuting` mutex is not sufficient because it blocks the entire cycle, not individual keys.

**Warning signs:**
- "EmptyDeposit" errors appearing in logs for deposits that were successfully executed moments earlier
- Execution count for deposits is higher than the number of actual deposits
- Gas spend increases after adding event listeners without a corresponding increase in successful executions
- Two log entries for the same deposit key within seconds of each other

**Phase to address:**
Phase 1 (Event-Driven Detection). The in-flight set must be implemented as part of the execution queue before going live.

---

### Pitfall 5: Pyth Lazer WebSocket + RPC WebSocket Connection Exhaustion on Single Server

**What goes wrong:**
The keeper already maintains 4 WebSocket connections to Pyth Lazer (via `numConnections: 4` in the SDK config at line 53 of `pythLazerOracle.ts`). Adding RPC WebSocket connections for event listening (one per service, or one per event type) increases the total WebSocket count significantly. On a single DigitalOcean droplet running both keeper-service and order-execution-keeper-service in Docker, this means: 4 Pyth Lazer + N RPC WebSocket connections per container, times 2 containers = potentially 12+ concurrent WebSocket connections.

Base Sepolia's public RPC endpoints are rate-limited and not designed for heavy WebSocket use. Connections may be throttled, forcefully closed, or deprioritized. The containers share the same network stack and external IP, so rate limits apply to the aggregate, not per container.

**Why it happens:**
Each service is developed independently and adds connections without considering the total resource budget of the shared host. The Pyth Lazer pool is already configured in the code. Developers add RPC WebSocket transport without checking how many connections the provider allows from a single IP.

**How to avoid:**
1. Use a managed RPC provider (Alchemy, QuickNode, dRPC) with explicit WebSocket support and known rate limits rather than Base Sepolia's public endpoint for event subscriptions.
2. Consolidate event listening: one WebSocket connection per service is sufficient. Use `watchContractEvent` with a single `EventEmitter` contract that emits all event types, rather than separate subscriptions per handler contract.
3. Monitor connection count. Add a health metric for active WebSocket connections.
4. For the order-execution-keeper-service, use a single WebSocket client for both block watching and event listening, not separate transports.
5. Consider whether keeper-service even needs RPC WebSocket events (it watches events via the existing `confirmator.ts` using `watchContractEvent` with HTTP polling, not WebSocket -- viem defaults to polling with HTTP transport).

**Warning signs:**
- WebSocket connections cycling rapidly (connect/disconnect/reconnect loops)
- "429 Too Many Requests" or similar rate limit errors from the RPC endpoint
- Event listener silently stops receiving events while HTTP RPC calls still work
- Container memory usage creeping up (each WebSocket connection consumes memory)

**Phase to address:**
Phase 1 (Event-Driven Detection) -- plan the connection budget BEFORE writing code. Document how many WebSocket connections each container will maintain and verify the RPC provider supports that count.

---

### Pitfall 6: viem `watchContractEvent` Silently Falls Back to Polling on HTTP Transport

**What goes wrong:**
The current `client.ts` in both keeper services uses `http()` transport, not `webSocket()`. Developers add `watchContractEvent` expecting real-time event subscriptions, but viem's behavior is: with HTTP transport, `watchContractEvent` defaults to `poll: true`, using `eth_getFilterChanges` on a polling interval (default 4 seconds). This is NOT event-driven -- it is just rebranded polling. The code looks event-driven but delivers no latency improvement over the existing scan interval.

The confirmator in `keeper-service` already uses `watchContractEvent` (line 50 of `confirmator.ts`) but the public client uses HTTP transport (line 28 of `contract.ts`). This means it is already polling under the hood at a default 4s interval, which developers may not realize.

**Why it happens:**
The API name `watchContractEvent` implies WebSocket subscriptions, but the implementation adapts to the transport. The code compiles and "works" with HTTP transport, providing no error or warning that it is polling instead of subscribing. Developers test locally, see events arriving, and assume it is real-time without checking the actual transport behavior.

**How to avoid:**
Explicitly create a WebSocket transport for the public client used for event watching:

```typescript
import { createPublicClient, webSocket } from "viem";

const wsClient = createPublicClient({
  chain: customChain,
  transport: webSocket("wss://base-sepolia-rpc.example.com", {
    reconnect: { attempts: 10, delay: 2_000 },
    keepAlive: { interval: 30_000 },
  }),
});
```

Use this `wsClient` exclusively for `watchContractEvent`. Keep the existing HTTP client for RPC calls (`readContract`, `writeContract`, `getTransactionCount`, etc.). Two clients, two transports, each optimized for their use case.

Verify the transport is actually WebSocket by checking `client.transport.type === "webSocket"` at startup and logging a warning if it is not.

**Warning signs:**
- Event detection latency is ~4 seconds (the default polling interval) rather than sub-second
- No `eth_subscribe` calls in RPC logs, only `eth_getFilterChanges`
- Adding `watchContractEvent` does not improve latency over reducing `SCAN_INTERVAL_SECONDS`
- Developers believe they have event-driven detection but latency metrics say otherwise

**Phase to address:**
Phase 1 (Event-Driven Detection). This is literally the first thing to verify: is the transport actually WebSocket? If the RPC endpoint does not support WebSocket, the entire event-driven strategy needs rethinking (use aggressive HTTP polling instead).

---

### Pitfall 7: Stale Event Processing After Keeper Restart

**What goes wrong:**
The keeper restarts (Docker rebuild, crash, OOM kill). During downtime, multiple events were emitted on-chain. On restart, if using `watchContractEvent`, the listener starts from the current block -- all events emitted during downtime are missed. The polling fallback eventually picks them up, but if the polling interval is now 30-60s (reduced frequency for the hybrid model), there is a delay window where operations are stale.

Worse, if the keeper replays missed events by calling `getLogs` from the last known block, it may process events that were already handled before the crash. The current system marks deposits as EXECUTED in the DB, so re-processing an already-executed deposit results in an EmptyDeposit error (harmless but noisy). However, if the DB state was not flushed before the crash, the deposit might still be PENDING in DB but already executed on-chain. The executor handles this (line 96-106 of `depositExecutor.ts` checks for zeroed structs), but the oracle price update (`updatePriceOnChain`) runs before the check, wasting gas and a nonce.

**Why it happens:**
WebSocket subscriptions have no concept of "resume from where I left off." They are ephemeral. The `watchContractEvent` API starts fresh each time it is called. Developers assume the event listener "catches up" on restart, but it does not.

**How to avoid:**
Persist the last processed block number to the database. On startup:

1. Read `lastProcessedBlock` from DB
2. Call `getLogs` from `lastProcessedBlock + 1` to `currentBlock` to backfill missed events
3. Start the WebSocket event listener from `currentBlock`
4. After each successful event processing, update `lastProcessedBlock`

Add the zeroed-struct check BEFORE the oracle price update to avoid wasting gas on stale events:

```typescript
// Check on-chain state BEFORE spending gas on price updates
const deposit = await reader.getDeposit(key);
if (!deposit || deposit.addresses.account === ZERO_ADDRESS) {
  // Already executed or cancelled -- skip
  return;
}
// THEN update oracle price and execute
```

**Warning signs:**
- "EmptyDeposit" errors spike immediately after keeper restart
- Gas consumption spikes after restart due to redundant price updates
- Users report that operations submitted during downtime take longer than expected
- Logs show processing events with old block numbers

**Phase to address:**
Phase 1 (Event-Driven Detection). Block number persistence is a core requirement of the event-driven system, not an optimization.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep HTTP polling as primary, just reduce interval to 2-3s | Zero architecture change, minimal risk | No real latency improvement; more RPC calls; not event-driven | Never -- defeats the purpose of v1.3 |
| Use viem `nonceManager` without handling the estimateGas gap bug | Cleaner code for parallel transactions | Nonce gap after any gas estimation failure blocks ALL subsequent transactions until manual intervention | Never for this system -- gas estimation failures are expected (EmptyDeposit, expired requests) |
| Skip the execution queue, rely on `isExecuting` mutex | Less new code to write | Works only if events trigger `executePendingRequests()` which is already guarded; but this serializes ALL operations behind one mutex, negating the latency benefit of event detection | Acceptable only as Phase 1 MVP, must be replaced with per-key queueing in Phase 2 |
| Remove polling fallback entirely | Simpler architecture, one code path | Single point of failure; silent WebSocket death = complete outage | Never -- polling is the safety net |
| Share one WebSocket client across both Docker containers | Fewer connections to RPC | Requires a shared WebSocket proxy or event bus; adds infrastructure complexity | Never for v1.3 -- over-engineering for testnet |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| viem WebSocket transport | Using `fallback([webSocket(), http()])` for event watching -- fallback transport type is "fallback", not "webSocket", so viem falls back to HTTP polling | Use a dedicated WebSocket-only client for event watching; keep the HTTP client for RPC calls |
| viem `watchContractEvent` | Assuming `watchContractEvent` handles reconnection gaps -- it reconnects but does NOT replay missed events | Implement gap detection: track last event block, backfill with `getLogs` when gap is detected |
| Pyth Lazer SDK WebSocket | Adding RPC WebSocket connections without accounting for the 4 existing Pyth Lazer pool connections per container | Audit total WebSocket connection count before adding new ones; use a connection budget |
| Base Sepolia public RPC | Using the public endpoint for WebSocket subscriptions without checking if `eth_subscribe` is supported and at what rate limit | Use a managed RPC provider for WebSocket; keep public endpoint only for low-frequency HTTP calls |
| Prisma / SQLite in Docker | Writing to the database from both the event handler and the polling scanner concurrently without coordination | Route all writes through the execution queue's single consumer; the queue serializes DB access |
| `recordScanCycle()` | Calling it at the end of the polling loop and expecting it to work with event-driven execution | Replace with a periodic heartbeat timer that fires unconditionally |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Oracle price update per execution (2 transactions per operation) | Each deposit/withdrawal/order requires `updatePriceOnChain` + `executeX`, doubling latency and gas | Batch oracle updates: update all needed token prices in one call before executing the operation. The on-chain Pyth Lazer cache (30s TTL at line 213 of `pythLazerOracle.ts`) can be leveraged -- if price was updated <30s ago, skip the update | When multiple operations arrive within seconds (event burst) |
| Sequential execution of deposits then withdrawals then orders | A burst of 5 deposits blocks all withdrawals and orders until all 5 are done | Interleave or priority-queue by operation age, not type. Process oldest-first across all types | When users do both deposits and trades in quick succession |
| `getLogs` backfill scanning entire history on restart | Startup takes minutes if `lastProcessedBlock` is far behind current block | Cap backfill to last N blocks (e.g., 1000); older operations are caught by the on-chain DEPOSIT_LIST scan anyway | After extended downtime (hours) |
| Aggressive polling fallback interval (e.g., 5s) alongside event listener | Doubles the RPC call volume; no latency benefit since events already handle the fast path | Set polling fallback to 30-60s; it exists only as a safety net, not a performance path | When RPC rate limits are hit |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Processing events from any contract, not just the known EventEmitter | An attacker could deploy a contract that emits matching events to trick the keeper into executing arbitrary operations | Filter events strictly by contract address; the `watchContractEvent` `address` parameter already does this, but verify it is set correctly |
| Not validating event data before execution (e.g., deposit key from event leads to a malicious contract callback) | The GMX v1 $42M reentrancy attack exploited keeper-executed callbacks to a malicious contract | Always validate the on-chain state of the operation (deposit struct, order struct) BEFORE execution; the current code already does this via `reader.getDeposit()` -- preserve this check in the event-driven path |
| Exposing the WebSocket RPC URL in Docker logs or health endpoints | Managed RPC provider keys could be leaked | Redact RPC URLs in logs; never include them in health endpoint responses |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Event-driven detection is faster but oracle price update still takes 2-5s | Users see "faster detection" in marketing but actual end-to-end time does not improve proportionally | Optimize the full pipeline, not just detection. If detection drops from 10s to 1s but execution still takes 8s, the user sees 9s instead of 13s -- underwhelming |
| Inconsistent execution times (events = fast, polling fallback = slow) | Users sometimes get sub-5s execution and sometimes 30s+, creating unpredictable experience | Set user expectations: "typically under 10 seconds." Log which path detected the operation (event vs poll) to diagnose slow outliers |
| Health endpoint says "ok" but execution is slow | Operators believe the system is healthy while users experience delays | Add latency percentiles (p50, p95) to the health endpoint so monitoring can alert on degradation, not just outages |

## "Looks Done But Isn't" Checklist

- [ ] **Event listener connected:** Verify transport type is "webSocket" at startup, not "http" or "fallback" -- `watchContractEvent` compiles with any transport but only uses `eth_subscribe` with WebSocket
- [ ] **Gap backfill works:** Test by stopping the event listener for 60s, submitting a deposit, then restarting -- the deposit should be detected within one polling cycle
- [ ] **Nonce sequential under load:** Submit 3 deposits in rapid succession while event listener is active -- all 3 should execute without nonce errors or retries
- [ ] **Health check idle-safe:** Stop all user activity for 5 minutes -- health endpoint should still return 200 (heartbeat-based, not execution-based)
- [ ] **WebSocket reconnection works:** Kill the WebSocket connection (e.g., network partition test) -- events should resume within the reconnect delay without manual intervention
- [ ] **Dual-path deduplication works:** Ensure that an operation detected by both event and polling fallback only executes once -- check DB for duplicate execution records
- [ ] **Restart recovery works:** Kill the keeper mid-execution, restart it -- all pending operations should be discovered and executed without duplicates or errors
- [ ] **Docker resource limits set:** Both containers have memory limits to prevent one service from OOM-killing the other on the shared DigitalOcean droplet

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Nonce gap from failed `nonceManager` | MEDIUM | Send a zero-value transaction at the stuck nonce to fill the gap; or restart the keeper (nonce resets from chain state) |
| Silent WebSocket death | LOW | Polling fallback catches up within 30-60s; add alerting on event stream staleness to detect sooner |
| Double execution of same operation | LOW | On-chain idempotency (EmptyDeposit guard) prevents real damage; wasted gas is the only cost; reduce noise by adding in-flight deduplication |
| Missed events during downtime | MEDIUM | Block number backfill on startup; if `lastProcessedBlock` was not persisted, fall back to scanning DEPOSIT_LIST (existing behavior) |
| Health check false alerts | LOW | Adjust staleness threshold; switch to heartbeat model; update BetterStack configuration |
| RPC rate limiting | MEDIUM | Switch to managed RPC provider; reduce polling frequency; consolidate WebSocket connections |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Nonce collision (Pitfall 1) | Phase 1: Execution Queue | Submit 3 operations simultaneously; all execute without nonce errors |
| Silent WS death (Pitfall 2) | Phase 1: Hybrid Architecture | Network partition test: kill WS, verify polling catches operations within 60s |
| Health check staleness (Pitfall 3) | Phase 2: Health Overhaul | Idle for 5 minutes; health endpoint still returns 200 |
| Double execution (Pitfall 4) | Phase 1: In-Flight Set | Event + poll detect same key; only one execution in logs |
| Connection exhaustion (Pitfall 5) | Phase 1: Connection Budget | Count total WS connections per container; verify under provider limit |
| HTTP polling masquerading as events (Pitfall 6) | Phase 1: Transport Verification | Log `client.transport.type` at startup; must be "webSocket" |
| Stale events after restart (Pitfall 7) | Phase 1: Block Persistence | Stop keeper for 30s, submit deposit, restart; deposit detected from backfill |

## Sources

- [viem watchContractEvent docs](https://viem.sh/docs/contract/watchContractEvent) -- polling vs WebSocket behavior, transport-dependent defaults
- [viem WebSocket Transport docs](https://viem.sh/docs/clients/transports/websocket) -- reconnect, keepAlive, retry configuration
- [viem createNonceManager docs](https://viem.sh/docs/accounts/local/createNonceManager) -- parallel nonce management API
- [viem nonceManager estimateGas bug (Issue #3142)](https://github.com/wevm/viem/issues/3142) -- nonce gap when gas estimation fails
- [viem fallback transport WebSocket bug (Issue #776)](https://github.com/wevm/viem/issues/776) -- fallback transport does not use eth_subscribe
- [viem WebSocket reconnect issues (Issue #2325, #877, #2563)](https://github.com/wevm/viem/issues/2325) -- silent connection death, reconnection failures
- [viem Discussion #503](https://github.com/wevm/viem/discussions/503) -- eth_subscribe vs eth_getFilterChanges polling behavior
- [viem Discussion #1338](https://github.com/wevm/viem/discussions/1338) -- parallel nonce handling patterns
- [Chainstack: Redundant Ethereum Event Listener](https://docs.chainstack.com/docs/ethereum-redundant-event-llstener-ethers-web3js) -- backfill and gap detection strategies
- [Chainstack: Monitor Ethereum Events Reliably](https://chainstack.com/ethereum-how-to-monitor-events-in-javascript/) -- reliable event monitoring patterns
- [Eventeum: Resilient Event Listener](https://github.com/eventeum/eventeum) -- block replay on failure, reorg handling
- [@pythnetwork/pyth-lazer-sdk (npm)](https://www.npmjs.com/package/@pythnetwork/pyth-lazer-sdk) -- WebSocket pool config, reconnection, deduplication
- [GMX v1 $42M Incident Analysis](https://www.quillaudits.com/blog/hack-analysis/how-gmx-lost-42m) -- keeper bot callback vulnerability, execution flow desync
- [Base Documentation: Flashblocks](https://docs.base.org/base-chain/flashblocks/apps) -- Base RPC WebSocket support, public endpoint limitations
- Codebase analysis: `order-execution-keeper-service/src/index.ts` (polling loop, isExecuting mutex), `baseExecutor.ts` (nonce handling), `pythLazerOracle.ts` (WebSocket pool config), `healthState.ts` (health model), `client.ts` (HTTP transport), `confirmator.ts` (existing watchContractEvent usage on HTTP transport)

---
*Pitfalls research for: Event-driven keeper execution speed optimization (v1.3)*
*Researched: 2026-02-23*
