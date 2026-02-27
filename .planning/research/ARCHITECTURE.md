# Architecture: Liquidation Readiness Integration

**Domain:** Perpetual futures keeper service — contract bug fix + liquidation pipeline verification and optimization
**Researched:** 2026-02-27
**Confidence:** HIGH (based on direct source code analysis of all integration points)

## Current System Architecture

Two independent keeper processes run on a single DigitalOcean droplet (142.93.203.222) via Docker Compose, sharing a wallet and RPC but otherwise isolated:

```
docker-compose.yml (/opt/0xmarkets/)
  |
  +-- postgres (postgres:16)
  |     - Two databases: keeper_service, order_execution_keeper (order_execution_keeper unused post-v1.5)
  |     - Volume: pgdata
  |
  +-- keeper-service (port 37017)            <-- FOCUS OF v1.7
  |     - scanner.ts: scans all positions for liquidatability
  |     - riskEngine.ts: secondary risk scoring (currently bypassed by scanner)
  |     - executor.ts: calls LiquidationHandler.executeLiquidation()
  |     - confirmator.ts: watches EventLog2 for OrderExecuted confirmation
  |     - positionFetcher.ts: discovers accounts + fetches positions from DataStore
  |     - pythLazerOracle.ts: WebSocket price cache (4-connection pool, 200ms updates)
  |     - store.ts: PostgreSQL via Prisma (PositionSnapshot, LiquidationCandidate, etc.)
  |     - candleCollector.ts: OHLC candles from Hermes
  |     - httpServer.ts: REST API at /health, /positions, /candidates, /executions
  |     - ORACLE_MODE env var (default: "hermes") -- must be set to "lazer" for prod
  |     - SCAN_INTERVAL_SECONDS: 30 (default)
  |
  +-- order-execution-keeper (port 37018)    <-- UNCHANGED for v1.7
        - oracle.ts: Pyth Lazer WebSocket (single connection, 200ms updates)
        - watcher.ts: EventEmitter WebSocket watching DepositCreated/WithdrawalCreated/OrderCreated
        - poller.ts: DataStore polling every 5s (safety net)
        - executor.ts: sequential queue, calls DepositHandler/WithdrawalHandler/OrderHandler
        - KNOWN BUG: OrderHandler division-by-zero on JPY/USD reversed markets (triggerPrice=0)
```

## v1.7 Changes: What Changes vs What Stays the Same

### What Changes

**1. OrderHandler.sol — Contract Redeployment**

The bug: when a user places a market order on a reversed market (JPY/USD), the frontend sets `triggerPrice=0`. `BaseOrderUtils.getExecutionPriceForIncrease()` computes `sizeDeltaUsd / sizeDeltaInTokens` where `sizeDeltaInTokens=0` for reversed markets, causing a Solidity panic (division by zero). This only affects reversed markets (currently JPY/USD).

The fix: add a guard in `BaseOrderUtils.sol` before the division: if `sizeDeltaInTokens == 0`, return `acceptablePrice` directly (matching the fallback behavior already documented in the code comments). Redeploy `OrderHandler.sol` only — `LiquidationHandler.sol` is not affected.

**Impact of redeployment:** Every service that holds `ORDER_HANDLER_ADDRESS` must be updated. The `LiquidationHandler.executeLiquidation()` does NOT use `OrderHandler` — it creates the order internally via `LiquidationUtils.createLiquidationOrder()` and executes it through `BaseOrderHandler._getExecuteOrderParams()`. So the liquidation pipeline is unaffected by the OrderHandler redeploy.

**2. keeper-service — Liquidation Pipeline Fixes**

The liquidation pipeline exists but has not been verified end-to-end on Base Sepolia. Issues to address:

- `ORACLE_MODE` must be `"lazer"` for the scanner's `getTokenPrice()` to use `PythLazerFeedProvider.getStoredPrice()`. In Hermes mode, `pythLazerOracle` singleton is null and `executor.ts` line 71 (`lazerOracle?.getLatestUpdate(token)`) silently passes `"0x"` as oracle data, relying on stored prices. This works only if the order-execution-keeper has recently pushed prices on-chain.
- The scanner's `discoverAccountsWithPositions()` calls `getBytes32ValuesAt` in a loop with serial RPC calls — N positions = N RPC calls. This is the primary scanning bottleneck at scale.
- The executor calls `positionFetcher.fetchAccountPositions()` again during execution (step 4) to get `collateralToken` and `isLong` — this is a redundant RPC call since the scanner already fetched this data in `processPosition()`.
- The `riskEngine.ts` is imported but never called in `scanner.ts`. The scanner calls `Reader.isPositionLiquidatable()` directly instead. `riskEngine.ts` is dead code.
- The `confirmator.ts` watches `EventLog2` via HTTP long-polling (not WebSocket), which may miss events if the RPC connection drops.

**3. docker-compose.yml — Environment Variables**

After OrderHandler redeployment, `ORDER_HANDLER_ADDRESS` must be updated in `docker-compose.yml`. Additionally, `keeper-service` needs `ORACLE_MODE=lazer` if it is not already set.

### What Stays the Same

| Component | Status | Notes |
|-----------|--------|-------|
| postgres container | Unchanged | Schema, volumes, both databases retained |
| order-execution-keeper (37018) | Unchanged | Redeploy OrderHandler address only |
| LiquidationHandler contract | Unchanged | Not involved in the bug |
| DataStore / Reader / EventEmitter | Unchanged | Core infrastructure contracts unchanged |
| PythLazerFeedProvider | Unchanged | Stores on-chain prices, used by liquidation executor |
| keeper-service DB schema (Prisma) | Unchanged | PositionSnapshot, LiquidationCandidate models stay |
| keeper-service httpServer | Unchanged | /health, /candidates, /executions endpoints stay |
| candleCollector | Unchanged | Not related to liquidation |
| BetterStack monitoring | Unchanged | Pings /health at both ports |
| Vercel frontend | Unchanged | No UI changes for liquidation keeper |

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **scanner.ts** | Discover accounts with positions, call `Reader.isPositionLiquidatable()`, create DB candidate records | positionFetcher, PythLazerFeedProvider (stored prices), Reader contract, store.ts |
| **positionFetcher.ts** | Fetch all positions from DataStore POSITION_LIST or per-account | DataStore contract, Reader contract |
| **executor.ts** (liq) | Build oracle params, call `LiquidationHandler.executeLiquidation()`, record execution in DB | LiquidationHandler contract, PythLazerFeedProvider, Reader, store.ts |
| **confirmator.ts** | Watch EventLog2 for OrderExecuted events, update DB status | EventEmitter contract (HTTP polling), store.ts, Reader contract |
| **pythLazerOracle.ts** | Maintain 200ms price cache from Pyth Lazer WS | Pyth Lazer WS, PythLazerFeedProvider contract (push prices on-chain) |
| **order-execution-keeper oracle.ts** | Maintain price cache, push prices every 5s via background interval | Pyth Lazer WS, PythLazerFeedProvider contract |
| **LiquidationHandler.sol** | Create liquidation order on-chain, validate oracle prices, execute position decrease | Oracle contract (via withOraclePrices modifier), DataStore, EventEmitter |

## Oracle Price Flow

The liquidation pipeline has a critical dependency on on-chain stored prices:

```
Pyth Lazer WebSocket (200ms)
  |
  +-> order-execution-keeper oracle.ts cache (in-memory)
  |     - Pushes to PythLazerFeedProvider on-chain every ~5s
  |     - Also sends inline price data on every executeDeposit/Withdrawal/Order call
  |
  +-> keeper-service pythLazerOracle.ts cache (in-memory, 4-connection pool)
        - Provides rawUpdate bytes for inline oracle params in executeLiquidation
        - Falls back to "0x" if no cached update (relies on order-execution-keeper's push)

keeper-service scanner.ts getTokenPrice():
  -> reads PythLazerFeedProvider.getStoredPrice(tokenAddress) on-chain
  -> validates age < 60 seconds
  -> uses stored price for isPositionLiquidatable() check
  -> NOTE: this means liquidatability is assessed against on-chain stored prices,
     which are ~5s stale (last push from order-execution-keeper)

keeper-service executor.ts buildOracleParams():
  -> tries pythLazerOracle.getLatestUpdate(token) for inline price bytes
  -> if null: falls back to "0x" (relies on stored price in PythLazerFeedProvider)
  -> LiquidationHandler.withOraclePrices reads the stored price when data is "0x"
```

**Key insight:** The liquidation keeper does NOT need its own on-chain price push mechanism — it piggybacks on the order-execution-keeper's 5s background push. The 60s staleness check in `getTokenPrice()` provides the safety margin.

## Contract Redeployment Steps

When OrderHandler is redeployed, the following config locations must be updated:

| Service | File | Field |
|---------|------|-------|
| order-execution-keeper | `docker-compose.yml` | `ORDER_HANDLER_ADDRESS` |
| order-execution-keeper | `.env` (server) | `ORDER_HANDLER_ADDRESS` |
| Interface SDK | `sdk/src/configs/contracts.ts` | orderHandler |
| Interface | `src/config/static/markets.ts` | (may reference handler) |
| Interface | `src/config/multichain.ts` | (may reference handler) |
| Contracts repo | `0xmarkets_contract/config/` | OrderHandler address |

LiquidationHandler does NOT need updating — it is not redeployed.

### Redeployment Verification

After redeployment, verify:
1. E2E test for JPY market order completes without revert (was the 1 skipped test)
2. `Data.OrderHandler` in DataStore matches new address (on-chain audit)
3. keeper-service and order-execution-keeper restart cleanly with new address

## Liquidation Pipeline Data Flow

```
Every 30 seconds (SCAN_INTERVAL_SECONDS):
  |
  scanner.scan()
    |
    1. positionFetcher.discoverAccountsWithPositions()
       -> DataStore.getBytes32Count(POSITION_LIST_KEY)
       -> DataStore.getBytes32ValuesAt(POSITION_LIST_KEY, 0, N)  [one call]
       -> for each key: Reader.getPosition(dataStore, key)        [N serial calls -- BOTTLENECK]
       -> extract unique accounts
    |
    2. for each account: positionFetcher.fetchAccountPositions(account)
       -> Reader.getAccountPositions(dataStore, account, 0, 100)
    |
    3. for each position with sizeInUsd > 0:
       a. Reader.getMarket(dataStore, market)
       b. PythLazerFeedProvider.getStoredPrice(indexToken)  [3 calls: index, long, short]
       c. Reader.isPositionLiquidatable(dataStore, referralStorage, positionKey, market, prices, true)
       |
       If liquidatable:
         d. store.savePositionSnapshot()         [DB write]
         e. store.createCandidate()               [DB write]
         f. walletClient.signMessage()            [local crypto]
         g. store.saveSignedDecision()            [DB write]
         h. executor.execute()
            |
            4. store.getPositionSnapshotById()   [DB read]
            5. positionFetcher.fetchAccountPositions()  [REDUNDANT -- already done in step 2]
            6. Reader.getMarket(dataStore, market)      [REDUNDANT -- done in step 3a]
            7. buildOracleParams()
               -> pythLazerOracle.getLatestUpdate(token) for each token
            8. publicClient.estimateFeesPerGas()
            9. publicClient.estimateContractGas()
            10. walletClient.writeContract(LiquidationHandler.executeLiquidation)
            11. store.createExecution()          [DB write]
            12. store.updateCandidateStatus()    [DB write]
    |
  confirmator (background EventLog2 watcher):
    - on OrderExecuted: store.updateExecutionStatus(MINED)
    - on candidateId: store.updateCandidateStatus(EXECUTED)
```

## Bottleneck Analysis

### Scanning Bottleneck: Serial RPC Calls

`discoverAccountsWithPositions()` makes N+1 serial RPC calls for N positions:
- 1 call: `getBytes32Count`
- N calls: `Reader.getPosition` (one per position key, in a for loop)

For 100 positions, this is 101 serial RPC calls. Base Sepolia latency ~100-200ms per call = 10-20 seconds per scan cycle. This exceeds the 30s scan interval once position count grows.

**Fix:** Use `publicClient.multicall()` to batch all `Reader.getPosition` calls into a single RPC request. This reduces 100 serial calls to 1 multicall.

### Execution Bottleneck: Redundant Fetches

`executor.execute()` re-fetches position data from the contract (step 5) even though `scanner.processPosition()` already has the `collateralToken` and `isLong` from step 2. The data should be passed through from the scanner to avoid the extra fetch.

**Fix:** Pass `collateralToken` and `isLong` directly from `PositionSnapshot` (they are already stored in the struct as optional fields). Eliminate the `fetchAccountPositions()` call in executor.

### RiskEngine: Dead Code

`riskEngine.ts` defines `checkLiquidation()` but it is never called. The scanner uses `Reader.isPositionLiquidatable()` instead, which is the correct approach (authoritative on-chain check). The `riskEngine.ts` module uses a simplified off-chain calculation that could diverge from contract math.

**Decision:** Remove `riskEngine.ts` or document it as dead code. The on-chain `isPositionLiquidatable()` is the authoritative source.

### Oracle Mode: Config Risk

`keeper-service/src/config.ts` defaults `oracleMode` to `"hermes"`. In Hermes mode, the scanner's executor still works (it reads stored prices) but the `pythLazerOracle` singleton is null, so `buildOracleParams()` passes `"0x"` for all inline price data. This works only because the order-execution-keeper keeps stored prices fresh. If the order-execution-keeper is down, liquidation executions will fail with stale oracle errors.

**Recommendation:** Set `ORACLE_MODE=lazer` in docker-compose.yml for keeper-service so it maintains its own Lazer WebSocket and can provide inline price bytes independently.

## Build Order for v1.7

### Step 1: Contract Bug Fix (independent, unblocked)
Fix `BaseOrderUtils.sol`, redeploy `OrderHandler.sol`, record new address.
- No other steps depend on this completing first.
- Can be done in parallel with Step 2.

### Step 2: Config Updates (depends on Step 1 completing)
Update `ORDER_HANDLER_ADDRESS` everywhere (docker-compose.yml, .env, SDK configs).
- Requires the new address from Step 1.
- Run address audit to verify consistency across all services.

### Step 3: Liquidation Verification (depends on keeper-service being accessible)
Confirm the existing pipeline works against a real liquidatable position:
- Create a test position near liquidation threshold
- Watch scanner logs for candidate detection
- Watch executor logs for `LiquidationHandler.executeLiquidation` call
- Verify confirmator updates status to EXECUTED
- Set `ORACLE_MODE=lazer` before testing if not already set.

### Step 4: Performance Optimization (depends on Step 3 verification)
Only optimize after verifying the pipeline works. Premature optimization hides bugs.
- Batch `getPosition` calls in `discoverAccountsWithPositions()` using multicall
- Eliminate redundant `fetchAccountPositions()` in executor
- Consider removing/archiving dead `riskEngine.ts`

### Step 5: Deploy and Verify
Redeploy keeper-service with optimizations, run E2E scan under load.

## New vs Modified Components

### New: None

No new files are required. All changes are modifications to existing files.

### Modified

| Component | File | Change |
|-----------|------|--------|
| Contract | `0xmarkets_contract/contracts/order/BaseOrderUtils.sol` or via OrderHandler deploy | Add `sizeDeltaInTokens == 0` guard |
| Config (all services) | `docker-compose.yml`, `.env`, SDK configs | New `ORDER_HANDLER_ADDRESS` |
| scanner.ts | `keeper-service/src/core/scanner.ts` | Replace serial getPosition loop with multicall batch |
| executor.ts (liq) | `keeper-service/src/core/executor.ts` | Remove redundant fetchAccountPositions call, read from PositionSnapshot |
| config (keeper-service) | `docker-compose.yml` | Add/set `ORACLE_MODE=lazer` for keeper-service |

### Deleted (Recommended)

| Component | File | Why |
|-----------|------|-----|
| RiskEngine | `keeper-service/src/core/riskEngine.ts` | Dead code — scanner uses on-chain isPositionLiquidatable() instead |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Skipping Verification Before Optimization
**What:** Jumping straight to multicall optimization without first verifying the basic pipeline works.
**Why bad:** Optimization changes can mask bugs. If the pipeline doesn't work before optimization, you don't know if a new failure is from the optimization or the underlying issue.
**Instead:** Run a real liquidation end-to-end with the unmodified scanner first. Confirm the tx succeeds. Then optimize.

### Anti-Pattern 2: Updating OrderHandler Without Auditing All Services
**What:** Updating only docker-compose.yml with the new OrderHandler address.
**Why bad:** The Interface SDK, multichain config, and contracts repo all contain addresses. Partial updates cause execution failures for users while the keeper continues working (different code paths for each).
**Instead:** Run the same contract address audit protocol used in v1.6 (Phase 20). Check DataStore on-chain to confirm the address the keeper uses matches what the SDK resolves.

### Anti-Pattern 3: Replacing On-Chain Liquidatability Check with Off-Chain Math
**What:** Using riskEngine.ts for liquidation decisions instead of Reader.isPositionLiquidatable().
**Why bad:** The off-chain math in riskEngine.ts uses simplified collateral valuation (`collateralUsd = collateralAmount` without price conversion) and a generic MMR check. The on-chain check accounts for funding fees, borrowing fees, price impact, and market-specific parameters. Using the off-chain check would cause false negatives (missing real liquidations) and false positives (attempting to liquidate healthy positions, which reverts).
**Instead:** Keep Reader.isPositionLiquidatable() as the sole liquidation decision gate.

### Anti-Pattern 4: Running scanner With ORACLE_MODE=hermes
**What:** Leaving `ORACLE_MODE` at the default `"hermes"` value for keeper-service.
**Why bad:** The pythLazerOracle singleton is null in Hermes mode. executor.ts line 71 silently passes "0x" for oracle data. This works when the order-execution-keeper is running and keeping prices fresh on-chain. If the order-execution-keeper restarts or falls behind, liquidation executions will revert with oracle staleness errors — with no warning in logs.
**Instead:** Set `ORACLE_MODE=lazer` so keeper-service maintains its own Lazer WebSocket and can provide inline price bytes independently. This makes liquidation execution independent of the order-execution-keeper's price push cadence.

## Rollback Plan

If OrderHandler redeployment breaks something:
- The old `ORDER_HANDLER_ADDRESS` is in git history for all config files
- Roll back docker-compose.yml, restart order-execution-keeper
- LiquidationHandler is NOT redeployed, so the liquidation keeper is unaffected

If keeper-service optimizations cause regressions:
- scanner.ts and executor.ts changes are isolated to the keeper-service container
- Roll back keeper-service git commits, rebuild Docker container: `docker compose build keeper-service && docker compose up -d keeper-service`
- No database migrations involved — the schema is unchanged

## Sources

- Direct codebase analysis:
  - `/Users/ken/Projects/0xM/keeper-service/src/core/scanner.ts` — full liquidation pipeline
  - `/Users/ken/Projects/0xM/keeper-service/src/core/executor.ts` — liquidation execution
  - `/Users/ken/Projects/0xM/keeper-service/src/core/positionFetcher.ts` — account discovery (bottleneck)
  - `/Users/ken/Projects/0xM/keeper-service/src/core/riskEngine.ts` — dead code identified
  - `/Users/ken/Projects/0xM/keeper-service/src/core/confirmator.ts` — event confirmation
  - `/Users/ken/Projects/0xM/keeper-service/src/core/pythLazerOracle.ts` — oracle service
  - `/Users/ken/Projects/0xM/keeper-service/src/index.ts` — startup, scan loop, ORACLE_MODE handling
  - `/Users/ken/Projects/0xM/keeper-service/src/config.ts` — env var defaults
  - `/Users/ken/Projects/0xM/order-execution-keeper-service/src/oracle.ts` — price push cadence
  - `/Users/ken/Projects/0xM/order-execution-keeper-service/src/index.ts` — service startup
  - `/Users/ken/Projects/0xM/docker-compose.yml` — deployment config
  - `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/exchange/LiquidationHandler.sol`
  - `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/liquidation/LiquidationUtils.sol`
  - `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/order/BaseOrderUtils.sol` — bug location
  - `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/order/DecreaseOrderUtils.sol`
  - `/Users/ken/Projects/0xM/0xMarkets-Interface/.planning/PROJECT.md` — milestone context
- Confidence: HIGH — all integration points verified from actual source code
