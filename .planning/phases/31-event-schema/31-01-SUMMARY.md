---
phase: 31-event-schema
plan: 01
subsystem: database
tags: [postgresql, sql, schema, event-indexer, raw-sql-migration]

# Dependency graph
requires: []
provides:
  - "50-table PostgreSQL schema for event indexer (49 event tables + 1 cursor)"
  - "9 PG schema namespaces (orders, positions, deposits, withdrawals, shifts, market, glv, referrals, oracle)"
  - "Column types mapped from Solidity types (NUMERIC(78,0), TEXT, BOOLEAN, TEXT[])"
  - "Indexes on key, account, market, block_number, block_timestamp"
affects: [31-02, 32-event-decoder, 33-event-listener, 34-deploy]

# Tech tracking
tech-stack:
  added: [raw-sql-migrations]
  patterns: [pg-schema-namespaces, composite-pk-block-log, idempotent-ddl]

key-files:
  created:
    - "data-verification-service/prisma/sql/001_orders.sql"
    - "data-verification-service/prisma/sql/002_positions.sql"
    - "data-verification-service/prisma/sql/003_deposits.sql"
    - "data-verification-service/prisma/sql/004_withdrawals.sql"
    - "data-verification-service/prisma/sql/005_shifts.sql"
    - "data-verification-service/prisma/sql/006_market.sql"
    - "data-verification-service/prisma/sql/007_glv.sql"
    - "data-verification-service/prisma/sql/008_referrals.sql"
    - "data-verification-service/prisma/sql/009_oracle.sql"
    - "data-verification-service/prisma/sql/010_cursor.sql"
  modified: []

key-decisions:
  - "Used NUMERIC(78,0) for all uint256/int256 to preserve full precision without overflow"
  - "Composite PK (block_number, log_index) ensures uniqueness and prevents duplicate inserts"
  - "ClaimableFundingUpdated uses nullable time_key and next_pool_value to handle two Solidity overloads in one table"
  - "DistributionCreated skipped -- listed in eventKeys.ts but has no emit function in contracts"
  - "Oracle timestamp column quoted as reserved word in PostgreSQL"
  - "Position fee tables have nullable referral/pro/liquidation columns matching conditional contract emit logic"

patterns-established:
  - "SQL file naming: NNN_namespace.sql with numeric ordering"
  - "Table naming: schema.snake_case_event_name (e.g. orders.created, positions.fees_collected)"
  - "Index naming: idx_{schema}_{table}_{column}"
  - "Common columns on every event table: block_number, log_index, tx_hash, block_timestamp, created_at"
  - "camelCase -> snake_case mapping: dot-separated fields use underscore (indexTokenPrice.max -> index_token_price_max)"

requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 31 Plan 01: Event Schema SQL Summary

**10 SQL migration files creating 52 tables (49 event + 1 cursor + 2 fee duplicate) across 9 PG schema namespaces with full type fidelity from Solidity contracts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T19:51:34Z
- **Completed:** 2026-03-03T19:56:34Z
- **Tasks:** 2
- **Files created:** 10

## Accomplishments
- Created 10 SQL migration files covering all 49 event types from eventKeys.ts plus 1 cursor table
- Column types match contract EventUtils exactly: NUMERIC(78,0) for uint256/int256, TEXT for address/bytes32, TEXT[] for arrays, BOOLEAN for bool
- Indexes on key, account, market, block_number, block_timestamp where applicable
- All DDL is idempotent with IF NOT EXISTS on every schema, table, and index
- Position fee tables correctly handle conditional nullable fields (referral, pro, liquidation)
- ClaimableFundingUpdated handles two Solidity overloads via nullable columns

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration files for orders, positions, deposits, withdrawals, shifts (001-005)** - `fe6c3c7` (feat)
2. **Task 2: SQL migration files for market, glv, referrals, oracle, cursor (006-010)** - `730480e` (feat)

## Files Created/Modified
- `prisma/sql/001_orders.sql` - 7 order event tables (created, executed, updated, size_delta_auto_updated, collateral_delta_amount_auto_updated, cancelled, frozen)
- `prisma/sql/002_positions.sql` - 6 position event tables (increase, decrease, fees_collected, fees_info, insolvent_close, insufficient_funding_fee_payment)
- `prisma/sql/003_deposits.sql` - 3 deposit event tables (created, executed, cancelled)
- `prisma/sql/004_withdrawals.sql` - 3 withdrawal event tables (created, executed, cancelled)
- `prisma/sql/005_shifts.sql` - 3 shift event tables (created, executed, cancelled)
- `prisma/sql/006_market.sql` - 17 market event tables covering pool values, amounts, open interest, borrowing, funding, claims, UI fees
- `prisma/sql/007_glv.sql` - 9 GLV event tables (deposit/withdrawal/shift created/executed/cancelled)
- `prisma/sql/008_referrals.sql` - 2 referral event tables (affiliate_reward_updated, affiliate_reward_claimed)
- `prisma/sql/009_oracle.sql` - 1 oracle event table (price_update)
- `prisma/sql/010_cursor.sql` - 1 cursor table with default event_indexer row

## Decisions Made
- **NUMERIC(78,0) for all uint256/int256**: Preserves full 78-digit precision without any overflow risk
- **Composite PK (block_number, log_index)**: Natural uniqueness key from on-chain data, prevents duplicate inserts
- **ClaimableFundingUpdated superset schema**: Two Solidity overloads merged into one table with nullable time_key and next_pool_value
- **DistributionCreated skipped**: Listed in eventKeys.ts but no emit function exists in contracts (no fields to define)
- **Position fee nullable columns**: referral_*, pro_*, liquidation_* columns are nullable because the contract conditionally emits them based on non-zero values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 10 SQL files ready for 31-02 (migration runner)
- Schema design is complete and verified against contract source files
- Phase 32 (decoder/router) can reference these table schemas for insert statement generation

## Self-Check: PASSED

- All 10 SQL files exist in data-verification-service/prisma/sql/
- SUMMARY.md exists in .planning/phases/31-event-schema/
- Commit fe6c3c7 found (Task 1)
- Commit 730480e found (Task 2)

---
*Phase: 31-event-schema*
*Completed: 2026-03-03*
