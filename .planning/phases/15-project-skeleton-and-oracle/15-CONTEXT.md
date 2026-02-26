# Phase 15: Project Skeleton and Oracle - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Clean TypeScript project reset of the order-execution-keeper-service — removing the 3,000+ line codebase (Prisma, class hierarchies, TransactionMonitor) and replacing it with a minimal skeleton (~5 files) plus a working Pyth Lazer oracle cache module. Requirements: ORCL-01, ORCL-02, ORCL-03.

</domain>

<decisions>
## Implementation Decisions

### Code Removal Approach
- Gut existing `order-execution-keeper-service/` directory — same directory, same git history, Docker Compose refs unchanged
- Delete everything Prisma/PostgreSQL related — prisma/ directory, schema, migrations, all imports. Database stays on server but keeper no longer touches it
- Strip down existing package.json — remove Prisma and unused deps, keep viem/pino/pyth/express/dotenv. Preserves lockfile for unchanged deps
- Replace ts-node + nodemon with tsx watch — single dep, `pnpm dev` runs `tsx watch src/index.ts`

### Oracle Failure Behavior
- On WebSocket disconnect: set stale flag, skip execution of new operations until reconnected. Already-cached prices still usable within 270s TTL
- FATAL log after 60 seconds of sustained disconnection — BetterStack picks this up for alerting. Keeper stays running but stale-flagged
- Evict prices from cache when they hit 270s TTL — buildOracleParams sees no price and skips the operation. Clean signal that data is too old
- Log state transitions only (connect, disconnect, stale, recovery) — not individual price updates. Testnet volume would flood logs without value

### Startup Strictness
- Wait for all 7 token prices (EUR, GBP, GOLD, JPY, USDC, WBTC, WETH) cached before accepting operations
- 30 second timeout — if any token still missing after 30s, log FATAL with which tokens failed and exit. Docker will restart
- Fail fast on any missing environment variable (PRIVATE_KEY, WS_RPC_URL, PYTH_LAZER_TOKEN, etc.) — immediate FATAL exit with clear message
- Log full config summary at INFO on startup: keeper address, chain ID, number of tokens, RPC endpoints (masked), oracle provider

### Dev Verification Workflow
- Verify with `pnpm dev` + watch structured logs for 'cache populated' messages for all 7 tokens
- Completion gate: `pnpm build` succeeds (no TS errors) AND `pnpm dev` connects to Pyth Lazer and shows 7 token prices in logs
- Local verification only for Phase 15 — deployment to droplet is Phase 17's concern
- Minimal index.ts that imports oracle, calls startOracle(), logs when cache is populated — proves end-to-end. Phase 16 expands index.ts with keeper logic

### Claude's Discretion
- Exact file structure within the 5-file target (config.ts, keys.ts, abis.ts, oracle.ts, index.ts)
- tsconfig.json simplification details
- Exact pino logger configuration
- Which existing utility code to preserve vs rewrite

</decisions>

<specifics>
## Specific Ideas

- Provider address for all tokens is `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05` (Pyth Lazer) — not a mix of providers
- Port DataStore key encoding verbatim from existing keys.ts — uses `encodeAbiParameters` not `encodePacked` (critical: wrong encoding silently produces wrong hashes)
- Pyth packages must stay Node 22 compatible: hermes-client ^2.1.0 (v3.x requires Node ^24), pyth-lazer-sdk pinned to 5.2.0 (v5.2.1+ declares Node ^24 engine)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-project-skeleton-and-oracle*
*Context gathered: 2026-02-26*
