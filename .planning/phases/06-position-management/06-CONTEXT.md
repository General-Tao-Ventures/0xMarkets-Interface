# Phase 6: Position Management - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to open long/short positions (market and limit orders), view and manage open positions, close positions (full or partial), and attach stop-loss/take-profit orders. Covers all 6 configured markets. Chart integration, trade history, and multi-collateral are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Order Placement UX
- Order type selection via dropdown selector (Market / Limit) within the trade box — not separate tabs
- Leverage set via slider + numeric input field (like GMX/dYdX)
- Confirmation modal before submitting — shows size, leverage, fees, liquidation price for review
- Limit orders: manual price input plus percentage shortcut buttons (-1%, -5%, +1%, +5% from current price)

### Position List Display
- Open positions displayed below the chart on the trade page (standard perps layout)
- Full detail columns: Market, Side (Long/Short), Size, Collateral, Leverage, Entry Price, Mark Price, Liq. Price, PnL, Net Value, SL/TP status, Close button
- PnL shown as both dollar amount and percentage (e.g., "$+42.50 (+2.1%)")
- Closing supports both full close and partial close (reduce size by specific amount)

### SL/TP Attachment
- Set SL/TP inline on the position row — click the SL/TP fields directly in the positions table
- Also settable during order placement — optional SL/TP fields in the confirmation modal before opening
- Input supports both price level and percentage from entry (-5%, -10% for SL; +5%, +10% for TP)
- SL/TP close size is configurable — user chooses how much of the position to close when triggered

### Order Execution Feedback
- Toast notification with status progression: "Order submitted → Executing → Filled" with elapsed time — same pattern as deposits/withdrawals
- Errors shown as red toast with error reason and "Retry" button
- Pending limit orders cancellable from the UI with a cancel button per order
- Pending orders display: Claude's discretion (separate "Orders" tab or in positions table with badge)

### Claude's Discretion
- Pending orders section layout (separate tab vs inline in positions)
- Exact confirmation modal layout and field ordering
- Leverage slider range per market type
- Order size input format (USD vs token units)
- Position row click behavior (expand details vs navigate)

</decisions>

<specifics>
## Specific Ideas

- Notification UX should match the deposit/withdrawal pattern from v1.0 Phase 3 and Phase 5 — toast with elapsed time, status progression, cancel for stuck orders
- Percentage shortcuts for limit price and SL/TP are both requested — consistent pattern across both features
- Configurable SL/TP close size is explicitly requested — not just full position close

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-position-management*
*Context gathered: 2026-02-21*
