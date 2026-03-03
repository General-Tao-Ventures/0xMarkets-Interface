# Phase 31: Event Schema - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the 50-table PostgreSQL schema for the event indexer in the data-verification-service. This phase delivers SQL migration files, schema namespaces, table definitions, indexes, and a cursor table. No application code — just the database schema and migration runner.

</domain>

<decisions>
## Implementation Decisions

### Table-per-event mapping
- One table per event name — all ~50 event types get their own table
- Consistent pattern even for small market state events (no consolidation into shared tables)
- Position events (PositionIncrease, PositionDecrease) get wide tables with ALL fee fields as columns (nullable for optional referral/pro/liquidation blocks) — no separate fee sub-table, no JOINs
- Cover ALL event types from the squid's eventKeys.ts, not just frequently queried ones

### Column naming convention
- snake_case for all column names (base_pnl_usd, size_in_usd, market_token_amount)
- Mapping from contract camelCase field names to Postgres snake_case
- Table names: descriptive snake_case within PG schemas (orders.created, orders.executed, positions.increase, market.pool_amount_updated)
- 9 PG schema namespaces as listed in roadmap: orders, positions, deposits, withdrawals, shifts, market, glv, referrals, oracle
- Arrays stored as PostgreSQL native arrays (TEXT[] for address arrays)

### Migration file strategy
- One SQL file per schema namespace: 001_orders.sql, 002_positions.sql, ... 009_oracle.sql, 010_cursor.sql
- Node.js migration runner that reads SQL files and executes via pg client — keeps everything in Node
- SQL files live in prisma/sql/ directory (co-located with Prisma, Docker COPY already copies prisma/ dir)
- Always-run idempotent: every startup executes all SQL files, CREATE SCHEMA/TABLE IF NOT EXISTS makes this safe — no version tracking needed

### Common columns and metadata
- Every event table includes: block_number (BIGINT), log_index (INT), tx_hash (TEXT), block_timestamp (TIMESTAMPTZ), created_at (TIMESTAMPTZ DEFAULT NOW())
- Primary key: composite (block_number, log_index) — natural key from blockchain, prevents duplicate inserts, no UUID generation
- Single cursor row for event indexer: collector_type='event_indexer', last_block=N
- Indexes: key, account, market, block_number as required, plus block_timestamp for time-range queries (where applicable per table)

### Claude's Discretion
- Exact column ordering within tables
- Whether to add COMMENT ON TABLE/COLUMN for documentation
- Specific index naming convention
- Migration runner error handling details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- squid's eventKeys.ts: Complete list of all ~50 event names to enumerate
- 12 EventUtils.sol contract files: Exact field names and types for each event
- Existing Prisma schema: Established patterns for Decimal(78,0), Timestamptz

### Established Patterns
- data-verification-service uses pnpm, TypeScript (ESM), pino logging
- Docker multi-stage build with prisma/ dir copied to production image
- Current CMD: `pnpm db:migrate:deploy && node dist/index.js`
- PostgreSQL 14 via Docker Compose, DB name: data_verification
- No pg client dependency yet — will need to add for raw SQL execution

### Integration Points
- Dockerfile CMD needs modification to run raw SQL migration runner before app start
- prisma/sql/ directory needs to be included in Docker COPY (already covered by existing `COPY prisma ./prisma/`)
- package.json needs pg dependency for raw SQL execution
- Cursor table will be read/written by the event listener (Phase 33)

</code_context>

<specifics>
## Specific Ideas

- Column types match requirements exactly: NUMERIC(78,0) for uint256/int256, TEXT for addresses/bytes32, TEXT[] for address arrays
- Contract EventUtils.sol files are the source of truth for field names — every column must trace back to a contract event field
- The squid eventDecoder.ts already has the mapping logic that can inform column definitions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-event-schema*
*Context gathered: 2026-03-03*
