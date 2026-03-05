# Phase 35: Trigger Order Fix - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Diagnose and fix the InvalidOrderPrices (0x0481a15a) error so that trigger orders (limit increase, stop-loss, take-profit) execute successfully on the live Base Sepolia testnet. The E2E test suite already passes 4/4 locally — the remaining work is verifying the deployed keeper infrastructure executes trigger orders end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Verification Scope
- Test all 3 trigger types: LimitIncrease, StopLossDecrease, LimitDecrease (TakeProfit)
- WETH/USD market, long positions only — sufficient to prove the fix
- Other markets + short positions tested in Phase 36 E2E suite

### End-to-End Proof Method
- Run local E2E test scripts (`e2e/test-trigger-orders.ts`) against live testnet — primary proof
- Confirm deployed keeper on 142.93.203.222 picks up and executes trigger orders by checking server logs
- Frontend round-trip verification deferred to Phase 37

### Keeper Oracle Freshness
- Check current keeper state first — if oracle prices are fresh and trigger orders execute, no fix needed
- If oracle prices are stale (>300s), investigate WebSocket connection state and TTL configuration
- The keeper wallet was funded with 0.01 ETH (#7319) — verify it still has sufficient balance

### Root Cause Documentation
- Root cause already documented in `.planning/continue-trigger-order-price-fix.md`
- Brief summary in this CONTEXT.md is sufficient — no separate investigation report needed

### Claude's Discretion
- Technical approach to any keeper oracle fix (TTL adjustment, reconnection logic, etc.)
- Whether to restart keeper services as part of verification
- Order of operations for debugging vs. testing

</decisions>

<specifics>
## Specific Ideas

- E2E tests currently use 5% price margins to account for stored price staleness — this is acceptable
- The continue note confirms oracle provider `0xc5810FC1` and PythLazer storage `0x8a3eb351` are correctly configured
- Keeper had two issues last session: (1) wallet needed funding, (2) oracle price age exceeded 300s limit
- feedMultiplier values verified: WETH=10^34, USDC=10^46

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/test-trigger-orders.ts`: Complete test suite with 4 tests (LimitIncrease, StopLoss, TakeProfit, PendingStay)
- `e2e/helpers.ts`: Shared utilities (ensureApprovals, extractOperationKey, waitForExecution, formatResults)
- `e2e/config.ts`: Chain configuration, contract addresses, market definitions
- `.planning/continue-trigger-order-price-fix.md`: Root cause analysis and resolution notes

### Established Patterns
- E2E tests use viem for direct on-chain interaction (readContract, writeContract, getLogs)
- Trigger order tests: read oracle price → calculate trigger price with margin → submit → wait for keeper execution
- Keeper executor: reads order struct → builds oracle params → simulates trigger orders before execution → submits TX

### Integration Points
- Order execution keeper (`order-execution-keeper-service/src/executor.ts`): executeOne() handles trigger orders with simulation
- Oracle module (`order-execution-keeper-service/src/oracle.ts`): Pyth Lazer WebSocket cache with 270s TTL
- On-chain contracts: ExchangeRouter.multicall → createOrder, OrderHandler.executeOrder

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-trigger-order-fix*
*Context gathered: 2026-03-04*
