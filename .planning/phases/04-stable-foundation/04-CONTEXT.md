# Phase 4: Stable Foundation - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix crashes and configuration issues so the trade page loads cleanly across all 6 markets. Includes on-chain market config completion, frontend defensive guards, WebSocket stability, and error suppression. No new trading features — just making the existing page stable.

</domain>

<decisions>
## Implementation Decisions

### Division by zero fix
- Fix BOTH on-chain config (set real values) AND add defensive guards in frontend math
- Global guard in `bigmath.ts` mulDiv as safety net — return 0n on zero divisor
- Also trace key validation paths (`validation.ts:442`, `selectTradeboxTradeErrors.ts:93`) and handle gracefully
- When guard catches a zero divisor, disable the affected market entirely (grey it out)
- Disabled markets show greyed out in market selector — visible but not selectable, "Market unavailable"

### Market configuration
- Per-type tuning: crypto (ETH, BTC) gets different params than forex (EUR, GBP, JPY) and commodities (GOLD)
- Realistic production-like params: 50-100x leverage, reasonable OI caps, realistic spreads
- Config method: Claude's discretion — use whatever approach is most efficient given existing scripts/tools

### Error suppression
- WebSocket CLOSING state: Claude's discretion on approach (check state before send vs catch/suppress)
- Metrics batch_report: Route to keeper service endpoint — add a metrics receiver on the keeper
- Keeper metrics endpoint: Claude's discretion on whether to store or discard (effort vs value)
- Manifest.json 401: Fix it — ensure manifest is served without auth or remove the reference

### Validation defaults
- Trade button disabled with reason tooltip when validation can't compute ("Market data loading..." or "Market unavailable")
- Insufficient liquidity message stays generic — no config details exposed to users
- Partial config = fully disabled: if ANY required value is zero, grey out the entire market (clean binary state)
- Missing config keys logged to console.warn — visible to devs inspecting, invisible to users

### Claude's Discretion
- Market config deployment method (script vs hardhat task vs manual)
- WebSocket error handling approach (state check vs try/catch)
- Keeper metrics endpoint implementation (store vs discard)
- Frontend health check for market config validation (if deemed useful)
- Exact tooltip/message wording for disabled markets

</decisions>

<specifics>
## Specific Ideas

- Markets should be binary: fully configured and enabled, or greyed out and disabled
- Console.warn for missing config keys helps testnet debugging without cluttering the UI
- The crash trace is: `bigmath.ts:6` → `validation.ts:442` → `selectTradeboxTradeErrors.ts:93`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-stable-foundation*
*Context gathered: 2026-02-21*
