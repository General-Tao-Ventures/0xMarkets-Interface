# Phase 26: Liquidation Hardening and Performance - Research

**Researched:** 2026-02-28
**Domain:** Node.js/TypeScript keeper service -- liquidation pipeline reliability, observability, and RPC efficiency
**Confidence:** HIGH

## Summary

Phase 26 hardens the existing liquidation pipeline in `keeper-service` (a Node.js/TypeScript service using viem, Prisma/PostgreSQL, and pino). The codebase is well-structured with clear separation: scanner detects liquidatable positions, executor submits transactions, confirmator watches for on-chain events. Six requirements span three concerns: (1) reliability guards (deduplication, revert tracking), (2) dead code cleanup, and (3) performance optimization (multicall batching, data reuse).

The current code has specific, well-scoped gaps. The executor re-fetches position data from on-chain via `positionFetcher.fetchPositionByKey()` (line 129 in executor.ts) even though the scanner already has this data. The `discoverAccountsWithPositions()` method in positionFetcher.ts makes N serial `getPosition()` RPC calls (one per position key) inside a loop (lines 249-262). There is no deduplication guard -- the scanner calls `executor.execute()` synchronously within `processPosition()`, but if the same position appears in consecutive scan cycles (30s interval), it could be submitted again. The confirmator only handles `MINED` status -- there is no mechanism to detect `REVERTED` transactions or update stuck `SUBMITTED` records. `riskEngine.ts` is confirmed dead code -- zero imports across the entire codebase.

**Primary recommendation:** Implement all six requirements as targeted, surgical modifications to existing files. No new libraries needed -- viem 2.40.3 already has `multicall` and `waitForTransactionReceipt`; pino 10.3.1 already supports child loggers with timing metadata; Prisma schema already has `failureReason` and `REVERTED` status fields.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LHARD-01 | Executor has deduplication guard -- same position is not liquidated twice concurrently | In-memory `Map<string, number>` in scanner or executor tracking positionKey -> submission timestamp. 60s TTL. Check before calling executor.execute(). See Architecture Pattern 1. |
| LHARD-02 | REVERTED liquidation attempts are tracked with error reason in the database | Add receipt polling after TX submission using viem `waitForTransactionReceipt`. When `receipt.status === 'reverted'`, call `store.updateExecutionStatus(id, 'REVERTED', undefined, revertReason)`. Schema already has `failureReason` column and `REVERTED` status. See Architecture Pattern 2. |
| LHARD-03 | Dead code cleanup -- remove or archive unused riskEngine.ts | `riskEngine.ts` has zero imports across the codebase (verified via grep). Delete the file. See Code Examples section. |
| LHARD-04 | Per-stage timing instrumentation for scanner, executor, and confirmator | Use `performance.now()` or `Date.now()` with pino structured logging. Log `scanDurationMs`, `checkDurationMs`, `submitDurationMs`, `confirmDurationMs` per cycle. See Architecture Pattern 3. |
| LPERF-01 | Position discovery uses multicall batching instead of serial RPC calls | Replace serial `getPosition()` loop in `discoverAccountsWithPositions()` with `publicClient.multicall()`. Batch all position key lookups into a single eth_call. See Architecture Pattern 4. |
| LPERF-02 | Executor reuses position data from scanner instead of redundant RPC fetch | Pass `collateralToken` and `isLong` from the PositionSnapshot (already populated by scanner) through to executor, eliminating the `positionFetcher.fetchPositionByKey()` call on line 129 of executor.ts. See Architecture Pattern 5. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | 2.40.3 | Ethereum client (multicall, waitForTransactionReceipt) | Already installed; has native multicall3 support |
| @prisma/client | 5.22.0 | PostgreSQL ORM | Already installed; schema has all needed columns |
| pino | 10.3.1 | Structured JSON logging | Already installed; child logger pattern in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.0.16 | Unit testing | Already installed; test infrastructure exists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory dedup Map | Redis/database dedup | Overkill for single-instance keeper on testnet; Map is simpler and sufficient |
| `waitForTransactionReceipt` | Confirmator event-based revert detection | Receipt polling is more reliable -- confirmator only sees OrderExecuted events, not reverts |
| `performance.now()` | `process.hrtime.bigint()` | hrtime has nanosecond precision but overkill for ms-level stage timing |

**Installation:**
```bash
# No new packages needed -- all libraries are already installed
```

## Architecture Patterns

### Recommended Changes (file-level)
```
keeper-service/src/core/
  scanner.ts          # Add deduplication guard + timing instrumentation
  executor.ts         # Reuse position data + receipt polling + timing
  confirmator.ts      # Timing instrumentation
  positionFetcher.ts  # Multicall batching for discoverAccountsWithPositions
  riskEngine.ts       # DELETE (dead code)
```

### Pattern 1: Deduplication Guard (LHARD-01)

**What:** Prevent the same position from being submitted for liquidation twice within 60 seconds.
**Where:** scanner.ts `processPosition()` method, before calling `executor.execute()`.
**Mechanism:** In-memory `Map<string, number>` mapping positionKey to submission timestamp (ms). Before calling executor, check if the key exists and is within TTL. After successful executor call, record the key.

**Example:**
```typescript
// In PositionScanner class
private submissionDedup = new Map<string, number>(); // positionKey -> submittedAt (ms)
private static DEDUP_TTL_MS = 60_000; // 60 seconds

private isDuplicate(positionKey: string): boolean {
    const submittedAt = this.submissionDedup.get(positionKey);
    if (!submittedAt) return false;
    if (Date.now() - submittedAt > PositionScanner.DEDUP_TTL_MS) {
        this.submissionDedup.delete(positionKey);
        return false;
    }
    return true;
}

// In processPosition(), before executor.execute():
if (this.isDuplicate(position.positionKey)) {
    log.info({ positionKey: position.positionKey }, "dedup: position already submitted within 60s, skipping");
    return;
}
// ... executor.execute() ...
this.submissionDedup.set(position.positionKey, Date.now());
```

**Key consideration:** The dedup guard is separate from the existing `failedCooldown` map. `failedCooldown` tracks positions that failed gas estimation (5-minute cooldown). `submissionDedup` tracks positions that were successfully submitted (60-second window to prevent double-submission). Both are needed.

### Pattern 2: Revert Tracking (LHARD-02)

**What:** After submitting a liquidation TX, poll for the receipt and update the database if it reverted.
**Where:** executor.ts, after `walletClient.writeContract()` and `store.createExecution()`.
**Mechanism:** Use `publicClient.waitForTransactionReceipt({ hash })` in a fire-and-forget async block. On receipt: if `status === 'reverted'`, update execution status to REVERTED with error reason. If `status === 'success'`, do nothing (confirmator handles MINED status via events).

**Example:**
```typescript
// After recording execution, start receipt watcher (non-blocking)
this.watchReceipt(executionId, hash, candidate.id).catch(err => {
    log.error({ err, executionId, txHash: hash }, "receipt watcher failed");
});

// Separate method
private async watchReceipt(executionId: string, txHash: Hex, candidateId: string) {
    try {
        const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: 120_000, // 2 minutes
        });

        if (receipt.status === "reverted") {
            // Try to extract revert reason via simulation
            let reason = "Transaction reverted (reason unknown)";
            try {
                // Simulate the failed TX to get the revert reason
                // This is best-effort -- may not always work
                await publicClient.call({
                    data: receipt.transactionHash, // won't work directly
                });
            } catch (simError: any) {
                reason = simError?.shortMessage || simError?.message?.slice(0, 200) || reason;
            }

            await store.updateExecutionStatus(executionId, "REVERTED", undefined, reason);
            await store.updateCandidateStatus(candidateId, "FAILED");
            log.warn({ executionId, txHash, reason }, "liquidation TX reverted");
        }
        // Note: MINED status is handled by confirmator via OrderExecuted events
    } catch (err: any) {
        if (err?.name === "WaitForTransactionReceiptTimeoutError") {
            log.warn({ executionId, txHash }, "receipt wait timed out -- execution may be stuck");
            // Do NOT update status -- let the stuck detection handle this in a future phase
        } else {
            throw err;
        }
    }
}
```

**Important:** The `waitForTransactionReceipt` call in viem v2 returns the receipt with `status: 'success' | 'reverted'`. It does NOT automatically throw on reverts (despite what some docs suggest -- verified via GitHub issue #1767). The code must explicitly check `receipt.status`.

**Revert reason extraction:** Getting the human-readable revert reason from a mined-but-reverted transaction is non-trivial. The most reliable approach: store the raw `receipt.status` and any error selector from the receipt logs. For a simpler first pass, just record "Transaction reverted" with the block number. The `failureReason` column already exists in the Prisma schema.

### Pattern 3: Per-Stage Timing Instrumentation (LHARD-04)

**What:** Log timing for each stage of the liquidation pipeline per cycle.
**Where:** scanner.ts `scan()` method, executor.ts `execute()` method, confirmator.ts `handleEvent()` method.
**Mechanism:** Capture `Date.now()` at stage boundaries, compute deltas, log as structured pino fields.

**Example:**
```typescript
// In scanner.scan():
async scan() {
    const cycleStart = Date.now();
    log.info("starting scan cycle");

    // Stage 1: Price refresh
    const priceStart = Date.now();
    this.priceCache.clear();
    await this.refreshPriceCache();
    const priceDurationMs = Date.now() - priceStart;

    // Stage 2: Account discovery
    const discoveryStart = Date.now();
    // ... existing discovery logic ...
    const discoveryDurationMs = Date.now() - discoveryStart;

    // Stage 3: Position fetch
    const fetchStart = Date.now();
    const positions = await fetchActivePositions(accountsToUse);
    const fetchDurationMs = Date.now() - fetchStart;

    // Stage 4: Liquidation checks
    const checkStart = Date.now();
    for (const position of positions) { /* ... */ }
    const checkDurationMs = Date.now() - checkStart;

    const totalDurationMs = Date.now() - cycleStart;
    log.info({
        totalDurationMs,
        priceDurationMs,
        discoveryDurationMs,
        fetchDurationMs,
        checkDurationMs,
        positionCount: positions.length,
    }, "scan cycle complete");
}

// In executor.execute():
async execute(candidate, decision) {
    const execStart = Date.now();
    // ... existing logic ...
    const submitDurationMs = Date.now() - execStart;
    log.info({ submitDurationMs, candidateId: candidate.id }, "execution submitted");
}
```

### Pattern 4: Multicall Batching for Position Discovery (LPERF-01)

**What:** Replace the serial `getPosition()` loop in `discoverAccountsWithPositions()` with a single multicall.
**Where:** positionFetcher.ts `discoverAccountsWithPositions()` method.
**Current problem:** Lines 249-262 make one `readContract` call per position key in a for loop. With N positions, this is N separate RPC round-trips.
**Solution:** Use `publicClient.multicall()` to batch all `getPosition()` calls into a single `eth_call`.

**Example:**
```typescript
async discoverAccountsWithPositions(): Promise<Address[]> {
    const accounts = new Set<Address>();
    const batchSize = 100;
    let start = 0;
    let hasMore = true;

    const POSITION_LIST_KEY = keccak256(
        encodeAbiParameters([{ type: "string" }], ["POSITION_LIST"])
    );

    try {
        const totalCount = await publicClient.readContract({
            address: DATA_STORE_ADDRESS,
            abi: DATA_STORE_ABI,
            functionName: "getBytes32Count",
            args: [POSITION_LIST_KEY],
        }) as bigint;

        log.info({ totalCount: totalCount.toString() }, "total positions found");

        while (hasMore && start < Number(totalCount)) {
            const end = Math.min(start + batchSize, Number(totalCount));

            const positionKeys = await publicClient.readContract({
                address: DATA_STORE_ADDRESS,
                abi: DATA_STORE_ABI,
                functionName: "getBytes32ValuesAt",
                args: [POSITION_LIST_KEY, BigInt(start), BigInt(end)],
            }) as Hex[];

            if (positionKeys.length === 0) {
                hasMore = false;
                break;
            }

            // MULTICALL: batch all getPosition calls into one RPC request
            const contracts = positionKeys.map(key => ({
                address: READER_ADDRESS,
                abi: READER_ABI,
                functionName: "getPosition" as const,
                args: [DATA_STORE_ADDRESS, key] as const,
            }));

            const results = await publicClient.multicall({
                contracts,
                allowFailure: true, // Individual positions can fail without breaking batch
            });

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.status === "success" && result.result) {
                    const position = result.result as PositionProps;
                    if (position.numbers.sizeInUsd > 0n) {
                        accounts.add(position.addresses.account);
                    }
                } else {
                    log.warn({ positionKey: positionKeys[i] }, "failed to fetch position in multicall");
                }
            }

            start = end;
            if (positionKeys.length < batchSize || start >= Number(totalCount)) {
                hasMore = false;
            }
        }

        const uniqueAccounts = Array.from(accounts);
        log.info({ count: uniqueAccounts.length }, "discovered unique accounts with positions");
        return uniqueAccounts;
    } catch (error) {
        log.error({ err: error }, "error discovering accounts");
        return [];
    }
}
```

**Key insight:** The `getBytes32ValuesAt` call already batches key retrieval. The bottleneck is the per-key `getPosition()` loop. With `multicall`, up to 100 `getPosition()` calls become a single RPC request.

### Pattern 5: Position Data Reuse (LPERF-02)

**What:** The executor currently re-fetches position data from on-chain (line 129 of executor.ts) even though the scanner already populated `collateralToken` and `isLong` on the PositionSnapshot.
**Where:** executor.ts `execute()` method.
**Current problem:** Lines 123-142 fetch position by key to get `collateralToken` and `isLong`. But the scanner already has this data from `positionFetcher.fetchAccountPositions()` and stores it on the snapshot.
**Solution:** Read `collateralToken` and `isLong` from the PositionSnapshot (which the scanner saved to DB). The PositionSnapshot already has optional `collateralToken` and `isLong` fields. The fix is to ensure these fields are persisted to the DB and read back in the executor.

**Current gap in Prisma schema:** The `position_snapshots` table does NOT have `collateralToken` or `isLong` columns. The internal PositionSnapshot type has them, but `store.savePositionSnapshot()` does not persist them. Two approaches:

**Approach A (recommended -- simpler):** Pass position data directly through the candidate pipeline in memory. The scanner calls `executor.execute()` synchronously within the same scan cycle, so the data is available. Add `collateralToken` and `isLong` to the candidate or pass them as parameters.

**Approach B (more robust):** Add `collateralToken` (String) and `isLong` (Boolean) columns to the Prisma schema, persist them in `savePositionSnapshot()`, and read them back in the executor via `getPositionSnapshotById()`.

**Recommendation:** Approach A is simpler and avoids a database migration. Since scanner calls executor synchronously within the same process, the data is already in memory. Approach B is better for long-term correctness (if executor ever runs asynchronously or in a separate process), but adds migration complexity.

### Anti-Patterns to Avoid
- **Over-engineering deduplication:** Do not use Redis or database-level dedup for a single-instance keeper. An in-memory Map with TTL is sufficient.
- **Blocking on receipt polling:** Do not `await` the receipt in the main execution flow. The executor should fire-and-forget the receipt watcher so it can continue processing other candidates.
- **Logging timestamps instead of durations:** Log `durationMs` fields, not raw `startTime`/`endTime`. Durations are directly actionable for performance analysis.
- **Multicall without allowFailure:** Always use `allowFailure: true` in multicall. A single bad position key should not break the entire batch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batching RPC reads | Custom Promise.all with individual readContract calls | `publicClient.multicall()` | Multicall3 is a single atomic eth_call; Promise.all is still N separate RPC calls, just concurrent |
| Transaction receipt polling | setInterval polling loop | `publicClient.waitForTransactionReceipt()` | Handles exponential backoff, timeout, and chain reorganization detection |
| Structured timing logs | Custom logging wrapper | pino child logger with metadata fields | pino already handles JSON serialization, levels, and transport |

**Key insight:** viem 2.40.3 already has every primitive needed for this phase. No new libraries are required.

## Common Pitfalls

### Pitfall 1: Multicall calldata size limits
**What goes wrong:** Batching too many calls in a single multicall can exceed RPC provider calldata limits.
**Why it happens:** Each `getPosition()` call returns a large tuple. 100+ calls in one batch may exceed some providers' limits.
**How to avoid:** Use the existing `batchSize = 100` loop. Each batch of 100 position keys becomes one multicall. For Base Sepolia, 100 is conservative and safe.
**Warning signs:** RPC errors like "request entity too large" or "calldata exceeds limit".

### Pitfall 2: waitForTransactionReceipt does NOT throw on reverts
**What goes wrong:** Developer assumes `waitForTransactionReceipt` throws when TX reverts, doesn't check `receipt.status`.
**Why it happens:** Some viem documentation versions suggest it throws on revert; actual behavior in v2 returns the receipt with `status: 'reverted'`.
**How to avoid:** Always explicitly check `receipt.status === 'reverted'`. Do not rely on try/catch for revert detection.
**Warning signs:** Executions stuck in SUBMITTED status forever.

### Pitfall 3: Dedup guard does not survive process restart
**What goes wrong:** If the keeper process restarts, the in-memory dedup Map is cleared, potentially allowing duplicate submissions.
**Why it happens:** In-memory state is ephemeral.
**How to avoid:** Acceptable on testnet. For mainnet, would need database-level dedup (check for recent SUBMITTED/PENDING executions by positionKey). For Phase 26, the in-memory approach is sufficient per requirements.
**Warning signs:** Duplicate executions in DB after keeper restart during active liquidation cycle.

### Pitfall 4: Revert reason extraction is unreliable
**What goes wrong:** Developer spends time trying to decode exact revert reason from a mined-but-reverted TX.
**Why it happens:** EVM doesn't store revert reasons on-chain (only in trace data). Getting the reason requires debug_traceTransaction or re-simulating at the reverted block.
**How to avoid:** Store the basic fact that it reverted, plus any error selector bytes from receipt logs. Full revert reason decoding is a nice-to-have, not a requirement. The success criteria says "error reason" -- the receipt status itself plus any extracted error selector is sufficient.
**Warning signs:** Over-engineering revert reason extraction instead of shipping the basic tracking.

### Pitfall 5: Executor position data columns missing from Prisma schema
**What goes wrong:** LPERF-02 assumes collateralToken and isLong are in the DB, but they are not persisted.
**Why it happens:** `savePositionSnapshot()` does not write `collateralToken` or `isLong` to the database, even though the internal type has these fields.
**How to avoid:** Use the in-memory approach (Approach A) to avoid schema migration. Or add the columns if long-term robustness is desired.
**Warning signs:** Executor still needs to call `fetchPositionByKey()` after "fix" because DB snapshot lacks the data.

## Code Examples

Verified patterns from the existing codebase and viem documentation:

### viem multicall (from viem 2.40.3 API)
```typescript
// Source: https://viem.sh/docs/contract/multicall
const results = await publicClient.multicall({
    contracts: [
        {
            address: READER_ADDRESS,
            abi: READER_ABI,
            functionName: "getPosition",
            args: [DATA_STORE_ADDRESS, positionKey1],
        },
        {
            address: READER_ADDRESS,
            abi: READER_ABI,
            functionName: "getPosition",
            args: [DATA_STORE_ADDRESS, positionKey2],
        },
    ],
    allowFailure: true,
});

// results[0].status === "success" | "failure"
// results[0].result  -- the decoded return value (when success)
// results[0].error   -- the error (when failure)
```

### viem waitForTransactionReceipt (from viem 2.40.3 API)
```typescript
// Source: https://viem.sh/docs/actions/public/waitForTransactionReceipt
const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 120_000, // 2 minute timeout
});

// receipt.status: "success" | "reverted"
// receipt.blockNumber: bigint
// receipt.transactionHash: Hex
```

### pino structured timing log (existing pattern in codebase)
```typescript
// Source: keeper-service/src/utils/logger.ts (pino 10.3.1)
const log = logger.child({ module: "scanner" });

const start = Date.now();
// ... operation ...
const durationMs = Date.now() - start;

log.info({ durationMs, positionCount: 42 }, "scan cycle complete");
// Output: {"level":30,"time":...,"module":"scanner","durationMs":1234,"positionCount":42,"msg":"scan cycle complete"}
```

### Confirming riskEngine.ts is dead code
```bash
# Verified: zero imports of riskEngine anywhere in the codebase
$ grep -r "riskEngine" keeper-service/src/ --include="*.ts"
# Only result: the file itself (export line)
keeper-service/src/core/riskEngine.ts:58:export const riskEngine = new RiskEngine();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Serial `getPosition()` in for loop | `publicClient.multicall()` with batched calls | viem 1.0+ | N RPC calls become 1 per batch |
| Manual setInterval receipt polling | `waitForTransactionReceipt()` built-in | viem 1.0+ | Handles backoff, timeout, reorg detection |
| Custom risk engine (riskEngine.ts) | On-chain `Reader.isPositionLiquidatable()` | Phase 25 | Scanner now uses contract for liquidatability, making local risk calc dead code |

**Deprecated/outdated:**
- `riskEngine.ts`: Superseded by on-chain `isPositionLiquidatable()` call in scanner.ts. Zero imports. Safe to delete.

## Open Questions

1. **Revert reason depth**
   - What we know: Prisma schema has `failureReason` column on LiquidationExecution. Receipt gives `status: 'reverted'` but not the human-readable reason.
   - What's unclear: How much effort should go into extracting the actual Solidity revert reason vs. just recording "reverted at block X".
   - Recommendation: Record `receipt.status === 'reverted'` with block number. Optionally attempt `publicClient.call()` re-simulation at the reverted block to extract the error selector. Don't block on perfect revert reason decoding.

2. **Schema migration for LPERF-02**
   - What we know: PositionSnapshot has `collateralToken` and `isLong` in the TypeScript type but NOT in the Prisma schema.
   - What's unclear: Whether the project wants to add a Prisma migration or use the in-memory approach.
   - Recommendation: Use the in-memory approach (pass data through the candidate pipeline) to avoid migration complexity. The scanner and executor run in the same process synchronously.

3. **LIQ-03/LIQ-04 from Phase 25**
   - What we know: These were deferred from Phase 25 due to pool reserve saturation. STATE.md says "LIQ-03/LIQ-04 retry when pool has >$5000 liquidity."
   - What's unclear: Whether Phase 26 should include retrying these or if they remain deferred.
   - Recommendation: Phase 26 requirements (LHARD-01 through LPERF-02) are code-level improvements that don't require live testnet positions. LIQ-03/LIQ-04 E2E verification is a separate concern. Focus Phase 26 on the six listed requirements.

## Sources

### Primary (HIGH confidence)
- **keeper-service source code** (direct reading) - scanner.ts, executor.ts, confirmator.ts, positionFetcher.ts, riskEngine.ts, store.ts, types.ts, contract.ts, config.ts, index.ts, prisma/schema.prisma
- **viem 2.40.3** (installed version) - multicall, waitForTransactionReceipt APIs
- **pino 10.3.1** (installed version) - child logger, structured logging
- **Prisma 5.22.0** (installed version) - schema with failureReason/REVERTED fields

### Secondary (MEDIUM confidence)
- [viem multicall docs](https://viem.sh/docs/contract/multicall) - API shape, allowFailure parameter
- [viem waitForTransactionReceipt](https://v1.viem.sh/docs/actions/public/waitForTransactionReceipt.html) - receipt status behavior
- [viem GitHub Issue #1767](https://github.com/wevm/viem/issues/1767) - confirms waitForTransactionReceipt does NOT throw on reverts in v2
- [Batch Contract Reads with Multicall3 + Viem](https://phonbopit.com/batch-contract-reads-with-multicall3-viem/) - multicall usage pattern

### Tertiary (LOW confidence)
- None -- all findings verified against installed code or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed, APIs verified against installed node_modules
- Architecture: HIGH - patterns derived directly from reading the existing codebase and understanding exact gaps
- Pitfalls: HIGH - identified from actual code inspection (e.g., missing Prisma columns, receipt status behavior)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- no library upgrades or architectural changes expected)
