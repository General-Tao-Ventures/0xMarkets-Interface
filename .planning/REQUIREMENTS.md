# Requirements: 0xMarkets Interface v1.2

**Defined:** 2026-02-22
**Core Value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets

## v1.2 Requirements

Requirements for milestone v1.2 "Demo-Ready Deployment". Each maps to roadmap phases.

### Deployment

- [x] **DEPLOY-01**: Frontend deployed to Vercel and accessible via public URL
- [ ] **DEPLOY-02**: Cloud keepers synced with all v1.1 verification fixes (PythLazer address, orderExecutor token fix, scanner retry, expiration config)

### Monitoring

- [ ] **MON-01**: Keeper services expose health check endpoints
- [ ] **MON-02**: Keeper logs structured for debugging (not just console.log)
- [ ] **MON-03**: Alerting when keeper services go down or stop executing

### UI Polish

- [ ] **UI-01**: UI audit completed — all rough edges identified and fixed
- [ ] **UI-02**: Loading states, error messages, and empty states are professional
- [ ] **UI-03**: Trade page has consistent visual styling across all 6 markets

### Tech Debt

- [ ] **DEBT-01**: pendingImpactAmount workaround properly resolved (remove field or fix mapping)
- [ ] **DEBT-02**: Pre-existing SDK test failures addressed or documented with skip reasons
- [ ] **DEBT-03**: useOrders.ts TypeScript error resolved
- [ ] **DEBT-04**: Keeper execution efficiency investigated and optimized

## Future Requirements

Deferred to future milestones.

- **SWAP-01**: User can swap between tokens using pool liquidity — deferred from v1.1
- **MOBILE-01**: Mobile-responsive trading interface
- **CHART-01**: Advanced TradingView charting with indicators
- **MULTI-01**: Multi-chain support beyond Base Sepolia
- **SOCIAL-01**: Social/copy trading features

## Out of Scope

| Feature | Reason |
|---------|--------|
| New pool/market creation UI | Admin operation, not user-facing for testnet |
| Advanced analytics dashboard | Focus on core trading polish first |
| Multi-wallet support | Single wallet sufficient for testnet |
| Mainnet deployment | Testnet-first, mainnet after full validation |
| Token swaps | Deferred from v1.1, user prioritized trading |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 7 | Complete (2026-02-23) |
| DEPLOY-02 | Phase 7 | Pending |
| MON-01 | Phase 8 | Pending |
| MON-02 | Phase 8 | Pending |
| MON-03 | Phase 8 | Pending |
| UI-01 | Phase 9 | Pending |
| UI-02 | Phase 9 | Pending |
| UI-03 | Phase 9 | Pending |
| DEBT-01 | Phase 9 | Pending |
| DEBT-02 | Phase 9 | Pending |
| DEBT-03 | Phase 9 | Pending |
| DEBT-04 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 — traceability updated after roadmap creation*
