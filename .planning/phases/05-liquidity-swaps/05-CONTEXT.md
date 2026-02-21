# Phase 5: Liquidity & Swaps - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to withdraw liquidity from pools (Sell GM) and display pool statistics. Completing the liquidity lifecycle started in v1.0 with deposits. Swaps are deferred — not needed for this phase.

**Revised scope:** LIQ-01 (Sell GM), LIQ-02 (Pool Stats) only. SWAP-01 deferred to future milestone.

</domain>

<decisions>
## Implementation Decisions

### Sell GM Flow
- Full exit only — user sells all GM tokens in a pool, no partial withdrawal support
- Sell GM button accessible from both the pools list page AND the pool detail page
- Token receive preference and output estimation: Claude's discretion based on what the codebase/contracts already support

### Pool Statistics
- Pools page has two tabs: "All Pools" (all 6 market pools with deposit button) and "My Pools" (only pools where user has GM tokens)
- "My Pools" tab shows PnL — how much user has gained or lost since depositing
- Which metrics to display and refresh behavior: Claude's discretion based on available contract/keeper data

### Keeper Execution
- Withdrawal execution pattern: Claude's discretion — follow whatever pattern exists in the keeper codebase (likely same as deposits: createWithdrawal → keeper detects → keeper executes)
- Withdrawal status feedback: same as deposit notification pattern — toast with elapsed time, status updates, cancel option if pending
- Keeper withdrawal scanning capability: unknown — Claude should investigate during research whether the order-execution-keeper already handles withdrawals from the GMX fork
- Failed withdrawals: user gets both retry and cancel options

### Claude's Discretion
- Token receive preference on Sell GM (user chooses vs pool split)
- Output estimation display before confirm
- Pool metrics selection (TVL, APY, utilization, fees, etc.)
- Stats refresh strategy (on load vs periodic)
- Keeper withdrawal execution implementation approach

</decisions>

<specifics>
## Specific Ideas

- Withdrawal notifications should match the deposit UX that shipped in v1.0 Phase 3 (toast with elapsed time counter, status updates, cancel button)
- "My Pools" tab with PnL tracking is explicitly requested — this is a user-facing priority

</specifics>

<deferred>
## Deferred Ideas

- **SWAP-01 (Token Swaps)** — User explicitly said "we don't need the swap route, we just want long and short." Entire swap capability deferred to a future milestone. Remove from Phase 5 requirements.

</deferred>

---

*Phase: 05-liquidity-swaps*
*Context gathered: 2026-02-21*
