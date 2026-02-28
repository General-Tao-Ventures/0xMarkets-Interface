# Requirements: 0xMarkets Interface

**Defined:** 2026-02-28
**Core Value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## v1.8 Requirements

Requirements for v1.8 Deployment milestone. Each maps to roadmap phases.

### Git Sync

- [ ] **GIT-01**: All local keeper-service commits pushed to remote (16 commits on `ken/keeper-updates`)
- [ ] **GIT-02**: Frontend branch pushed to remote to trigger Vercel deploy
- [ ] **GIT-03**: keeper-service initialized as git repo on DO server (currently raw files)

### Server Config

- [ ] **CFG-01**: docker-compose.yml updated with v1.7 contract addresses (OrderHandler, ExchangeRouter)
- [ ] **CFG-02**: ORACLE_MODE switched from `hermes` to `lazer` in server .env
- [ ] **CFG-03**: Any missing env vars added (EXCHANGE_ROUTER_ADDRESS if needed)

### Database

- [ ] **DB-01**: Prisma migrations verified to apply cleanly on Docker rebuild
- [ ] **DB-02**: Existing data preserved through migration (no destructive changes)

### Docker Deploy

- [ ] **DEPLOY-01**: keeper-service pulled and Docker image rebuilt on DO
- [ ] **DEPLOY-02**: order-execution-keeper-service pulled and Docker image rebuilt on DO
- [ ] **DEPLOY-03**: All three containers (postgres, keeper, order-keeper) healthy after restart

### CI/CD

- [ ] **CICD-01**: GitHub Actions workflow for keeper-service: push to deploy branch → SSH deploy to DO
- [ ] **CICD-02**: GitHub Actions workflow for order-execution-keeper: push to deploy branch → SSH deploy to DO

### Frontend

- [ ] **FE-01**: Frontend deployed to Vercel via git push (auto-deploy)
- [ ] **FE-02**: app.0xmarkets.io loads and connects to keeper endpoints

### Verification

- [ ] **VER-01**: Both keeper health endpoints return 200 from public internet
- [ ] **VER-02**: A deposit/withdrawal/order executes end-to-end on the deployed system

## Future Requirements

### Deployment Hardening

- **DEPH-01**: Zero-downtime deploys with rolling container restarts
- **DEPH-02**: Automated rollback on health check failure
- **DEPH-03**: Secrets management via GitHub Secrets or Vault (remove hardcoded .env)
- **DEPH-04**: SSL/TLS termination for keeper endpoints

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mainnet deployment | Testnet-first, mainnet is a separate milestone |
| Kubernetes/ECS migration | Docker Compose sufficient for current scale |
| Multi-server deployment | Single DO droplet sufficient |
| CDN/edge caching for frontend | Vercel handles this automatically |
| Database backups automation | Can be added in future hardening milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GIT-01 | Phase 28 | Pending |
| GIT-02 | Phase 28 | Pending |
| GIT-03 | Phase 28 | Pending |
| CFG-01 | Phase 28 | Pending |
| CFG-02 | Phase 28 | Pending |
| CFG-03 | Phase 28 | Pending |
| DB-01 | Phase 29 | Pending |
| DB-02 | Phase 29 | Pending |
| DEPLOY-01 | Phase 29 | Pending |
| DEPLOY-02 | Phase 29 | Pending |
| DEPLOY-03 | Phase 29 | Pending |
| CICD-01 | Phase 30 | Pending |
| CICD-02 | Phase 30 | Pending |
| FE-01 | Phase 31 | Pending |
| FE-02 | Phase 31 | Pending |
| VER-01 | Phase 31 | Pending |
| VER-02 | Phase 31 | Pending |

**Coverage:**
- v1.8 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after roadmap creation*
