# Domain Pitfalls

**Domain:** Contract redeployment in multi-service ecosystem + liquidation keeper verification and optimization
**Researched:** 2026-02-27
**Confidence:** HIGH (based on direct codebase analysis of all five services and known production incidents)

---

## Critical Pitfalls

Mistakes that cause reverts, stuck positions, or silent keeper failures.

---

### Pitfall 1: ExchangeRouter Immutable Constructor — Redeploying OrderHandler Alone Silently Fails

**What goes wrong:**
OrderHandler is fixed and redeployed. The fix works when called directly. But all user transactions flow through ExchangeRouter, which stores `orderHandler` as an `immutable` Solidity field set at construction time. The old ExchangeRouter still points to the old (buggy) OrderHandler address. Users submitting JPY orders continue to get division-by-zero reverts. The keeper executes deposits and withdrawals fine. Only orders fail. This looks like the fix didn't work.

**Why it happens:**
The natural instinct is "I'm fixing OrderHandler, so I deploy OrderHandler." But ExchangeRouter's constructor takes `OrderHandler` as a direct address argument baked into bytecode (`immutable`). It cannot be updated post-deployment. This is confirmed by the deploy script at `/Users/ken/Projects/0xM/0xmarkets_contract/deploy/deployExchangeRouter.ts` — `constructorContracts` explicitly includes `"OrderHandler"`.

**Consequences:**
- JPY market orders continue to revert despite fix
- Confusion about whether the fix was applied correctly
- Developers spend hours re-verifying the Solidity fix when the real problem is stale wiring

**Prevention:**
Always redeploy ExchangeRouter immediately after redeploying OrderHandler. Never test the fix through direct calls to OrderHandler — always test through ExchangeRouter to catch wiring issues.

**Verification:**
After deployment, call `cast call <NEW_EXCHANGE_ROUTER> "orderHandler()(address)"` and confirm it returns the new OrderHandler address, not the old one (`0xCf752B72B74eE7b35a405c445E9843968f53A397`).

**Phase to address:** Phase 24 (contract bug fixes) — must be a single atomic deployment step: fix → compile → deploy OrderHandler → deploy ExchangeRouter.

---

### Pitfall 2: CONTROLLER Role Not Granted to New Contracts — onlyController Reverts

**What goes wrong:**
New OrderHandler or ExchangeRouter is deployed. Transactions begin reverting with an access control error (not the original bug). The new contract was deployed but the `RoleStore.grantRole` transaction failed silently, was skipped, or the deployer lacked sufficient gas. The `onlyController` modifier on all handler functions checks `roleStore.hasRole(CONTROLLER, msg.sender)` — without the role, nothing executes.

**Why it happens:**
The `afterDeploy` hook in `deployOrderHandler.ts` calls `grantRoleIfNotGranted(deployedContract.address, "CONTROLLER")`. If this hook throws or is skipped (network hiccup, insufficient gas, deployer nonce conflict), the deployment artifact is written with the new address but the on-chain role was never granted. Hardhat does not fail the overall deployment in all cases when `afterDeploy` throws — it depends on the version and error type.

**Consequences:**
- All order execution reverts with access control error
- Keeper logs show transaction reverted, no useful revert reason
- The deployment artifact looks correct (new address) but the contract is non-functional

**Prevention:**
After every deployment, explicitly verify roles using `cast`:
```bash
cast call <ROLE_STORE> "hasRole(bytes32,address)(bool)" $(cast keccak "CONTROLLER") <NEW_ORDER_HANDLER> --rpc-url https://sepolia.base.org
cast call <ROLE_STORE> "hasRole(bytes32,address)(bool)" $(cast keccak "CONTROLLER") <NEW_EXCHANGE_ROUTER> --rpc-url https://sepolia.base.org
cast call <ROLE_STORE> "hasRole(bytes32,address)(bool)" $(cast keccak "ROUTER_PLUGIN") <NEW_EXCHANGE_ROUTER> --rpc-url https://sepolia.base.org
```

All three must return `true`. If any returns `false`, manually call `grantRole` from the RoleStore admin account.

**Phase to address:** Phase 24 — add explicit role verification as a mandatory post-deployment step before marking the phase complete.

---

### Pitfall 3: Stale Addresses Across Five Services After Redeployment

**What goes wrong:**
OrderHandler and ExchangeRouter are redeployed with new addresses. The Interface is updated. But keeper-service and order-execution-keeper-service still have the old ExchangeRouter address in their `.env` files. The keepers attempt to execute operations against the old contracts, which silently succeed (the transactions go through) but execute against a contract that is no longer the canonical entry point. Worse, if the old ExchangeRouter's roles were revoked as part of cleanup, all keeper transactions revert.

**Why it happens:**
The address update guide in `.claude/contract-address-update-guide.md` lists the full checklist, but it is easy to miss individual service `.env` files — especially on the DigitalOcean droplet which has its own live `.env` files that differ from the local development copies.

**The five services that must be updated:**
1. Interface: `sdk/src/configs/contracts.ts`, `src/config/multichain.ts`
2. keeper-service: `src/config.ts` (env vars) + DO droplet `.env`
3. order-execution-keeper-service: `.env` + DO droplet `.env`
4. 0xMarkets-squid: `src/processor.ts` (EventEmitter address only, unchanged here)
5. 0xmarkets_contract: deployment artifacts (auto-updated by hardhat-deploy)

**The DO droplet danger:** The deployed services on `142.93.203.222` have their own `.env` files that are NOT automatically updated when you update local files. After local `.env` changes are verified, the updated configs must be pushed to the droplet and both keeper services must be restarted.

**Prevention:**
Run the on-chain DataStore verification script after every deployment. The pattern from Phase 20 (contract address audit) reads the DataStore's canonical addresses directly from the chain and compares them against each service's configured values. Discrepancies fail loudly.

**Detection:** After redeployment, run a test deposit through the UI. If the keeper's transaction shows a revert reason related to "invalid handler" or "access denied," a service has a stale address.

**Phase to address:** Phase 24 — the post-deployment checklist must include explicit address propagation to the DO droplet.

---

### Pitfall 4: Nonce Conflicts Between keeper-service and order-execution-keeper-service Sharing One Wallet

**What goes wrong:**
Both keepers run with the same `PRIVATE_KEY` environment variable, meaning they share the same Ethereum account and therefore share the same nonce sequence. The order-execution-keeper uses manual nonce management: `getTransactionCount({ blockTag: "latest" })` before each submission. If keeper-service's liquidation executor submits a transaction simultaneously, both keepers read the same "current" nonce, both try to submit with that nonce, and one wins while the other gets `replacement transaction underpriced`. The loser's error handling may then retry with the same stale nonce, compounding the problem.

**The critical asymmetry:** The order-execution-keeper has a well-tested sequential executor with nonce error recovery (`extractExpectedNonce`). The keeper-service's liquidation executor (`/src/core/executor.ts`) does NOT use this pattern — it calls `estimateFeesPerGas()` and `writeContract()` without manual nonce management, relying on viem's default behavior.

**Why it happens:**
Using a single keeper wallet is documented as an intentional "simpler for testnet" decision (`PROJECT.md` Key Decisions). It was acceptable when keeper-service only did price feeds and candles (no transactions). Liquidation execution adds transaction submission to keeper-service, creating genuine concurrency.

**Current mitigations present:**
- order-execution-keeper has `extractExpectedNonce` and retries with corrected nonce on "nonce too low"
- Sequential executor design means order-execution-keeper only has one in-flight TX at a time
- keeper-service liquidation executor has no concurrency protection

**Consequence:** Liquidation execution and order/deposit/withdrawal execution will collide under concurrent load. The liquidation TX or the deposit TX will revert. The deposit will be retried (it stays in the DataStore). The liquidation candidate will be marked `FAILED` in the keeper-service database and never retried.

**Prevention options (in order of preference):**
1. **Separate wallets (recommended for production):** Give keeper-service its own funded wallet with `LIQUIDATION_KEEPER` role. Completely eliminates the conflict. Zero code changes needed beyond a new `.env` var.
2. **Transaction mutex shared across both keepers (testnet shortcut):** Not feasible — two separate processes, no shared memory.
3. **Stagger execution windows:** Configure keeper-service to delay liquidation execution by 3 seconds after order-execution-keeper's last known submission time. Not reliable under load.
4. **Accept conflicts as rare for testnet:** On testnet with low traffic, simultaneous liquidation + order execution is unlikely. The order-execution-keeper's `extractExpectedNonce` recovery handles most cases. Acceptable for v1.7 verification but must be fixed before production.

**Detection:** Watch for `replacement transaction underpriced` or `nonce too low` errors in keeper-service logs at the same time that order-execution-keeper logs show normal execution. The timing correlation identifies a nonce conflict.

**Phase to address:** Phase 24 or a dedicated wallet-split phase. For v1.7 (testnet verification), document this as a known risk. Mark it blocking for any production deployment.

---

### Pitfall 5: Liquidation Executor Uses `getStoredPrice` With 60-Second Staleness Check — Depends on order-execution-keeper Staying Alive

**What goes wrong:**
The keeper-service liquidation executor's `getTokenPrice` method reads prices from `PythLazerFeedProvider.getStoredPrice()` on-chain, with a 60-second staleness guard (`nowSeconds - storedPrice.timestamp > 60n`). This design assumes the order-execution-keeper is continuously pushing fresh prices to the `PythLazerFeedProvider` contract. If the order-execution-keeper goes down (Docker restart, crash, temporary OOM), the stored prices go stale within 60 seconds. The liquidation keeper then returns `null` for all token prices, skips all markets with a "stored price too stale" warning, and silently misses every liquidation opportunity during the downtime window.

**Why this is dangerous for liquidations specifically:** A liquidation that was valid at the time of the scan may become invalid if prices move. But a position that should be liquidated immediately (e.g., price spiked sharply against the position) needs to be acted on within the same scan window. If prices go stale for even 60 seconds during volatile market conditions, legitimate liquidations are skipped.

**Prevention:**
1. The liquidation keeper should have its OWN Pyth Lazer WebSocket connection and cache (independent of order-execution-keeper's on-chain price storage). The `PythLazerOracleService` already exists in keeper-service — it just needs to be started in `lazer` oracle mode and `getTokenPrice` should read from the local cache, not from on-chain stored prices.
2. The current keeper-service `index.ts` already initializes `PythLazerOracleService` when `ORACLE_MODE=lazer` — but the `scanner.ts` `getTokenPrice` method ignores this and reads from the contract instead.
3. Minimum fix: change `getTokenPrice` to try the local Lazer cache first, fall back to on-chain stored price if the cache miss.

**Detection:** If order-execution-keeper has a brief restart and liquidation scanner logs show "stored price too stale" for all tokens during that window, this pitfall is manifesting.

**Phase to address:** Phase 25 (liquidation verification) — fixing this dependency is part of making the liquidation path reliable.

---

### Pitfall 6: `discoverAccountsWithPositions` Fetches Every Position Key Individually — O(N) RPC Calls Per Scan

**What goes wrong:**
`positionFetcher.discoverAccountsWithPositions()` in keeper-service:
1. Reads `getBytes32Count(POSITION_LIST_KEY)` to get total count
2. Reads position keys in batches of 100 via `getBytes32ValuesAt`
3. For EACH position key, makes an individual `getPosition(dataStore, key)` RPC call to extract the account address

With 1000 open positions, this is 1000 serial RPC calls per scan cycle. At ~100ms per call on Base Sepolia, one scan cycle takes 100 seconds — longer than the 30-second scan interval. The `scanRunning` guard prevents overlapping scans, so every scan cycle is skipped until the previous one finishes. Effective scan frequency degrades to once every 100 seconds at 1000 positions.

**Why it happens:**
The `POSITION_LIST` in the DataStore stores position keys (`bytes32`), not the full position structs. To find which accounts have positions, you must decode each key back to an account — but position keys are hashes, not reversible. The only way to get the account is to read the full position struct from the contract.

**Note for v1.7 testnet context:** With very few test positions (likely 5-20), this is not a problem. The pitfall becomes relevant at scale or during load testing.

**Prevention:**
For now, document the O(N) limitation. The correct optimization is to use event-based account discovery: watch `PositionIncrease` events from EventEmitter to build an account registry, then only fetch positions for known accounts. This eliminates the DataStore iteration entirely. The `confirmator.ts` already watches the EventEmitter — extend it to track accounts with active positions.

**Detection:** Scan cycle duration in logs exceeds 30 seconds (the scan interval). "previous scan still running, skipping" warnings appear regularly.

**Phase to address:** Phase 25 (liquidation optimization) — document as a known scale bottleneck. Implement event-based account discovery when testnet positions exceed 50.

---

### Pitfall 7: `collateralUsd` in PositionSnapshot Is Not USD — It Is Raw Token Amount

**What goes wrong:**
`positionFetcher.ts` sets `collateralUsd = pos.numbers.collateralAmount`. The comment says `// TODO: Convert using collateral token price`. But `collateralAmount` is the raw token amount (e.g., USDC with 6 decimals, so 1000 USDC = `1_000_000` wei). The `RiskEngine.checkLiquidation` uses this raw value as if it were a USD amount (`const collateral = position.collateralUsd`). All risk calculations are wrong by orders of magnitude.

**However:** The scanner in `scanner.ts` does NOT use `RiskEngine.checkLiquidation`. It calls `Reader.isPositionLiquidatable()` directly on-chain, which computes everything correctly using the contract's internal pricing. The `RiskEngine` is only used to compute a `riskScore` for the database record, not to decide whether to liquidate.

**The consequence:** Risk scores in the database are wrong (will show extreme values). But liquidation decisions are based on the on-chain Reader call, which is correct. The bug is a data quality issue in the audit trail, not a correctness issue in the execution path.

**Prevention:** Fix the `collateralUsd` calculation before relying on risk scores for any alerting or dashboarding. For v1.7, note this as a known data quality issue in the audit trail but not a blocker for functional correctness.

**Phase to address:** Phase 25 (liquidation optimization) — fix the calculation as part of the risk scoring improvements.

---

### Pitfall 8: Executor Re-Fetches Position From Contract After It May Have Changed

**What goes wrong:**
The liquidation execution flow in `executor.ts`:
1. Scanner identifies a liquidatable position and saves a snapshot
2. Scanner calls `executor.execute(candidate, decision)` synchronously
3. Executor re-fetches the position from the contract via `positionFetcher.fetchAccountPositions`
4. If no matching position is found (size > 0), the execution fails with "Position not found"

Between step 1 (scanner decision) and step 3 (executor re-fetch), the position state on-chain may have changed:
- The user closed their position voluntarily between the scan and the execution
- Another keeper instance liquidated it first (impossible with single keeper, but relevant if testing with multiple)
- The user added collateral and the position is no longer liquidatable

**The double-fetch pattern:** The executor re-fetches the position specifically to get `collateralToken` and `isLong`, which are needed for `executeLiquidation(account, market, collateralToken, isLong, oracleParams)`. These are stored in the position struct but not reliably in the scanner's snapshot.

**Consequence for closed positions:** The executor calls `executeLiquidation` with parameters from the snapshot for a position that no longer exists. The LiquidationHandler will revert because there is no position to liquidate. The executor catches the error and marks the candidate `FAILED`. This is correct behavior — but the `FAILED` status in the DB looks concerning and may trigger false alerts.

**Prevention:** Treat `FAILED` liquidation executions as potentially benign (position closed before execution). Log them as INFO not ERROR when the position no longer exists at execution time. Do not alert on `FAILED` candidates without first checking whether the position still exists.

**Phase to address:** Phase 25 — improve executor error classification to distinguish "position no longer exists" from genuine execution failures.

---

## Moderate Pitfalls

---

### Pitfall 9: SKIP_HANDLER_DEPLOYMENTS Environment Variable Silently Skips OrderHandler Redeploy

**What goes wrong:**
`deployOrderHandler.ts` has `func.skip = async () => process.env.SKIP_HANDLER_DEPLOYMENTS ? true : false`. If this variable is set in the shell environment (perhaps from a previous partial deployment session or a different project's dotenv), `npx hardhat deploy --tags OrderHandler` runs, appears to succeed (Hardhat reports "nothing to deploy"), but deploys nothing. The old buggy OrderHandler remains at its old address.

**Prevention:** Before deployment, explicitly verify `SKIP_HANDLER_DEPLOYMENTS` is unset:
```bash
echo $SKIP_HANDLER_DEPLOYMENTS  # must be empty
unset SKIP_HANDLER_DEPLOYMENTS
```

**Phase to address:** Phase 24 — add this verification to the pre-deployment checklist.

---

### Pitfall 10: hardhat-deploy Skips Redeployment If Bytecode Matches Cached Deployment

**What goes wrong:**
`hardhat-deploy` compares the new contract's bytecode against the cached deployment in `deployments/baseSepolia/`. If the bytecode matches (e.g., you compiled the same contract twice without changes), it skips deployment and uses the cached address. After fixing `OrderHandler.sol`, the bytecode will differ, so this is not a concern — unless the fix was reverted accidentally or the compilation produced the same bytecode via a no-op change.

**Detection:** After `npx hardhat deploy --tags OrderHandler`, verify the address in `deployments/baseSepolia/OrderHandler.json` differs from the old address (`0xCf752B72B74eE7b35a405c445E9843968f53A397`). If the address is unchanged, the deployment was skipped.

**Prevention:** Force redeployment if needed with `--reset` flag. Do not use `--reset` blindly — it redeploys ALL contracts, not just the targeted ones.

**Phase to address:** Phase 24 — explicit address comparison is part of the post-deployment verification.

---

### Pitfall 11: `withOraclePrices` Modifier Staleness Check Uses On-Chain Block Timestamp, Not Keeper Clock

**What goes wrong:**
The `LiquidationHandler.executeLiquidation` uses `withOraclePrices(oracleParams)` which calls `Oracle.setPrices`. Inside `Oracle.setPrices`, each price's timestamp is validated against `block.timestamp` with `MAX_ORACLE_PRICE_AGE` (300 seconds). The keeper's executor in `buildOracleParams` passes `update?.rawUpdate ?? "0x"` — when `rawUpdate` is "0x" (no cached update), the contract reads from stored prices via `PythLazerFeedProvider.getOraclePrice`, which returns whatever price was last pushed on-chain.

**The trap:** On-chain stored prices are updated by the order-execution-keeper every ~5 seconds. But the `timestamp` field stored in the contract comes from the Pyth Lazer feed's original timestamp, not `block.timestamp`. If there is any clock drift between the Pyth feed timestamp and the chain's `block.timestamp`, the `MAX_ORACLE_PRICE_AGE` check can fail even with fresh prices.

**Prevention:** Test liquidation execution end-to-end on testnet before assuming it works. The oracle timestamp handling for liquidations may differ from deposit/withdrawal execution in subtle ways. Verify by observing actual `executeLiquidation` transactions on Basescan.

**Phase to address:** Phase 25 — requires live testnet testing, not just code review.

---

### Pitfall 12: `onlyLiquidationKeeper` Role — keeper-service Must Have This Role Granted

**What goes wrong:**
`LiquidationHandler.executeLiquidation` has `onlyLiquidationKeeper` modifier (visible in `LiquidationHandler.sol` line 46). The keeper-service wallet must have the `LIQUIDATION_KEEPER` role in the RoleStore. If this role was not granted when the keeper was originally set up (it is separate from `ORDER_KEEPER` and `CONTROLLER`), all liquidation transactions will revert with an access control error.

**Why likely not yet verified:** The liquidation keeper has never been run end-to-end (it is "pending verification" per `PROJECT.md`). The role may or may not have been granted when the contract was originally deployed.

**Prevention:** Before running the liquidation keeper for the first time, verify the role:
```bash
cast call <ROLE_STORE> "hasRole(bytes32,address)(bool)" $(cast keccak "LIQUIDATION_KEEPER") <KEEPER_WALLET_ADDRESS> --rpc-url https://sepolia.base.org
```
If it returns `false`, grant it:
```bash
cast send <ROLE_STORE> "grantRole(bytes32,address)" $(cast keccak "LIQUIDATION_KEEPER") <KEEPER_WALLET_ADDRESS> --rpc-url https://sepolia.base.org --private-key <ADMIN_KEY>
```

**Phase to address:** Phase 25 — this is the first thing to check before any liquidation testing.

---

## Minor Pitfalls

---

### Pitfall 13: Scan Interval (30 seconds) May Miss Immediate Liquidation After Sharp Price Move

**What goes wrong:**
The keeper-service scan runs every 30 seconds (`SCAN_INTERVAL_SECONDS=30`). If a position becomes liquidatable due to a sudden price spike, it is not detected until the next scan cycle completes, which could be up to 29 seconds after the price move. On testnet with low latency, this is acceptable. On mainnet with competitive liquidators, this means losing every liquidation to bots scanning at 1-second intervals.

**Prevention for v1.7:** 30 seconds is acceptable for testnet verification. Document the limitation. For production, the scan interval should be reduced to 2-5 seconds, and the oracle pricing should be pulled directly from the Lazer WebSocket cache (not from on-chain stored prices) to eliminate the oracle-freshness dependency during scanning.

**Phase to address:** Phase 25 (optimization) — scan interval tuning is a performance parameter, not a correctness issue.

---

### Pitfall 14: PostgreSQL Database Must Be Migrated Before keeper-service Restart

**What goes wrong:**
The keeper-service uses Prisma with a PostgreSQL database. If the schema changes (new fields, renamed tables) between deployments without running `prisma migrate deploy`, the service crashes on startup with a Prisma schema mismatch error.

**For v1.7:** No schema changes are planned. The liquidation tables (`position_snapshots`, `liquidation_candidates`, `signed_decisions`, `liquidation_executions`) already exist from the initial keeper-service deployment.

**Prevention:** If schema changes are ever made, always run `prisma migrate deploy` on the DO droplet before restarting the service. The database is on the same droplet; SSH in and run it manually.

**Phase to address:** Not a v1.7 concern unless schema changes are introduced.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| OrderHandler redeploy | ExchangeRouter immutable constructor not updated | Always deploy ExchangeRouter immediately after OrderHandler |
| ExchangeRouter redeploy | CONTROLLER/ROUTER_PLUGIN roles not granted | Verify with `cast call` before any testing |
| Address propagation to DO droplet | Stale addresses in live `.env` files | SSH to droplet, update `.env`, restart both keepers |
| Liquidation first run | LIQUIDATION_KEEPER role not granted | Check role before first execution attempt |
| Nonce management | Both keepers share wallet, concurrent TXs | Separate wallets or accept testnet race condition with documented risk |
| Oracle for liquidations | Depends on order-execution-keeper's on-chain price store | Verify freshness window; use local Lazer cache for independence |
| Account discovery | O(N) per-position RPC calls | Acceptable at testnet scale; document as scale blocker |
| Risk score accuracy | collateralUsd is raw token amount, not USD | Non-blocking for v1.7; fix before using scores for alerts |
| Skip flag on deployment | SKIP_HANDLER_DEPLOYMENTS env var skips redeploy silently | Unset before running hardhat deploy |
| hardhat-deploy cache | Unchanged bytecode skips redeploy | Verify new address differs from old after deployment |
| Oracle timestamp validation | On-chain timestamp vs block.timestamp drift | Verify with actual testnet liquidation execution |

---

## Recovery Strategies

| Pitfall | Recovery Steps |
|---------|---------------|
| ExchangeRouter still points to old OrderHandler | Redeploy ExchangeRouter immediately; update all service addresses |
| CONTROLLER role missing | Call `grantRole(CONTROLLER, newAddress)` from RoleStore admin; no redeployment needed |
| LIQUIDATION_KEEPER role missing | Call `grantRole(LIQUIDATION_KEEPER, keeperWallet)` from RoleStore admin |
| Stale addresses on DO droplet | SSH to `142.93.203.222`, update `.env` for both keepers, `docker compose restart` both services |
| Nonce conflict between keepers | Let it resolve naturally (order-execution-keeper has recovery); if stuck, restart both keepers and let them re-sync nonces from chain |
| Liquidation executor marks candidates FAILED | Check whether position still exists on-chain; if position was closed legitimately, FAILED status is correct. Re-check logic if position still exists. |
| SKIP_HANDLER_DEPLOYMENTS silently skipped deploy | Unset the var, run deployment again; hardhat-deploy will compare bytecode and redeploy correctly |

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `/Users/ken/Projects/0xM/0xmarkets_contract/deploy/deployOrderHandler.ts` — SKIP_HANDLER_DEPLOYMENTS skip logic, afterDeploy role grants
- `/Users/ken/Projects/0xM/0xmarkets_contract/deploy/deployExchangeRouter.ts` — immutable OrderHandler constructor arg, afterDeploy role grants
- `/Users/ken/Projects/0xM/0xmarkets_contract/contracts/exchange/LiquidationHandler.sol` — onlyLiquidationKeeper modifier, executeLiquidation signature
- `/Users/ken/Projects/0xM/keeper-service/src/core/scanner.ts` — discoverAccountsWithPositions O(N) pattern, getStoredPrice 60s staleness check
- `/Users/ken/Projects/0xM/keeper-service/src/core/executor.ts` — no nonce management, double-fetch pattern, gas estimation
- `/Users/ken/Projects/0xM/keeper-service/src/core/positionFetcher.ts` — collateralUsd = collateralAmount bug
- `/Users/ken/Projects/0xM/keeper-service/src/core/riskEngine.ts` — uses collateralUsd as USD value (incorrect)
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/executor.ts` — extractExpectedNonce, sequential execution, nonce recovery
- `/Users/ken/Projects/0xM/0xMarkets-Interface/.planning/PROJECT.md` — single wallet decision, liquidation keeper pending verification, nonce management notes
- `/Users/ken/Projects/0xM/0xMarkets-Interface/.planning/phases/24-contract-bug-fixes/24-01-PLAN.md` — full contract redeploy context, interface listing, known addresses

---
*Pitfalls research for: v1.7 Liquidation Readiness (contract redeployment + liquidation keeper)*
*Researched: 2026-02-27*
