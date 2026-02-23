# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** All keeper-executed operations complete in under 10 seconds, consistently
**Current focus:** Phase 10 — Event-Driven Detection

## Current Position

Phase: 10 of 12 (Event-Driven Detection)
Plan: 2 of 2
Status: Phase 10 complete, Phase 11 next
Last activity: 2026-02-23 — Completed 10-02 (Event Listener + Main Loop Rewire)

Progress: [██░░░░░░░░] 20% (v1.3)

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
| 11 | v1.3 | 0/? | Not started |
| 12 | v1.3 | 0/? | Not started |
| Phase 10 P01 | 3min | 2 tasks | 6 files |
| Phase 10 P02 | 3min | 2 tasks | 3 files |

## Accumulated Context

### Research Flags

- Phase 11: Oracle price contract behavior is a key unknown — does `executeDeposit` with inline oracle params make separate `updatePriceOnChain()` TX redundant? Must investigate during planning.
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

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 10-02-PLAN.md (Event Listener + Main Loop Rewire)
Next: Plan Phase 11 (next milestone phase)
