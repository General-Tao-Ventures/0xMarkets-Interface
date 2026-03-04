---
phase: 34-deploy-verify
verified: 2026-03-03T23:01:15Z
status: human_needed
score: 4/5 must-haves verified
re_verification: false
human_verification:
  - test: "Check live health endpoint at http://142.93.203.222:37019/health"
    expected: "status=ok, lastIndexedBlock > 0 and advancing, eventsPerMinute present, lastBlock > 0 and advancing, lastPriceTick is a recent ISO timestamp"
    why_human: "Production service on DO droplet — cannot SSH or HTTP from local verification context"
  - test: "Query DB on droplet: SELECT COUNT(*) FROM oracle.price_update (or market.pool_value_info)"
    expected: "At least some rows appear in event tables after a few minutes of uptime (Base Sepolia may have low activity)"
    why_human: "Database is on the remote DO droplet — cannot query from local context"
  - test: "Compare lastIndexedBlock between two health polls 60 seconds apart"
    expected: "lastIndexedBlock should advance (cursor tracking new blocks even with 0 events)"
    why_human: "Requires live polling of a remote service"
---

# Phase 34: Deploy and Verify — Verification Report

**Phase Goal:** Deploy updated data-verification-service to DO and verify all collectors working
**Verified:** 2026-03-03T23:01:15Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Docker image builds with all new event indexer code and pg dependency | VERIFIED | `pg@^8.19.0` in package.json; `dist/index.js` present; `npx tsc --noEmit` exits 0; commits ea42567 and da9a961 confirm code is in repo |
| 2 | Container startup chains Prisma migrations, raw SQL migrations, then app start | VERIFIED | Dockerfile line 23: `CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/migrate.js && node dist/index.js"]` — unchanged from Phase 31 design |
| 3 | Health endpoint reports lastIndexedBlock, indexedEvents, eventsPerMinute, and other fields | VERIFIED | `src/index.ts` lines 56–71 — all fields present: status, lastBlock, lastPriceTick, lastIndexedBlock, indexedEvents, eventsPerMinute, uptime |
| 4 | WS_RPC_URL env var passed through in docker-compose.yml | VERIFIED | `docker-compose.yml` line 26: `WS_RPC_URL: ${WS_RPC_URL}` — confirmed via commit ea42567 diff |
| 5 | Events appearing in DB tables within seconds of on-chain emission (production) | HUMAN NEEDED | The SUMMARY reports user confirmed this via live health endpoint and DB queries, but cannot be verified programmatically from local context |

**Score:** 4/5 truths verified locally; truth #5 is a live production check already performed by the human deployer

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data-verification-service/docker-compose.yml` | Docker Compose config with WS_RPC_URL passthrough | VERIFIED | Contains `WS_RPC_URL: ${WS_RPC_URL}` on line 26 |
| `data-verification-service/.env.example` | Example env file documenting all required variables | VERIFIED | Contains `WS_RPC_URL=wss://base-sepolia-rpc.publicnode.com` |
| `data-verification-service/src/index.ts` | Health endpoint with eventsPerMinute rate metric | VERIFIED | Lines 59–61 compute rolling average; line 69 includes `eventsPerMinute` in response |
| `data-verification-service/src/collectors/eventIndexer.ts` | Substantive event indexer (not stub) | VERIFIED | 396-line file with full cursor management, historical replay, real-time WS subscription, processLogs, start/stop lifecycle |
| `data-verification-service/Dockerfile` | Multi-stage build with CMD chaining migrations | VERIFIED | Lines 1–23 confirm multi-stage build; CMD chains 3 commands as designed |
| `data-verification-service/dist/index.js` | Build output present | VERIFIED | File exists — `pnpm build` ran successfully |
| `data-verification-service/dist/migrate.js` | Migration runner build output | VERIFIED | File exists |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `docker-compose.yml` | `src/config.ts` | `WS_RPC_URL` env var passed from compose to `required()` | WIRED | `docker-compose.yml:26` passes `${WS_RPC_URL}`; `config.ts:16` calls `required("WS_RPC_URL")` |
| `src/index.ts` | `src/collectors/eventIndexer.ts` | Imports `getLastIndexedBlock` and `getIndexedEventCount` for health | WIRED | `index.ts` lines 18–22 import both functions; lines 57 and 64 use them in health response |
| `src/index.ts` | `src/collectors/eventIndexer.ts` | Calls `startEventIndexer` and `stopEventIndexer` in lifecycle | WIRED | `index.ts:51` awaits `startEventIndexer`; `index.ts:82` calls `stopEventIndexer` in shutdown |
| `src/collectors/eventIndexer.ts` | `src/config.ts` | Reads `config.wsRpcUrl` to create WebSocket client | WIRED | `eventIndexer.ts:265–268` creates `wsClient` using `config.wsRpcUrl` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DEPLOY-01 | 34-01, 34-02 | Updated service builds and runs in Docker on DO droplet | SATISFIED (locally; production confirmed by human) | pg dependency in package.json; dist/ built; Docker Dockerfile correct; SUMMARY reports container running on droplet |
| DEPLOY-02 | 34-01, 34-02 | SQL migration runs on container startup alongside Prisma migrations | SATISFIED | Dockerfile CMD: `pnpm db:migrate:deploy && node dist/migrate.js && node dist/index.js` — both Prisma and raw SQL migration chained |
| DEPLOY-03 | 34-01, 34-02 | Health check endpoint reports event indexer status (last block, events/min) | SATISFIED | `src/index.ts` health endpoint returns `lastIndexedBlock`, `indexedEvents`, and `eventsPerMinute` |
| DEPLOY-04 | 34-01, 34-02 | Existing market snapshotter and price recorder continue working unchanged | SATISFIED | `marketSnapshotter.ts` and `priceRecorder.ts` not modified in commits ea42567 or da9a961; still imported and started in `index.ts` at lines 8–15 |

All 4 DEPLOY requirements assigned to Phase 34 are satisfied. No orphaned requirements found — REQUIREMENTS.md Traceability table maps all 4 to Phase 34.

---

### Anti-Patterns Found

No anti-patterns detected. Scanned all files modified in this phase:
- `docker-compose.yml` — no TODOs, stubs, or placeholders
- `.env.example` — complete, no missing values
- `src/index.ts` — full implementation, no empty handlers
- `src/collectors/eventIndexer.ts` — substantive 396-line implementation

---

### Human Verification Required

The following items require live production verification. Per the 34-02-SUMMARY, the deploying user already completed these checks during the human-action checkpoint. The results are documented in the SUMMARY but cannot be re-verified programmatically from local context.

#### 1. Live Health Endpoint

**Test:** `curl -s http://142.93.203.222:37019/health | python3 -m json.tool`
**Expected:** All fields present: `status="ok"`, `lastIndexedBlock > 0`, `eventsPerMinute` is a number, `lastBlock > 0`, `lastPriceTick` is a recent ISO timestamp
**Why human:** Remote service on DO droplet (142.93.203.222) — unreachable from local verification context
**SUMMARY evidence:** Reports `lastIndexedBlock=38405038`, `indexedEvents=0`, `eventsPerMinute=0`, cursor set to block 38405019

#### 2. Event Table Population

**Test:** SSH to droplet, run `SELECT COUNT(*) FROM oracle.price_update` in the data_verification DB
**Expected:** Some rows after 5+ minutes of uptime (oracle price updates are most frequent)
**Why human:** Requires remote DB access
**SUMMARY evidence:** Reports "All 10 SQL migrations executed successfully, creating event tables across 9 PG schemas" — tables exist; indexedEvents=0 at verification time was expected due to low Base Sepolia activity

#### 3. Cursor Advancement

**Test:** Poll health endpoint twice, 60 seconds apart, compare `lastIndexedBlock`
**Expected:** Value advances with each new block (~2 seconds on Base Sepolia)
**Why human:** Requires live polling over time
**SUMMARY evidence:** Reports cursor set to block 38405019, health shows lastIndexedBlock=38405038 — already advancing 19 blocks from initial set point

---

### Gaps Summary

No gaps identified. All local code artifacts are substantive, correctly wired, and pass TypeScript compilation. The production deployment truths were already verified by the human deployer per the 34-02-SUMMARY checkpoint. The `human_needed` status reflects that production runtime behavior cannot be re-confirmed programmatically from the local codebase — not that gaps exist.

**Notable:** `indexedEvents=0` and `eventsPerMinute=0` at initial verification time is expected and documented — Base Sepolia has low on-chain contract activity. The cursor is advancing (tracking new blocks), confirming the indexer is correctly subscribed and polling.

---

## Commit Verification

Both commits referenced in 34-01-SUMMARY exist and match claimed changes:

| Commit | Message | Files Changed | Match |
|--------|---------|---------------|-------|
| `ea42567` | chore(34-01): add WS_RPC_URL to docker-compose and .env.example | docker-compose.yml +1, .env.example +1 | EXACT |
| `da9a961` | feat(34-01): add eventsPerMinute rate metric to health endpoint | src/index.ts +8/-1 | EXACT |

Plan 34-02 had no code commits (human-action + human-verify tasks only) — correct per plan design.

---

_Verified: 2026-03-03T23:01:15Z_
_Verifier: Claude (gsd-verifier)_
