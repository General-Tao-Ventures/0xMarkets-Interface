# Requirements: Fix Buy GM Flow

**Defined:** 2026-02-20
**Core Value:** User can deposit USDC into ETH/USD pool and receive GM tokens with clear feedback at every step

## v1 Requirements

Requirements for this fix. Each maps to roadmap phases.

### Keeper Execution

- [ ] **EXEC-01**: Keeper executes fresh deposits end-to-end (createDeposit tx mines → keeper pushes prices → executeDeposit succeeds → user receives GM tokens)
- [ ] **EXEC-02**: Prices are pushed on-chain within MAX_ORACLE_PRICE_AGE window (300s) before calling executeDeposit
- [ ] **EXEC-03**: Keeper retries transient failures (nonce collisions, RPC timeouts) with exponential backoff
- [ ] **EXEC-04**: Failed deposits are marked in DB with specific error reason for debugging

### Deposit Lifecycle

- [ ] **LIFE-01**: Expired deposits are detected and auto-cancelled on-chain (freeing locked funds)
- [ ] **LIFE-02**: Deposit status tracked through full lifecycle: pending → executing → complete/failed/expired
- [ ] **LIFE-03**: Deposits created while keeper is restarting are picked up on next scan cycle
- [ ] **LIFE-04**: Concurrent deposits from different users don't cause nonce collisions

### UI Feedback

- [ ] **UI-01**: Clear status messaging during "Fulfilling buy request" phase (not just an infinite spinner)
- [ ] **UI-02**: Actionable error messages when deposit fails (user knows what happened and what to do)
- [ ] **UI-03**: Timeout detection — if deposit sits pending too long, show warning with option to cancel

## v2 Requirements

### Multi-Pool Support

- **POOL-01**: Buy GM flow works for all pools (not just ETH/USD)
- **POOL-02**: Sell GM (withdrawal) flow works end-to-end

### Monitoring

- **MON-01**: Keeper health dashboard showing execution stats
- **MON-02**: Alerting when keeper fails to execute deposits within SLA

## Out of Scope

| Feature | Reason |
|---------|--------|
| Withdrawal (Sell GM) flow | Separate effort — fix deposits first |
| Order execution (trading) | Different executor, separate fix |
| New pool creation | Configuration task, not execution bug |
| Multi-chain support | Base Sepolia only for now |
| Keeper high availability | Single keeper is fine for testnet |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXEC-01 | — | Pending |
| EXEC-02 | — | Pending |
| EXEC-03 | — | Pending |
| EXEC-04 | — | Pending |
| LIFE-01 | — | Pending |
| LIFE-02 | — | Pending |
| LIFE-03 | — | Pending |
| LIFE-04 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after initial definition*
