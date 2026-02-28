# Requirements: 0xMarkets v1.7 Liquidation Readiness

**Defined:** 2026-02-27
**Core Value:** A user can open and close leveraged trading positions with clear feedback, reliable execution, and access to all configured markets.

## v1.7 Requirements

### Contract Fixes

- [x] **CFIX-01**: OrderHandler guards triggerPrice=0 before inverting on reversed markets — JPY/USD orders no longer revert
- [x] **CFIX-02**: OrderHandler and ExchangeRouter redeployed atomically to Base Sepolia
- [x] **CFIX-03**: All service configs updated with new contract addresses (interface SDK, keepers, E2E tests)

### Liquidation Verification

- [x] **LIQ-01**: Keeper wallet has LIQUIDATION_KEEPER role verified on-chain
- [x] **LIQ-02**: Liquidation scanner detects undercollateralized positions within one scan cycle (30s)
- [x] **LIQ-03**: Liquidation executor successfully calls executeLiquidation on a real test position
- [ ] **LIQ-04**: Confirmator records liquidation result in PostgreSQL with correct status

### Liquidation Hardening

- [x] **LHARD-01**: Executor has deduplication guard — same position is not liquidated twice concurrently
- [x] **LHARD-02**: REVERTED liquidation attempts are tracked with error reason in the database
- [x] **LHARD-03**: Dead code cleanup — remove or archive unused riskEngine.ts
- [ ] **LHARD-04**: Per-stage timing instrumentation for scanner, executor, and confirmator

### Liquidation Performance

- [ ] **LPERF-01**: Position discovery uses multicall batching instead of serial RPC calls
- [ ] **LPERF-02**: Executor reuses position data from scanner instead of redundant RPC fetch
- [x] **LPERF-03**: Oracle mode set to Lazer (not Hermes default) for keeper-service

## Prior Milestone Requirements (v1.6)

### Contract Audit (v1.6 — Complete)

- [x] **AUDIT-01**: All market addresses in interface SDK match actual on-chain DataStore deployments
- [x] **AUDIT-02**: All token addresses in keeper services match deployed token contracts
- [x] **AUDIT-03**: Oracle provider addresses are correct and match on-chain DataStore configuration
- [x] **AUDIT-04**: All 6 markets are enabled and properly configured on-chain

### Keeper Execution (v1.6 — Verified manually)

- [x] **EXEC-01**: Keeper executes deposits for all 6 markets without reverts
- [x] **EXEC-02**: Keeper executes withdrawals for all 6 markets without reverts
- [x] **EXEC-03**: Keeper executes market orders for all 6 markets without reverts
- [x] **EXEC-04**: Keeper detects new operations within 10 seconds of on-chain submission

### Frontend Feedback (v1.6 — Complete)

- [x] **FB-01**: Toast shows "Pending..." immediately after deposit submission
- [x] **FB-02**: Toast updates to "Executed!" when DepositExecuted event is detected
- [x] **FB-03**: Toast shows "Pending..." immediately after withdrawal submission
- [x] **FB-04**: Toast updates to "Executed!" when WithdrawalExecuted event is detected
- [x] **FB-05**: Toast shows "Pending..." immediately after order submission
- [x] **FB-06**: Toast updates to "Executed!" when OrderExecuted event is detected
- [x] **FB-07**: Balances auto-refresh when a deposit or withdrawal executes
- [x] **FB-08**: Positions auto-refresh when an order executes

### Automated Testing (v1.6 — Complete)

- [x] **TEST-01**: E2E test script that tests deposits for all 6 markets
- [x] **TEST-02**: E2E test script that tests withdrawals for all 6 markets
- [x] **TEST-03**: E2E test script that tests market orders for all 6 markets (5/6 — JPY/USD skipped, contract bug)

## Future Requirements

Deferred to v2+. Tracked but not in current roadmap.

### Reliability

- **REL-01**: Expired request cancellation — returns stuck user funds past REQUEST_EXPIRATION_TIME
- **REL-02**: Multi-wallet parallel execution for higher throughput (also resolves nonce conflict between keepers)

### Performance

- **PERF-01**: Sub-5s end-to-end execution latency

## Out of Scope

| Feature | Reason |
|---------|--------|
| Token swaps (SWAP-01) | Deferred from v1.1, user prioritized trading |
| WebSocket push from keeper | Adds complexity; on-chain events are authoritative |
| Separate liquidation wallet | Nonce conflict is low-risk on testnet; track for mainnet |
| Mobile-specific UI | Web-first approach |
| Mainnet deployment | Testnet-first strategy unchanged |
| New market creation | Admin operation, not user-facing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CFIX-01 | Phase 24 | Complete |
| CFIX-02 | Phase 24 | Complete |
| CFIX-03 | Phase 24 | Complete |
| LIQ-01 | Phase 25 | Complete |
| LIQ-02 | Phase 25 | Complete |
| LIQ-03 | Phase 25 | Complete |
| LIQ-04 | Phase 25 | Pending |
| LPERF-03 | Phase 25 | Complete |
| LHARD-01 | Phase 26 | Complete |
| LHARD-02 | Phase 26 | Complete |
| LHARD-03 | Phase 26 | Complete |
| LHARD-04 | Phase 26 | Pending |
| LPERF-01 | Phase 26 | Pending |
| LPERF-02 | Phase 26 | Pending |

**Coverage:**
- v1.7 requirements: 14 total
- Mapped to phases: 14/14
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation*
