---
phase: 29-docker-deploy-database
verified: 2026-03-01T04:00:00Z
status: human_needed
score: 4/5 must-haves verified locally; 5th requires live server confirmation
re_verification: false
human_verification:
  - test: "Confirm all three Docker containers are currently running on the DO server"
    expected: "docker compose ps on 142.93.203.222 shows postgres, keeper-service, and order-execution-keeper all in Up/healthy state"
    why_human: "This is a remote server state check. The deployment happened via SSH on 2026-03-01 and was approved at the human checkpoint, but there is no programmatic way to re-query the live server. Container state can drift (crash, restart loop) after the checkpoint was approved."
  - test: "Confirm both keeper health endpoints return HTTP 200 from public internet"
    expected: "curl http://142.93.203.222:37017/health returns 200 with uptime field; curl http://142.93.203.222:37018/health returns 200"
    why_human: "Live network check required. The SUMMARY documents HTTP 200 at the time of Task 3 approval, but current status cannot be verified statically."
---

# Phase 29: Docker Deploy & Database Verification Report

**Phase Goal:** All three Docker containers (postgres, keeper-service, order-execution-keeper) are running with current code on the DO server
**Verified:** 2026-03-01T04:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | keeper-service container running v1.7 code (liquidation pipeline, multicall batching) | VERIFIED | `src/core/scanner.ts` has full liquidation scan cycle (7 references to getOraclePrice/multicall); `src/core/contract.ts` and `positionFetcher.ts` confirm multicall3 batching; local repo HEAD = bff78a4 = `ken/keeper-updates` remote HEAD (pushed to GitHub). Dockerfile CMD runs `pnpm db:migrate:deploy && node dist/index.js`. SUMMARY documents liquidation scanner active with 30s cycles. |
| 2 | order-execution-keeper container running current code with updated contract addresses | VERIFIED | Local repo HEAD = 37c313a = `ken/keeper-rebuild` remote HEAD. Production `docker-compose.yml` at `/Users/ken/Projects/0xM/docker-compose.yml` contains `ORDER_HANDLER_ADDRESS: "0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad"`, `DEPOSIT_HANDLER_ADDRESS`, `WITHDRAWAL_HANDLER_ADDRESS` — these are the v1.7 contract addresses. Dockerfile has HEALTHCHECK on port 37018 and CMD `node dist/index.js`. |
| 3 | Prisma migrations applied without errors on Docker rebuild | VERIFIED | Exactly 2 migration directories confirmed: `20240106000000_init` (liquidation pipeline tables) and `20250214000000_add_price_candles`. Dockerfile CMD sequence ensures `pnpm db:migrate:deploy` runs before the server starts. SUMMARY records "2 migrations found in prisma/migrations, none pending." Migration SQL files are substantive (not stubs). |
| 4 | Existing database data (price_candles, position_snapshots) preserved through rebuild | VERIFIED | `docker-compose.yml` uses named volume `pgdata` mounted at `/var/lib/postgresql/data`. `docker compose down` without `--volumes` does not remove named volumes — data persists. SUMMARY records price_candles count grew from 140,532 to 140,539 (active, not lost). |
| 5 | All three containers (postgres, keeper-service, order-execution-keeper) show running/healthy status | HUMAN NEEDED | The SUMMARY and STATE.md both document all 3 containers healthy with HTTP 200 on both health endpoints at the time of Task 3 human checkpoint approval. This was confirmed by the user. However, this is a live server state — it cannot be re-verified without SSH access to the server. |

**Score:** 4/5 truths verified locally; truth #5 requires live server confirmation

### Required Artifacts

This phase performed all work on the remote DO server. There are no local file artifacts to create — the phase delivers a running server state, not source code files. Verification is based on the local supporting infrastructure (Dockerfiles, migrations, docker-compose.yml) and documented remote evidence.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `/Users/ken/Projects/0xM/docker-compose.yml` | Three-service compose with pgdata volume and DATABASE_URL | VERIFIED | Contains postgres, keeper-service, order-execution-keeper services. pgdata named volume present. DATABASE_URL: `postgresql://${POSTGRES_USER:-keeper}:${POSTGRES_PASSWORD}@postgres:5432/keeper_service`. Ports 37017 and 37018 exposed. |
| `/Users/ken/Projects/0xM/keeper-service/Dockerfile` | CMD runs Prisma migrate then starts server | VERIFIED | `CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/index.js"]` — exactly as specified. |
| `/Users/ken/Projects/0xM/order-execution-keeper-service/Dockerfile` | HEALTHCHECK on port 37018 | VERIFIED | `HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s CMD curl -f http://localhost:37018/health || exit 1` confirmed. |
| `prisma/migrations/20240106000000_init/` | Init migration (liquidation tables) | VERIFIED | Substantive SQL: creates position_snapshots, oracle_snapshots, liquidation_candidates, signed_decision_records, liquidation_executions with indexes and foreign keys. |
| `prisma/migrations/20250214000000_add_price_candles/` | Second migration (price_candles table) | VERIFIED | Substantive SQL: creates price_candles table with composite unique index and DESC sort index. |
| `keeper-service` on `origin/ken/keeper-updates` | bff78a4 pushed to GitHub | VERIFIED | `git log origin/ken/keeper-updates` confirms HEAD = bff78a4 = `feat(27): fix scanner price cache with getOraclePrice view calls and multicall3`. |
| `order-execution-keeper-service` on `origin/ken/keeper-rebuild` | 37c313a pushed to GitHub | VERIFIED | `git log origin/ken/keeper-rebuild` confirms HEAD = 37c313a = `fix: increase gas limit to 8M and add bid/ask prices to oracle subscription`. |
| Remote: Docker containers on 142.93.203.222 | All 3 in running/healthy state | HUMAN NEEDED | Confirmed at Task 3 human checkpoint (user approved); live state requires SSH re-check. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| keeper-service container | postgres container | DATABASE_URL in docker-compose.yml | VERIFIED | Pattern `postgresql://${POSTGRES_USER:-keeper}:${POSTGRES_PASSWORD}@postgres:5432/keeper_service` confirmed in `/Users/ken/Projects/0xM/docker-compose.yml` line 28. Service name `postgres` matches the postgres service name — Docker DNS resolution will resolve correctly. |
| keeper-service | /health endpoint on port 37017 | HTTP server in `src/server/httpServer.ts` | VERIFIED | `app.get("/health", ...)` at line 44 with uptime, lastScanTime, candleCollectorActive, wsConnected fields. Port = `Number(process.env.PORT || 37017)`. Exposed in docker-compose.yml as `0.0.0.0:37017:37017`. |
| order-execution-keeper | /health endpoint on port 37018 | `src/health.ts` + `src/index.ts` | VERIFIED | `app.get("/health", ...)` in health.ts imported and called in index.ts (`startHealthServer` at step 7). Default port 37018 in config.ts. Exposed as `0.0.0.0:37018:37018`. |
| keeper-service CMD | prisma migrate deploy | `sh -c "pnpm db:migrate:deploy && node dist/index.js"` | VERIFIED | The `&&` ensures migrations run and succeed before the server starts. The `prisma` directory is COPY'd into the production stage. pnpm script confirmed: `db:migrate:deploy` maps to `prisma migrate deploy`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEPLOY-01 | 29-01-PLAN.md | keeper-service pulled and Docker image rebuilt on DO | SATISFIED | Local repo at bff78a4, pushed to `origin/ken/keeper-updates`. SUMMARY documents `git pull` succeeded and `docker compose up --build -d` rebuilt image. Human checkpoint approved. |
| DEPLOY-02 | 29-01-PLAN.md | order-execution-keeper-service pulled and Docker image rebuilt on DO | SATISFIED | Local repo at 37c313a, pushed to `origin/ken/keeper-rebuild`. SUMMARY documents same rebuild. Human checkpoint approved. |
| DEPLOY-03 | 29-01-PLAN.md | All three containers (postgres, keeper, order-keeper) healthy after restart | SATISFIED (human-confirmed) | User approved Task 3 checkpoint after verifying all 3 containers running with HTTP 200 on both health endpoints. SUMMARY records "containers healthy 4+ hours." |
| DB-01 | 29-01-PLAN.md | Prisma migrations verified to apply cleanly on Docker rebuild | SATISFIED | 2 migration directories confirmed with substantive SQL. Dockerfile CMD applies migrations before server start. SUMMARY records "none pending" after rebuild. |
| DB-02 | 29-01-PLAN.md | Existing data preserved through migration (no destructive changes) | SATISFIED | Named volume `pgdata` in docker-compose.yml guarantees persistence across `docker compose down + up`. No `DROP TABLE` or `ALTER TABLE ... DROP COLUMN` in either migration. SUMMARY records row count grew 140,532 → 140,539. |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps only DEPLOY-01, DEPLOY-02, DEPLOY-03, DB-01, DB-02 to Phase 29. All 5 are accounted for in the PLAN frontmatter. No orphaned requirements.

### Anti-Patterns Found

No anti-patterns detected in the local supporting artifacts reviewed:

- `docker-compose.yml`: No hardcoded secrets (uses `${VAR:?required}` enforcement for PRIVATE_KEY, POSTGRES_PASSWORD, WS_RPC_URL)
- `Dockerfile` (keeper-service): No stubs; proper multi-stage build with production stage
- `Dockerfile` (order-execution-keeper): HEALTHCHECK present; no placeholder CMD
- Prisma migrations: Substantive SQL, no `-- TODO` comments
- `src/server/httpServer.ts`: Real health response with runtime data (uptime, scan time), not a stub `return { ok: true }`

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

### Human Verification Required

#### 1. Container Running State on DO Server

**Test:** SSH to the server and check container status:
```
ssh root@142.93.203.222 "cd /opt/0xmarkets && docker compose ps"
```
**Expected:** All three containers — postgres, keeper-service, and order-execution-keeper — appear with "Up" or "running (healthy)" status. No containers in "Exited" or "Restarting" state.
**Why human:** The deployment was confirmed at the Task 3 checkpoint on 2026-03-01. Container state is live — it cannot be re-verified without a live SSH connection to the server.

#### 2. Health Endpoint Verification

**Test:** From any machine with public internet access:
```
curl -v http://142.93.203.222:37017/health
curl -v http://142.93.203.222:37018/health
```
**Expected:** Both return HTTP 200. The 37017 response body includes `uptime`, `lastScanTime`, `candleCollectorActive`, `wsConnected`. The 37018 response includes token cache and oracle status.
**Why human:** Live network check required. The SUMMARY documents HTTP 200 at checkpoint time; current status requires a real request.

### Gaps Summary

No gaps found. All five PLAN requirements (DEPLOY-01 through DEPLOY-03, DB-01, DB-02) are satisfied by evidence in the local codebase and the human-approved checkpoint.

The two human verification items above are confirmation checks for a live deployment — not gaps in the implementation. The supporting infrastructure (Dockerfiles, migrations, health endpoints, docker-compose.yml, remote branches) is fully substantive and correctly wired. The human checkpoint was already approved by the user during plan execution.

---

_Verified: 2026-03-01T04:00:00Z_
_Verifier: Claude (gsd-verifier)_
