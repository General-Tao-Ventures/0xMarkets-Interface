# Requirements: 0xMarkets Interface v1.1

**Defined:** 2026-02-21
**Core Value:** User can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets

## v1.1 Requirements

Requirements for milestone v1.1 "Full Trading Experience". Each maps to roadmap phases.

### Trade Page Stability

- [x] **FIX-01**: Trade page loads without Division by zero crash (fix zero market config values in validation)
- [x] **FIX-02**: All 6 markets pass liquidity checks (complete on-chain reserve factors and OI limits)
- [x] **FIX-03**: WebSocket reconnection handles CLOSING state gracefully without console spam
- [x] **FIX-04**: Metrics batch_report endpoint returns 200 or errors are suppressed silently

### Position Management

- [x] **POS-01**: User can open long and short positions via market order on any of the 6 markets
- [ ] **POS-02**: User can close full or partial positions and receive collateral back
- [ ] **POS-03**: User can place limit orders to open positions at a target price
- [ ] **POS-04**: User can set stop-loss and take-profit orders on existing positions

### Swaps

- [ ] **SWAP-01**: User can swap between tokens using pool liquidity

### Liquidity

- [x] **LIQ-01**: User can withdraw liquidity from pools (Sell GM) and receive underlying tokens
- [x] **LIQ-02**: Pools page displays utilization, fees earned, and APY stats

## Future Requirements

Deferred to future milestones.

- **UI-01**: Mobile-responsive trading interface
- **CHART-01**: Advanced TradingView charting with indicators
- **MULTI-01**: Multi-chain support beyond Base Sepolia
- **SOCIAL-01**: Social/copy trading features

## Out of Scope

| Feature | Reason |
|---------|--------|
| New pool/market creation UI | Admin operation, not user-facing for testnet |
| Advanced analytics dashboard | Focus on core trading first |
| Multi-wallet support | Single wallet sufficient for testnet |
| Mainnet deployment | Testnet-first, mainnet after full validation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 4 | Complete |
| FIX-02 | Phase 4 | Complete |
| FIX-03 | Phase 4 | Complete |
| FIX-04 | Phase 4 | Complete |
| LIQ-01 | Phase 5 | Complete |
| LIQ-02 | Phase 5 | Complete |
| SWAP-01 | Phase 5 | Pending |
| POS-01 | Phase 6 | Complete |
| POS-02 | Phase 6 | Pending |
| POS-03 | Phase 6 | Pending |
| POS-04 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 — traceability mapped to Phases 4-6*
