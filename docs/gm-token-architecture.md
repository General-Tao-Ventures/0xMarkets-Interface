# GM Token Architecture — 0xMarkets

> **Purpose:** Comprehensive reference for understanding, rebranding (testnet), and eventually removing (mainnet) the GM token system inherited from GMX.

## Table of Contents

1. [What is the GM Token?](#what-is-the-gm-token)
2. [Contract Layer](#contract-layer)
3. [UI Layer](#ui-layer)
4. [Testnet Plan: UI Rebrand](#testnet-plan-ui-rebrand)
5. [Mainnet Plan: Remove GM Token](#mainnet-plan-remove-gm-token)

---

## What is the GM Token?

The GM token is an ERC-20 receipt token representing a user's share of a liquidity pool. Each market (ETH/USD, EUR/USD, etc.) deploys its own GM token contract.

**How it works:**
- User deposits USDC → contract mints GM tokens proportional to their share of the pool
- Trading fees accrue to the pool → GM token price increases (no staking/claiming needed)
- User withdraws → contract burns GM tokens → returns USDC

**GM Token Price:**
```
price = poolValue / totalSupply
```

**Pool Value includes:**
- Long token amounts × price
- Short token amounts × price
- Open interest impact
- Trader PnL (long + short)
- Borrowing fees

---

## Contract Layer

### Core Contracts

#### MarketToken.sol
**Path:** `0xmarkets_contract/contracts/market/MarketToken.sol`

Simple ERC-20 extending `Bank` (which can hold collateral tokens). Each market gets its own instance.

```solidity
constructor(RoleStore _roleStore, DataStore _dataStore)
    ERC20("GMX Market", "GM")  // ← rename target
    Bank(_roleStore, _dataStore)
{}
```

Only controllers can mint/burn (restricted by `onlyController` modifier).

#### MarketFactory.sol
**Path:** `0xmarkets_contract/contracts/market/MarketFactory.sol`

Deploys new MarketToken instances via CREATE2 with deterministic salt from: indexToken, longToken, shortToken, marketType.

### Deposit Flow (Minting)

**File:** `0xmarkets_contract/contracts/deposit/ExecuteDepositUtils.sol`

**Mint call (line 529):**
```solidity
MarketToken(payable(_params.market.marketToken)).mint(_params.receiver, mintAmount);
```

**Minting formula** (via `MarketUtils.usdToMarketTokenAmount()`):
```
First deposit (supply=0, poolValue=0):  mint = depositedUSD × 1e30
First deposit (supply=0, poolValue>0):  mint = (poolValue + depositedUSD) × 1e30
Normal deposit:                         mint = (totalSupply / poolValue) × depositedUSD
```

**Deposit steps:**
1. Fee deduction from deposit amount (lines 307-360)
2. Price impact calculation — positive adds tokens from impact pool, negative deducts (lines 419-500)
3. Final mint amount calculation (lines 502-506)
4. Mint GM tokens to receiver (line 529)

### Withdrawal Flow (Burning)

**File:** `0xmarkets_contract/contracts/withdrawal/ExecuteWithdrawalUtils.sol`

**Burn call (line 313):**
```solidity
MarketToken(payable(market.marketToken)).burn(
    address(params.withdrawalVault),
    withdrawal.marketTokenAmount()
);
```

**Withdrawal formula** (via `MarketUtils.marketTokenAmountToUsd()`):
```
outputUSD  = (gmTokensBurned / totalSupply) × poolValue
longOutput  = (outputUSD / totalPoolUSD) × longTokenInPool
shortOutput = (outputUSD / totalPoolUSD) × shortTokenInPool
```

**Withdrawal steps:**
1. Calculate total USD value being withdrawn
2. Distribute proportionally between long and short tokens
3. Deduct withdrawal fees (lines 173-318)
4. Validate max PnL constraints
5. Burn GM tokens from withdrawal vault (line 313)

### Pool Value & Price Calculations

**File:** `0xmarkets_contract/contracts/market/MarketUtils.sol` (~2800 lines)

Key functions:
| Function | Purpose |
|----------|---------|
| `usdToMarketTokenAmount()` (L2496) | Calculates mint amount for deposits |
| `marketTokenAmountToUsd()` (L2522) | Calculates USD value for withdrawals |
| `getMarketTokenPrice()` (L135) | Derives GM token price = poolValue / supply |
| `getMarketTokenSupply()` (L170) | Returns `marketToken.totalSupply()` |
| `getPoolAmount()` (L477) | Gets token amount held in pool |
| `applyDeltaToPoolAmount()` (L619) | Updates pool amounts on deposit/withdrawal |

### Shift Flow

**File:** `0xmarkets_contract/contracts/shift/ShiftUtils.sol`

Shifts move GM tokens between markets — burns from one market, deposits into another. Uses both mint and burn paths.

### GLV Layer

GLV (GMX Liquidity Vault) wraps multiple GM tokens into a single vault token:

| File | Action |
|------|--------|
| `glv/glvDeposit/GlvDepositUtils.sol` (L246) | Mints GLV tokens; accepts either GM tokens or raw USDC |
| `glv/glvWithdrawal/GlvWithdrawalUtils.sol` (L155) | Burns GLV tokens; converts GM back to USDC |

### Complete Contract File List

**Direct GM operations (mint/burn):**
1. `contracts/market/MarketToken.sol` — Token definition
2. `contracts/deposit/ExecuteDepositUtils.sol` — Mints GM
3. `contracts/withdrawal/ExecuteWithdrawalUtils.sol` — Burns GM
4. `contracts/glv/glvDeposit/GlvDepositUtils.sol` — Mints GLV (wraps GM)
5. `contracts/glv/glvWithdrawal/GlvWithdrawalUtils.sol` — Burns GLV (unwraps GM)

**Pool value & calculations:**
6. `contracts/market/MarketUtils.sol` — All pricing formulas
7. `contracts/market/MarketPoolValueInfo.sol` — Data structures

**Market creation:**
8. `contracts/market/MarketFactory.sol` — Deploys MarketToken via CREATE2

**Infrastructure:**
9. `contracts/bank/Bank.sol` — Base class for token transfers
10. `contracts/deposit/DepositUtils.sol` — Creates deposit requests
11. `contracts/withdrawal/WithdrawalUtils.sol` — Creates withdrawal requests
12. `contracts/shift/ShiftUtils.sol` — Multi-market transfers

**Orchestration:**
13. `contracts/exchange/DepositHandler.sol`
14. `contracts/exchange/WithdrawalHandler.sol`
15. `contracts/exchange/ShiftHandler.sol`

---

## UI Layer

### Token Configuration

**File:** `sdk/src/configs/tokens.ts`

```typescript
{
  name: "GMX Market tokens",
  symbol: "GM",
  address: "<market-token-address>",
  decimals: 18,
  isPlatformToken: true,  // hides from general token selectors
}
```

`isPlatformToken: true` excludes GM from `V2_TOKENS` — users only see it in pool-specific contexts.

### User-Facing "GM" Strings

| File | Line(s) | Current Text | Category |
|------|---------|-------------|----------|
| `GmSwapBoxHeader.tsx` | 17-19 | "Buy GM", "Sell GM", "Shift GM" | Operation tabs |
| `GmListItem.tsx` | 307, 315, 441, 449 | "Buy GM", "Sell GM" | Pool list buttons |
| `GmStatusNotification.tsx` | 265 | "Buying GM:" | Deposit notification |
| `GmStatusNotification.tsx` | 284 | "Selling GM" | Withdrawal notification |
| `GmStatusNotification.tsx` | 292 | "Unknown shift GM order" | Shift notification |
| `GmStatusNotification.tsx` | 326, 329 | "buy request" | Deposit status |
| `GmStatusNotification.tsx` | 334, 337 | "sell request" | Withdrawal status |
| `GmStatusNotification.tsx` | 368 | "Buy order executed" | Deposit success |
| `GmStatusNotification.tsx` | 387 | "check your GM token balance" | Success hint |
| `GmStatusNotification.tsx` | 394 | "Sell order executed" | Withdrawal success |
| `GmStatusNotification.tsx` | 84-100 | "GM tokens have been returned" | Withdrawal cancellation |
| `TokenSelector.tsx` | 121 | "GM {indexToken.name}" | Token dropdown |
| `AssetDropdown.tsx` | 207 | "Buy GM: {name}" | Dashboard |
| `PoolsDetailsHeader.tsx` | — | Shows "GM" for supply display | Pool details |
| `GmTokensTotalBalanceInfo.tsx` | — | Symbol displayed as "GM" | Total balance |

### Symbol Detection Logic (Critical)

The UI identifies GM tokens by checking `symbol === "GM"`:

**File:** `GmDepositWithdrawalBox.tsx`
- Line 195: `isMarketToken: firstToken?.symbol === "GM"` — determines if input is a market token
- Line 448: `const isGm = selectedToken?.symbol === "GM"` — controls deposit/withdrawal behavior
- Line 692: `if (firstToken?.symbol === "GM")` — token switching logic

**Important:** If you rename the symbol, these checks must also be updated (or replaced with `isMarketToken` flag checks).

### Component Tree

```
src/components/GmSwap/               — Deposit/Withdrawal interface
├── GmSwapBox.tsx                     — Root orchestrator
├── GmSwapBoxHeader.tsx               — Operation tabs (Buy/Sell/Shift)
├── GmSwapBoxPoolRow.tsx              — Pool selection
├── GmSwapWarningsRow.tsx             — Warning messages
├── GmDepositWithdrawalBox/           — Core form
│   ├── GmDepositWithdrawalBox.tsx    — Main form logic
│   ├── InfoRows.tsx                  — Fee display
│   ├── useGmDepositWithdrawalBoxState.tsx
│   ├── useGmSwapSubmitState.tsx
│   ├── useDepositWithdrawalAmounts.tsx
│   ├── useDepositWithdrawalFees.tsx
│   ├── useDepositWithdrawalTransactions.tsx
│   ├── useUpdateInputAmounts.tsx
│   └── useUpdateTokens.tsx
├── GmShiftBox/                       — Shift between markets
│   ├── GmShiftBox.tsx
│   ├── useShiftAmounts.tsx
│   ├── useShiftFees.tsx
│   └── useShiftTransactions.tsx
└── GmFees/                           — Fee display components

src/components/GmList/                — Pool list display
├── GmList.tsx                        — Main list (already says "0xMarkets Pools")
├── GmListItem.tsx                    — Individual pool rows
├── GmTokensTotalBalanceInfo.tsx      — Total balance display
├── sortGmTokensByField.tsx
├── sortGmTokensDefault.tsx
└── useFilterSortPools.tsx
```

### Domain Logic

| File | Key Functions |
|------|--------------|
| `domain/synthetics/markets/utils.ts` | `usdToMarketTokenAmount()`, `marketTokenAmountToUsd()`, `getTotalGmInfo()`, `getMintableMarketTokens()` |
| `domain/synthetics/markets/glv.ts` | `getMintableInfoGlv()`, `getSellableInfoGlvInMarket()` |
| `domain/synthetics/markets/useMarketTokensData.ts` | `useMarketTokensDataRequest()` — fetches all GM token balances/prices |
| `domain/synthetics/markets/useGmMarketsApy.ts` | `useGmMarketsApy()` — calculates pool APY |
| `domain/synthetics/trade/utils/validation.ts` | `getGmSwapError()` — validates deposit/withdrawal operations |
| `domain/synthetics/markets/createDepositTxn.ts` | Constructs deposit transaction |
| `domain/synthetics/markets/createWithdrawalTxn.ts` | Constructs withdrawal transaction |

### Hooks

| Hook | Purpose |
|------|---------|
| `useMarketTokensData()` | Fetches balances/prices for all GM tokens |
| `useGmMarketsApy()` | Calculates APY per pool |
| `useGmGlvAprSnapshots()` | Historical APR data |
| `useGmWarningState()` | Warning state for deposit/withdrawal |
| `useGmDepositWithdrawalBoxState()` | Form state management |
| `useGmSwapSubmitState()` | Submit button state/validation |
| `useDepositWithdrawalAmounts()` | Calculates output amounts |
| `useDepositWithdrawalFees()` | Fee calculations |
| `useDepositWithdrawalTransactions()` | Transaction construction |

### Metrics

**File:** `src/lib/metrics/utils.ts` (line 535)
- `metricType: "buyGM"` / `"sellGM"` — tracked for analytics

---

## Testnet Plan: UI Rebrand

Rename all user-facing "GM" references while keeping the contract and internal code unchanged.

### Changes Required

**1. Token config** — `sdk/src/configs/tokens.ts`
```diff
- name: "GMX Market tokens",
- symbol: "GM",
+ name: "0xMarkets Pool",
+ symbol: "0xM",
```

**2. Symbol detection** — `GmDepositWithdrawalBox.tsx` (lines 195, 448, 692)
```diff
- firstToken?.symbol === "GM"
+ firstToken?.symbol === "0xM"
```

**3. Operation labels** — `GmSwapBoxHeader.tsx`
```diff
- [Operation.Deposit]: msg`Buy GM`,
- [Operation.Withdrawal]: msg`Sell GM`,
- [Operation.Shift]: msg`Shift GM`,
+ [Operation.Deposit]: msg`Deposit`,
+ [Operation.Withdrawal]: msg`Withdraw`,
+ [Operation.Shift]: msg`Shift`,
```

**4. Pool list buttons** — `GmListItem.tsx`
```diff
- <Trans>Buy GM</Trans>
- <Trans>Sell GM</Trans>
+ <Trans>Deposit</Trans>
+ <Trans>Withdraw</Trans>
```

**5. Status notifications** — `GmStatusNotification.tsx`
```diff
- "Buying GM:"          → "Depositing to"
- "Selling GM"          → "Withdrawing from"
- "buy request"         → "deposit request"
- "sell request"        → "withdrawal request"
- "Buy order executed"  → "Deposit executed"
- "Sell order executed" → "Withdrawal executed"
- "GM token balance"    → "pool balance"
- "GM tokens returned"  → "funds have been returned"
```

**6. Token selector** — `TokenSelector.tsx`
```diff
- name = indexToken.name ? `GM ${indexToken.name}` : name;
+ name = indexToken.name ? `${indexToken.name} Pool` : name;
```

**7. Dashboard** — `AssetDropdown.tsx`
```diff
- `Buy GM: ${marketStat.marketInfo.name}`
+ `Deposit: ${marketStat.marketInfo.name}`
```

**8. Pool details** — `PoolsDetailsHeader.tsx`
```diff
- Shows "GM" for supply
+ Shows "0xM" for supply (or hide token symbol entirely, show USD value)
```

**9. Metrics** — `lib/metrics/utils.ts`
```diff
- metricType: "buyGM" / "sellGM"
+ metricType: "deposit" / "withdraw"
```

### What Stays the Same
- All component file names (`GmSwapBox.tsx`, `GmList.tsx`, etc.) — internal only
- All hook names (`useGmMarketsApy`, etc.) — internal only
- All CSS class names (`.gm-swap-box`, etc.) — internal only
- All domain logic function names — internal only
- Contract interactions — unchanged

---

## Mainnet Plan: Remove GM Token

Replace the ERC-20 receipt token with an internal accounting system so no GM/0xM token exists at all.

### Architecture Change

**Current (GM Token):**
```
User deposits USDC → Contract mints GM ERC-20 → User holds GM in wallet
User withdraws    → Contract burns GM ERC-20 → User receives USDC
Share tracking    → GM token balance / totalSupply
```

**Target (Internal Ledger):**
```
User deposits USDC → Contract records share in mapping → Nothing appears in wallet
User withdraws    → Contract debits share in mapping → User receives USDC
Share tracking    → shares[user][market] / totalShares[market]
```

### Contract Changes Required

#### 1. Replace MarketToken.sol with ShareLedger
```solidity
// New: internal accounting, no ERC-20
contract MarketShareLedger {
    mapping(address => mapping(address => uint256)) public shares; // user → market → shares
    mapping(address => uint256) public totalShares;                // market → total

    function creditShares(address market, address user, uint256 amount) external onlyController;
    function debitShares(address market, address user, uint256 amount) external onlyController;
}
```

#### 2. Update ExecuteDepositUtils.sol
```diff
- MarketToken(payable(_params.market.marketToken)).mint(_params.receiver, mintAmount);
+ shareLedger.creditShares(_params.market.marketToken, _params.receiver, mintAmount);
```

#### 3. Update ExecuteWithdrawalUtils.sol
```diff
- MarketToken(payable(market.marketToken)).burn(address(params.withdrawalVault), amount);
+ shareLedger.debitShares(market.marketToken, withdrawal.account(), amount);
```

User must specify withdrawal amount in shares (or USD, with contract converting).

#### 4. Update MarketUtils.sol
```diff
- function getMarketTokenSupply() → marketToken.totalSupply()
+ function getMarketTokenSupply() → shareLedger.totalShares(market)

- function getMarketTokenPrice() → poolValue / totalSupply()
+ function getMarketTokenPrice() → poolValue / totalShares(market)
```

All pricing formulas remain identical — just the data source changes.

#### 5. Update MarketFactory.sol
No longer deploys MarketToken ERC-20 contracts. Still needs to deploy Bank contracts to hold collateral.

#### 6. Update GLV Layer
GLV currently accepts GM tokens as input. Would need to:
- Accept share references instead of ERC-20 transfers
- Track which GLV owns shares in which markets via the ledger

#### 7. Update Shift Operations
Currently transfers GM tokens between vaults. Would instead debit shares from source market and credit to destination market.

### What You Lose

| Capability | With GM Token | Without |
|-----------|--------------|---------|
| Transfer pool position | Yes (ERC-20 transfer) | No (or custom transfer function) |
| Use as collateral elsewhere | Yes (composable) | No |
| View in wallet | Yes (MetaMask shows it) | No |
| Block explorer visibility | Yes | Query contract directly |
| LP position on DEX | Theoretically possible | Not possible |

### What You Gain

| Benefit | Details |
|---------|---------|
| Simpler UX | No confusing token in wallet |
| Cleaner mental model | "I deposited $500" not "I have 250 tokens" |
| No token approval step | No ERC-20 approve() needed for withdrawals |
| Reduced attack surface | No ERC-20 transfer/approval bugs |

### Risks & Considerations

1. **Full re-audit required** — pool accounting is the most security-critical code
2. **Migration path** — existing testnet GM holders need a migration or fresh start
3. **Withdrawal UX** — without a token balance, how does the user specify "withdraw 50%"? Need a UI showing their share value in USD
4. **Fee accrual unchanged** — pool value math stays the same, just tracked differently
5. **Keeper impact** — keepers that read GM token balances/supply need updates
6. **Subsquid/indexer impact** — currently indexes ERC-20 Transfer events for GM tokens

### Estimated Effort

| Area | Effort | Risk |
|------|--------|------|
| ShareLedger contract | 1-2 weeks | Medium |
| Update Deposit/Withdrawal handlers | 1 week | High |
| Update MarketUtils | 1 week | High |
| Update GLV layer | 1-2 weeks | High |
| Update Shift operations | 3-5 days | Medium |
| Update keepers | 3-5 days | Low |
| Update subsquid indexer | 3-5 days | Low |
| Update frontend | 1 week | Low |
| Testing | 2-3 weeks | — |
| Audit | 4-8 weeks | — |
| **Total** | **~3-5 months** | **High** |

### Alternative: Keep Token, Hide Everything

Instead of removing GM tokens from contracts:
1. Rename on-chain to "0xM" (one-line contract change)
2. Hide all token references in UI (show USD values only)
3. Suppress GM token from MetaMask token list (don't add to token lists)
4. Same user experience as removing it, with 1% of the effort and risk

This is what Aave (aTokens), Compound (cTokens), Lido (stETH), and every major protocol does — the receipt token exists on-chain but users think in USD terms.
