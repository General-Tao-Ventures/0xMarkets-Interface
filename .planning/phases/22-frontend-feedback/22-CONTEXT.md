# Phase 22: Frontend Feedback - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time toast notifications for withdrawals and orders, plus auto-refresh for pool balances and positions after execution. Deposit toasts (FB-01, FB-02) are already complete from Phase 18 — this phase extends the same pattern to withdrawals and orders, and adds auto-refresh so users never need to manually reload.

</domain>

<decisions>
## Implementation Decisions

### Toast lifecycle
- Same Pending → Executed pattern for all three operation types (deposits already done, add withdrawals and orders)
- Spinner animation on the Pending toast while waiting for execution
- Executed toast auto-dismisses after 5 seconds
- If execution not detected within 60 seconds, update toast to "Taking longer than expected..." as a timeout warning
- Each toast includes market name for identification: "ETH/USD Deposit Pending..." → "ETH/USD Deposit Executed!"

### Auto-refresh behavior
- Silently auto-refresh data immediately when execution event is detected — no visual indicator, numbers just update
- Same silent refresh for positions on the trade page after order execution
- Only refresh data if user is currently on the relevant page (pools page for deposits/withdrawals, trade page for orders) — no background data fetching for other pages
- Immediate refresh on event detection, no artificial delay

### Multi-operation handling
- Stack toasts when multiple operations are in flight simultaneously
- Maximum 3 visible toasts at once — older ones hidden but still tracked
- Market name in each toast makes stacked toasts distinguishable
- Debounce auto-refresh when multiple execution events arrive within seconds — batch into a single data refresh to avoid flicker

### Failure/error feedback
- Cancellation events show a red error toast with human-readable reason decoded from on-chain data (e.g. "MinMarketTokens" → "Price impact exceeded slippage tolerance")
- Error/cancellation toasts require manual dismissal (user must click X) — do not auto-dismiss
- Auto-refresh triggers on cancellation too (funds returned to wallet, balances should reflect that)

### Claude's Discretion
- Exact toast component styling and positioning
- Debounce timing for batched refreshes
- Timeout warning message wording
- How to map additional on-chain error codes to human-readable messages beyond the known ones

</decisions>

<specifics>
## Specific Ideas

- User experienced a deposit cancellation due to slippage (MinMarketTokens error on a 10k ETH deposit) — this is the primary error scenario to handle well
- Phase 18 already built the polling infrastructure and deposit toast lifecycle — extend rather than rebuild
- The existing `watchOrderTxn` pattern from Phase 18 should be the foundation for withdrawal and order tracking

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-frontend-feedback*
*Context gathered: 2026-02-27*
