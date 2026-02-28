# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6 ([shipped 2026-02-22](milestones/v1.1-ROADMAP.md))
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9 ([shipped 2026-02-23](milestones/v1.2-ROADMAP.md))
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12 (shipped 2026-02-24)
- ✅ **v1.4 Maximum Keeper Speed** — Phases 13-14 (shipped 2026-02-25)
- ✅ **v1.5 Minimal Keeper Rewrite** — Phases 15-17 (shipped 2026-02-26)
- ✅ **v1.6 E2E Reliability** — Phases 18, 20-23 (shipped 2026-02-27)
- ✅ **v1.7 Liquidation Readiness** — Phases 24-27 ([shipped 2026-02-28](milestones/v1.7-ROADMAP.md))
- 🚧 **v1.8 Deployment** — Phases 28-31 (in progress)

## Phases

<details>
<summary>✅ v1.0 Fix Buy GM Flow (Phases 1-3) — SHIPPED 2026-02-21</summary>

- [x] Phase 1: Keeper Oracle Integration (2/2 plans) — completed 2026-02-21
- [x] Phase 2: End-to-End Deposit Execution (2/2 plans) — completed 2026-02-21
- [x] Phase 3: Deposit UX & Status Visibility (2/2 plans) — completed 2026-02-21

</details>

<details>
<summary>✅ v1.1 Full Trading Experience (Phases 4-6) — SHIPPED 2026-02-22</summary>

- [x] Phase 4: Stable Foundation (2/2 plans) — completed 2026-02-21
- [x] Phase 5: Liquidity & Swaps (2/2 plans) — completed 2026-02-21
- [x] Phase 6: Position Management (4/4 plans) — completed 2026-02-22

</details>

<details>
<summary>✅ v1.2 Demo-Ready Deployment (Phases 7-9) — SHIPPED 2026-02-23</summary>

- [x] Phase 7: Public Deployment (2/2 plans) — completed 2026-02-23
- [x] Phase 8: Keeper Monitoring (3/3 plans) — completed 2026-02-23
- [x] Phase 9: UI Polish & Tech Debt (2/2 plans) — completed 2026-02-23

</details>

<details>
<summary>✅ v1.3 Keeper Execution Speed (Phases 10-12) — SHIPPED 2026-02-24</summary>

- [x] Phase 10: Event-Driven Detection (2/2 plans) — completed 2026-02-23
- [x] Phase 11: Execution Pipeline Optimization (2/2 plans) — completed 2026-02-23
- [x] Phase 12: Observability & Tuning (2/2 plans) — completed 2026-02-24

</details>

<details>
<summary>✅ v1.4 Maximum Keeper Speed (Phases 13-14) — SHIPPED 2026-02-25</summary>

- [x] Phase 13: Oracle Correctness (4/4 plans) — completed 2026-02-25
- [x] Phase 14: Execution Speed (2/2 plans) — completed 2026-02-25

</details>

<details>
<summary>✅ v1.5 Minimal Keeper Rewrite (Phases 15-17) — SHIPPED 2026-02-26</summary>

- [x] Phase 15: Project Skeleton and Oracle (2/2 plans) — completed 2026-02-26
- [x] Phase 16: Keeper Logic and Infrastructure (2/2 plans) — completed 2026-02-26
- [x] Phase 17: Deploy and Verify (2/2 plans) — completed 2026-02-26

</details>

<details>
<summary>✅ v1.6 E2E Reliability (Phases 18, 20-23) — SHIPPED 2026-02-27</summary>

- [x] Phase 18: Event Detection and Toast Feedback (3/3 plans) — completed 2026-02-27
- [x] Phase 20: Contract Address Audit (2/2 plans) — completed 2026-02-26
- [x] Phase 21: Keeper Execution Fixes (1/1 plans) — completed 2026-02-27
- [x] Phase 22: Frontend Feedback (2/2 plans) — completed 2026-02-27
- [x] Phase 23: Automated E2E Testing (2/2 plans) — completed 2026-02-27

</details>

<details>
<summary>✅ v1.7 Liquidation Readiness (Phases 24-27) — SHIPPED 2026-02-28</summary>

- [x] Phase 24: Contract Bug Fixes (2/2 plans) — completed 2026-02-27
- [x] Phase 25: Liquidation Pipeline Verification (4/4 plans) — completed 2026-02-28
- [x] Phase 26: Liquidation Hardening and Performance (2/2 plans) — completed 2026-02-28
- [x] Phase 27: Liquidation Pipeline E2E Execution (1/1 plan) — completed 2026-02-28

</details>

### v1.8 Deployment (In Progress)

**Milestone Goal:** Deploy all v1.7 keeper updates to DigitalOcean, push frontend to Vercel, set up CI/CD for automated future deployments, and verify full system end-to-end.

- [ ] **Phase 28: Git Sync & Server Config** - Push local code, init git on server, update contract addresses and oracle mode
- [ ] **Phase 29: Docker Deploy & Database** - Rebuild containers on DO, verify migrations, confirm all services healthy
- [ ] **Phase 30: CI/CD Automation** - GitHub Actions workflows for push-to-deploy on both keeper repos
- [ ] **Phase 31: Frontend & E2E Verification** - Deploy frontend to Vercel, verify full system from browser to chain

## Phase Details

### Phase 28: Git Sync & Server Config
**Goal**: All code repositories are in sync (local to GitHub to server) with correct production configs
**Depends on**: Nothing (first phase of v1.8)
**Requirements**: GIT-01, GIT-02, GIT-03, CFG-01, CFG-02, CFG-03
**Plans:** 2 plans
Plans:
- [ ] 28-01-PLAN.md — Push all repos to GitHub and update docker-compose.yml with v1.7 addresses
- [ ] 28-02-PLAN.md — Initialize git on DO server, pull code, verify config
**Success Criteria** (what must be TRUE):
  1. `git log` on GitHub shows all 16 keeper-service commits from v1.7 work
  2. keeper-service directory on DO server is a git repo that can `git pull` from GitHub
  3. Server docker-compose.yml contains the v1.7 OrderHandler and ExchangeRouter addresses
  4. Server .env has ORACLE_MODE=lazer and all required environment variables present
  5. Frontend branch pushed to GitHub (Vercel auto-deploy triggered)

### Phase 29: Docker Deploy & Database
**Goal**: All three Docker containers (postgres, keeper-service, order-execution-keeper) are running with current code on the DO server
**Depends on**: Phase 28
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DB-01, DB-02
**Success Criteria** (what must be TRUE):
  1. `docker ps` on the server shows all three containers in healthy/running state
  2. keeper-service container is running the v1.7 code (with liquidation pipeline, multicall batching)
  3. order-execution-keeper container is running current code with updated contract addresses
  4. Prisma migrations applied without errors and existing database data is preserved
**Plans**: TBD

### Phase 30: CI/CD Automation
**Goal**: Pushing to a deploy branch on GitHub automatically deploys to the DO server without manual SSH
**Depends on**: Phase 29
**Requirements**: CICD-01, CICD-02
**Success Criteria** (what must be TRUE):
  1. Pushing to the deploy branch of keeper-service triggers a GitHub Actions workflow that SSHes to the DO server and redeploys the container
  2. Pushing to the deploy branch of order-execution-keeper triggers a GitHub Actions workflow that SSHes to the DO server and redeploys the container
  3. A failed deploy (e.g., build error) surfaces in the GitHub Actions UI with clear error output
**Plans**: TBD

### Phase 31: Frontend & E2E Verification
**Goal**: The full deployed system works end-to-end: a user on app.0xmarkets.io can execute a trade that keepers process on-chain
**Depends on**: Phase 29
**Requirements**: FE-01, FE-02, VER-01, VER-02
**Success Criteria** (what must be TRUE):
  1. app.0xmarkets.io loads in a browser and connects to the keeper endpoints on the DO server
  2. Both keeper health endpoints (ports 37017 and 37018) return HTTP 200 from the public internet
  3. A deposit, withdrawal, or order submitted through the frontend is detected and executed by the deployed keepers
  4. Frontend reflects execution status (toast notification transitions from Pending to Executed)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Keeper Oracle Integration | v1.0 | 2/2 | Complete | 2026-02-21 |
| 2. End-to-End Deposit Execution | v1.0 | 2/2 | Complete | 2026-02-21 |
| 3. Deposit UX & Status Visibility | v1.0 | 2/2 | Complete | 2026-02-21 |
| 4. Stable Foundation | v1.1 | 2/2 | Complete | 2026-02-21 |
| 5. Liquidity & Swaps | v1.1 | 2/2 | Complete | 2026-02-21 |
| 6. Position Management | v1.1 | 4/4 | Complete | 2026-02-22 |
| 7. Public Deployment | v1.2 | 2/2 | Complete | 2026-02-23 |
| 8. Keeper Monitoring | v1.2 | 3/3 | Complete | 2026-02-23 |
| 9. UI Polish & Tech Debt | v1.2 | 2/2 | Complete | 2026-02-23 |
| 10. Event-Driven Detection | v1.3 | 2/2 | Complete | 2026-02-23 |
| 11. Execution Pipeline Optimization | v1.3 | 2/2 | Complete | 2026-02-23 |
| 12. Observability & Tuning | v1.3 | 2/2 | Complete | 2026-02-24 |
| 13. Oracle Correctness | v1.4 | 4/4 | Complete | 2026-02-25 |
| 14. Execution Speed | v1.4 | 2/2 | Complete | 2026-02-25 |
| 15. Project Skeleton and Oracle | v1.5 | 2/2 | Complete | 2026-02-26 |
| 16. Keeper Logic and Infrastructure | v1.5 | 2/2 | Complete | 2026-02-26 |
| 17. Deploy and Verify | v1.5 | 2/2 | Complete | 2026-02-26 |
| 18. Event Detection and Toast Feedback | v1.6 | 3/3 | Complete | 2026-02-27 |
| 20. Contract Address Audit | v1.6 | 2/2 | Complete | 2026-02-26 |
| 21. Keeper Execution Fixes | v1.6 | 1/1 | Complete | 2026-02-27 |
| 22. Frontend Feedback | v1.6 | 2/2 | Complete | 2026-02-27 |
| 23. Automated E2E Testing | v1.6 | 2/2 | Complete | 2026-02-27 |
| 24. Contract Bug Fixes | v1.7 | 2/2 | Complete | 2026-02-27 |
| 25. Liquidation Pipeline Verification | v1.7 | 4/4 | Complete | 2026-02-28 |
| 26. Liquidation Hardening and Performance | v1.7 | 2/2 | Complete | 2026-02-28 |
| 27. Liquidation Pipeline E2E Execution | v1.7 | 1/1 | Complete | 2026-02-28 |
| 28. Git Sync & Server Config | v1.8 | 0/2 | Not started | - |
| 29. Docker Deploy & Database | v1.8 | 0/TBD | Not started | - |
| 30. CI/CD Automation | v1.8 | 0/TBD | Not started | - |
| 31. Frontend & E2E Verification | v1.8 | 0/TBD | Not started | - |
