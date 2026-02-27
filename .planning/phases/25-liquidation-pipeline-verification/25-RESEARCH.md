# Phase 25: Liquidation Pipeline Verification - Research

**Researched:** 2026-02-27
**Domain:** Blockchain keeper liquidation pipeline (scanner -> executor -> confirmator) on Base Sepolia
**Confidence:** HIGH

## Summary

Phase 25 verifies the existing liquidation pipeline end-to-end on Base Sepolia. The keeper-service already has a complete scanner/executor/confirmator implementation, but it has **never been tested against a real on-chain liquidation**. The code exists; the question is whether it works when faced with real contract interactions, correct role grants, and live oracle data.

The research uncovered **three critical issues** that must be fixed before the pipeline can execute a liquidation:
1. **PythLazerFeedProvider address mismatch** -- `contract.ts` hardcodes a stale address (`0x8a3eb351...`) that differs from both the `.env` value (`0x81B3857...`) and the config default. The scanner reads stored prices from the wrong contract.
2. **Keeper wallet mismatch** -- The private key in `keeper-service/.env` (`0x862dead...`) derives to `0x48Cb0d...`, not the deployer wallet `0x9724251d...` that has the LIQUIDATION_KEEPER role. Either the private key must change or the role must be granted to the current wallet.
3. **ORACLE_MODE defaults to "hermes"** -- The `.env` has `ORACLE_MODE=hermes` but Phase 25 requires `ORACLE_MODE=lazer` for independent oracle operation.

**Primary recommendation:** Fix the three configuration issues above, then create a deliberately undercollateralized test position via the E2E framework and run the keeper-service to observe the full scan->detect->execute->confirm cycle.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIQ-01 | Keeper wallet has LIQUIDATION_KEEPER role verified on-chain | Wallet address mismatch discovered: `.env` private key derives to different address than the deployer with roles. Must verify/grant role via `cast call` on RoleStore `0x773C3f6973064FD877FE5DF4f762Fe57C8F2Fd47` or use the `grantKeeperRolesDirect.js` script. Role hash uses `keccak256(abi.encode("LIQUIDATION_KEEPER"))` pattern. |
| LIQ-02 | Liquidation scanner detects undercollateralized positions within one scan cycle (30s) | Scanner code is complete: `scanner.ts` -> `positionFetcher.ts` -> `Reader.isPositionLiquidatable()`. PythLazerFeedProvider address bug in `contract.ts` must be fixed first -- scanner reads stored prices from wrong contract address. Auto-discover mode reads all positions from DataStore POSITION_LIST. |
| LIQ-03 | Liquidation executor successfully calls executeLiquidation on a real test position | Executor code is complete: `executor.ts` calls `LiquidationHandler.executeLiquidation()` with oracle params built from `buildOracleParams()`. Same PythLazerFeedProvider address bug affects the executor's provider address in oracle params. The `executeLiquidation` ABI is correctly defined in `liquidation-handler.ts`. |
| LIQ-04 | Confirmator records liquidation result in PostgreSQL with correct status | Confirmator watches `EventLog2` events from EventEmitter, filters for `OrderExecuted`, checks if order type is `Liquidation (7)`, then updates execution status from SUBMITTED to MINED and candidate from PENDING to EXECUTED. Status flow: candidate NEW->PENDING->EXECUTED, execution SUBMITTED->MINED. |
| LPERF-03 | Oracle mode set to Lazer (not Hermes default) for keeper-service | Current `.env` has `ORACLE_MODE=hermes`. Must change to `ORACLE_MODE=lazer`. The `index.ts` startup already handles lazer mode correctly: creates PythLazerOracle, registers feeds from `PYTH_LAZER_FEED_CONFIGS`, connects WebSocket. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.x | Contract interactions, transaction signing, ABI encoding | Already used throughout keeper-service |
| @prisma/client | 5.22.0 | PostgreSQL ORM for liquidation records | Already configured with schema |
| @pythnetwork/pyth-lazer-sdk | latest | Pyth Pro WebSocket price feeds | Already integrated in pythLazerOracle.ts |
| pino | latest | Structured logging | Already used throughout keeper-service |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| foundry/cast | latest | On-chain verification of roles and state | Used for `cast call` to verify roles on RoleStore |
| ethers v5 | 5.x | Role granting script (`grantKeeperRolesDirect.js`) | Only for running the existing role-granting script in contracts repo |

### Alternatives Considered
None -- this phase uses the existing keeper-service stack. No new libraries needed.

**Installation:**
No new packages to install. The keeper-service already has all dependencies.

## Architecture Patterns

### Existing Pipeline Architecture
```
keeper-service/src/
├── core/
│   ├── scanner.ts          # PositionScanner: discovers accounts, fetches positions,
│   │                       #   checks liquidatability via Reader.isPositionLiquidatable(),
│   │                       #   creates candidate + signed decision, calls executor
│   ├── executor.ts         # Executor: builds oracle params, calls
│   │                       #   LiquidationHandler.executeLiquidation(), records execution
│   ├── confirmator.ts      # EventConfirmator: watches EventLog2 for OrderExecuted,
│   │                       #   updates execution status SUBMITTED->MINED,
│   │                       #   updates candidate PENDING->EXECUTED
│   ├── positionFetcher.ts  # PositionFetcher: reads positions from Reader contract,
│   │                       #   computes position keys, discovers accounts via POSITION_LIST
│   ├── contract.ts         # Contract clients, ABIs, addresses
│   ├── store.ts            # Prisma database operations
│   ├── pythLazerOracle.ts  # WebSocket connection to Pyth Lazer for price data
│   └── riskEngine.ts       # DEAD CODE: not imported by scanner (uses Reader instead)
├── config.ts               # Environment variable configuration
├── config/
│   └── tokens.ts           # Token addresses and Pyth Lazer feed configs
├── interfaces/
│   └── types.ts            # TypeScript types for all pipeline entities
└── index.ts                # Startup: DB connect, Pyth Lazer init, scanner loop, confirmator
```

### Pattern 1: Scanner-Executor-Confirmator Pipeline
**What:** Three-stage pipeline that detects, executes, and confirms liquidations
**When to use:** This is the existing pattern, not a new pattern to implement

**Data flow:**
```
scan() -> fetchActivePositions(accounts) -> for each position:
  1. getMarket(marketAddress)               -- Reader.getMarket()
  2. getMarketPrices(market)                -- PythLazerFeedProvider.getStoredPrice()
  3. checkLiquidatability(key, market, prices)  -- Reader.isPositionLiquidatable()
  4. if liquidatable:
     a. store.savePositionSnapshot()
     b. store.createCandidate(status=NEW)
     c. walletClient.signMessage()          -- sign decision
     d. store.saveSignedDecision()
     e. executor.execute(candidate, decision)
        i.   store.getPositionSnapshotById()
        ii.  positionFetcher.fetchAccountPositions()  -- re-fetch for collateralToken/isLong
        iii. buildOracleParams(market)
        iv.  LiquidationHandler.executeLiquidation()
        v.   store.createExecution(status=SUBMITTED)
        vi.  store.updateCandidateStatus(PENDING)

confirmator (running in parallel):
  1. watchContractEvent(EventEmitter, EventLog2)
  2. filter: eventName === "OrderExecuted"
  3. isLiquidationOrder(orderKey) -- Reader.getOrder(), check orderType === 7
  4. store.getExecutionByTxHash(txHash)
  5. store.updateExecutionStatus(MINED, orderKey, minedAt)
  6. store.updateCandidateStatus(EXECUTED)
```

### Pattern 2: Role Verification via cast call
**What:** Verify on-chain role grants using foundry `cast call`
**When to use:** Before running the pipeline, to confirm the keeper wallet has the required role

**Example:**
```bash
# Compute role hash: keccak256(abi.encode("LIQUIDATION_KEEPER"))
# In Solidity/GMX: hashData(["string"], ["LIQUIDATION_KEEPER"])
ROLE_HASH=$(cast keccak $(cast abi-encode "f(string)" "LIQUIDATION_KEEPER"))

# Check if wallet has role on RoleStore
cast call 0x773C3f6973064FD877FE5DF4f762Fe57C8F2Fd47 \
  "hasRole(address,bytes32)(bool)" \
  <KEEPER_WALLET_ADDRESS> \
  $ROLE_HASH \
  --rpc-url https://sepolia.base.org
```

### Pattern 3: Creating an Undercollateralized Position
**What:** Open a high-leverage position that will be immediately liquidatable
**When to use:** For testing the liquidation pipeline

**Approach:** Use the E2E framework's order creation pattern with maximum leverage. Open a MarketIncrease with minimal collateral ($1 USDC) and large size ($100), creating ~100x leverage. With spread/fees, this position should be immediately liquidatable or very close to it. Alternatively, open a normal position, then let it move against you (slower, less deterministic).

### Anti-Patterns to Avoid
- **Testing with the wrong wallet:** The private key in `.env` MUST map to a wallet that has LIQUIDATION_KEEPER role, or the `executeLiquidation` call will revert with role-check failure.
- **Hardcoded addresses:** The `contract.ts` hardcoded `PYTH_LAZER_FEED_PROVIDER_ADDRESS` overrides the `.env` value. All contract addresses should come from config.
- **Relying on order-execution-keeper for oracle data:** The scanner reads `getStoredPrice()` from PythLazerFeedProvider. Stored prices are written by the order-execution-keeper's background Lazer updates. If the order-execution-keeper is down, stored prices go stale (>60s) and the scanner returns null for all prices, causing all positions to be skipped.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role verification | Manual ABI encoding of role hashes | `cast call` + `cast abi-encode` + `cast keccak` | Role hash encoding must match Solidity's `keccak256(abi.encode("STRING"))` exactly; `cast` handles this correctly |
| Role granting | Custom script | `grantKeeperRolesDirect.js` in contracts repo | Already tested, handles hasRole check before granting |
| Position creation | Custom liquidation test harness | E2E framework (`e2e/test-orders.ts` pattern) | Already proven to create positions on Base Sepolia via ExchangeRouter multicall |
| Database schema | New tables or migrations | Existing Prisma schema | All tables (position_snapshots, liquidation_candidates, liquidation_executions, signed_decision_records) already exist |

**Key insight:** The entire liquidation pipeline is already built. This phase is about **making the existing code work correctly** by fixing configuration bugs and verifying the pipeline against a real on-chain position.

## Common Pitfalls

### Pitfall 1: PythLazerFeedProvider Address Mismatch (CRITICAL)
**What goes wrong:** Scanner reads stored prices from wrong contract, gets `ok=false` or stale data for every token. All positions silently skipped with "no stored price available" log.
**Why it happens:** `contract.ts` line 8 hardcodes `0x8a3eb351...` instead of reading from `config.pythLazerFeedProviderAddress`. The scanner and executor import from `contract.ts`, bypassing the `.env` configuration.
**How to avoid:** Replace the hardcoded constant with `config.pythLazerFeedProviderAddress` in `contract.ts`.
**Warning signs:** Scanner logs say "no stored price available" or "stored price too stale" for every token.

**Address inventory (as of research time):**
- `contract.ts` hardcoded: `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05` (WRONG - old deployment)
- `config.ts` default: `0x2F00A6200853B093459BCAAee1De6648D9d672fc` (WRONG - different old deployment)
- `.env` value: `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` (from Phase 20 audit)
- Docs canonical: `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` (matches .env)
- Order-execution-keeper `.env`: `0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6` (DIFFERENT from keeper-service!)

**The correct address should be verified on-chain:** query DataStore for the oracle provider for any token and confirm it matches.

### Pitfall 2: Keeper Wallet Role Mismatch (CRITICAL)
**What goes wrong:** `executeLiquidation` reverts because the signing wallet doesn't have `LIQUIDATION_KEEPER` role.
**Why it happens:** The keeper-service `.env` has private key `0x862dead...` which derives to wallet `0x48Cb0d738C9B3F44F60f7338F788fa093FD25828`. But the deployer wallet (`0x9724251d7DeC79FB5C41F31b2793892831Bf1200`, private key `0x879bff...`) is the one that has all roles from initial deployment.
**How to avoid:** Either (a) change the keeper-service `.env` to use the deployer private key, or (b) grant LIQUIDATION_KEEPER role to `0x48Cb0d...` using `grantKeeperRolesDirect.js`.
**Warning signs:** Executor logs "execution failed" with a role-check revert from LiquidationHandler.

### Pitfall 3: ORACLE_MODE Defaulting to Hermes
**What goes wrong:** Keeper-service starts without Pyth Lazer WebSocket connection. The scanner can still read stored prices from PythLazerFeedProvider (written by order-execution-keeper), but the executor's `buildOracleParams()` won't have cached WebSocket data to include as inline oracle updates.
**Why it happens:** `.env` has `ORACLE_MODE=hermes` (the default). The requirement (LPERF-03) mandates `ORACLE_MODE=lazer`.
**How to avoid:** Set `ORACLE_MODE=lazer` in `.env`.
**Warning signs:** No "Pyth Lazer Oracle initialized" log at startup.

### Pitfall 4: Stale Stored Prices When Order-Execution-Keeper is Down
**What goes wrong:** The scanner's `getTokenPrice()` reads on-chain stored prices from PythLazerFeedProvider. These prices are written by the order-execution-keeper's background Lazer price push loop (~5s interval). If the order-execution-keeper is not running, stored prices age beyond the 60-second staleness threshold and the scanner rejects all prices.
**Why it happens:** The keeper-service currently depends on the order-execution-keeper for fresh on-chain prices, even though it has its own Pyth Lazer WebSocket connection.
**How to avoid:** When running with `ORACLE_MODE=lazer`, the keeper-service has its own WebSocket. However, the scanner's `getTokenPrice()` reads from PythLazerFeedProvider ON-CHAIN, not from the WebSocket cache. The on-chain prices are still written by the order-execution-keeper. With `ORACLE_MODE=lazer`, the keeper-service pushes prices to PythLazerFeedProvider via `updatePriceOnChain()` -- but this is NOT called from the scan loop, only from the executor's `buildOracleParams()` path.
**Warning signs:** All prices rejected as "stored price too stale" when order-execution-keeper is not running.

**Note:** For Phase 25 verification, ensuring the order-execution-keeper is running is sufficient. The independence concern (LPERF-03) is partially addressed by the `ORACLE_MODE=lazer` flag, which gives the keeper-service its own WebSocket, but the scanner still needs fresh on-chain prices from either keeper.

### Pitfall 5: Status Terminology Mismatch
**What goes wrong:** Confusion between success criteria language and actual code status values.
**Why it happens:** The success criteria says "SUBMITTED to EXECUTED" but the code uses different status names:
- Candidate: `NEW` -> `PENDING` -> `EXECUTED` (or `FAILED`)
- Execution: `SUBMITTED` -> `MINED` (or `REVERTED` / `DROPPED`)
**How to avoid:** Map criteria to code: "SUBMITTED to EXECUTED" means execution status goes `SUBMITTED -> MINED` AND candidate status goes `PENDING -> EXECUTED`.

### Pitfall 6: Shared Wallet Nonce Conflict
**What goes wrong:** Both keeper-service and order-execution-keeper share the same wallet and submit transactions simultaneously, causing nonce conflicts and reverts.
**Why it happens:** Both services use the deployer wallet private key for on-chain transactions.
**How to avoid:** On testnet, this is a known risk (documented in STATE.md). For Phase 25 verification, minimize by not running intensive E2E tests while the liquidation pipeline is executing.
**Warning signs:** "nonce too low" or "replacement transaction underpriced" errors in logs.

### Pitfall 7: JPY/USD Oracle Data Gap
**What goes wrong:** Liquidation checks on JPY/USD positions may fail because Pyth Lazer oracle lacks price data for the JPY feed at certain timestamps.
**Why it happens:** Known testnet issue documented in Phase 24. The JPY Pyth Lazer feed has intermittent data gaps.
**How to avoid:** Use a non-JPY market for the test liquidation (WETH/USD or WBTC/USD are most reliable).

## Code Examples

### Verifying LIQUIDATION_KEEPER Role On-Chain
```bash
# RoleStore address: 0x773C3f6973064FD877FE5DF4f762Fe57C8F2Fd47
# Compute role hash matching Solidity's keccak256(abi.encode("LIQUIDATION_KEEPER"))
ROLE_HASH=$(cast keccak $(cast abi-encode "f(string)" "LIQUIDATION_KEEPER"))

# Check if the current keeper wallet has the role
cast call 0x773C3f6973064FD877FE5DF4f762Fe57C8F2Fd47 \
  "hasRole(address,bytes32)(bool)" \
  0x48Cb0d738C9B3F44F60f7338F788fa093FD25828 \
  $ROLE_HASH \
  --rpc-url https://sepolia.base.org
```

### Granting LIQUIDATION_KEEPER Role
```bash
# Using the existing script in the contracts repo
cd /Users/ken/Projects/0xM/0xmarkets_contract
ACCOUNT_KEY=879bff1d49fafb44d2e778150b88e298c5d62ec42f5f47d778ddfc3b46b279ca \
KEEPER_ADDRESS=0x48Cb0d738C9B3F44F60f7338F788fa093FD25828 \
node scripts/grantKeeperRolesDirect.js
```

### Fixing PythLazerFeedProvider Address in contract.ts
```typescript
// Before (hardcoded, wrong):
export const PYTH_LAZER_FEED_PROVIDER_ADDRESS = "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05" as Address;

// After (reads from config):
export const PYTH_LAZER_FEED_PROVIDER_ADDRESS = (config.pythLazerFeedProviderAddress || "0x0000000000000000000000000000000000000000") as Address;
```

### Creating an Undercollateralized Position
```typescript
// Based on e2e/test-orders.ts pattern
// Minimal collateral ($1 USDC) with high leverage ($50 size = 50x)
const orderParams = {
  addresses: {
    receiver: walletAddress,
    cancellationReceiver: zeroAddress,
    callbackContract: zeroAddress,
    uiFeeReceiver: zeroAddress,
    market: MARKETS["WETH/USD"].market,    // Use reliable market
    initialCollateralToken: USDC_ADDRESS,
    swapPath: [],
  },
  numbers: {
    sizeDeltaUsd: 50n * 10n ** 30n,        // $50 at 30 decimals
    initialCollateralDeltaAmount: 0n,
    triggerPrice: 0n,
    acceptablePrice: maxUint256,
    executionFee: EXECUTION_FEE,
    callbackGasLimit: 0n,
    minOutputAmount: 0n,
    validFromTime: 0n,
  },
  orderType: 2,  // MarketIncrease
  isLong: true,
  shouldUnwrapNativeToken: false,
  decreasePositionSwapType: 0,
  autoCancel: false,
  referralCode: zeroHash,
};
// Send 1 USDC collateral to OrderVault, then createOrder
// The high leverage should make the position immediately or near-immediately liquidatable
```

### Checking Stored Prices On-Chain
```bash
# Verify the PythLazerFeedProvider has fresh prices for WETH
cast call 0x81B3857cD770887fa1d839AbEa66f951ECa4206f \
  "getStoredPrice(address)(bool,(address,uint256,uint256,uint256,address))" \
  0x4200000000000000000000000000000000000006 \
  --rpc-url https://sepolia.base.org
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RiskEngine off-chain check | Reader.isPositionLiquidatable on-chain | Phase 16 (v1.5) | RiskEngine.ts is dead code; scanner uses Reader contract directly |
| Hermes oracle only | Pyth Lazer WebSocket + on-chain stored prices | Phase 13-14 (v1.4) | Lower latency, but scanner still reads on-chain stored prices |
| Manual account list | Auto-discover from DataStore POSITION_LIST | Phase 16 (v1.5) | No need to manually configure ACCOUNTS_TO_SCAN |

**Deprecated/outdated:**
- `riskEngine.ts`: Dead code, not imported by scanner. Scanner uses Reader.isPositionLiquidatable() directly. Cleanup deferred to Phase 26 (LHARD-03).
- `config.ts` default PythLazerFeedProvider address (`0x2F00A620...`): Stale, but overridden by `.env`. Still should be corrected.

## Open Questions

1. **Which PythLazerFeedProvider address is truly correct?**
   - What we know: `.env` and docs both say `0x81B3857...`. Order-execution-keeper `.env` says `0xc5810FC...` (different!). Phase 20 audit confirmed `0x81B3857...` for keeper-service.
   - What's unclear: Why order-execution-keeper uses a different address. Both may be valid (different versions deployed at different times), or one may be wrong.
   - Recommendation: Verify on-chain by querying DataStore for the oracle provider address for any token. The on-chain value is authoritative. Both keeper services must use the same provider or they'll read/write different price stores.

2. **Will a high-leverage position be immediately liquidatable after creation?**
   - What we know: Positions need to violate `minCollateralUsd` or `minCollateralUsdForLeverage` to be liquidatable. Opening fees and spread eat into collateral immediately.
   - What's unclear: The exact threshold at which the position becomes liquidatable depends on market-specific configuration (max leverage, min collateral).
   - Recommendation: Start with a very high leverage ratio (e.g., $1 collateral, $50 size = 50x). If the max allowed leverage is lower, reduce size. If the position isn't immediately liquidatable, wait for a small adverse price move.

3. **Is the order-execution-keeper's PythLazerFeedProvider address mismatch a problem?**
   - What we know: Order-execution-keeper `.env` has `0xc5810FC...` while keeper-service `.env` has `0x81B3857...`.
   - What's unclear: If they're writing/reading to different contracts, the keeper-service scanner would read stale prices even though the order-execution-keeper is actively pushing.
   - Recommendation: This MUST be investigated as part of the phase. Query both addresses on-chain to determine which is the active provider registered in DataStore.

## Sources

### Primary (HIGH confidence)
- `keeper-service/src/core/scanner.ts` -- Scanner implementation with Reader.isPositionLiquidatable() pattern
- `keeper-service/src/core/executor.ts` -- Executor implementation with LiquidationHandler.executeLiquidation() call
- `keeper-service/src/core/confirmator.ts` -- Confirmator with EventLog2 OrderExecuted filtering and status updates
- `keeper-service/src/core/contract.ts` -- Hardcoded PythLazerFeedProvider address bug discovered
- `keeper-service/.env` -- Current configuration including ORACLE_MODE=hermes and private key
- `keeper-service/prisma/schema.prisma` -- Database schema with all required tables
- `0xmarkets_contract/config/roles.ts` -- LIQUIDATION_KEEPER role definition for baseSepolia
- `0xmarkets_contract/utils/role.ts` -- grantRoleIfNotGranted uses hashString (keccak256 of abi.encode)
- `0xmarkets_contract/utils/hash.ts` -- hashString = keccak256(abi.encode(["string"], [str]))
- `0xmarkets_contract/scripts/grantKeeperRolesDirect.js` -- Existing script for granting roles
- `docs/keeper-infrastructure.md` -- Keeper wallet address, contract addresses, architecture

### Secondary (MEDIUM confidence)
- `e2e/test-orders.ts` -- Pattern for creating positions on Base Sepolia (proven in Phase 23/24)
- `order-execution-keeper-service/.env` -- PythLazerFeedProvider address discrepancy noted

### Tertiary (LOW confidence)
- Exact liquidation threshold behavior for creating an immediately-liquidatable position -- depends on market config parameters not fully investigated

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code is existing, no new libraries needed
- Architecture: HIGH - Full pipeline code reviewed, data flow traced end-to-end
- Pitfalls: HIGH - Three critical bugs discovered through code analysis with specific file/line references
- Test approach: MEDIUM - Creating an immediately-liquidatable position may require iteration on parameters

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- this is existing infrastructure verification)
