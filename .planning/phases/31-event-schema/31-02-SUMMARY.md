---
phase: 31-event-schema
plan: 02
subsystem: infra
tags: [postgresql, pg, migration-runner, docker, typescript]

# Dependency graph
requires:
  - phase: 31-01
    provides: "10 SQL migration files in prisma/sql/"
provides:
  - "Node.js migration runner (src/migrate.ts) that executes SQL files via pg client"
  - "db:migrate:sql npm script for manual migration runs"
  - "Dockerfile CMD chains Prisma -> SQL migrations -> app start"
affects: [33-event-listener, 34-deploy]

# Tech tracking
tech-stack:
  added: [pg]
  patterns: [sql-file-migration-runner, docker-chained-cmd]

key-files:
  created:
    - "data-verification-service/src/migrate.ts"
  modified:
    - "data-verification-service/package.json"
    - "data-verification-service/Dockerfile"

key-decisions:
  - "Used pg Client (not Prisma) for raw SQL execution since event tables use PG schema namespaces outside Prisma management"
  - "Resolve SQL directory via process.cwd() for consistent behavior in both dev and Docker environments"
  - "Migration runner aborts on error (throw, not swallow) to prevent app starting with incomplete schema"

patterns-established:
  - "SQL migration runner: reads prisma/sql/*.sql alphabetically, executes sequentially via pg Client"
  - "Standalone runner pattern: import.meta.url === pathToFileURL(process.argv[1]).href"

requirements-completed: [SCHEMA-04]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 31 Plan 02: Migration Runner Summary

**Node.js SQL migration runner using pg client with Docker CMD chaining for automatic schema creation on every container startup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T19:59:14Z
- **Completed:** 2026-03-03T20:01:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created src/migrate.ts with runMigrations() that reads all .sql files from prisma/sql/ in alphabetical order and executes via pg Client
- Added pg and @types/pg dependencies to package.json
- Updated Dockerfile CMD to chain: Prisma migrations -> SQL migrations -> app start
- Added db:migrate:sql npm script for manual/standalone migration runs
- Migration runner uses pino logger consistent with rest of codebase
- Error handling throws on failure to prevent app starting with incomplete schema

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pg dependency and create migration runner** - `ae23200` (feat)
2. **Task 2: Update Dockerfile CMD and add npm script** - `fe8513f` (chore)

## Files Created/Modified
- `src/migrate.ts` - Node.js migration runner that reads SQL files from prisma/sql/ and executes them sequentially via pg Client
- `package.json` - Added pg dependency, @types/pg devDependency, and db:migrate:sql script
- `Dockerfile` - CMD updated to chain Prisma -> SQL -> app start

## Decisions Made
- **pg Client over Prisma**: Event tables use PG schema namespaces (orders.*, positions.*, etc.) that Prisma doesn't manage, so raw pg is the correct tool
- **process.cwd() for SQL path**: Works in both dev (cwd = project root) and Docker (cwd = /app) without import.meta.url complications
- **Fail-fast on migration error**: If any SQL file fails, the process throws and the container won't start -- this is intentional to prevent running with incomplete schema

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Migration runner ready to execute the 10 SQL files from Plan 01 on next container restart
- Phase 32 (decoder/router) can proceed -- schema creation is fully automated
- Phase 34 (deploy) will trigger the migration runner via Docker CMD on production

---
*Phase: 31-event-schema*
*Completed: 2026-03-03*
