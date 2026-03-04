---
phase: 31-event-schema
verified: 2026-03-03T20:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 31: Event Schema Verification Report

**Phase Goal:** Create the 50-table PostgreSQL schema with proper namespaces, types, and indexes
**Verified:** 2026-03-03T20:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 10 SQL files exist in prisma/sql/ covering all 9 namespaces plus cursor | VERIFIED | ls confirms 001–010 all present |
| 2 | Every event table has composite primary key (block_number, log_index) | VERIFIED | 51 matching `PRIMARY KEY (block_number, log_index)` entries across event files; cursor has separate TEXT PK |
| 3 | Every event table has the 5 common columns | VERIFIED | block_number=102, log_index=102, tx_hash=51, block_timestamp=51, created_at=51 occurrences in event files (2 entries per table for block columns due to PK line) |
| 4 | Column types match contract types: NUMERIC(78,0) for uint256/int256, TEXT for address/bytes32, TEXT[] for address arrays, BOOLEAN for bool | VERIFIED | 245 NUMERIC(78,0) occurrences; BIGINT only appears for block_number and event_cursor.last_block; no mistyped columns found |
| 5 | All DDL is idempotent (IF NOT EXISTS everywhere) | VERIFIED | All 10 files use IF NOT EXISTS on every CREATE SCHEMA, CREATE TABLE, and CREATE INDEX |
| 6 | Indexes on key, account, market, block_number, block_timestamp where applicable | VERIFIED | Index counts per file: 001=27, 002=28, 003=13, 004=13, 005=12, 006=55, 007=35, 008=8, 009=3 |
| 7 | All ~49 event types from eventKeys.ts have a corresponding table (except DistributionCreated) | VERIFIED | 51 event tables cover all 49 named event constants minus DistributionCreated (no emit function in contracts) plus positions.fees_info (separate table from fees_collected for same internal function) |
| 8 | Migration runner reads all SQL files from prisma/sql/ and executes them via pg client | VERIFIED | migrate.ts lines 16–42: path.join(process.cwd(), "prisma", "sql"), readdir+sort+filter, sequential client.query() |
| 9 | Migration runner is idempotent — safe to run on every startup | VERIFIED | Relies on IF NOT EXISTS in all SQL; runner itself has no state |
| 10 | Dockerfile CMD runs migration runner before the app starts | VERIFIED | `CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/migrate.js && node dist/index.js"]` |
| 11 | pg dependency is installed in package.json | VERIFIED | `"pg": "^8.19.0"` in dependencies, `"@types/pg": "^8.18.0"` in devDependencies |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/sql/001_orders.sql` | 7 order event tables in orders schema | VERIFIED | 7 CREATE TABLE, CREATE SCHEMA IF NOT EXISTS orders, composite PK, indexes |
| `prisma/sql/002_positions.sql` | 6 position event tables in positions schema | VERIFIED | 6 CREATE TABLE, nullable referral/pro/liquidation columns in fees_collected and fees_info |
| `prisma/sql/003_deposits.sql` | 3 deposit event tables | VERIFIED | 3 CREATE TABLE, IF NOT EXISTS throughout |
| `prisma/sql/004_withdrawals.sql` | 3 withdrawal event tables | VERIFIED | 3 CREATE TABLE |
| `prisma/sql/005_shifts.sql` | 3 shift event tables | VERIFIED | 3 CREATE TABLE |
| `prisma/sql/006_market.sql` | 17 market event tables in market schema | VERIFIED | 17 CREATE TABLE; DistributionCreated omission documented in SQL comment; ClaimableFundingUpdated uses nullable time_key/next_pool_value for two Solidity overloads |
| `prisma/sql/007_glv.sql` | 9 GLV event tables in glv schema | VERIFIED | 9 CREATE TABLE |
| `prisma/sql/008_referrals.sql` | 2 referral event tables | VERIFIED | 2 CREATE TABLE |
| `prisma/sql/009_oracle.sql` | 1 oracle event table | VERIFIED | 1 CREATE TABLE (oracle.price_update) |
| `prisma/sql/010_cursor.sql` | Cursor table with event_cursor | VERIFIED | CREATE TABLE event_cursor with TEXT PRIMARY KEY, INSERT ON CONFLICT DO NOTHING seed |
| `src/migrate.ts` | Node.js migration runner exporting runMigrations | VERIFIED | 68 lines, exports runMigrations(): Promise<void>, standalone runner pattern via import.meta.url |
| `package.json` | pg dependency present | VERIFIED | pg in dependencies, @types/pg in devDependencies, db:migrate:sql script |
| `Dockerfile` | CMD chains migrate before app | VERIFIED | Three-command chain: db:migrate:deploy && node dist/migrate.js && node dist/index.js |
| `dist/migrate.js` | Compiled build output | VERIFIED | File exists at /data-verification-service/dist/migrate.js (2065 bytes, 2026-03-03) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/migrate.ts` | `prisma/sql/*.sql` | fs.readdir + fs.readFile | WIRED | Lines 19–38: readdir(sqlDir).filter(.sql).sort(), readFile(filePath, utf-8) |
| `Dockerfile` | `src/migrate.ts` | CMD runs node dist/migrate.js | WIRED | `node dist/migrate.js` in CMD chain between Prisma and app start |
| `src/migrate.ts` | PostgreSQL | pg Client using config.databaseUrl | WIRED | Line 30: `new Client({ connectionString: config.databaseUrl })`, line 32: client.connect() |
| `migrate.ts` error handling | container abort | throw on failure | WIRED | Line 45: `throw err` — migration error propagates, container startup aborts |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCHEMA-01 | 31-01-PLAN.md | 50-table PostgreSQL schema created with schema namespaces | SATISFIED | 51 event tables + 1 cursor across 9 namespaces (orders, positions, deposits, withdrawals, shifts, market, glv, referrals, oracle) |
| SCHEMA-02 | 31-01-PLAN.md | All table columns match contract EventUtils field names and types exactly | SATISFIED | snake_case mapping verified; NUMERIC(78,0) for all uint256/int256; TEXT/BOOLEAN/TEXT[] for other types |
| SCHEMA-03 | 31-01-PLAN.md | Indexes on key, account, market, and block_number columns for query performance | SATISFIED | 194 CREATE INDEX statements across 9 event files; idx_{schema}_{table}_{column} naming convention |
| SCHEMA-04 | 31-02-PLAN.md | Raw SQL migration runs idempotently (CREATE SCHEMA/TABLE IF NOT EXISTS) | SATISFIED | migrate.ts executes SQL files via pg client; all SQL uses IF NOT EXISTS; Dockerfile wires into startup |

### Anti-Patterns Found

None detected. No TODO/FIXME/placeholder comments. No stub return values. Error handling is fail-fast (throws, not swallows).

### Human Verification Required

None for automated checks. All wiring is verifiable statically. However, the following are worth noting for integration testing when the service is next deployed:

**1. Schema creation on live DB**
- Test: Restart the Docker container against the real PostgreSQL instance
- Expected: All 52 tables created without errors; second restart is no-op (idempotent)
- Why human: Requires a running database and container orchestration

**2. DistributionCreated coverage**
- Test: Confirm whether DistributionCreated events are actually emitted by the live contract
- Expected: Either no events emitted, or a table needs to be added
- Why human: Requires inspecting live contract logs or bytecode

### Gaps Summary

No gaps. All 11 observable truths verified. All artifacts exist, are substantive, and are wired correctly.

---

## Table Count Summary

| File | Schema | Tables |
|------|--------|--------|
| 001_orders.sql | orders | 7 |
| 002_positions.sql | positions | 6 |
| 003_deposits.sql | deposits | 3 |
| 004_withdrawals.sql | withdrawals | 3 |
| 005_shifts.sql | shifts | 3 |
| 006_market.sql | market | 17 |
| 007_glv.sql | glv | 9 |
| 008_referrals.sql | referrals | 2 |
| 009_oracle.sql | oracle | 1 |
| 010_cursor.sql | public | 1 (cursor) |
| **Total** | | **52** |

Event tables: 51 (49 eventKeys.ts entries minus DistributionCreated plus positions.fees_info)
Cursor table: 1

## Commit Verification

All four commits documented in summaries confirmed present in git history:

- `fe6c3c7` — feat(31-01): add SQL migration files for orders, positions, deposits, withdrawals, shifts schemas
- `730480e` — feat(31-01): add SQL migration files for market, glv, referrals, oracle, cursor schemas
- `ae23200` — feat(31-02): add pg dependency and create SQL migration runner
- `fe8513f` — chore(31-02): update Dockerfile CMD and add db:migrate:sql script

---

_Verified: 2026-03-03T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
