---
phase: 12-observability-and-tuning
plan: 02
title: Heartbeat Health Model Integration
status: complete
started: 2026-02-24
completed: 2026-02-24
duration: 3min
commits:
  - d4ac225
tasks_completed: 2
files_changed: 3
requires:
  - 12-01
provides:
  - heartbeat-liveness-model
  - startup-grace-period
  - wsConnected-health-field
affects:
  - health-endpoint
  - betterstack-monitoring
patterns:
  - heartbeat-based liveness (scan cycle = heartbeat, not execution)
  - startup grace period for fresh boot tolerance
decisions:
  - Used recordHeartbeat rename (not backward-compatible alias) since no external callers
  - Combined recordExecutionLatency convenience function preserved from prior partial wiring
  - HEARTBEAT_THRESHOLD_MS = 90s (3x 30s scan interval) tolerates 1 missed scan
  - STARTUP_GRACE_MS = 90s matches heartbeat threshold for consistency
tags:
  - health-monitoring
  - observability
  - liveness
  - latency-percentiles
---

# Plan 12-02 Summary: Heartbeat Health Model Integration

## One-Liner
Replaced execution-timestamp liveness with heartbeat-based model so /health returns 200 during idle periods and exposes latency percentiles.

## What Changed
- **healthState.ts**: Added `lastHeartbeatTime` field, renamed `recordScanCycle` → `recordHeartbeat` (updates heartbeat not execution time), removed dead code (`recordEvent`, `lastEventTime`)
- **httpServer.ts**: Replaced `HEALTH_THRESHOLD_MS` (2min, execution-based) with `HEARTBEAT_THRESHOLD_MS` (90s) + `STARTUP_GRACE_MS` (90s). Health logic: `isHealthy = inStartupGrace || heartbeatAlive`. Added `wsConnected` and `lastHeartbeatTime` to response.
- **index.ts**: Updated import and call from `recordScanCycle` → `recordHeartbeat`

## Requirements Satisfied
- INFRA-02: Heartbeat liveness — no false 503s during idle periods
- INFRA-03: Latency percentiles in /health response (wired in 12-01, completed here)

## Verification
8/8 truths verified. TypeScript compiles clean, 45 tests pass.
