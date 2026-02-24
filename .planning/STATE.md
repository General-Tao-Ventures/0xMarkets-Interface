# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** All keeper-executed operations complete as fast as possible with proper oracle configuration
**Current focus:** Defining requirements for v1.4

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-24 — Milestone v1.4 started

## Performance Metrics

**Velocity (v1.0-v1.3):**
- Total plans completed: 27
- Phases: 12, all complete

**By Phase:**

| Phase | Milestone | Plans | Status |
|-------|-----------|-------|--------|
| 1-3 | v1.0 | 6/6 | Complete |
| 4-6 | v1.1 | 8/8 | Complete |
| 7-9 | v1.2 | 7/7 | Complete |
| 10-12 | v1.3 | 6/6 | Complete |

## Accumulated Context

### Research Flags

- Phase 11: RESOLVED — PythLazerFeedProvider.getOraclePrice() reads from storedPrices mapping; separate updatePriceOnChain() TX IS required but moved to proactive background loop.
- Phase 10: viem `fallback([webSocket(), http()])` does NOT produce WebSocket-type client (Issue #776). Must use dedicated WebSocket-only PublicClient for event subscriptions.

### Roadmap Evolution

- v1.3 Phase 13 deferred to v1.4 (Production Lazer Deployment)

### Known Issues

- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
- batch_report 404 from metrics — cosmetic
- FX token withdrawals fail with InvalidOracleProvider — Hermes not registered on-chain for FX tokens
- MaxPriceAgeExceeded when using Lazer-only mode — stored prices go stale

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

Archived with v1.3 milestone. See .planning/PROJECT.md for key decisions table.

## Session Continuity

Last session: 2026-02-24
Stopped at: v1.4 milestone initialization
Next: Define requirements and create roadmap
