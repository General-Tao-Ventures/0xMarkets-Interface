# Roadmap: 0xMarkets Interface

## Milestones

- ✅ **v1.0 Fix Buy GM Flow** — Phases 1-3 ([shipped 2026-02-21](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Full Trading Experience** — Phases 4-6
- ✅ **v1.2 Demo-Ready Deployment** — Phases 7-9
- ✅ **v1.3 Keeper Execution Speed** — Phases 10-12
- ✅ **v1.4 Maximum Keeper Speed** — Phases 13-14
- ✅ **v1.5 Minimal Keeper Rewrite** — Phases 15-17
- ✅ **v1.6 E2E Reliability** — Phases 18-23
- ✅ **v1.7 Liquidation Readiness** — Phases 24-27
- ✅ **v1.8 Deployment** — Phases 28-30
- 🔵 **v1.9 Event Indexer** — Phases 31-34

---

## v1.9 Event Indexer

**Goal:** Build a full on-chain event indexer into the data-verification-service, recording all contract events into a 50-table PostgreSQL schema, and deploy to DigitalOcean.

### Phase 31: Event Schema
**Goal**: Create the 50-table PostgreSQL schema with proper namespaces, types, and indexes
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04
**Depends on**: None
**Plans:** 2/2 plans complete
Plans:
- [x] 31-01-PLAN.md — Write all 10 SQL migration files (49 event tables + 1 cursor table across 9 PG schemas)
- [x] 31-02-PLAN.md — Create Node.js migration runner and update Dockerfile CMD
**Success criteria**:
1. Raw SQL migration creates 9 schemas and 50 tables matching contract EventUtils exactly
2. All NUMERIC(78,0) columns for uint256/int256, TEXT for addresses/bytes32, TEXT[] for address arrays
3. Indexes exist on key, account, market, block_number for all relevant tables
4. Migration is idempotent (IF NOT EXISTS) and runs in Docker CMD alongside Prisma migrations
5. Cursor table exists to track last processed block per collector type

### Phase 32: Event Decoder and Router
**Goal**: Port the squid's event decoder and build insert handlers for all 50 event types
**Requirements**: DEC-01, DEC-02, DEC-03, ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04
**Depends on**: Phase 31
**Plans:** 2/2 plans complete
Plans:
- [x] 32-01-PLAN.md — Port event decoder from ethers to viem, create types and event key constants
- [x] 32-02-PLAN.md — Create insert builder, all 49 event handlers, and event router
**Success criteria**:
1. EventLogData bytes decoded into typed Maps (address, uint, int, bool, bytes32, bytes, string items + array variants)
2. Both EventLog1 and EventLog2 formats handled correctly
3. Event router maps all 50 event names to correct table insert functions
4. Conditional nullable fields (positions.fees referral/pro/liquidation) handled
5. Unknown event names logged at warn level, not crash
6. Raw SQL inserts via pg client (not Prisma) for event tables

### Phase 33: Event Listener with Crash Recovery
**Goal**: WebSocket listener on EventEmitter with auto-reconnect and block cursor resumption
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04
**Depends on**: Phase 32
**Plans:** 1 plan
Plans:
- [ ] 33-01-PLAN.md — Create event indexer with cursor management, historical replay, WebSocket listener, and service wiring
**Success criteria**:
1. WebSocket subscription to EventEmitter EventLog1 + EventLog2 events
2. Auto-reconnect on disconnection (viem WebSocket transport handles this)
3. Block cursor persisted to DB after each batch of events
4. On startup, getLogs replays from cursor to current head before switching to real-time
5. No duplicate inserts (block_number + log_index unique constraint or skip logic)

### Phase 34: Deploy and Verify
**Goal**: Deploy updated data-verification-service to DO and verify all collectors working
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Depends on**: Phase 33
**Success criteria**:
1. Docker image builds with new dependencies (pg client for raw SQL)
2. Container startup runs both Prisma migrations and raw SQL schema migration
3. Health endpoint reports event indexer status (last indexed block, events count)
4. Market snapshotter and price recorder continue working unchanged
5. Events appearing in DB tables within seconds of on-chain emission

---
*Created: 2026-03-03*
