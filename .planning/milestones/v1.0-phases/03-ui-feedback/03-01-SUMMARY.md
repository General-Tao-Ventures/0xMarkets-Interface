---
phase: 03-ui-feedback
plan: 01
subsystem: api
tags: [express, prisma, cors, rest-api, keeper-service]

# Dependency graph
requires:
  - phase: 02-keeper-resilience
    provides: "errorReason field on depositRequest model (Prisma)"
provides:
  - "GET /api/deposits/:key endpoint exposing deposit status and errorReason"
  - "CORS middleware on keeper HTTP server for cross-origin frontend access"
affects: [03-02 (frontend error display will consume this API)]

# Tech tracking
tech-stack:
  added: []
  patterns: [manual CORS middleware, controller-route separation pattern]

key-files:
  created:
    - /Users/ken/Projects/0xM/order-execution-keeper-service/src/server/controllers/depositController.ts
  modified:
    - /Users/ken/Projects/0xM/order-execution-keeper-service/src/server/routes/index.ts
    - /Users/ken/Projects/0xM/order-execution-keeper-service/src/server/httpServer.ts

key-decisions:
  - "Manual CORS middleware instead of cors npm package -- testnet only, minimal footprint"
  - "Deployment deferred -- SSH key not loaded in agent, code compiles and is committed"

patterns-established:
  - "Controller pattern: async handler with try/catch, Prisma query, typed JSON response"
  - "Route registration: import controller, router.get with path params"

requirements-completed: [UI-02]

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 3 Plan 01: Deposit Status API Summary

**GET /api/deposits/:key endpoint on keeper service exposing deposit status and errorReason via Prisma, with CORS middleware for cross-origin frontend access**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T18:03:46Z
- **Completed:** 2026-02-20T18:04:48Z
- **Tasks:** 1 of 2 (Task 2 deployment deferred -- SSH auth gate)
- **Files modified:** 3

## Accomplishments
- Created deposit status controller querying Prisma depositRequest by requestKey
- Added GET /api/deposits/:key route returning { key, status, errorReason, retryCount, createdAt }
- Added CORS middleware with configurable origin (defaults to * for testnet)
- TypeScript compiles cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CORS middleware and deposit status API route** - `cd8ea72` (feat)
2. **Task 2: Deploy keeper update and verify API endpoint** - Deferred (SSH auth gate)

## Files Created/Modified
- `order-execution-keeper-service/src/server/controllers/depositController.ts` - New controller: queries Prisma for deposit by requestKey, returns status/errorReason/retryCount/createdAt
- `order-execution-keeper-service/src/server/routes/index.ts` - Added GET /deposits/:key route registration
- `order-execution-keeper-service/src/server/httpServer.ts` - Added CORS middleware before route registration

## Decisions Made
- Manual CORS middleware (3 lines) instead of installing cors npm package -- testnet only, no sensitive data, minimal footprint
- CORS_ALLOWED_ORIGINS env var with * default allows easy tightening later
- Deployment (Task 2) deferred due to SSH authentication gate -- code is committed and ready to deploy

## Deviations from Plan

None for code implementation -- plan executed exactly as written for Task 1.

Task 2 (deployment) blocked by SSH authentication gate -- no SSH keys loaded in agent session. The remote server at 142.93.203.222:37018 is reachable (health endpoint responds) but code deployment requires SSH access.

## Issues Encountered
- SSH to deployment server returned "Permission denied (publickey)" -- no SSH identities loaded in agent. This is expected (auth gate), not a code issue.

## User Setup Required
**Deployment required.** The code is committed to the order-execution-keeper-service repo but not deployed. To deploy:
```bash
ssh root@142.93.203.222 "cd /opt/0xmarkets && git -C order-execution-keeper-service pull && docker compose build order-execution-keeper && docker compose up -d order-execution-keeper"
```

Verify after deployment:
```bash
# Test 404 for unknown key
curl -s http://142.93.203.222:37018/api/deposits/0x0000000000000000000000000000000000000000000000000000000000000000 | jq .
# Expected: { "error": "Deposit not found" }

# Verify CORS headers
curl -sD - http://142.93.203.222:37018/api/deposits/0x0000 -o /dev/null 2>&1 | grep -i "access-control"
# Expected: Access-Control-Allow-Origin: *

# Verify health still works
curl -s http://142.93.203.222:37018/api/health | jq .
# Expected: { "status": "ok" }
```

## Next Phase Readiness
- API endpoint code is complete and compiled -- ready for deployment
- Once deployed, Plan 03-02 (frontend error display) can consume GET /api/deposits/:key
- Frontend will need the keeper base URL (142.93.203.222:37018) to call this endpoint

## Self-Check: PASSED

- FOUND: depositController.ts
- FOUND: commit cd8ea72
- FOUND: 03-01-SUMMARY.md

---
*Phase: 03-ui-feedback*
*Completed: 2026-02-20*
