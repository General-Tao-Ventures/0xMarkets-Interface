# Requirements: 0xMarkets Event Indexer

**Defined:** 2026-03-03
**Core Value:** Record all on-chain contract events for data verification and analysis

## v1.9 Requirements

### Schema

- [ ] **SCHEMA-01**: 50-table PostgreSQL schema created with schema namespaces (orders, positions, deposits, withdrawals, shifts, market, glv, referrals, oracle)
- [ ] **SCHEMA-02**: All table columns match contract EventUtils field names and types exactly
- [ ] **SCHEMA-03**: Indexes on key, account, market, and block_number columns for query performance
- [ ] **SCHEMA-04**: Raw SQL migration runs idempotently (CREATE SCHEMA/TABLE IF NOT EXISTS)

### Decoder

- [ ] **DEC-01**: Event decoder parses EventLogData from raw log bytes into typed Maps (address, uint, int, bool, bytes32, bytes, string items)
- [ ] **DEC-02**: Decoder handles both EventLog1 (1 indexed topic) and EventLog2 (2 indexed topics)
- [ ] **DEC-03**: Decoder extracts msgSender, eventName, and all eventData fields

### Listener

- [ ] **LIST-01**: WebSocket listener subscribes to EventEmitter contract for EventLog1 and EventLog2 events
- [ ] **LIST-02**: Listener auto-reconnects on WebSocket disconnection
- [ ] **LIST-03**: Cursor tracks last processed block number for crash recovery
- [ ] **LIST-04**: On startup, listener replays missed blocks from cursor to current head

### Router

- [ ] **ROUTE-01**: Decoded events are routed to correct table by eventName (e.g. OrderCreated → orders.created)
- [ ] **ROUTE-02**: All 50 event types have insert handlers that map decoded fields to table columns
- [ ] **ROUTE-03**: Unknown event names are logged and skipped (no crash)
- [ ] **ROUTE-04**: Conditional nullable fields handled (e.g. positions.fees referral/pro/liquidation fields)

### Deploy

- [ ] **DEPLOY-01**: Updated service builds and runs in Docker on DO droplet
- [ ] **DEPLOY-02**: SQL migration runs on container startup alongside Prisma migrations
- [ ] **DEPLOY-03**: Health check endpoint reports event indexer status (last block, events/min)
- [ ] **DEPLOY-04**: Existing market snapshotter and price recorder continue working unchanged

## Future Requirements

### Backfill

- **BACKFILL-01**: Replay historical blocks from genesis to populate past events
- **BACKFILL-02**: Backfill runs as separate mode (not real-time listener)

### Query API

- **API-01**: REST endpoints to query stored events by key, account, market
- **API-02**: Pagination support for large result sets

## Out of Scope

| Feature | Reason |
|---------|--------|
| Virtual inventory events | Not needed for verification (VirtualSwapInventoryUpdated, VirtualPositionInventoryUpdated) |
| Real-time WebSocket API for consumers | Overkill for current needs — DB queries sufficient |
| Prisma models for event tables | Raw SQL preferred — 50 tables with PG schema namespaces don't fit Prisma well |
| Frontend integration | This is a backend data service only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 31 | Pending |
| SCHEMA-02 | Phase 31 | Pending |
| SCHEMA-03 | Phase 31 | Pending |
| SCHEMA-04 | Phase 31 | Pending |
| DEC-01 | Phase 32 | Pending |
| DEC-02 | Phase 32 | Pending |
| DEC-03 | Phase 32 | Pending |
| LIST-01 | Phase 33 | Pending |
| LIST-02 | Phase 33 | Pending |
| LIST-03 | Phase 33 | Pending |
| LIST-04 | Phase 33 | Pending |
| ROUTE-01 | Phase 32 | Pending |
| ROUTE-02 | Phase 32 | Pending |
| ROUTE-03 | Phase 32 | Pending |
| ROUTE-04 | Phase 32 | Pending |
| DEPLOY-01 | Phase 34 | Pending |
| DEPLOY-02 | Phase 34 | Pending |
| DEPLOY-03 | Phase 34 | Pending |
| DEPLOY-04 | Phase 34 | Pending |

**Coverage:**
- v1.9 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after initial definition*
