# Requirements: 0xMarkets E2E Verification

**Defined:** 2026-03-04
**Core Value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets

## v1.10 Requirements

### Trigger Order Fix

- [ ] **TRIG-01**: Diagnose root cause of InvalidOrderPrices (0x0481a15a) error on trigger order execution
- [ ] **TRIG-02**: Fix trigger order execution so limit increase, stop-loss, and take-profit orders execute successfully on-chain

### E2E Test Suite

- [ ] **E2E-01**: Deposits execute end-to-end against live testnet (createDeposit → keeper executes → GM minted)
- [ ] **E2E-02**: Withdrawals execute end-to-end (createWithdrawal → keeper executes → USDC returned)
- [ ] **E2E-03**: Market orders execute end-to-end (MarketIncrease open, MarketDecrease close)
- [ ] **E2E-04**: Limit orders execute when trigger price conditions are met
- [ ] **E2E-05**: Stop-loss orders execute when trigger price conditions are met
- [ ] **E2E-06**: Take-profit orders execute when trigger price conditions are met
- [ ] **E2E-07**: Liquidation flow executes on a market with available reserves (BTC, EUR, etc.)
- [ ] **E2E-08**: All E2E tests run as a single suite with pass/fail summary

### Frontend Accuracy

- [ ] **FE-01**: Pool balances displayed in UI match on-chain contract state
- [ ] **FE-02**: Position size, collateral, PnL in UI match on-chain position data
- [ ] **FE-03**: Order status (pending/executed/cancelled) in UI matches on-chain state
- [ ] **FE-04**: Token balances (USDC, ETH) in wallet display match on-chain balances

### Frontend Functionality

- [ ] **UI-01**: All pages load without console errors (Trade, Pools, Dashboard, Earn)
- [ ] **UI-02**: Trade form submits orders correctly (market, limit, TP/SL)
- [ ] **UI-03**: Deposit and withdrawal forms submit correctly
- [ ] **UI-04**: Toast notifications appear and resolve (Pending → Executed)

## Future Requirements

### Error UX

- **ERR-01**: Decode reasonBytes from cancelled events and show human-readable error messages
- **ERR-02**: Surface revert reasons for failed deposits/orders in the UI

### Advanced Testing

- **TEST-01**: Multi-market parallel E2E suite (all 6 markets in single run)
- **TEST-02**: Automated regression suite on CI (GitHub Actions)

## Out of Scope

| Feature | Reason |
|---------|--------|
| CI/CD integration | Manual test runs sufficient for v1.10, automate later |
| Multi-chain testing | Base Sepolia only |
| Performance benchmarking | Focus on correctness, not speed |
| Mobile UI testing | Web-first |
| Mainnet deployment | Testnet verification milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIG-01 | Phase 35 | Pending |
| TRIG-02 | Phase 35 | Pending |
| E2E-01 | Phase 36 | Pending |
| E2E-02 | Phase 36 | Pending |
| E2E-03 | Phase 36 | Pending |
| E2E-04 | Phase 36 | Pending |
| E2E-05 | Phase 36 | Pending |
| E2E-06 | Phase 36 | Pending |
| E2E-07 | Phase 36 | Pending |
| E2E-08 | Phase 36 | Pending |
| FE-01 | Phase 37 | Pending |
| FE-02 | Phase 37 | Pending |
| FE-03 | Phase 37 | Pending |
| FE-04 | Phase 37 | Pending |
| UI-01 | Phase 37 | Pending |
| UI-02 | Phase 37 | Pending |
| UI-03 | Phase 37 | Pending |
| UI-04 | Phase 37 | Pending |

**Coverage:**
- v1.10 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
