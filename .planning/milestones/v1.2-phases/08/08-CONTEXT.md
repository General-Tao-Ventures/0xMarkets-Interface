# Phase 8 Context: Keeper Monitoring

**Phase Goal:** Keeper health is observable and failures trigger alerts before they affect users
**Requirements:** MON-01, MON-02, MON-03
**Decided:** 2026-02-23

## Health Endpoint Shape

- **Health definition:** Process is running AND last successful execution was within **2 minutes** (12x the 10s scan interval). Generous threshold avoids false positives during nonce retries or network hiccups.
- **Schema:** Service-specific. Each keeper reports its own relevant subsystems:
  - `order-execution-keeper` (port 37018): last execution time, oracle connection status, execution counts
  - `keeper-service` (port 37017): last price push, candle generation status, WebSocket status
- **Auth:** Open (no authentication). Response contains only timestamps and status — no secrets.
- **HTTP method:** GET on `/health`
- **Response code:** 200 when healthy, 503 when unhealthy (last execution > 2 min ago or process degraded)

## Alerting Mechanism

- **Tool:** BetterStack (free tier) — external uptime monitor pings health endpoints every 1-2 min
- **Setup:** Create account from scratch as part of this phase
- **Alert channel:** Shared channel (Slack or email group) so both Ken and Michael receive alerts
- **How it works:** BetterStack pings `http://<DO-IP>:37017/health` and `http://<DO-IP>:37018/health`. If either returns non-200 or times out, alert fires.
- **No keeper-side alert code needed** — the health endpoint from Plan 08-01 is sufficient. BetterStack handles the monitoring and notification.
- **Success criterion:** Alert fires within 5 minutes of keeper going down (BetterStack checks every 1-2 min, confirms failure after 2-3 consecutive fails → well within 5 min)

## Structured Logging

- **Library:** pino (fast, JSON-native, minimal overhead)
- **Format:** JSON lines in all environments. Each log is one JSON object per line:
  ```json
  {"timestamp":"2026-02-23T01:30:00.000Z","level":"info","service":"order-keeper","event":"deposit_executed","key":"0x123...","gasUsed":150000}
  ```
- **Required fields:** timestamp, level, service, event
- **Migration:** Replace ALL ~100+ existing `console.log/warn/error` calls in one pass. Clean break — no mixed logging.
- **Scope:** Both keeper services (`order-execution-keeper-service` and `keeper-service`)

## Deferred Ideas

_None identified during discussion._

## Plan Mapping

| Decision Area | Plan |
|--------------|------|
| Health endpoints + structured logging | 08-01 |
| BetterStack setup + alerting | 08-02 |
