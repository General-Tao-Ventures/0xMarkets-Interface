# Phase 9: UI Polish & Tech Debt - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the UI demo-ready for investors and resolve codebase workarounds blocking future development. Covers visual consistency across all pages, loading/empty/error states, wallet UX polish, basic mobile responsiveness, and tech debt items (pendingImpactAmount, TypeScript errors, SDK tests, keeper efficiency). No new features — only polish and cleanup of what exists.

</domain>

<decisions>
## Implementation Decisions

### Visual Consistency
- Clean & professional impression — consistent spacing, aligned elements, no rough edges
- Pools page and trade page layout are the main areas needing work
- Reference apps: Hyperliquid and GMX v2 for visual quality bar
- Market page layout consistency (same vs different per market): Claude's discretion

### Loading & Empty States
- Loading pattern (skeletons vs spinners): Claude decides per component
- Empty states: clean empty tables with column headers — no extra messaging or CTAs
- Errors: toast notifications (non-blocking, auto-dismiss)
- Error detail level (technical vs user-friendly): Claude decides based on error type

### Navigation Flow
- Primary demo journey: Trade page (with Positions panel) → Pools page
- Header navigation is fine as-is
- Market switching is decent — minor fixes only
- No known dead links or broken routes

### Mobile Responsiveness
- Basic mobile support — should be usable but doesn't need to be perfect
- Minimum mobile experience: Claude decides, fix worst issues without full responsive redesign

### Wallet Connection UX
- Wrong network handling: keep current behavior
- Pre-connection: action buttons show "Connect Wallet" and trigger connect flow on click
- Pending transactions: toast + spinner (button returns to normal, toast shows "Transaction pending...")
- Confirmed transactions: success toast with "View on BaseScan" explorer link
- Wallet disconnection: currently buggy — Claude should investigate and fix stale data/errors after disconnect

### Tech Debt
- pendingImpactAmount: Claude should trace usage and decide — fix, remove, or document
- SDK test failures: mix approach — fix easy ones, skip hard ones with documented reasons
- useOrders.ts TypeScript error: Claude should check if it blocks tsc and fix accordingly
- Keeper execution efficiency: important for demo — investigate and optimize

### Claude's Discretion
- Market page layout consistency across 6 markets
- Loading pattern choice per component (skeleton vs spinner)
- Error toast detail level per error type
- Mobile responsiveness approach and minimum bar
- pendingImpactAmount resolution strategy

</decisions>

<specifics>
## Specific Ideas

- Visual quality bar: Hyperliquid and GMX v2 — clean, data-dense, professional
- Trade page is the primary page — positions are embedded there, not a separate route
- Success toasts should include BaseScan transaction link for user verification
- Wallet disconnect flow is buggy and needs investigation + fix

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-ui-polish-tech-debt*
*Context gathered: 2026-02-23*
