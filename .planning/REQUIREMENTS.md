# Requirements: 0xMarkets v1.5 Minimal Keeper Rewrite

**Defined:** 2026-02-25
**Core Value:** Deposits, withdrawals, and orders execute reliably with minimal code

## v1.5 Requirements

### Detection

- [ ] **DET-01**: Keeper detects DepositCreated, WithdrawalCreated, and OrderCreated events via WebSocket in under 1 second
- [ ] **DET-02**: Keeper polls DataStore for pending deposits, withdrawals, and orders every 15 seconds as safety net
- [ ] **DET-03**: Duplicate keys are deduplicated — same operation is never executed twice

### Execution

- [ ] **EXEC-01**: Keeper executes deposits by reading on-chain struct, building oracle params, and calling executeDeposit
- [ ] **EXEC-02**: Keeper executes withdrawals by reading on-chain struct, building oracle params, and calling executeWithdrawal
- [ ] **EXEC-03**: Keeper executes orders by reading on-chain struct, building oracle params, and calling executeOrder
- [ ] **EXEC-04**: Execution is sequential — one transaction at a time, no nonce conflicts
- [ ] **EXEC-05**: Transient errors retry up to 3 times; permanent errors (EmptyDeposit, expired, InvalidOracleProvider) are logged and skipped

### Oracle

- [ ] **ORCL-01**: Pyth Lazer WebSocket connects and caches price updates for all 7 tokens
- [ ] **ORCL-02**: buildOracleParams reads from cache (synchronous) and includes correct provider address per token
- [ ] **ORCL-03**: Cache rejects prices older than 270 seconds (safety margin below 300s MAX_ORACLE_PRICE_AGE)

### Infrastructure

- [ ] **INFRA-01**: Health endpoint at GET /health returns JSON with status, uptime, queue length, and keeper address
- [ ] **INFRA-02**: All operations logged as structured JSON via pino
- [ ] **INFRA-03**: Graceful shutdown on SIGTERM — completes in-flight TX, closes WebSocket, stops intervals
- [ ] **INFRA-04**: Simplified Dockerfile with no database, no Prisma, 30s health check start-period

### Deployment

- [ ] **DEPLOY-01**: Deployed to DigitalOcean droplet (142.93.203.222) via Docker Compose
- [ ] **DEPLOY-02**: End-to-end deposit executes successfully on a live market
- [ ] **DEPLOY-03**: End-to-end withdrawal executes successfully
- [ ] **DEPLOY-04**: End-to-end order executes successfully

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
| PostgreSQL / any database | On-chain DataStore is source of truth |
| Per-type scanner/executor classes | Single parameterized function replaces 1,200 lines |
| TransactionMonitor | Inline waitForTransactionReceipt handles this |
| Block number persistence | Full DataStore scan on startup covers restart recovery |
| Feature flags per operation type | All three types always enabled |
| Multiple WebSocket connections | Testnet volume doesn't need redundancy |
| Mainnet deployment | Testnet-first strategy unchanged |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01 | Phase 16 | Pending |
| DET-02 | Phase 16 | Pending |
| DET-03 | Phase 16 | Pending |
| EXEC-01 | Phase 16 | Pending |
| EXEC-02 | Phase 16 | Pending |
| EXEC-03 | Phase 16 | Pending |
| EXEC-04 | Phase 16 | Pending |
| EXEC-05 | Phase 16 | Pending |
| ORCL-01 | Phase 15 | Pending |
| ORCL-02 | Phase 15 | Pending |
| ORCL-03 | Phase 15 | Pending |
| INFRA-01 | Phase 16 | Pending |
| INFRA-02 | Phase 16 | Pending |
| INFRA-03 | Phase 16 | Pending |
| INFRA-04 | Phase 16 | Pending |
| DEPLOY-01 | Phase 17 | Pending |
| DEPLOY-02 | Phase 17 | Pending |
| DEPLOY-03 | Phase 17 | Pending |
| DEPLOY-04 | Phase 17 | Pending |

**Coverage:**
- v1.5 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
