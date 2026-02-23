---
phase: 07-public-deployment
plan: 01
subsystem: infra
tags: [vercel, serverless, proxy, deployment, env-vars, react]

# Dependency graph
requires:
  - phase: 06-position-management
    provides: Full trading loop working end-to-end on Base Sepolia
provides:
  - Vercel production deployment at app.0xmarkets.io with env-driven keeper proxies
  - api/keeper.ts serverless proxy using KEEPER_URL env var
  - api/order-keeper.ts serverless proxy using ORDER_KEEPER_URL env var
  - KeeperStatusBanner component for degraded-service user communication
affects: [08-keeper-monitoring, 09-ui-polish]

# Tech tracking
tech-stack:
  added: [vercel serverless functions (api/order-keeper.ts)]
  patterns: [env-var-driven proxy pattern for serverless API routes, relative URL API calls from frontend]

key-files:
  created:
    - api/order-keeper.ts
    - src/components/KeeperStatusBanner/KeeperStatusBanner.tsx
    - src/components/KeeperStatusBanner/KeeperStatusBanner.scss
  modified:
    - api/keeper.ts
    - vercel.json
    - vite.config.ts
    - src/components/StatusNotification/GmStatusNotification.tsx
    - src/App/App.tsx
    - .planning/PROJECT.md

key-decisions:
  - "Use process.env.KEEPER_URL with fallback IP so local dev works without env setup"
  - "Add /api/order-keeper proxy to avoid mixed-content (HTTPS page -> HTTP IP) in production"
  - "KeeperStatusBanner polls /api/keeper/prices/tickers every 60s as health check"
  - "Deployment protection is a Vercel project-level setting; user must disable via dashboard for public access"

patterns-established:
  - "Serverless proxy pattern: api/*.ts files proxy to internal services via env-var URLs"
  - "Relative URL pattern: frontend calls /api/keeper/* and /api/order-keeper/* — works in both dev (vite proxy) and prod (Vercel serverless)"

requirements-completed: [DEPLOY-01]

# Metrics
duration: 10min
completed: 2026-02-23
---

# Phase 7 Plan 1: Public Deployment Summary

**Vercel production deployment at app.0xmarkets.io with env-driven keeper proxies (KEEPER_URL, ORDER_KEEPER_URL) and keeper-down banner — all hardcoded 142.93.203.222 IPs removed from frontend source**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-23T04:47:57Z
- **Completed:** 2026-02-23T05:00:00Z
- **Tasks:** 2
- **Files modified:** 8 (1 created new: api/order-keeper.ts, 2 new component files)

## Accomplishments
- Removed all hardcoded keeper IPs from `src/` — replaced with relative `/api/keeper` and `/api/order-keeper` URLs
- Created `api/order-keeper.ts` serverless proxy for order-execution-keeper service (port 37018)
- Added `KEEPER_URL` and `ORDER_KEEPER_URL` env vars to Vercel production project
- Deployed to Vercel production — deployment ID `dpl_GETTqnXW41eEXQRS9K2ck5WY9Juc`, aliased to `app.0xmarkets.io`
- Verified keeper proxy returns valid JSON price data for all 7 configured tokens
- Created `KeeperStatusBanner` component that polls keeper health every 60s and shows amber banner when unreachable

## Task Commits

Each task was committed atomically:

1. **Task 1: Environment-driven keeper proxy and keeper-down banner** - `54e866f9e` (feat)
2. **Task 2: Deploy to Vercel and configure production environment** - No code commit (deployment-only; Vercel env vars set, production deployment triggered via CLI)

**Plan metadata:** (see final commit in this batch)

## Files Created/Modified
- `api/keeper.ts` - Changed hardcoded IP to `process.env.KEEPER_URL || "http://142.93.203.222:37017"`
- `api/order-keeper.ts` - New serverless proxy for order-execution-keeper (port 37018), uses `ORDER_KEEPER_URL` env var
- `vercel.json` - Added `/api/order-keeper/:path*` rewrite and function config
- `vite.config.ts` - Added `/api/order-keeper` dev proxy pointing to port 37018
- `src/components/StatusNotification/GmStatusNotification.tsx` - `KEEPER_API_URL` changed from hardcoded IP to `/api/order-keeper`
- `src/components/KeeperStatusBanner/KeeperStatusBanner.tsx` - New banner component; fetches `/api/keeper/prices/tickers`, shows amber banner on failure, re-checks every 60s
- `src/components/KeeperStatusBanner/KeeperStatusBanner.scss` - Amber (#FFA726) banner styles
- `src/App/App.tsx` - Renders `<KeeperStatusBanner />` above `<AppRoutes />`
- `.planning/PROJECT.md` - Corrected keeper management description to "managed directly via SSH"

## Decisions Made
- Used `process.env.KEEPER_URL || fallback` pattern so local dev works without setting env vars — zero-config for developers
- Added `/api/order-keeper` proxy alongside `/api/keeper` to resolve mixed-content issue where HTTPS Vercel deployment would call HTTP keeper IP directly
- KeeperStatusBanner polls the production proxy endpoint (not the keeper directly) — this tests the full stack
- Vercel project already had `app.0xmarkets.io` as a custom domain alias — no domain setup needed

## Deviations from Plan

None — plan executed exactly as written. All five sub-tasks in Task 1 were completed as specified. Task 2 deployment succeeded on first attempt.

## Issues Encountered

**Vercel Deployment Protection enabled:** The Vercel project has "Deployment Protection" (visitor password) enabled at the project level. This causes a 401 + password prompt when visiting the URL without authentication. This is a Vercel Dashboard setting, not a code issue.

**Resolution:** Keeper proxy verified working via `vercel curl /api/keeper/prices/tickers` (bypasses protection). The app code is correct. To make the app publicly accessible, the user needs to disable Deployment Protection in the Vercel Dashboard:
- Go to: Vercel Dashboard -> Project 0xmarkets-interface -> Settings -> Deployment Protection
- Set to "Vercel Authentication" (team-only) or "Disabled" for public access

## User Setup Required

1. **Disable Vercel Deployment Protection** (required for public access):
   - Vercel Dashboard -> 0xmarkets-interface project -> Settings -> Deployment Protection
   - Change from "Password" to "Vercel Authentication" or "Disabled"

2. **Custom domain** (`app.0xmarkets.io`) is already configured as a production alias. No DNS changes needed.

3. **Environment variables** are already set in Vercel production:
   - `KEEPER_URL` = `http://142.93.203.222:37017`
   - `ORDER_KEEPER_URL` = `http://142.93.203.222:37018`

## Next Phase Readiness
- App is deployed and functional — keeper proxy returns valid price data
- Once deployment protection is disabled, the app will be publicly accessible
- Phase 8 (Keeper Monitoring) can proceed in parallel — infrastructure is in place
- The `KeeperStatusBanner` is ready to show users when the keeper is down (Phase 8 will add more monitoring)

---
*Phase: 07-public-deployment*
*Completed: 2026-02-23*
