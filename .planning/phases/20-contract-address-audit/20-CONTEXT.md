# Phase 20: Contract Address Audit - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify every contract address and market parameter across all services against on-chain DataStore state. Fix all discrepancies. Confirm fixes work via automated smoke test. This phase eliminates config mismatches as a source of execution failures — it does NOT verify full E2E flow (keeper execution → frontend feedback), which is Phases 21-22.

</domain>

<decisions>
## Implementation Decisions

### Audit scope
- All services in scope: interface SDK, order-execution-keeper-service, keeper-service, squid (0xMarkets-squid), contracts repo config, docs
- Source of truth is on-chain DataStore via RPC reads — not deployment artifacts or config files
- Audit covers both addresses AND on-chain market parameters (reserve factors, OI limits, pool caps, enabled status)
- Clean slate approach — re-verify everything from scratch, treat no prior fixes as done

### Fix strategy
- Two-pass approach: first pass documents all discrepancies in an audit report, second pass applies fixes with full picture
- Fixes committed one commit per service repo — easy to review and revert per-service
- Include keeper service restart/redeployment on DigitalOcean after config fixes are applied
- Include SDK prebuild (`cd sdk && yarn prebuild`) after interface config changes and commit generated output

### Verification method
- Write an automated verification script that reads all relevant DataStore keys and compares against config files across services
- Script lives in contracts repo alongside existing test scripts (testDeposit.ts, testAllMarkets.ts)
- After all fixes applied, run a smoke test: one deposit per market across all 6 markets (ETH, BTC, EUR, GBP, GOLD, JPY)
- Smoke test confirms addresses are correct at the contract level (no reverts) — full E2E verification (keeper pickup → frontend toast) is out of scope for this phase

### Claude's Discretion
- Specific DataStore keys to read for each address type
- Script structure and error reporting format
- Order of service auditing
- Audit report internal structure

</decisions>

<specifics>
## Specific Ideas

- The verification script should be reusable — it feeds into Phase 23's automated E2E testing
- Earlier today (#5386) SDK market addresses were updated ad-hoc — the clean slate audit will re-verify these
- Docker deployment on DigitalOcean runs two keeper containers (keeper-service + order-execution-keeper-service) — both need restart after fixes
- The existing `contract-address-update-guide.md` in `.claude/` documents the update checklist — audit should verify against that list

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-contract-address-audit*
*Context gathered: 2026-02-26*
