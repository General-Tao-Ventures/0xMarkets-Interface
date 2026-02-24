# Phase 12: Observability & Tuning - Research

**Researched:** 2026-02-23
**Domain:** Health monitoring & latency metrics for event-driven keeper service
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-02 | Health endpoints use heartbeat-based liveness model compatible with event-driven architecture | Heartbeat liveness pattern replaces stale `lastExecutionTime` check; multiple liveness signals (scan cycle, WS events, oracle) prevent false alerts during idle periods |
| INFRA-03 | Health endpoint reports execution latency percentiles (p50, p95) for monitoring | Circular buffer latency tracker with in-process sorted-insert percentile computation; no external dependencies needed |
</phase_requirements>

## Summary

The order-execution-keeper-service recently migrated from a polling-based architecture (Phases 10-11) to an event-driven model where WebSocket events provide primary detection. The existing health endpoint in `src/server/httpServer.ts` uses a 2-minute threshold on `lastExecutionTime` to determine liveness. This is fundamentally broken in the event-driven model: when no user operations occur for 2+ minutes, the timestamp goes stale, the endpoint returns 503, and BetterStack fires a false-positive alert even though the keeper is perfectly healthy and listening for events.

The fix requires two changes: (1) replace the execution-timestamp-based liveness check with a heartbeat model that considers multiple liveness signals -- the 30-second poll cycle (`recordScanCycle`), WebSocket connection status, and oracle connection status -- and (2) add an in-process latency percentile tracker that collects the `latencyMs` values already computed in `drainQueue()` and exposes p50/p95 on the health endpoint.

**Primary recommendation:** Refactor `healthState.ts` to use a multi-signal heartbeat model (scan cycle as primary heartbeat, WS/oracle as secondary) and add a circular-buffer LatencyTracker class that computes percentiles from the last N executions. No external libraries needed -- this is ~80 lines of new code total.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.1.0 | HTTP server (already in use) | Existing -- no change needed |
| pino | 10.3.1 | Structured logging (already in use) | Existing -- no change needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.0.16 | Unit testing (already configured) | Test the latency tracker and health logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process percentile buffer | prom-client (Prometheus) | Full metrics stack is overkill for a single health endpoint; adds Prometheus dependency, scrape config, and operator burden for a testnet keeper |
| In-process percentile buffer | hdr-histogram-js | High-precision histogram library; unnecessary precision for p50/p95 on ~100s of executions; adds a dependency |
| Circular buffer | Unlimited array | Memory-unbounded; grows forever in long-running process |

**Installation:**
```bash
# No new packages needed -- all required libraries already installed
```

## Architecture Patterns

### Current Architecture (Problem)

```
src/
├── utils/healthState.ts       # healthState object + recordExecution/recordScanCycle
├── server/httpServer.ts        # /health endpoint with 2min threshold on lastExecutionTime
├── server/controllers/         # /api/health returning simple {status: "ok"}
├── server/routes/index.ts      # Routes including /api/health
├── core/queue/executionQueue.ts # Queue with detectedAt timestamps
└── index.ts                    # drainQueue() computes latencyMs but only logs it
```

**The bug:** `httpServer.ts` line 26 checks `(now - lastExec.getTime()) < HEALTH_THRESHOLD_MS` (2 min). In the event-driven model:
- Polling runs every 30s and calls `recordScanCycle()` which updates `lastExecutionTime`
- But `lastExecutionTime` serves double duty: it tracks BOTH scan cycles AND actual executions
- The scan cycle IS a valid heartbeat (keeper is alive and scanning), but if any scan/execution failure causes a gap > 2min, the health check fails even though the keeper process is running fine

**Deeper problem:** The 30s poll cycle means `lastExecutionTime` updates every 30s, so the 2min threshold works *most* of the time... until the scan itself errors. A scan error at line 63 catches the error and logs it but does NOT call `recordScanCycle()`, so a sustained scan error (e.g., RPC node down) correctly reports unhealthy. But an *idle keeper with working scans* reports healthy -- so the current model actually works by accident for the common case, but is fragile and semantically wrong.

### Recommended Architecture (Solution)

```
src/
├── utils/healthState.ts        # REFACTORED: multi-signal heartbeat + latency tracker
├── utils/latencyTracker.ts     # NEW: circular buffer percentile calculator
├── server/httpServer.ts        # REFACTORED: heartbeat-based health check + percentiles
└── index.ts                    # MODIFIED: record latency after execution
```

### Pattern 1: Multi-Signal Heartbeat Liveness

**What:** Replace single-timestamp liveness with a model that checks multiple independent heartbeat signals. The keeper is "healthy" if its primary heartbeat (scan cycle) is recent AND critical subsystems (WS, oracle) are not in a degraded state.

**When to use:** Any long-running service where "no recent work" does not mean "dead."

**Example:**
```typescript
// healthState.ts - refactored
export const healthState = {
  startedAt: new Date(),
  // Heartbeat signals (liveness indicators independent of user activity)
  lastHeartbeatTime: null as Date | null,  // Updated by scan cycle (every 30s)
  // Subsystem status
  oracleConnected: false,
  wsConnected: false,
  // Execution tracking (separate from liveness)
  lastExecutionTime: null as Date | null,
  executionCounts: { deposits: 0, withdrawals: 0, orders: 0 },
};

// The scan cycle IS the heartbeat -- runs every 30s regardless of user activity
export function recordHeartbeat(): void {
  healthState.lastHeartbeatTime = new Date();
}
```

```typescript
// httpServer.ts - refactored health check
const HEARTBEAT_THRESHOLD_MS = 90_000; // 3x the 30s scan interval

app.get("/health", (_req, res) => {
  const now = Date.now();
  const lastBeat = healthState.lastHeartbeatTime;

  // Primary liveness: scan cycle heartbeat is recent
  const heartbeatAlive = lastBeat !== null
    && (now - lastBeat.getTime()) < HEARTBEAT_THRESHOLD_MS;

  const isHealthy = heartbeatAlive;
  // ...
});
```

**Why 90s threshold (3x scan interval):** The scan runs every 30s. A single missed scan should not trigger an alert. Two missed scans (60s) could be transient network hiccup. Three missed scans (90s) indicates a real problem. This gives BetterStack (which pings every ~30-60s) a clean window.

### Pattern 2: Circular Buffer Percentile Tracker

**What:** Fixed-size array that overwrites the oldest entry when full. To compute percentiles, sort a copy and index into it. No external library needed.

**When to use:** When you need p50/p95 from a bounded recent window without adding dependencies.

**Example:**
```typescript
// latencyTracker.ts - NEW file
export class LatencyTracker {
  private buffer: number[];
  private index: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number = 200) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  record(latencyMs: number): void {
    this.buffer[this.index] = latencyMs;
    this.index = (this.index + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Get percentile value (0-100). Returns null if no data. */
  percentile(p: number): number | null {
    if (this.count === 0) return null;
    const sorted = this.buffer.slice(0, this.count).sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /** Convenience: get p50 and p95 together */
  getPercentiles(): { p50: number | null; p95: number | null; sampleCount: number } {
    return {
      p50: this.percentile(50),
      p95: this.percentile(95),
      sampleCount: this.count,
    };
  }
}
```

### Pattern 3: Consolidate Duplicate Health Endpoints

**What:** The codebase currently has TWO health endpoints: `/health` (in `httpServer.ts`, returns detailed status with 200/503 based on liveness) and `/api/health` (in `healthController.ts`, always returns 200 with `{status: "ok"}`). Consolidate to one authoritative endpoint.

**When to use:** When duplicate endpoints create confusion about which BetterStack should ping.

**Recommendation:** Keep `/health` as the primary (BetterStack-facing) endpoint with the new heartbeat model. Either remove `/api/health` or make it proxy to the same logic. The simplest approach: leave `/api/health` as a lightweight "process is running" check (always 200) and make `/health` the liveness check (200/503 based on heartbeat).

### Anti-Patterns to Avoid
- **Using execution timestamps for liveness:** Execution depends on user activity. No users = no executions = false "dead" signal. Liveness must be independent of workload.
- **Single-signal health:** Checking only one thing means a degraded subsystem (WS down, oracle disconnected) is invisible. Multi-signal gives operators actionable information.
- **Unbounded latency arrays:** Storing every latency value forever causes memory growth. Always use a bounded buffer.
- **Sorting on every health request:** For small buffers (<500), sorting a copy on each request is fine (~0.01ms). For larger buffers, use a pre-sorted insertion approach. 200 elements is well within "just sort it" territory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentile calculation (200 samples) | External histogram library | Simple sorted-array percentile on circular buffer | 200 elements sorts in microseconds; adding hdr-histogram-js or prom-client for this is dependency bloat |
| Health check framework | Custom middleware chain | Express route handler (existing) | Already using Express; health check is one route handler |
| Metrics exposition | Prometheus /metrics endpoint | JSON on existing /health endpoint | No Prometheus infrastructure exists; JSON is what BetterStack consumes |

**Key insight:** This service is a single-process testnet keeper. The monitoring consumer is BetterStack pinging an HTTP endpoint. The right tool is the simplest thing that works: in-process state + JSON response. External metrics infrastructure (Prometheus, Grafana, OpenTelemetry) would be the right call for a production multi-instance deployment, but adds operator burden for zero benefit here.

## Common Pitfalls

### Pitfall 1: Threshold Too Tight
**What goes wrong:** Setting heartbeat threshold to 1x the scan interval (30s). A single slow scan or brief GC pause causes a false alert.
**Why it happens:** Intuition says "if scan runs every 30s, I should expect a heartbeat within 30s."
**How to avoid:** Use 3x the scan interval (90s). This tolerates one missed scan while still detecting genuine failures within a reasonable window.
**Warning signs:** Intermittent 503s on /health in logs during periods of zero user activity.

### Pitfall 2: Confusing Liveness with Readiness
**What goes wrong:** The health endpoint returns 503 during startup before the first scan completes, causing BetterStack to alert during deployments.
**Why it happens:** `lastHeartbeatTime` is null until the first `recordHeartbeat()` call.
**How to avoid:** During the startup grace period (first 90s), return 200 with `status: "starting"`. After the grace period, require heartbeats.
**Warning signs:** Alerts every time the service redeploys.

### Pitfall 3: Dead Code in healthState.ts
**What goes wrong:** `recordEvent()` and `lastEventTime` exist in `healthState.ts` but are never called. They were likely intended for event-driven health tracking but never wired up.
**Why it happens:** Leftover from Phase 10 development.
**How to avoid:** Remove dead code during refactoring. Don't add more unused fields.
**Warning signs:** Functions exported but imported nowhere.

### Pitfall 4: Percentile Confusion on Empty Data
**What goes wrong:** Health endpoint reports `p50: null, p95: null` forever because no executions have happened yet.
**Why it happens:** Keeper just started and no user operations have occurred.
**How to avoid:** Return `null` for percentiles with `sampleCount: 0` so monitoring tools can distinguish "no data" from "latency = 0". This is expected behavior, not an error.
**Warning signs:** Dashboard showing null values treated as errors.

## Code Examples

### Example 1: Refactored healthState.ts

```typescript
// src/utils/healthState.ts
import { LatencyTracker } from "./latencyTracker.js";

export const latencyTracker = new LatencyTracker(200);

export const healthState = {
  startedAt: new Date(),
  // Primary heartbeat (scan cycle, every 30s)
  lastHeartbeatTime: null as Date | null,
  // Subsystem status
  oracleConnected: false,
  wsConnected: false,
  // Execution stats (informational, NOT used for liveness)
  lastExecutionTime: null as Date | null,
  executionCounts: {
    deposits: 0,
    withdrawals: 0,
    orders: 0,
  },
};

/** Record scan cycle completion as heartbeat (primary liveness signal). */
export function recordHeartbeat(): void {
  healthState.lastHeartbeatTime = new Date();
}

/** Record a successful execution. Updates stats and latency tracker. */
export function recordExecution(type: "deposit" | "withdrawal" | "order", latencyMs: number): void {
  healthState.lastExecutionTime = new Date();
  healthState.executionCounts[type === "deposit" ? "deposits" : type === "withdrawal" ? "withdrawals" : "orders"]++;
  latencyTracker.record(latencyMs);
}

export function setOracleStatus(connected: boolean): void {
  healthState.oracleConnected = connected;
}

export function setWsStatus(connected: boolean): void {
  healthState.wsConnected = connected;
}
```

### Example 2: LatencyTracker Implementation

```typescript
// src/utils/latencyTracker.ts
/**
 * Fixed-capacity circular buffer for tracking execution latency.
 * Stores the most recent N latency values and computes percentiles on demand.
 */
export class LatencyTracker {
  private buffer: number[];
  private index: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number = 200) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /** Record a latency measurement in milliseconds. */
  record(latencyMs: number): void {
    this.buffer[this.index] = latencyMs;
    this.index = (this.index + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /**
   * Compute the value at a given percentile (0-100).
   * Returns null if no data has been recorded.
   */
  percentile(p: number): number | null {
    if (this.count === 0) return null;
    const sorted = this.buffer.slice(0, this.count).sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /** Get p50 and p95 together with sample count. */
  getPercentiles(): { p50: number | null; p95: number | null; sampleCount: number } {
    return {
      p50: this.percentile(50),
      p95: this.percentile(95),
      sampleCount: this.count,
    };
  }
}
```

### Example 3: Refactored /health Endpoint

```typescript
// In httpServer.ts
import { latencyTracker } from "../utils/healthState.js";

const HEARTBEAT_THRESHOLD_MS = 90_000; // 3x 30s scan interval
const STARTUP_GRACE_MS = 90_000;       // Grace period after startup

app.get("/health", (_req, res) => {
  const now = Date.now();
  const uptime = now - healthState.startedAt.getTime();
  const lastBeat = healthState.lastHeartbeatTime;

  // During startup grace period, report healthy (no heartbeats yet is expected)
  const inStartupGrace = uptime < STARTUP_GRACE_MS;
  const heartbeatAlive = lastBeat !== null
    && (now - lastBeat.getTime()) < HEARTBEAT_THRESHOLD_MS;

  const isHealthy = inStartupGrace || heartbeatAlive;

  const percentiles = latencyTracker.getPercentiles();

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    service: "order-execution-keeper",
    uptime: Math.floor(uptime / 1000),
    lastHeartbeatTime: lastBeat?.toISOString() ?? null,
    lastExecutionTime: healthState.lastExecutionTime?.toISOString() ?? null,
    oracleConnected: healthState.oracleConnected,
    wsConnected: healthState.wsConnected,
    executionCounts: healthState.executionCounts,
    latency: {
      p50: percentiles.p50,
      p95: percentiles.p95,
      sampleCount: percentiles.sampleCount,
    },
  });
});
```

### Example 4: Updated drainQueue() Call Site

```typescript
// In index.ts drainQueue(), after successful execution:
queue.complete(item.key);
const latencyMs = Date.now() - item.detectedAt;
recordExecution(item.type, latencyMs);  // Pass latencyMs to tracker
log.info({ key: item.key, type: item.type, source: item.source, latencyMs }, "execution complete");
```

### Example 5: Rename recordScanCycle to recordHeartbeat

```typescript
// In index.ts scanAndEnqueue():
// Old: recordScanCycle();
// New: recordHeartbeat();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `lastExecutionTime` threshold (polling-era) | Multi-signal heartbeat (event-driven era) | Phase 12 (now) | Eliminates false-positive alerts during idle periods |
| Log-only latency tracking | In-process percentile buffer | Phase 12 (now) | Enables monitoring tools to consume p50/p95 |
| `recordScanCycle` naming | `recordHeartbeat` (semantic clarity) | Phase 12 (now) | Makes intent clear: scan cycle is a liveness heartbeat |

**Deprecated/outdated:**
- `recordEvent()` and `lastEventTime` in `healthState.ts`: Dead code, never called. Remove during refactoring.
- `recordScanCycle()`: Rename to `recordHeartbeat()` for semantic clarity.
- `/api/health` (healthController.ts): Redundant simple endpoint. Keep as-is (lightweight "process alive" check) but ensure BetterStack points to `/health`.

## Open Questions

1. **BetterStack ping frequency**
   - What we know: BetterStack pings `/health` and expects 200. The 90s heartbeat threshold gives generous room.
   - What's unclear: Exact BetterStack check interval (typically 30s or 60s).
   - Recommendation: 90s threshold works for any reasonable check interval. No action needed.

2. **Buffer capacity (200 executions)**
   - What we know: 200 recent executions provides a representative sample for percentiles. On testnet with low traffic, this may cover hours or days of activity.
   - What's unclear: Whether operators want time-windowed percentiles (e.g., "last hour") vs count-windowed ("last 200").
   - Recommendation: Start with count-windowed (simpler). Time-windowed can be added later if needed. For a testnet keeper, count-windowed is sufficient.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/server/httpServer.ts` -- current health check logic with 2min threshold
- Codebase inspection: `src/utils/healthState.ts` -- current healthState shape, dead `recordEvent()` code
- Codebase inspection: `src/index.ts` -- drainQueue latencyMs computation (line 108), scanAndEnqueue calling recordScanCycle (line 62), 30s poll interval (line 239)
- Codebase inspection: `src/core/listeners/eventListener.ts` -- event-driven detection model
- Codebase inspection: `src/server/controllers/healthController.ts` -- duplicate /api/health endpoint

### Secondary (MEDIUM confidence)
- BetterStack behavior: standard HTTP health check monitoring; expects 200 for healthy, non-200 for alert

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; all changes are to existing code
- Architecture: HIGH - Pattern is well-understood (heartbeat liveness + circular buffer percentiles); all code inspected directly
- Pitfalls: HIGH - Identified from direct codebase analysis (dead code, threshold math, startup grace period)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain, no external dependency changes expected)
