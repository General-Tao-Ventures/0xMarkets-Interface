# Technology Stack: v1.7 Liquidation Readiness

**Project:** 0xMarkets keeper-service + 0xmarkets_contract
**Researched:** 2026-02-27
**Overall Confidence:** HIGH

## Context

v1.7 is an additive milestone on top of a fully operational system. The contracts repo uses Hardhat + Foundry. The keeper-service uses TypeScript, Prisma, and PostgreSQL with a pipeline of scanner → riskEngine → executor. This document covers only NEW stack additions/changes needed for the three work streams:

1. **Contract bug fix** — guard `triggerPrice=0` in OrderHandler for reversed markets, redeploy to Base Sepolia
2. **Liquidation verification** — confirm the existing scanner → riskEngine → executor pipeline works on Base Sepolia
3. **Liquidation performance** — optimize scanning (batched multicall), risk assessment, and execution latency

## Existing Stack (Do Not Re-research)

Everything in the previous STACK.md (v1.5 Minimal Keeper Rewrite) applies to the order-execution-keeper-service and remains unchanged. The keeper-service (liquidation keeper, port 37017) uses:

| Technology | Version | Role |
|------------|---------|------|
| TypeScript | ^5.9.3 | Language |
| Node.js | 22 (Docker: node:22-slim) | Runtime |
| viem | ^2.40.3 | Ethereum client |
| @prisma/client | ^5.22.0 | Database ORM |
| prisma | ^5.22.0 | Migrations + codegen |
| @pythnetwork/pyth-lazer-sdk | ^5.2.0 | Oracle WebSocket |
| @pythnetwork/hermes-client | ^2.1.0 | Oracle HTTP fallback |
| express | ^5.1.0 | HTTP server |
| pino | ^10.3.1 | Structured logging |
| dotenv | ^17.2.3 | Env config |
| vitest | ^4.0.16 | Test runner |
| ts-node + nodemon | dev runners | Dev watch |

The contracts repo uses Hardhat 2.x (^2.22.8) with hardhat-deploy, hardhat-foundry, Foundry forge, and Solidity 0.8.24.

---

## Work Stream 1: Contract Bug Fix and Redeploy

### What Exists

The `0xmarkets_contract` repo already has a full Hardhat + Foundry dual-toolchain setup:

- **Hardhat** `^2.22.8` with `hardhat-deploy ^0.11.25`, `@nomicfoundation/hardhat-foundry ^1.1.1`, `@nomicfoundation/hardhat-verify ^2.0.11`
- **Foundry** (`forge`) via `lib/forge-std` 1.12.0 — available for fast local tests
- **Solidity** 0.8.24 with optimizer enabled (runs: 10)
- **Network config** for `baseSepolia` already present in `hardhat.config.ts`
- **Deploy scripts** exist but are in `deploy/` directory (not found as TypeScript — likely JavaScript or a convention not committed)

### What Is Needed

**Nothing new to install.** The fix is surgical Solidity editing inside the existing repo, then redeploying with the existing Hardhat pipeline.

#### Solidity Fix Pattern

The bug is a division-by-zero in `OrderHandler.sol` when `triggerPrice=0` for reversed markets (JPY/USD). The fix is a guard:

```solidity
// In OrderHandler._setExactOrderPrice() or equivalent:
// BEFORE (causes division-by-zero):
uint256 price = WeiPerUnit * WeiPerUnit / triggerPrice; // reversed market

// AFTER (guard against zero):
require(triggerPrice > 0, "OrderHandler: triggerPrice cannot be zero for reversed market");
// OR return early / use a sentinel:
if (triggerPrice == 0) revert Errors.EmptyTriggerPrice();
```

The exact location in OrderHandler.sol needs to be confirmed when editing. Search for `triggerPrice` and the reversal logic to find the division site.

#### Redeploy Command (existing toolchain)

```bash
# From 0xmarkets_contract/
ACCOUNT_KEY=<deployer_pk> npx hardhat deploy --network baseSepolia --tags OrderHandler
# Or if using specific deploy script:
ACCOUNT_KEY=<deployer_pk> npx hardhat run scripts/deployOrderHandler.ts --network baseSepolia
```

**After redeploy:** Update `ORDER_HANDLER_ADDRESS` in ALL services (order-execution-keeper-service, keeper-service, interface, squid). See `.claude/contract-address-update-guide.md`.

#### Verification (existing toolchain)

```bash
# Verify on Basescan using already-configured hardhat-verify
BASESCAN_API_KEY=<key> npx hardhat verify --network baseSepolia <NEW_ADDRESS> <constructor_args>
```

**Confidence: HIGH** — No new tooling needed. The existing Hardhat pipeline handles compile, deploy, and verify.

---

## Work Stream 2: Liquidation Verification

### What Exists

The keeper-service has a full test infrastructure but most tests are stubs. The actual pipeline integration tests are in `src/test/testnet/integration.test.ts` (skipped unless `TEST_ENV=testnet`) and E2E tests in `src/test/e2e/` (use mock contracts, not real Base Sepolia).

The existing scanner already does the critical work: auto-discovers accounts from DataStore POSITION_LIST, fetches positions, calls `Reader.isPositionLiquidatable()`, and triggers executor if liquidatable. The executor uses Lazer oracle cache (via `getPythLazerOracle()`) and calls `LiquidationHandler.executeLiquidation()`.

**Critical observation:** The `riskEngine.ts` is NOT called by `scanner.ts`. The scanner calls `Reader.isPositionLiquidatable()` on-chain directly. The `riskEngine.ts` is a standalone module that computes risk off-chain using its own formula (collateral vs MMR). This is a structural inconsistency — the scanner bypasses the riskEngine entirely and delegates liquidatability determination to the contract.

### What Is Needed for Verification

**No new dependencies.** Verification is about running the existing pipeline against real Base Sepolia testnet data.

#### Verification Test Pattern

The `src/test/testnet/integration.test.ts` scaffolding exists but the test bodies are stub assertions. To verify end-to-end:

1. Set `TEST_ENV=testnet` environment variable
2. Provide `TEST_RPC_URL`, `TEST_PRIVATE_KEY`, real contract addresses
3. Fill in the existing test stubs with actual assertions

The test pattern already in place:

```typescript
// src/test/testnet/integration.test.ts
// Already has describe.skipIf(!isTestnetMode())
// Already imports getTestRPCClient(), getTestDatabase()
// Just needs real assertions replacing the stub expects
```

**What to write (not new dependencies):**

```typescript
it('should fetch positions from real contracts', async () => {
  const positionFetcher = new PositionFetcher(84532);
  const positions = await positionFetcher.discoverAccountsWithPositions();
  // verify it runs without throwing, returns array
  expect(Array.isArray(positions)).toBe(true);
});

it('should complete scan cycle without throwing', async () => {
  await scanner.scan(); // runs full pipeline
  // verify health state updated
  expect(healthState.lastScanAt).toBeTruthy();
});
```

**Confidence: HIGH** — No new packages needed. Tests run with `vitest ^4.0.16` already installed.

---

## Work Stream 3: Liquidation Performance Optimization

### Performance Problem Analysis

The current position discovery path (`discoverAccountsWithPositions()`) makes N+1 individual RPC calls:

1. One call to get `totalCount` from DataStore
2. One batch call to get position keys (100 at a time)
3. One individual `getPosition()` call **per position key** to extract the account

Then for each discovered account, `fetchAccountPositions()` loops with individual `getAccountPositions()` calls. For M accounts and P positions total, this is O(P) serial RPC calls, each costing ~100-300ms on Base Sepolia testnet.

### New Tool: viem Multicall

**Already available in viem `^2.40.3`.** No new installation required.

`viem`'s `publicClient.multicall()` batches multiple `readContract` calls into a single RPC round-trip using the Multicall3 contract deployed on all major chains including Base Sepolia.

```typescript
// BEFORE: N serial calls
for (const positionKey of positionKeys) {
  const position = await publicClient.readContract({
    address: READER_ADDRESS,
    abi: READER_ABI,
    functionName: "getPosition",
    args: [DATA_STORE_ADDRESS, positionKey],
  });
}

// AFTER: 1 multicall
const results = await publicClient.multicall({
  contracts: positionKeys.map(key => ({
    address: READER_ADDRESS,
    abi: READER_ABI,
    functionName: "getPosition",
    args: [DATA_STORE_ADDRESS, key],
  })),
  allowFailure: true, // don't abort if one position errors
});
// results is { status: 'success' | 'failure', result: PositionProps }[]
```

**Multicall3 address on Base Sepolia:** `0xcA11bde05977b3631167028862bE2a173976CA11` (same across all EVM chains — standard deployment). viem uses this automatically when chain config includes it, which Base Sepolia does.

**Confidence: HIGH** — viem multicall is documented, stable since viem 1.x, and Base Sepolia has Multicall3 deployed.

### Supporting: Parallel Account Fetching

After account discovery, `fetchPositionsFromAccounts()` currently loops serially. Replace with `Promise.all()`:

```typescript
// BEFORE: serial per-account
for (const account of accounts) {
  const positions = await positionFetcher.fetchAccountPositions(account);
}

// AFTER: parallel fetch (all accounts simultaneously)
const allResults = await Promise.all(
  accounts.map(acc => positionFetcher.fetchAccountPositions(acc).catch(() => []))
);
const allPositions = allResults.flat();
```

No new dependencies — this is a code pattern change only.

### Timing Instrumentation

The existing `pino ^10.3.1` logger supports high-resolution timestamps via `Date.now()` or `performance.now()`. No new tooling needed.

Pattern already used in order-execution-keeper-service (and copied here):

```typescript
const t0 = performance.now();
const positions = await discoverAccountsWithPositions();
log.info({ durationMs: Math.round(performance.now() - t0), count: positions.length }, "discovery complete");
```

`performance` is available in Node 22 without any import.

---

## Complete Stack Delta for v1.7

### keeper-service: No New Dependencies

| Package | Status | Reason |
|---------|--------|--------|
| viem multicall | Existing | Already in viem ^2.40.3 |
| vitest | Existing | Already devDependency ^4.0.16 |
| pino timing | Existing | Built-in with performance.now() |

**No `pnpm add` commands needed for keeper-service.**

### 0xmarkets_contract: No New Dependencies

| Package | Status | Reason |
|---------|--------|--------|
| hardhat ^2.22.8 | Existing | Already installed |
| hardhat-deploy | Existing | Already installed |
| @nomicfoundation/hardhat-verify | Existing | Already installed |
| Foundry forge | Existing | Already available via foundry.toml |

**No `yarn add` commands needed for contracts repo.**

---

## Critical Integration Points

### 1. Pyth Lazer Oracle Cache in Scanner

The scanner calls `getStoredPrice()` from the `PythLazerFeedProvider` contract (on-chain stored prices) to get market prices for liquidatability checks. The order-execution-keeper pushes Lazer prices every ~5s. If the order-execution-keeper is down or stale, `getStoredPrice()` returns `ok: false` or a stale timestamp, and the scanner will skip all position checks.

**Dependency:** Liquidation verification requires the order-execution-keeper to be running and pushing prices.

### 2. Prisma Schema / Database

The store uses Prisma 5.22.0 with PostgreSQL. Before running verification tests against testnet, the database must be migrated. The Docker Compose setup on DigitalOcean includes the postgres service and auto-runs `prisma migrate deploy` on startup.

**For local verification:** `cd keeper-service && pnpm db:migrate` requires a local PostgreSQL or the DO database URL.

### 3. Position Discovery Bottleneck in `discoverAccountsWithPositions()`

The current implementation fetches individual positions to extract account addresses. This is the primary optimization target: replace with multicall to batch N positions into one RPC call. The positions stored in DataStore's POSITION_LIST are bytes32 keys — each key encodes `keccak256(abi.encode(account, market, collateralToken, isLong))`. The contract does NOT expose the account from a position key without reading the full position struct.

Therefore: multicall on `getPosition()` for all keys is the correct batching approach (one RPC round-trip instead of N serial calls).

### 4. Contract Addresses After Redeploy

After OrderHandler redeploy, `keeper-service`'s `ORDER_HANDLER_ADDRESS` env var must be updated. Currently keeper-service only has `LIQUIDATION_HANDLER_ADDRESS` — it does not call OrderHandler directly. But the E2E test suite in `order-execution-keeper-service` does. Update checklist per `.claude/contract-address-update-guide.md`.

---

## What NOT to Add

### Do NOT add a separate multicall library

`viem` already exposes `publicClient.multicall()` that uses Multicall3 under the hood. Do not add `ethers-multicall`, `multicall.js`, or similar. Zero value, adds dependency weight.

### Do NOT add a task queue (Bull, BullMQ, etc.)

The scanner already runs on a simple `setInterval` loop with an `scanRunning` guard to prevent overlap. Performance gains from multicall and parallel fetching will make each scan cycle faster — no queue needed at this scale.

### Do NOT add Foundry for testing keeper TypeScript

Foundry is for Solidity contract testing, not keeper TypeScript. The existing vitest setup is correct for keeper unit/integration tests.

### Do NOT add a profiling daemon (clinic.js, 0x flame)

Performance gains here come from reducing RPC round-trips via multicall, not from CPU profiling. The bottleneck is network latency, measurable with `performance.now()` already available.

### Do NOT upgrade Prisma from ^5.22.0 to ^7.x

The order-execution-keeper-service removed Prisma. The keeper-service still uses it. Prisma 7.x has a new adapter-based API that would require schema and query changes. Prisma 5.22.0 is stable and handles all required queries. Upgrade is out of scope.

### Do NOT add Hardhat Ignition for contract deployment

The contracts repo uses `hardhat-deploy`, not Hardhat Ignition. Ignition is the newer deployment framework (introduced in Hardhat 2.22+) but the existing `hardhat-deploy` scripts are proven and sufficient for a single-contract patch deploy. Switching deployment frameworks for a bug fix is unnecessary risk.

### Do NOT upgrade hardhat to ^2.24 or ethers to v6

The contracts repo uses hardhat ^2.22.8 + ethers ^5.7.2. These are pinned and working. The Hardhat ecosystem has some breaking changes between ethers v5 and v6. Do not touch the contracts toolchain version for a Solidity fix.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Batch RPC | viem multicall (built-in) | ethcall / multicall.js | Already in viem, zero extra dep |
| Contract profiling | Hardhat gas reporter (already installed) | Tenderly DevNets, Foundry --gas-report | Already available, sufficient for testnet |
| Position discovery | Multicall batch on getPosition() | Parse position keys off-chain | Keys are opaque hashes, cannot decode account without contract call |
| Liquidation test | Vitest testnet mode (existing) | Hardhat fork of Base Sepolia | Fork adds complexity; real testnet is sufficient for verification |
| Deploy verification | hardhat-verify (existing) | Manual Basescan upload | hardhat-verify already configured and working |

---

## Sources

- Existing codebase: `keeper-service/package.json` — confirmed Prisma 5.22.0, vitest 4.0.16, viem 2.40.3
- Existing codebase: `keeper-service/src/core/scanner.ts` — confirmed scanner calls Reader.isPositionLiquidatable() directly, bypasses riskEngine.ts
- Existing codebase: `keeper-service/src/core/positionFetcher.ts` — confirmed N+1 serial RPC pattern in discoverAccountsWithPositions()
- Existing codebase: `keeper-service/src/core/executor.ts` — confirmed Lazer oracle cache dependency via getPythLazerOracle()
- Existing codebase: `0xmarkets_contract/package.json` — confirmed hardhat ^2.22.8, hardhat-deploy ^0.11.25, hardhat-verify ^2.0.11
- Existing codebase: `0xmarkets_contract/hardhat.config.ts` — confirmed baseSepolia network config, Solidity 0.8.24
- Existing codebase: `0xmarkets_contract/foundry.toml` — confirmed forge-std 1.12.0 available
- Existing codebase: `keeper-service/src/test/testnet/integration.test.ts` — confirmed testnet test scaffolding exists with stub assertions
- viem documentation: `publicClient.multicall()` stable API, Multicall3 auto-detected on Base Sepolia (chainId 84532)
- Multicall3: deployed at `0xcA11bde05977b3631167028862bE2a173976CA11` on all major EVM chains including Base Sepolia (confidence: HIGH — standard deployment address)
