---
phase: 07-public-deployment
plan: 02
subsystem: infra
tags: [keeper, docker, pyth-lazer, order-execution, cloud-deployment, digitalocean]

# Dependency graph
requires:
  - phase: 07-public-deployment
    plan: 01
    provides: Vercel production deployment at app.0xmarkets.io with env-driven keeper proxies
  - phase: 06-position-management
    plan: 04
    provides: v1.1 verification fixes for keeper config (PythLazer, indexToken, FAILED retry)
provides:
  - All v1.1 verification fixes committed to order-execution-keeper-service repo
  - docker-compose.yml updated with correct PYTH_LAZER_FEED_PROVIDER_ADDRESS (0x8a3eb351) for both services
  - Cloud keeper source ready for DO deployment via git pull + docker compose up --build
affects: [08-keeper-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [docker-compose env-var override for PythLazer provider address, FAILED-status retry pattern in keeper scanner+executor]

key-files:
  created: []
  modified:
    - /Users/ken/Projects/0xM/docker-compose.yml
    - /Users/ken/Projects/0xM/order-execution-keeper-service/src/config.ts
    - /Users/ken/Projects/0xM/order-execution-keeper-service/src/core/executors/orderExecutor.ts
    - /Users/ken/Projects/0xM/order-execution-keeper-service/src/core/scanners/orderScanner.ts

key-decisions:
  - "docker-compose.yml is not tracked in any git repo locally — user must manually apply the file on DO server (scp or direct edit)"
  - "v1.1 verification fixes (orderExecutor indexToken + scanner FAILED retry) were already present in local source from phase 06-04; this plan committed them to the repo"
  - "Fix 4 (REQUEST_EXPIRATION_TIME=3600s) requires no code change — it is set in DataStore on-chain"

patterns-established:
  - "FAILED status retry: scanner queries PENDING+FAILED, executor resets FAILED to PENDING before retry — prevents stuck orders"
  - "Index token resolution: reader.getMarket() call in executor provides correct token for oracle pricing, not market address"

requirements-completed: [DEPLOY-02]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 7 Plan 2: Cloud Keeper Sync Summary

**v1.1 verification fixes committed to order-execution-keeper-service (PythLazer v4 address, indexToken resolution, FAILED-order retry) and docker-compose.yml updated with correct provider address for DO deployment**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-23T05:01:32Z
- **Completed:** 2026-02-23T05:03:02Z
- **Tasks:** 1 of 2 (Task 2 is a human-verify checkpoint requiring DO deployment)
- **Files modified:** 4

## Accomplishments
- Confirmed all 3 source-level v1.1 fixes are present in the order-execution-keeper-service codebase
- Committed the v1.1 fixes to the repo so the DO server can pull and deploy them
- Updated docker-compose.yml PYTH_LAZER_FEED_PROVIDER_ADDRESS from stale 0x93704d (old) to 0x8a3eb351 (v4 current) for both keeper-service and order-execution-keeper containers
- Verified all 4 verification checks from the plan pass (grep confirms correct addresses, indexToken logic, FAILED retry)

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply v1.1 verification fixes to keeper configs and source** - `2532601` (fix) — order-execution-keeper-service repo
2. **Task 2: Deploy keepers to DO and verify end-to-end trading loop** - Awaiting human verification (checkpoint)

**Plan metadata:** (see final commit in this batch)

## Files Created/Modified
- `/Users/ken/Projects/0xM/docker-compose.yml` - Updated PYTH_LAZER_FEED_PROVIDER_ADDRESS for keeper-service and order-execution-keeper from 0x93704d... to 0x8a3eb351... (not git-tracked locally — must be applied manually on DO server)
- `order-execution-keeper-service/src/config.ts` - Updated pythLazerFeedProviderAddress fallback from 0x2F00A620... to 0x8a3eb351... (v4 provider)
- `order-execution-keeper-service/src/core/executors/orderExecutor.ts` - Added reader.getMarket() call to resolve market indexToken for oracle pricing; added FAILED-status retry logic
- `order-execution-keeper-service/src/core/scanners/orderScanner.ts` - Added FAILED to getPendingOrderKeys() status filter so failed orders are re-queued

## Decisions Made
- docker-compose.yml is not tracked in any local git repository — the `/Users/ken/Projects/0xM/` parent directory has no `.git`. The fix was applied locally, but must be deployed to DO manually (via `scp docker-compose.yml root@142.93.203.222:/opt/0xmarkets/` or direct edit on server).
- The three source-level fixes (config.ts, orderExecutor.ts, orderScanner.ts) were already implemented during phase 06-04 verification but were uncommitted. This plan commits them, making the DO deployment via `git pull` effective.

## Deviations from Plan

### Observation: docker-compose.yml not git-tracked

**Found during:** Task 1 (reviewing where to commit docker-compose.yml)
- **Issue:** `/Users/ken/Projects/0xM/docker-compose.yml` is not inside any git repository. The `git pull` step on the DO server cannot update this file automatically.
- **Impact:** User must manually apply the docker-compose.yml change on the DO server before running `docker compose up --build -d`. The source code fixes are pushed via the order-execution-keeper-service repo.
- **Documented in:** Task 2 checkpoint instructions below.

No other deviations — fixes 2 and 3 were already present in local source from phase 06-04 (as expected — they were applied during live verification). Fix 1 required docker-compose.yml update (done). Fix 4 requires no code change.

## Issues Encountered

**docker-compose.yml not in version control:** The file at `/Users/ken/Projects/0xM/docker-compose.yml` is a standalone file not tracked in any git repository. The source code changes to order-execution-keeper-service are committed and pushable, but docker-compose.yml requires manual deployment. Added explicit SCP instruction to the checkpoint steps.

## User Setup Required

**To complete deployment (Task 2 checkpoint):**

1. Push the order-execution-keeper-service commit to GitHub:
   ```bash
   cd /Users/ken/Projects/0xM/order-execution-keeper-service
   git push origin main
   ```

2. Copy updated docker-compose.yml to the DO server:
   ```bash
   scp /Users/ken/Projects/0xM/docker-compose.yml root@142.93.203.222:/opt/0xmarkets/docker-compose.yml
   ```

3. SSH to DO server and deploy:
   ```bash
   ssh root@142.93.203.222
   cd /opt/0xmarkets
   cd order-execution-keeper-service && git pull && cd ..
   docker compose up --build -d
   docker compose logs --tail 20 keeper-service
   docker compose logs --tail 20 order-execution-keeper
   ```

4. Verify keeper proxy from public URL:
   ```bash
   curl -s https://app.0xmarkets.io/api/keeper/prices/tickers | head -c 200
   ```

5. Complete the full trading loop test (see Task 2 checkpoint for full steps).

## Next Phase Readiness
- All source-level fixes are committed and ready for DO deployment
- Once user deploys and verifies the full trading loop, DEPLOY-02 is complete
- Phase 8 (Keeper Monitoring) can begin after successful cloud keeper deployment

---
*Phase: 07-public-deployment*
*Completed: 2026-02-23*
