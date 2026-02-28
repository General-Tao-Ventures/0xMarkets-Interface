# Phase 27: Liquidation Pipeline End-to-End Execution - Research

**Researched:** 2026-02-28
**Domain:** Keeper-service liquidation pipeline (scanner/executor/confirmator) on Base Sepolia testnet
**Confidence:** HIGH

## Summary

Phase 27 closes the two remaining v1.7 requirements (LIQ-03, LIQ-04) by executing a real liquidation on Base Sepolia. All pipeline code is complete and verified structurally correct across Phases 25-26. The blockers are operational, not code-level: (1) the WETH/USD pool needs more USDC liquidity to allow position creation, and (2) the order-execution-keeper's `.env` still has the wrong `PYTH_LAZER_FEED_PROVIDER_ADDRESS` (though the keeper-service is now correct).

The work is primarily testnet operations -- seeding pool liquidity, creating a high-leverage position, and observing the pipeline execute. The code changes are minimal: fixing the order-execution-keeper's `.env` address, and potentially updating `seed-pool.ts` to deposit more USDC. The verification is observational: a successful `executeLiquidation` TX on Basescan and a `MINED`/`EXECUTED` row in PostgreSQL.

**Primary recommendation:** Fix the order-execution-keeper oracle address, seed the WETH/USD pool with 5,000+ USDC via `seed-pool.ts`, create a high-leverage position via `test-liquidation.ts`, and observe the keeper-service pipeline execute and confirm the liquidation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIQ-03 | Liquidation executor successfully calls executeLiquidation on a real test position | Executor code is complete (executor.ts lines 195-205). Blocked by pool reserves. Requires: (1) pool has >$5,000 USDC, (2) a high-leverage position exists, (3) position becomes undercollateralized. Gas estimation gate validates before submission. |
| LIQ-04 | Confirmator records liquidation result in PostgreSQL with correct status | Confirmator code is complete (confirmator.ts lines 135-144). Watches for OrderExecuted events with orderType=7. Depends on LIQ-03 succeeding first. Automatically updates execution to MINED and candidate to EXECUTED. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.x | Blockchain interaction (readContract, writeContract, multicall) | Already used throughout keeper-service and e2e tests |
| @prisma/client | ^5.x | PostgreSQL ORM for liquidation records | Already used in keeper-service store.ts |
| pino | ^8.x | Structured logging with timing fields | Already used in keeper-service |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aspect-build/pyth-lazer-sdk | ^0.x | WebSocket Pyth Lazer price feeds | Already initialized in keeper-service for oracle cache |
| dotenv | ^16.x | Environment variable loading | Already used in both keeper services |

### No New Dependencies
This phase requires zero new library installations. All code is already written and deployed. The work is operational (testnet interaction) and configuration (fixing one address).

## Architecture Patterns

### Existing Pipeline Architecture (No Changes Needed)
```
keeper-service/src/
├── core/
│   ├── scanner.ts          # Discovers positions, checks liquidatability via Reader contract
│   ├── executor.ts         # Submits executeLiquidation to LiquidationHandler
│   ├── confirmator.ts      # Watches OrderExecuted events, updates DB
│   ├── store.ts            # Prisma CRUD for candidates/executions
│   ├── contract.ts         # Client setup, address exports (PYTH_LAZER + ORACLE_PROVIDER)
│   ├── positionFetcher.ts  # Multicall position discovery
│   └── pythLazerOracle.ts  # WebSocket Lazer price cache
├── config.ts               # Env var loading with fallback defaults
└── index.ts                # Service entry point, scan loop
```

### Oracle Address Architecture (Two Distinct Roles)
```
Scanner path:
  PYTH_LAZER_FEED_PROVIDER_ADDRESS = 0x8a3eb351  (has getStoredPrice)
  └── scanner.ts → refreshPriceCache() → getStoredPrice(token) → price for isPositionLiquidatable

Executor path:
  ORACLE_PROVIDER_ADDRESS = 0xc5810FC  (registered in DataStore IS_ORACLE_PROVIDER_ENABLED)
  └── executor.ts → buildOracleParams() → providers[i] = ORACLE_PROVIDER_ADDRESS
  └── LiquidationHandler.executeLiquidation(account, market, collateral, isLong, oracleParams)
  └── Oracle.sol validates IS_ORACLE_PROVIDER_ENABLED for each provider → calls getOraclePrice(token, data)
```

This two-address design is intentional and correct:
- `0x8a3eb351` has `getStoredPrice()` for reading cached prices (scanner uses this)
- `0xc5810FC` is registered in DataStore as an enabled oracle provider (executor must use this for Oracle.sol validation)
- Both can process inline Pyth Lazer data via `getOraclePrice(token, data)` which verifies the Pyth signature

### Pool Liquidity Flow (seed-pool.ts)
```
1. ensureApprovals() → mint mUSDC if low, approve SyntheticsRouter
2. multicall([sendWnt, sendTokens(long), sendTokens(short), createDeposit])
3. Order-execution-keeper detects DepositCreated event → executes deposit
4. Pool USDC increases → open interest headroom increases
```

### Test Liquidation Flow (test-liquidation.ts)
```
1. ensureApprovals() → mint mUSDC, approve
2. createPosition() → multicall([sendWnt, sendTokens, createOrder])
3. Order-execution-keeper executes order → position created on-chain
4. Verify position exists (sizeInUsd > 0) and is not immediately closed by fees
5. Wait for keeper-service scanner to detect position as liquidatable
6. Executor submits executeLiquidation → TX succeeds on Basescan
7. Confirmator detects OrderExecuted (orderType=7) → updates DB
```

### Anti-Patterns to Avoid
- **Do NOT change ORACLE_PROVIDER_ADDRESS in keeper-service:** It must remain 0xc5810FC because Oracle.sol validates `IS_ORACLE_PROVIDER_ENABLED` in DataStore. Changing it to 0x8a3eb351 will cause executor TX to revert.
- **Do NOT use synthetic markets (GOLD/EUR/GBP/JPY):** Pyth Lazer has "best ask price" data gaps for these tokens. Only WETH/USD and WBTC/USD have reliable oracle data.
- **Do NOT create positions with very small collateral (<$10):** Fees consume the entire collateral amount and the position is immediately closed (zero size on-chain).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pool liquidity injection | Manual contract calls | `e2e/seed-pool.ts` | Already handles approvals, minting, deposit creation, keeper execution waiting |
| Position creation | Manual contract calls | `e2e/test-liquidation.ts` | Already handles multicall encoding, size tiers, direction iteration, on-chain verification |
| USDC minting | Faucet UI | `ensureApprovals()` in helpers.ts | Auto-mints 500 mUSDC if balance < 200 (mUSDC has public `mint()`) |
| Event waiting | Manual log polling | `waitForExecution()` in helpers.ts | Polls EventEmitter logs with timeout, handles Executed/Cancelled/Timeout |

**Key insight:** The e2e tooling already exists. The gap is not code -- it is testnet state (pool liquidity) and one wrong address in order-execution-keeper.

## Common Pitfalls

### Pitfall 1: Pool Reserve Catch-22
**What goes wrong:** Even with liquidity, reserve calculations include the collateral amount itself. Large collateral ($100+) inflates reserves past the cap. Tiny collateral ($5) survives reserve checks but fees consume it entirely.
**Why it happens:** The protocol's `InsufficientReserveForOpenInterest` check accounts for total OI including the new position's collateral.
**How to avoid:** Ensure the pool has enough headroom (>$5,000 total USDC) so that positions with $10-50 collateral at 10-30x leverage fit within reserves and survive fees.
**Warning signs:** Order TX succeeds but position has zero `sizeInUsd` on-chain (fees consumed everything), or order is cancelled by keeper.

### Pitfall 2: Order-Execution-Keeper Not Running
**What goes wrong:** Orders and deposits are created on-chain but never executed. Positions don't appear, pool deposits don't process.
**Why it happens:** The order-execution-keeper (port 37018) must be running to execute deposit and order operations.
**How to avoid:** Always run the health check (`curl localhost:37018/health`) before starting. The `test-liquidation.ts` already does this pre-flight check.
**Warning signs:** `waitForExecution()` times out after 180s.

### Pitfall 3: Nonce Conflict Between Keepers
**What goes wrong:** Both keeper-service and order-execution-keeper share the same wallet. If keeper-service submits an `executeLiquidation` TX while order-execution-keeper is submitting an order execution, nonce conflict can cause one to fail.
**Why it happens:** Single wallet used for both services on testnet (documented risk in STATE.md).
**How to avoid:** This is a known testnet limitation. If it occurs, the failed TX will be caught by error handling. The receipt watcher (Phase 26) tracks REVERTED status. Retry on next scan cycle.
**Warning signs:** `nonce too low` or `replacement transaction underpriced` errors in logs.

### Pitfall 4: Lazer Price Staleness
**What goes wrong:** Scanner detects position as liquidatable using stored prices, but executor's gas estimation fails because Lazer inline data is stale or missing.
**Why it happens:** Scanner reads `getStoredPrice` (prices pushed by order-execution-keeper during last order execution). If no orders have been executed recently, stored prices become stale.
**How to avoid:** Ensure order-execution-keeper is running and has recently executed at least one operation (which pushes fresh Lazer prices). The scanner's cooldown mechanism (5 min) prevents thrashing on stale-price rejections.
**Warning signs:** Executor logs `PositionShouldNotBeLiquidated` despite scanner detecting the position as liquidatable.

### Pitfall 5: seed-pool.ts Deposits Only 200 USDC
**What goes wrong:** Running seed-pool.ts once only adds 200 USDC (100 per side). This is far less than the >$5,000 needed.
**Why it happens:** The script was written for initial testing, not for the liquidity scale needed for liquidation testing.
**How to avoid:** Either (a) modify the deposit amount in seed-pool.ts to 5,000+ USDC per side, or (b) run the script multiple times. Option (a) is preferred -- single TX is simpler to verify.
**Warning signs:** Pool reserve analysis still shows <$5,000 USDC after seeding.

## Code Examples

### Current Oracle Address Configuration (keeper-service/src/config.ts)
```typescript
// Source: keeper-service/src/config.ts lines 22-28
// Scanner uses this for getStoredPrice simulation
pythLazerFeedProviderAddress: (process.env.PYTH_LAZER_FEED_PROVIDER_ADDRESS
  || "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05") as `0x${string}`,

// Executor uses this for executeLiquidation (must be registered in DataStore)
oracleProviderAddress: (process.env.ORACLE_PROVIDER_ADDRESS
  || process.env.PYTH_LAZER_FEED_PROVIDER_ADDRESS
  || "0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6") as `0x${string}`,
```

### Current Oracle Address State (.env files)
```bash
# keeper-service/.env (CORRECT -- fixed in 25-03 and 25-04)
PYTH_LAZER_FEED_PROVIDER_ADDRESS=0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05  # scanner
ORACLE_PROVIDER_ADDRESS=0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6            # executor

# order-execution-keeper-service/.env (CORRECT for its purpose)
# Uses 0xc5810FC because it pushes prices via updatePrice() and is registered in DataStore
PYTH_LAZER_FEED_PROVIDER_ADDRESS="0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6"
```

### Executor Gas Estimation Gate (executor.ts lines 161-192)
```typescript
// Source: keeper-service/src/core/executor.ts
try {
    gasEstimate = await publicClient.estimateContractGas({
        address: LIQUIDATION_HANDLER_ADDRESS,
        abi: LIQUIDATION_HANDLER_ABI,
        functionName: "executeLiquidation",
        args: [accountToLiquidate, market, collateralToken, isLong, oracleParams],
        account,
    });
} catch (error) {
    // 0xee919dd9 = PositionShouldNotBeLiquidated
    // Gas estimation failure = TX would revert -- don't waste gas
    scanner.markPositionFailed(positionSnapshot.positionKey); // 5-min cooldown
    await store.updateCandidateStatus(candidate.id, "FAILED");
    return;
}
```

### Confirmator Event Handling (confirmator.ts lines 135-144)
```typescript
// Source: keeper-service/src/core/confirmator.ts
// After verifying orderType === 7 (Liquidation):
await store.updateExecutionStatus(execution.id, "MINED", orderKey, undefined, minedAt);
await store.updateCandidateStatus(execution.candidateId, "EXECUTED");
```

### Pool Seeding Script (seed-pool.ts -- needs amount increase)
```typescript
// Source: e2e/seed-pool.ts line 7
const depositAmount = 100_000_000n; // 100 USDC each side = 200 total
// NEEDS TO BE: 5_000_000_000n (5,000 USDC each side = 10,000 total)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hermes-only pricing | getStoredPrice from PythLazerFeedProvider | Phase 25-02 | Scanner uses exact on-chain prices that match executor's Lazer data |
| Serial position fetching | Multicall batching | Phase 26-02 | Single RPC call for all position queries |
| No dedup/cooldown | 60s submission dedup + 5min failed cooldown | Phase 25-02, 26-01 | Prevents scan thrashing and double-submission |
| Single oracle address | Two addresses (scanner vs executor) | Phase 25-04 | Scanner reads stored prices from 0x8a3eb351; executor uses 0xc5810FC registered in DataStore |

## Open Questions

1. **Will the position become liquidatable naturally or need inducement?**
   - What we know: High leverage (20-30x) positions are near-liquidation by design. ETH price movement of 3-5% should trigger liquidation.
   - What's unclear: Whether current ETH volatility on testnet will move prices enough, or if manual collateral withdrawal is needed.
   - Recommendation: Create the position and wait for 1-2 scan cycles. If not liquidatable after several minutes, consider creating a position in the opposite direction to the current trend, or reduce collateral further. The scanner's `isPositionLiquidatable` check via Reader contract is the authoritative source.

2. **How much USDC is needed for reliable position creation?**
   - What we know: Pool had $1,548 USDC with $1,370 reserved (95% factor). Comments in test-liquidation.ts mention ~$10,256 USDC and ~$4,871 headroom per side, suggesting pool was seeded since Phase 25-04.
   - What's unclear: Current exact pool state (may have changed since last test run).
   - Recommendation: Query pool state on-chain before seeding. Target >$5,000 USDC total headroom per side. The seed-pool.ts script should deposit at least 5,000 USDC per side (10,000 total) to ensure ample room.

3. **Is the order-execution-keeper address actually wrong?**
   - What we know: order-execution-keeper uses `PYTH_LAZER_FEED_PROVIDER_ADDRESS=0xc5810FC` which is the DataStore-registered oracle provider. The order-execution-keeper pushes prices via `updatePrice()` on this contract and uses it as the provider in `setPricesParams` for order execution.
   - What's unclear: Whether `updatePrice()` on 0xc5810FC actually stores prices that 0x8a3eb351's `getStoredPrice()` can read. Phase 25 verification noted 0xc5810FC "reverts on getStoredPrice" but that does not affect order execution (which uses `getOraclePrice` with inline data).
   - Recommendation: The order-execution-keeper address is likely correct for its use case. The scanner reads from 0x8a3eb351 which has independently stored prices. Both addresses can process inline Lazer data. No change needed unless testing reveals an issue.

## Sources

### Primary (HIGH confidence)
- keeper-service source code: scanner.ts, executor.ts, confirmator.ts, contract.ts, config.ts, store.ts, positionFetcher.ts, index.ts -- read directly
- keeper-service/.env -- read directly, verified commit history (25-03, 25-04 fixes committed)
- order-execution-keeper-service/.env -- read directly
- e2e/test-liquidation.ts, e2e/seed-pool.ts, e2e/helpers.ts, e2e/config.ts -- read directly
- Phase 25 VERIFICATION.md -- comprehensive gap analysis with on-chain evidence
- Phase 25-02 SUMMARY -- 9 bug fixes, pipeline status table
- Phase 25-04 SUMMARY -- pool reserve analysis with exact numbers
- v1.7 MILESTONE-AUDIT.md -- requirement status, integration gaps, tech debt

### Secondary (MEDIUM confidence)
- test-liquidation.ts comments about pool having ~$10,256 USDC -- this was written during a specific run and pool state may have changed since

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all code is written and committed, read directly from source
- Architecture: HIGH - two-address oracle pattern verified through config.ts, contract.ts, executor.ts code
- Pitfalls: HIGH - all pitfalls documented from actual Phase 25 test sessions (50+ order attempts)
- Pool liquidity requirements: MEDIUM - exact current state unknown, but >$5,000 target is well-justified by Phase 25-04 analysis

**Research date:** 2026-02-28
**Valid until:** 2026-03-07 (testnet state changes; code is stable)
