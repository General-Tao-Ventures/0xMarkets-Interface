# Requirements: 0xMarkets v1.6 E2E Reliability

**Defined:** 2026-02-26
**Core Value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## v1.6 Requirements

### Contract Audit

- [ ] **AUDIT-01**: All market addresses in interface SDK match actual on-chain DataStore deployments
- [ ] **AUDIT-02**: All token addresses in keeper services match deployed token contracts
- [ ] **AUDIT-03**: Oracle provider addresses are correct and match on-chain DataStore configuration
- [ ] **AUDIT-04**: All 6 markets are enabled and properly configured on-chain (reserve factors, OI limits, pool caps)

### Keeper Execution

- [ ] **EXEC-01**: Keeper executes deposits for all 6 markets without reverts
- [ ] **EXEC-02**: Keeper executes withdrawals for all 6 markets without reverts
- [ ] **EXEC-03**: Keeper executes market orders (long and short) for all 6 markets without reverts
- [ ] **EXEC-04**: Keeper detects new operations within 10 seconds of on-chain submission

### Frontend Feedback

- [ ] **FB-01**: Toast shows "Pending..." immediately after deposit submission
- [ ] **FB-02**: Toast updates to "Executed!" when DepositExecuted event is detected
- [ ] **FB-03**: Toast shows "Pending..." immediately after withdrawal submission
- [ ] **FB-04**: Toast updates to "Executed!" when WithdrawalExecuted event is detected
- [ ] **FB-05**: Toast shows "Pending..." immediately after order submission
- [ ] **FB-06**: Toast updates to "Executed!" when OrderExecuted event is detected
- [ ] **FB-07**: Balances auto-refresh when a deposit or withdrawal executes (no manual page refresh)
- [ ] **FB-08**: Positions auto-refresh when an order executes (no manual page refresh)

### Automated Testing

- [ ] **TEST-01**: E2E test script that tests deposits for all 6 markets and reports pass/fail
- [ ] **TEST-02**: E2E test script that tests withdrawals for all 6 markets and reports pass/fail
- [ ] **TEST-03**: E2E test script that tests market orders for all 6 markets and reports pass/fail

## Future Requirements

Deferred to v2+. Tracked but not in current roadmap.

### Reliability

- **REL-01**: Expired request cancellation -- returns stuck user funds past REQUEST_EXPIRATION_TIME
- **REL-02**: Multi-wallet parallel execution for higher throughput

### Performance

- **PERF-01**: Sub-5s end-to-end execution latency

## Out of Scope

| Feature | Reason |
|---------|--------|
| Token swaps (SWAP-01) | Deferred from v1.1, user prioritized trading |
| WebSocket push from keeper | Adds complexity; on-chain events are authoritative |
| Operation history page | Beyond current scope -- just toast + refresh |
| Mobile-specific UI | Web-first approach |
| Mainnet deployment | Testnet-first strategy unchanged |
| New market creation | Admin operation, not user-facing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 20 | Pending |
| AUDIT-02 | Phase 20 | Pending |
| AUDIT-03 | Phase 20 | Pending |
| AUDIT-04 | Phase 20 | Pending |
| EXEC-01 | Phase 21 | Pending |
| EXEC-02 | Phase 21 | Pending |
| EXEC-03 | Phase 21 | Pending |
| EXEC-04 | Phase 21 | Pending |
| FB-01 | Phase 22 | Pending |
| FB-02 | Phase 22 | Pending |
| FB-03 | Phase 22 | Pending |
| FB-04 | Phase 22 | Pending |
| FB-05 | Phase 22 | Pending |
| FB-06 | Phase 22 | Pending |
| FB-07 | Phase 22 | Pending |
| FB-08 | Phase 22 | Pending |
| TEST-01 | Phase 23 | Pending |
| TEST-02 | Phase 23 | Pending |
| TEST-03 | Phase 23 | Pending |

**Coverage:**
- v1.6 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap creation*
