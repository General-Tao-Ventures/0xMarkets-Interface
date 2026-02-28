# Phase 24: Contract Bug Fixes - Research

**Researched:** 2026-02-27
**Domain:** Solidity contract bug fix, Hardhat redeployment, multi-service address propagation
**Confidence:** HIGH

## Summary

Phase 24 fixes a division-by-zero bug in `OrderHandler.sol` that prevents market orders on the JPY/USD reversed market. The bug is in `createOrder()` where `Precision.mulDiv(FLOAT_PRECISION, FLOAT_PRECISION, triggerPrice)` panics when `triggerPrice=0` (the default for market orders). The fix is a simple zero-guard: if triggerPrice is 0, skip the inversion (0 means "no trigger price" and should remain 0 after reversal).

Because `ExchangeRouter` stores `OrderHandler` as an immutable constructor argument, fixing OrderHandler requires redeploying both contracts. After deployment, the new `ExchangeRouter` address must be propagated to all five services that reference it: the interface SDK, E2E test suite, order-execution-keeper, contracts repo (roles config), and documentation.

**Primary recommendation:** Fix the Solidity code, redeploy both contracts via `hardhat deploy`, then systematically update the ExchangeRouter address in 4 files (SDK contracts.ts, E2E config.ts, order-execution-keeper .env, docs) and the OrderHandler address in 2 files (order-execution-keeper .env, docs). Run `cd sdk && yarn prebuild` after SDK changes to regenerate prebuilt keys.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CFIX-01 | OrderHandler guards triggerPrice=0 before inverting on reversed markets -- JPY/USD orders no longer revert | Bug located at OrderHandler.sol line 50-53. Zero-guard wrapping mulDiv calls is the standard pattern. LiquidationUtils is NOT affected (bypasses OrderHandler.createOrder entirely). |
| CFIX-02 | OrderHandler and ExchangeRouter redeployed atomically to Base Sepolia | ExchangeRouter constructor takes OrderHandler as immutable arg (line 12 of deployExchangeRouter.ts). Hardhat-deploy reads OrderHandler address from deployment artifact. Deploy OrderHandler first, then ExchangeRouter. afterDeploy hooks handle role grants. |
| CFIX-03 | All service configs updated with new contract addresses | ExchangeRouter referenced in: SDK contracts.ts (line 11), E2E config.ts (line 57), docs/keeper-infrastructure.md (line 41). OrderHandler referenced in: order-execution-keeper .env (line 21), docs/keeper-infrastructure.md (line 45). keeper-service does NOT reference either contract. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hardhat | 2.x | Contract compilation and deployment | Project already uses hardhat-deploy plugin |
| Solidity | ^0.8.0 | Smart contract language | Existing contract version |
| viem | 2.x | TypeScript Ethereum client (E2E tests, SDK) | Already used throughout frontend and E2E |
| cast (foundry) | latest | CLI for on-chain verification calls | Already used for contract verification in prior phases |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| hardhat-deploy | 0.x | Deployment management with artifacts | Handles constructor args, role grants, artifact files |
| dotenv | 17.x | Environment variable loading | Used by order-execution-keeper and E2E tests |

### Alternatives Considered
None -- this phase uses only existing tooling.

**Installation:**
No new packages required. All tools are already installed in the project.

## Architecture Patterns

### Pattern 1: Zero-Guard Before Division
**What:** Wrap `Precision.mulDiv()` calls with `if (x != 0)` when the divisor can legitimately be zero.
**When to use:** Any time a value with semantic meaning of "not set" (0) would be passed as a divisor.
**Example:**
```solidity
// Source: OrderHandler.sol line 50-54 (after fix)
if (market.reversed) {
    if (params.numbers.triggerPrice != 0) {
        params.numbers.triggerPrice = Precision.mulDiv(
            Precision.FLOAT_PRECISION, Precision.FLOAT_PRECISION, params.numbers.triggerPrice
        );
    }
    if (params.numbers.acceptablePrice != 0) {
        params.numbers.acceptablePrice = Precision.mulDiv(
            Precision.FLOAT_PRECISION, Precision.FLOAT_PRECISION, params.numbers.acceptablePrice
        );
    }
    params.isLong = !params.isLong;
}
```

### Pattern 2: Atomic Contract Pair Redeployment
**What:** When contract B holds contract A as an immutable reference, both must be redeployed together.
**When to use:** ExchangeRouter + OrderHandler (immutable constructor arg).
**Process:**
1. Deploy OrderHandler first (updates `deployments/baseSepolia/OrderHandler.json`)
2. Deploy ExchangeRouter second (reads new OrderHandler from artifact)
3. Verify with `cast call <ExchangeRouter> "orderHandler()(address)"`

### Pattern 3: Multi-Service Address Propagation
**What:** After contract redeployment, update all services that reference the changed addresses.
**When to use:** Every time a contract address changes.
**Checklist (for ExchangeRouter + OrderHandler specifically):**
1. Interface SDK: `sdk/src/configs/contracts.ts` (ExchangeRouter only)
2. E2E tests: `e2e/config.ts` (ExchangeRouter only, in CONTRACTS object)
3. Order-execution-keeper: `.env` (ORDER_HANDLER_ADDRESS only)
4. Docs: `docs/keeper-infrastructure.md` (both addresses)
5. Run `cd sdk && yarn prebuild` to regenerate prebuilt keys

### Anti-Patterns to Avoid
- **Redeploying only OrderHandler:** ExchangeRouter stores OrderHandler as immutable. All user transactions route through ExchangeRouter.multicall() -> createOrder(). If only OrderHandler is redeployed, ExchangeRouter still calls the old buggy one.
- **Forgetting `yarn prebuild` after SDK changes:** The SDK generates hashed market config/values/rates keys in `sdk/src/prebuilt/`. These may reference contract addresses indirectly. Always regenerate after contract address changes.
- **Updating keeper-service for ExchangeRouter:** The keeper-service (port 37017) does NOT reference ExchangeRouter or OrderHandler. It handles price feeds and liquidation scanning. Only the order-execution-keeper-service (port 37018) references ORDER_HANDLER_ADDRESS.
- **Setting SKIP_HANDLER_DEPLOYMENTS env var:** The OrderHandler deploy script skips if this env var is set. Must ensure it is NOT set during deployment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contract deployment | Manual deploy scripts | `npx hardhat deploy --tags OrderHandler` | hardhat-deploy handles constructor args, artifacts, and afterDeploy hooks (role grants) automatically |
| Role grants | Manual cast calls for CONTROLLER/ROUTER_PLUGIN | afterDeploy hooks in deploy scripts | Already implemented -- grantRoleIfNotGranted() + ReferralStorage.setHandler() |
| Address verification | Manual Basescan lookup | `cast call <addr> "orderHandler()(address)"` | One-liner CLI verification, scriptable |

**Key insight:** The Hardhat deploy scripts already handle the entire deployment lifecycle including role grants. The only manual work is the Solidity fix and the post-deployment address propagation.

## Common Pitfalls

### Pitfall 1: Forgetting to Update E2E Test Config
**What goes wrong:** E2E tests still point to old ExchangeRouter, all 18 tests fail because transactions go to old (buggy) contract.
**Why it happens:** E2E config (`e2e/config.ts`) has hardcoded addresses, not imported from SDK.
**How to avoid:** Update `e2e/config.ts` CONTRACTS.ExchangeRouter to new address after deployment.
**Warning signs:** E2E tests submit transactions but they never get executed by keeper (because keeper watches new ExchangeRouter's events, not old one).

### Pitfall 2: JPY/USD Skip List Not Removed
**What goes wrong:** E2E order test still reports 17/18 (5 pass + 1 skip) instead of 18/18.
**Why it happens:** `e2e/test-orders.ts` line 222 has `const SKIP_MARKETS = new Set(["JPY/USD"])` hardcoded.
**How to avoid:** After contract fix is deployed, remove "JPY/USD" from SKIP_MARKETS set (make it empty).
**Warning signs:** Test output shows "SKIP" for JPY/USD instead of testing it.

### Pitfall 3: Order-Execution-Keeper Not Restarted
**What goes wrong:** Keeper still calls old OrderHandler to execute orders, which reverts on JPY/USD.
**Why it happens:** The keeper reads ORDER_HANDLER_ADDRESS from .env at startup. Changing .env requires restart.
**How to avoid:** After updating `.env`, restart the keeper service (both local and cloud).
**Warning signs:** Keeper logs show revert errors on JPY/USD order execution.

### Pitfall 4: acceptablePrice=0 on Market Orders
**What goes wrong:** The zero-guard must also protect `acceptablePrice` inversion, not just `triggerPrice`.
**Why it happens:** For market increase orders, `acceptablePrice` is typically set to `maxUint256` (not 0), so this may not trigger in normal usage. But the guard is defensive and correct.
**How to avoid:** Guard both values, as the existing plan specifies.
**Warning signs:** Rare edge case where acceptablePrice=0 causes same panic.

### Pitfall 5: Cloud Keeper Address Mismatch
**What goes wrong:** Local E2E tests pass but production still fails because cloud keeper on DigitalOcean still has old ORDER_HANDLER_ADDRESS.
**Why it happens:** Cloud keeper managed by Michael Wallert, .env update requires SSH + Docker rebuild.
**How to avoid:** Communicate new address to team member responsible for cloud deployment, or SSH and update directly.
**Warning signs:** Local tests pass 18/18 but production users report JPY/USD still failing.

## Code Examples

### Exact Files That Need Address Updates

**1. Interface SDK -- ExchangeRouter only**
```typescript
// File: sdk/src/configs/contracts.ts, line 11
// Current: ExchangeRouter: "0x5AcE07B0E746662A2BB172a7A3C652C198bAf631",
// Update to: ExchangeRouter: "<NEW_ADDRESS>",
```

**2. E2E Tests -- ExchangeRouter only**
```typescript
// File: e2e/config.ts, line 57
// Current: ExchangeRouter: "0x5AcE07B0E746662A2BB172a7A3C652C198bAf631" as Address,
// Update to: ExchangeRouter: "<NEW_ADDRESS>" as Address,
```

**3. E2E Tests -- Remove JPY/USD skip**
```typescript
// File: e2e/test-orders.ts, line 222
// Current: const SKIP_MARKETS = new Set(["JPY/USD"]);
// Update to: const SKIP_MARKETS = new Set<string>();
```

**4. Order-Execution-Keeper -- OrderHandler only**
```bash
# File: order-execution-keeper-service/.env, line 21
# Current: ORDER_HANDLER_ADDRESS="0xCf752B72B74eE7b35a405c445E9843968f53A397"
# Update to: ORDER_HANDLER_ADDRESS="<NEW_ADDRESS>"
```

**5. Docs -- Both addresses**
```markdown
# File: docs/keeper-infrastructure.md, lines 41 and 45
# Update ExchangeRouter and OrderHandler rows in the address table
```

**6. Contract Address Update Guide -- Both addresses**
```markdown
# File: .claude/contract-address-update-guide.md
# Update ExchangeRouter and OrderHandler in the Infrastructure Contracts table
```

### Verification Commands
```bash
# Verify new ExchangeRouter points to new OrderHandler
cast call <NEW_EXCHANGE_ROUTER> "orderHandler()(address)" --rpc-url https://sepolia.base.org

# Verify OrderHandler has CONTROLLER role
cast call 0x773C3f6973064FD877FE5DF4f762Fe57C8F2Fd47 "hasRole(address,bytes32)(bool)" <NEW_ORDER_HANDLER> $(cast keccak "CONTROLLER") --rpc-url https://sepolia.base.org

# Regenerate SDK prebuilt keys
cd 0xMarkets-Interface/sdk && yarn prebuild

# Run E2E test suite (should be 18/18 after fix)
cd 0xMarkets-Interface/e2e && npx tsx test-orders.ts
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual contract deployment | hardhat-deploy with afterDeploy hooks | Project setup | Role grants automated |
| Update addresses ad hoc | Contract address update guide checklist | Phase 20 (v1.6) | Systematic 12-step checklist |

**Note:** This phase only changes ExchangeRouter and OrderHandler addresses. No token addresses, market addresses, or other infrastructure contracts change. The update scope is narrower than a full address migration.

## Open Questions

1. **Cloud keeper update timing**
   - What we know: Cloud keepers on DigitalOcean (142.93.203.222) need ORDER_HANDLER_ADDRESS updated
   - What's unclear: Whether the user will update cloud keepers themselves or needs instructions
   - Recommendation: Include the new address in the plan output so it can be communicated to the team

2. **LiquidationUtils and reversed markets**
   - What we know: LiquidationUtils.createLiquidationOrder passes triggerPrice=0 (line 67) but does NOT go through OrderHandler.createOrder -- it writes directly to OrderStoreUtils. The execution path (ExecuteOrderUtils.executeOrder) skips trigger price validation for Liquidation order types (BaseOrderUtils line 176-181).
   - What's unclear: Whether there are other reversed-market edge cases in the liquidation path that Phase 25 needs to investigate.
   - Recommendation: This is NOT a blocker for Phase 24. Phase 25 should audit the full liquidation execution path for reversed-market edge cases independently.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of OrderHandler.sol (line 50-54) -- confirmed bug location
- Direct codebase inspection of Precision.sol mulDiv() -- delegates to OpenZeppelin Math.mulDiv which panics on zero divisor
- Direct codebase inspection of ExchangeRouter deploy script -- confirmed OrderHandler is immutable constructor arg
- Direct codebase inspection of LiquidationUtils.sol -- confirmed it bypasses OrderHandler.createOrder entirely
- Direct codebase inspection of BaseOrderUtils.sol -- confirmed triggerPrice validation is skipped for market and liquidation orders
- Direct codebase inspection of all five services for address references

### Secondary (MEDIUM confidence)
- Contract address update guide (.claude/contract-address-update-guide.md) -- comprehensive but may be slightly stale after Phase 20 changes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already installed and used in prior phases
- Architecture: HIGH - bug location, fix, and deployment process are well-understood from existing plan and code inspection
- Pitfalls: HIGH - address propagation checklist verified against actual codebase files
- Address scope: HIGH - confirmed exactly which files reference ExchangeRouter vs OrderHandler via grep

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- contract architecture unlikely to change)
