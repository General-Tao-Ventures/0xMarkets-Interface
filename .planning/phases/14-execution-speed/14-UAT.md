---
status: testing
phase: 14-execution-speed
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md]
started: 2026-02-25T03:00:00Z
updated: 2026-02-25T04:00:00Z
---

## Current Test

number: 1
name: Flashblocks TX Confirmation Speed
expected: |
  With FLASHBLOCKS_RPC_URL=https://sepolia-preconf.base.org in keeper .env, restart the keeper.
  Logs should show "public client created" with chain "Base Sepolia (Preconf)".
  Execute a deposit on any market. Check keeper logs for txConfirmMs — should be under 500ms (ideally ~200ms).
awaiting: blocked — background updatePrice reverts, no successful TX to measure

## Tests

### 1. Flashblocks TX Confirmation Speed
expected: With FLASHBLOCKS_RPC_URL set, keeper logs show Base Sepolia (Preconf) chain. A deposit execution shows txConfirmMs under 500ms in timing breakdown.
result: [pending]
notes: |
  Partially verified: FLASHBLOCKS_RPC_URL configured, keeper uses preconf RPC URL.
  Chain logged as "Base Sepolia" (baseSepoliaPreconf chain). Subscription confirmed for 3 crypto feeds.
  BLOCKED: background updatePrice() reverts with "out of gas: gas required exceeds: 52305" during
  viem eth_estimateGas. Static cast call/estimate succeed. Suspected viem gas parameter issue.

### 2. Background Oracle Update Cadence
expected: With keeper running in Lazer mode, logs show background oracle update messages approximately every 5 seconds per token. No MaxPriceAgeExceeded errors appear.
result: [pending]

### 3. Per-Stage Timing in Deposit Logs
expected: After a successful deposit, keeper logs show structured timing: { oracleBuildMs, gasEstimateMs, txSubmitMs, txConfirmMs, totalMs } with all values as numbers (e.g., 203.4).
result: [pending]

### 4. Per-Stage Timing in Order Logs
expected: After a successful order execution, keeper logs show the same timing breakdown. Order request status is updated to EXECUTED in the database.
result: [pending]

### 5. Hermes Fallback for Stale Prices
expected: If background oracle updater falls behind (or for FX tokens without Lazer entitlement), keeper logs "stored price unexpectedly stale — falling back to Hermes" and execution succeeds via Hermes path.
result: [pending]
notes: |
  Partially verified: Hermes fallback path IS triggered (logs show "stored price unexpectedly stale —
  background updater may be behind, falling back to Hermes" for both WETH and USDC). Per-token routing
  correctly identifies stale Lazer prices and fetches Hermes prices. However, the subsequent executeOrder
  calls also revert (likely stale/expired orders from previous sessions, not a Hermes issue).

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

### Blocker: background updatePrice reverts via viem

- truth: "Background oracle updater pushes fresh prices on-chain every 5 seconds"
  status: blocked
  reason: "updatePrice() on PythLazerFeedProvider reverts with 'out of gas: gas required exceeds: 52305' during viem eth_estimateGas. Static cast call and cast estimate both succeed against same RPC. Viem passes maxFeePerGas=0.007 gwei which may be too low, or there is a nonce/state race in the preconf RPC."
  severity: blocker
  test: 1
  root_cause: "viem writeContract -> estimateGas fails where raw cast commands succeed. Possibly related to gas price parameters or baseSepoliaPreconf chain gas estimation behavior."
  artifacts:
    - path: "order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts"
      issue: "updatePriceOnChain() line 256 — writeContract call fails during gas estimation"
    - path: "order-execution-keeper-service/src/core/blockchain/client.ts"
      issue: "flashblocksChain uses baseSepoliaPreconf — may need gas price overrides"
  missing:
    - "Investigate if baseSepoliaPreconf chain requires explicit gas price or gas limit overrides in writeContract"
    - "Try adding explicit gas limit (e.g., 200000) to writeContract call to bypass estimation"
    - "Check if viem's gas estimation behavior differs between standard and preconf chain configs"

### Fix applied: FX feeds removed from Lazer config

- truth: "Keeper should start without crashing"
  status: fixed
  reason: "FX feeds (EUR, GBP, GOLD, JPY) in PYTH_LAZER_FEED_CONFIGS caused WebSocket subscription errors that crashed all connections. Removed FX feeds — they route through Hermes via per-token routing."
  severity: blocker
  test: 0
  artifacts:
    - path: "order-execution-keeper-service/src/config/tokens.ts"
      issue: "PYTH_LAZER_FEED_CONFIGS included FX feeds not entitled for Lazer access token"
