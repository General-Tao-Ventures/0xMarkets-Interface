---
status: testing
phase: 11-execution-pipeline-optimization
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md]
started: 2026-02-23T23:10:00Z
updated: 2026-02-23T23:10:00Z
---

## Current Test

number: 1
name: Background Oracle Prices Stay Fresh
expected: |
  Start the keeper with WS_RPC_URL set. Observe logs showing "background oracle update" messages
  appearing every ~10 seconds per token. The on-chain stored prices should stay perpetually fresh
  without any execution triggers.
awaiting: user response

## Tests

### 1. Background Oracle Prices Stay Fresh
expected: Start the keeper with WS_RPC_URL set. Observe logs showing background oracle update messages appearing every ~10s per token. On-chain stored prices stay fresh without execution triggers.
result: [pending]

### 2. Execution Skips Synchronous Oracle TX When Fresh
expected: Trigger a deposit/withdrawal while background updater is running. Logs should show "stored price is fresh, skipping updatePriceOnChain" (or similar) instead of the 2-8s synchronous oracle TX. Execution completes noticeably faster.
result: [pending]

### 3. Nonce Safety Under Concurrent Load
expected: Submit 2-3 rapid deposits while the keeper is running. No "nonce too low" or "nonce already used" errors appear in logs. Background updates pause during execution and resume after.
result: [pending]

### 4. Oracle Fallback When Stale
expected: Stop the Pyth Lazer WebSocket (or start keeper without it). Execute a deposit. The keeper falls back to synchronous updatePriceOnChain TX — same behavior as before Phase 11. No errors, just slower.
result: [pending]

### 5. Scanner Data Passthrough in Logs
expected: Trigger a deposit via polling path (not event). Logs should show "using pre-fetched deposit data" (or similar) instead of redundant reader.getDeposit()/getMarket() calls. No extra RPC reads visible.
result: [pending]

### 6. Event-Sourced Fallback to Chain Reads
expected: Trigger a deposit detected via WebSocket event (not poll). Since events don't carry operation data, logs should show the executor reading from chain as before — no errors, graceful fallback.
result: [pending]

### 7. End-to-End Execution Under 5 Seconds
expected: With background updater running and WebSocket events active, submit a deposit. From the "detected DepositCreated via event" log to the "execution complete" log, elapsed time should be under 5 seconds.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
