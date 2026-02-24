# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** All keeper-executed operations complete in under 10 seconds, consistently
**Current focus:** Phase 12 — Observability and Tuning

## Current Position

Phase: 12 of 12 (Observability and Tuning)
Plan: 2 of 2
Status: Phase 12 COMPLETE — all phases done
Last activity: 2026-02-24 — Phase 12 verified (8/8 truths)

Progress: [██████████] 100% (v1.3)

## Performance Metrics

**Velocity (v1.0-v1.2):**
- Total plans completed: 21
- Phases: 9, all complete

**By Phase:**

| Phase | Milestone | Plans | Status |
|-------|-----------|-------|--------|
| 1-3 | v1.0 | 6/6 | Complete |
| 4-6 | v1.1 | 8/8 | Complete |
| 7-9 | v1.2 | 7/7 | Complete |
| 10 | v1.3 | 2/2 | Complete |
| 11 | v1.3 | 2/2 | Complete |
| 12 | v1.3 | 2/2 | Complete |
| Phase 10 P01 | 3min | 2 tasks | 6 files |
| Phase 10 P02 | 3min | 2 tasks | 3 files |
| Phase 11 P01 | 3min | 2 tasks | 4 files |
| Phase 11 P02 | 4min | 2 tasks | 9 files |
| Phase 12 P01 | 1min | 2 tasks | 2 files |

## Accumulated Context

### Research Flags

- Phase 11: RESOLVED — PythLazerFeedProvider.getOraclePrice() reads from storedPrices mapping; separate updatePriceOnChain() TX IS required but moved to proactive background loop.
- Phase 10: viem `fallback([webSocket(), http()])` does NOT produce WebSocket-type client (Issue #776). Must use dedicated WebSocket-only PublicClient for event subscriptions.

### Known Issues

- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)
- batch_report 404 from metrics — cosmetic

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

Archived with v1.2 milestone. See .planning/PROJECT.md for key decisions table.

- Phase 10-01: Used Map-based FIFO queue with allKnown dedup (TTL 3600s) for nonce-safe sequential execution
- Phase 10-01: WebSocket client verifies transport.type at creation to prevent silent HTTP fallback (viem #776)
- Phase 10-01: viem reconnect uses `attempts` not `maxAttempts` (corrected from plan)
- Phase 10-02: EventListener only enqueues, never executes directly (event-to-queue pattern)
- Phase 10-02: drainQueue() single-consumer loop replaces isExecuting mutex for LIFE-04 sequential execution
- Phase 10-02: Polling hardcoded to 30s (not config.scanIntervalSeconds) -- events are primary detection
- Phase 10-02: Block persistence batched (every 10 events or 5-block gap) to avoid DB write per event
- Phase 11-01: 10s per-token background update interval balances freshness vs gas cost
- Phase 11-01: Nonce coordination via disable/enable pattern around drainQueue execution (simplest approach)
- Phase 11-01: 5s safety margin on MAX_ORACLE_PRICE_AGE for block propagation delay
- Phase 11-02: Scanner attaches operation data per-item with try/catch so market read failure never blocks scan
- Phase 11-02: Executors use type-narrowed optional parameter for safe pre-fetched data access
- Phase 11-02: Event-sourced items carry no operationData -- executor falls back to chain reads (zero regression)
- Phase 12-01: Used ceil(p/100 * length) - 1 nearest-rank percentile method for LatencyTracker
- Phase 12-01: Default capacity of 200 samples balances memory and statistical accuracy

## Session Continuity

Last session: 2026-02-24
Stopped at: Phase 12 verified and complete (8/8 truths). All v1.3 phases done.
Next: v1.3 milestone completion (blocked on Phase 11 UAT — Pyth Lazer token renewal)
