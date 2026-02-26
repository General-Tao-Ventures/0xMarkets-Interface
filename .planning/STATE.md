# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.
**Current focus:** v1.5 — Minimal Keeper Rewrite

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-25 — Milestone v1.5 started

## Performance Metrics

**Velocity (v1.0-v1.4):**
- Total plans completed: 33
- Phases: 14, all complete

**By Phase:**

| Phase | Milestone | Plans | Status |
|-------|-----------|-------|--------|
| 1-3 | v1.0 | 6/6 | Complete |
| 4-6 | v1.1 | 8/8 | Complete |
| 7-9 | v1.2 | 7/7 | Complete |
| 10-12 | v1.3 | 6/6 | Complete |
| 13-14 | v1.4 | 6/6 | Complete |

## Accumulated Context

### Research Flags

- All 7 tokens point to Pyth Lazer provider on-chain — no Hermes migration needed
- Minimal Lazer WebSocket cache (~50 lines) chosen over Hermes HTTP for compatibility

### Known Issues

- REQUEST_EXPIRATION_TIME set to 3600s for testnet (should be configurable per environment)

### Pending Todos

None.

### Blockers/Concerns

None.

### Decisions

**v1.4 decisions (archived):** See .planning/PROJECT.md key decisions table.

## Session Continuity

Last session: 2026-02-25
Stopped at: Milestone v1.5 definition started
Next: Define requirements and roadmap
