# Phase 16: Keeper Logic and Infrastructure - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the core keeper loop on top of Phase 15's skeleton — event detection via WebSocket, DataStore polling safety net, sequential execution of deposits/withdrawals/orders, deduplication, health endpoint, graceful shutdown, and Dockerfile updates. Requirements: DET-01, DET-02, DET-03, EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, INFRA-01, INFRA-02, INFRA-03, INFRA-04.

</domain>

<decisions>
## Implementation Decisions

### Error Handling Strategy
- Permanent reverts (EmptyDeposit, expired, InvalidOracleProvider): log at WARN and skip permanently — add bytes32 key to an ignored Set, never retry
- Transient errors (network timeout, RPC failure): retry up to 3 times with exponential backoff (1s, 2s, 4s), then log ERROR and move to next operation
- Permanently-skipped operations tracked forever in memory (simple Set). Testnet volume is low. Clears on restart
- Categorize errors in logs: permanent errors at WARN, transient errors at ERROR, unexpected errors at ERROR with full stack trace
- User funds are NOT lost on transient failure — operations stay pending in DataStore, poller picks them up on next 15s cycle

### Execution Queue Behavior
- FIFO ordering — process in order received, no priority by type
- Plain Array as queue (push/shift) + Set of bytes32 keys for dedup. ~5 lines of code
- No queue size limit — testnet volume is low, large queue is a signal something else is broken
- Event-driven wake — executor sleeps when queue is empty, woken by event watcher or poller adding to queue

### Health Endpoint
- Core diagnostics at GET /health: status (ok/degraded), uptime, queue length, keeper address, oracle stale flag, cached token count
- No authentication — public endpoint, BetterStack needs unauthenticated access
- Status is "degraded" when isOracleStale() returns true, "ok" otherwise
- Express server (already in package.json, one route, 5 lines)

### Event Watcher + Poller Overlap
- Startup sequence: DataStore full scan FIRST (catches pre-existing pending ops from before restart), THEN start event watcher for new ops
- Dedup via Set of bytes32 operation keys — before enqueuing, check Set. If key exists, skip. O(1) lookup
- In-flight operations covered by dedup Set — key stays in Set from first detection through execution, poller sees it and skips
- After successful execution, key stays in dedup Set forever (prevents any double-execution). Clears on restart, rebuilt from DataStore scan

### Claude's Discretion
- Exact implementation of exponential backoff (setTimeout vs loop)
- How to extract operation type (deposit/withdrawal/order) from event data
- Exact Express server setup and middleware
- SIGTERM handler implementation details
- How to structure the sequential executor (async loop vs recursive)

</decisions>

<specifics>
## Specific Ideas

- Nonce management: use manual getTransactionCount, NOT viem's createNonceManager (documented production bug — viem issue #3142)
- DataStore key encoding: already correctly implemented in keys.ts from Phase 15 using encodeAbiParameters
- Sequential execution means single wallet = single nonce = no contention (this was the root cause of v1.4 issues)
- Port the submitTransaction pattern from existing baseExecutor.ts for nonce-aware TX submission

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-keeper-logic-and-infrastructure*
*Context gathered: 2026-02-26*
