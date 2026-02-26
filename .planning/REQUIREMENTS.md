# Requirements: 0xMarkets v1.6 Execution Feedback

**Defined:** 2026-02-26
**Core Value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## v1.6 Requirements

### Detection

- [x] **DET-01**: Frontend watches for DepositExecuted events after user submits a deposit
- [x] **DET-02**: Frontend watches for WithdrawalExecuted events after user submits a withdrawal
- [x] **DET-03**: Frontend watches for OrderExecuted events after user submits an order

### Feedback

- [x] **FB-01**: Toast notification shows "Pending..." immediately after operation submission
- [x] **FB-02**: Toast notification updates to "Executed!" when execution event is detected
- [x] **FB-03**: Toast notification shows error state if operation fails or expires

### Refresh

- [ ] **REF-01**: Balances auto-refresh when a deposit or withdrawal executes (no manual page refresh)
- [ ] **REF-02**: Positions auto-refresh when an order executes (no manual page refresh)

## Future Requirements

Deferred to v2+. Tracked but not in current roadmap.

### Reliability

- **REL-01**: Expired request cancellation — returns stuck user funds past REQUEST_EXPIRATION_TIME
- **REL-02**: Startup oracle provider + feed entitlement verification
- **REL-03**: Hermes HTTP fallback for individual tokens when Lazer cache goes stale

### Performance

- **PERF-01**: Per-stage execution timing instrumentation via performance.now()
- **PERF-02**: Multi-wallet parallel execution for higher throughput

## Out of Scope

| Feature | Reason |
|---------|--------|
| Token swaps (SWAP-01) | Deferred from v1.1, user prioritized trading |
| WebSocket push from keeper | Adds complexity; on-chain events are authoritative |
| Operation history page | Beyond current scope — just toast + refresh |
| Mobile-specific UI | Web-first approach |
| Mainnet deployment | Testnet-first strategy unchanged |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01 | Phase 18 | Complete |
| DET-02 | Phase 18 | Complete |
| DET-03 | Phase 18 | Complete |
| FB-01 | Phase 18 | Complete |
| FB-02 | Phase 18 | Complete |
| FB-03 | Phase 18 | Complete |
| REF-01 | Phase 19 | Pending |
| REF-02 | Phase 19 | Pending |

**Coverage:**
- v1.6 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap creation*
