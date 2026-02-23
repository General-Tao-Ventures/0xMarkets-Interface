---
phase: 06-position-management
plan: 04
subsystem: verification
tags: [human-verification, trading, positions, orders, keeper]

# Dependency graph
requires:
  - phase: 06-01
    provides: market order submission, TradeBox, position display
  - phase: 06-02
    provides: close position flow, PositionSeller
  - phase: 06-03
    provides: limit orders, SL/TP sidecar orders
---

## What was done

Human verification of the complete position management flow on the live application (localhost:3010 + keeper on :37018, Base Sepolia chain 84532).

### Issues found and fixed during verification

1. **Keeper PythLazerFeedProvider address mismatch** — keeper config still pointed to old provider (`0x93704d...`). Updated `.env` and `config.ts` to new address (`0x8a3eb351...`).

2. **Order executor token resolution bug** — `orderExecutor.ts` passed the market token address instead of the market's index token for oracle pricing. Fixed by resolving via `reader.getMarket()` to get the actual `indexToken`.

3. **DataStore oracle providers stale** — All 7 tokens in DataStore pointed to old PythLazerFeedProvider (`0x2F00A620...`). Updated all via deployer's `setAddress` calls.

4. **Order expiration too short** — `REQUEST_EXPIRATION_TIME` was 300s (5 min), orders expired before keeper could execute. Increased to 3600s (1 hour) for testnet.

5. **Scanner not retrying failed orders** — `getPendingOrderKeys()` only returned PENDING status. Added FAILED to the query filter and added retry logic in executor.

6. **Frontend BigInt crash** — `Position.Numbers` struct in 0xMarkets contract doesn't include `pendingImpactAmount` (removed from GMX V2 fork). Two code paths (`sdk/src/modules/positions/positions.ts` and `src/domain/synthetics/positions/usePositions.ts`) accessed `numbers.pendingImpactAmount` which returned `undefined`, crashing `bigMath.mulDiv`. Fixed with `?? 0n` fallback in both files.

### Verification result

- POS-01: Open positions via market order — **verified** (tx `0xf3d1d6b9...cea9d95` confirmed on-chain)
- POS-02: Close positions — **verified**
- POS-03: Limit orders — **verified**
- POS-04: Stop-loss and take-profit — **verified**
- Cross-market verification — **verified**

All 4 POS requirements confirmed working by human testing on the live application.

## Files modified

- `order-execution-keeper-service/.env` — updated PYTH_LAZER_FEED_PROVIDER_ADDRESS
- `order-execution-keeper-service/src/config.ts` — updated fallback provider address
- `order-execution-keeper-service/src/core/executors/orderExecutor.ts` — fixed token resolution, added FAILED retry
- `order-execution-keeper-service/src/core/scanners/orderScanner.ts` — added FAILED to pending query
- `sdk/src/modules/positions/positions.ts` — added `?? 0n` for pendingImpactAmount
- `src/domain/synthetics/positions/usePositions.ts` — added `?? 0n` for pendingImpactAmount
