# Requirements: 0xMarkets v1.13 0xM Token Rebrand + Error UX

**Defined:** 2026-03-09
**Core Value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## v1.13 Requirements

### Contract Rebranding

- [ ] **REBRAND-01**: MarketToken contract deployed with "0xM" symbol and "0xMarkets Pool" name
- [ ] **REBRAND-02**: 7 new markets created on-chain (ETH, BTC, EUR, GBP, GOLD, JPY, WTI) using new MarketToken
- [ ] **REBRAND-03**: Market parameters configured on-chain (swapImpactFactor=0, pool caps, OI limits, reserve factors, leverage limits)
- [ ] **REBRAND-04**: All 7 pools seeded with USDC deposits

### Service Config Updates

- [ ] **CFG-01**: Interface SDK configs updated with new market/token addresses (tokens.ts, markets.ts, contracts.ts, static/markets.ts, multichain.ts)
- [ ] **CFG-02**: Keeper service config updated with new token addresses and restarted
- [ ] **CFG-03**: Order execution keeper updated with new contract addresses and restarted
- [ ] **CFG-04**: Squid processor updated with new EventEmitter address and start block, hard-reset redeployed

### Error UX

- [ ] **ERR-01**: Frontend decodes reasonBytes from cancelled deposit/withdrawal/order events into human-readable messages
- [ ] **ERR-02**: Error messages displayed to user in toast notifications when operations fail

### Verification

- [ ] **VER-01**: End-to-end deposit and withdrawal works with new 0xM token contracts
- [ ] **VER-02**: End-to-end market order (open/close position) works with new contracts
- [ ] **VER-03**: Trade history and leaderboard populate correctly from squid with new addresses

## Future Requirements

- **TEST-01**: Multi-market parallel E2E suite
- **TEST-02**: Automated regression suite on CI/GitHub Actions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mainnet deployment | Testnet-first |
| Liquidity migration from old pools | No migration path in GMX v2 contracts |
| New market additions beyond existing 7 | Rebrand only, same market set |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REBRAND-01 | Phase 43 | Pending |
| REBRAND-02 | Phase 43 | Pending |
| REBRAND-03 | Phase 43 | Pending |
| REBRAND-04 | Phase 44 | Pending |
| CFG-01 | Phase 44 | Pending |
| CFG-02 | Phase 44 | Pending |
| CFG-03 | Phase 44 | Pending |
| CFG-04 | Phase 44 | Pending |
| ERR-01 | Phase 45 | Pending |
| ERR-02 | Phase 45 | Pending |
| VER-01 | Phase 46 | Pending |
| VER-02 | Phase 46 | Pending |
| VER-03 | Phase 46 | Pending |

**Coverage:**
- v1.13 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 — updated REBRAND-02/04 from 6 to 7 markets (includes WTI per CONTEXT.md decisions)*
