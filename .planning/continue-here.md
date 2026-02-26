# Continue Here — Keeper Execution Speed

**Date:** 2026-02-25
**Branch:** ken/integration (interface), main (order-execution-keeper), feat/candles-endpoint (keeper-service)

---

## COMPLETED THIS SESSION

1. **keeper-service bytes32 fix** ✅ — removed broken `oracleWatcher.getMarketData()` call in scanner.ts
2. **keeper-service deployed** ✅ — clean startup, no WebSocket churn, no errors
3. **Both repos committed and pushed** ✅
4. **Architecture refactor: cache-only oracle** ✅ — order-execution-keeper
   - Removed ALL background `updatePriceOnChain` calls (were sending 7 txs every 5s, causing nonce chaos)
   - `buildOracleParams` passes inline price data from WebSocket cache — no separate on-chain updates needed
   - Replaced `estimateGas` RPC call with fixed 2M gas limit (saves round-trip)
   - Reduced scan interval from 5min to 15s
   - Deployed and verified: zero nonce conflicts from execution path

---

## REMAINING TASKS

### 1. Fix `cancelExpiredDeposits` nonce conflicts

**File:** `order-execution-keeper-service/src/core/scanners/depositScanner.ts` lines 255-310

The `cancelExpiredDeposits()` method fires rapid sequential `cancelDeposit` txs without nonce management. Each tx uses viem's default nonce (which can be stale when previous tx hasn't confirmed). Fix: either await each receipt before sending next, or use explicit nonce increment pattern.

### 2. Reset stuck DB state and verify execution

After fixing cancel nonce issue:
```bash
ssh root@142.93.203.222 "cd /opt/0xmarkets && docker compose exec postgres psql -U keeper -d order_execution_keeper -c \"UPDATE deposit_requests SET status = 'PENDING' WHERE status = 'FAILED';\""
ssh root@142.93.203.222 "cd /opt/0xmarkets && docker compose restart order-execution-keeper"
```

Then create a fresh deposit on the frontend and verify it executes within seconds.

### 3. Commit remaining interface changes

The interface repo on `ken/integration` has uncommitted changes (pools page, planning docs).

### Key addresses
| Contract | Address |
|----------|---------|
| PythLazerFeedProvider | `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05` |
| DepositHandler | `0x9388B07f807eB870aD36d350d80DC0c214a7f04f` |
| EventEmitter | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` |
| Keeper wallet | `0x48Cb0d738C9B3F44F60f7338F788fa093FD25828` |
| DO Droplet | `142.93.203.222` |
