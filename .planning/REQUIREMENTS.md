# Requirements: 0xMarkets Interface

**Defined:** 2026-02-23
**Core Value:** All keeper-executed operations complete in under 10 seconds, consistently

## v1.3 Requirements

Requirements for Keeper Execution Speed milestone. Each maps to roadmap phases.

### Detection Speed

- [x] **DETECT-01**: Keeper detects new deposits/withdrawals/orders via WebSocket event listeners within 2 seconds of on-chain creation
- [x] **DETECT-02**: Polling fallback continues scanning at reduced interval when WebSocket connection drops
- [x] **DETECT-03**: Keeper backfills missed events on WebSocket reconnection using persisted block numbers

### Execution Pipeline

- [x] **EXEC-01**: All keeper transactions flow through a serialized execution queue that prevents nonce collisions
- [x] **EXEC-02**: Scanner passes operation data directly to executor without redundant on-chain re-reads
- [x] **EXEC-03**: Oracle prices are pre-cached from Pyth Lazer WebSocket stream and used directly in execution

### Infrastructure

- [x] **INFRA-01**: Both keeper services use WebSocket RPC transport for Base Sepolia event subscriptions
- [ ] **INFRA-02**: Health endpoints use heartbeat-based liveness model compatible with event-driven architecture
- [ ] **INFRA-03**: Health endpoint reports execution latency percentiles (p50, p95) for monitoring

## Future Requirements

### Advanced Optimization

- **OPT-01**: Flashblocks-aware RPC endpoint for 200ms preconfirmations
- **OPT-02**: Multi-wallet keeper for parallel transaction submission
- **OPT-03**: Mempool monitoring for front-run prevention

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-wallet keepers | Overkill for testnet with no competition |
| Mempool monitoring | No MEV competition on Base Sepolia testnet |
| Custom multicall contracts | Existing ExchangeRouter.multicall sufficient |
| Redis message queue | Single-process I/O-bound workload; adds complexity without benefit |
| Worker threads | Same reason — workload is I/O-bound, not CPU-bound |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DETECT-01 | Phase 10 | Complete |
| DETECT-02 | Phase 10 | Complete |
| DETECT-03 | Phase 10 | Complete |
| EXEC-01 | Phase 10 | Complete |
| EXEC-02 | Phase 11 | Complete |
| EXEC-03 | Phase 11 | Complete |
| INFRA-01 | Phase 10 | Complete |
| INFRA-02 | Phase 12 | Pending |
| INFRA-03 | Phase 12 | Pending |

**Coverage:**
- v1.3 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after roadmap creation*
