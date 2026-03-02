# 0xMarkets Contract Addresses

> Source of truth for all deployed contract addresses.
> **Chain:** Base Sepolia (84532)
> **Last Updated:** 2026-03-01

---

## Tokens

| Token | Address | Decimals | Notes |
|-------|---------|----------|-------|
| ETH (Native) | `0x0000000000000000000000000000000000000000` | 18 | |
| WETH | `0x4200000000000000000000000000000000000006` | 18 | Canonical Base WETH |
| USDC (mUSDC) | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | 6 | Mock USDC on testnet |
| EUR | `0x86e6ab05217318Db4A63f0361BADBf5aF0c69270` | 6 | Synthetic |
| GBP | `0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e` | 6 | Synthetic |
| GOLD | `0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4` | 6 | Synthetic |
| JPY | `0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A` | 6 | Synthetic |
| WBTC | `0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39` | 8 | |

---

## Markets

All markets use USDC as both long and short token.

| Market | Address | Index Token |
|--------|---------|-------------|
| EUR/USD | `0xd3c882AbD5854267d509b944429faA82f3d36088` | EUR |
| GBP/USD | `0x981977239025C8F2E133f87b79bEcc587B0e7562` | GBP |
| GOLD/USD | `0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563` | GOLD |
| USD/JPY | `0xF28b8572AD4c0BfF5EdfB6579b1Fa6fF0A9Eef5A` | JPY (inverted) |
| WBTC/USD | `0x3c3D358701B4df855b3B88D4c840f694c9db8324` | WBTC |
| WETH/USD | `0x41a281111Aa12a968564a33f9293D9B7b0dDFf19` | WETH |

---

## Core Infrastructure

| Contract | Address |
|----------|---------|
| DataStore | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` |
| EventEmitter | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` |
| ExchangeRouter | `0xF98622Ff9Dfd6bC7877EB0653cbE1bA7dCC54321` |
| SyntheticsRouter | `0x33153255bed0219b571483e6a0801Fa0B916f7D7` |
| SyntheticsReader | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` |
| SubaccountRouter | `0x733FC820632de04Ff901E2664d208401c4E71A6e` |
| Multicall | `0x922ac746Eda42e1ce6989e5B964638C96dc753c7` |
| Timelock | `0xc59f83749Ab34e45a2b29fbd533266E3d7209FE5` |
| GovToken | `0x8430dE0bAD0f2F58B56304ef708d934dFB8aeF3F` |
| ExternalHandler | `0xd56529c954f29620DAA2dB23F4dB45506254A2b0` |
| ReferralStorage | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` |

---

## Vaults

| Contract | Address |
|----------|---------|
| DepositVault | `0x4AFE24c4e2477F54aFa4bF30d6D7385e588dfeC4` |
| WithdrawalVault | `0x64D496E867000875Dd19C808592fAB6Fc99cBE7F` |
| OrderVault | `0x18916C70dFEb3fA3366089d35464aC40f5a1D903` |
| ShiftVault | `0xEB15262f24c0AdB52FaB1E496fDf8730B0195cD7` |

---

## Execution Handlers

Used by keeper services to execute queued requests.

| Contract | Address |
|----------|---------|
| DepositHandler | `0xA91306c067959C157Df04f8c07568Ce51146484c` |
| WithdrawalHandler | `0x6b2aDac8313AA5971143Cc8dDd1cf7057163B68C` |
| OrderHandler | `0x63dE8c596687EA9C752a9b7548Bc02360d3d04Ad` |
| AdlHandler | `0x3128F74Fa7CE6A074767A5Ef3aa1da5Ca1a866c4` |
| LiquidationHandler | `0x241829af5Fd67bf67F0c9226Ce4907dd87A94cA8` |

---

## Oracle Providers

| Contract | Address | Notes |
|----------|---------|-------|
| PythLazerFeedProvider | `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05` | Pyth Lazer V2 (primary) |
| PythHermesFeedProvider | `0x3ed0BA3E33602bd5AC4fD9F6D3a292F15753da4a` | Pyth Hermes |
| Active Oracle Provider | `0xc5810FC1932e44866bD0D041FbfB08d8AC2A67d6` | Registered in DataStore |
| ChainlinkPriceFeedProvider | `0xA861Ea7fEc99F19C5fD9872679CeDb965d80c391` | |

### Pyth Lazer Feed IDs

| Asset | Feed ID |
|-------|---------|
| USDC | 7 |
| WBTC | 1 |
| WETH | 2 |
| EUR | 327 |
| GBP | 333 |
| GOLD (XAU) | 346 |
| JPY | 340 (inverted) |

---

## GLV (Generalized Liquidity Vault)

| Contract | Address |
|----------|---------|
| GlvReader | `0x838a9822868ddAF0951e2474c575b8632835776A` |
| GlvRouter | `0xEf4cB87df8050cD98237aF174F4b7972972a114F` |
| GlvVault | `0x1c1427d9B8a6C3B419f686A070F4612689B276f7` |

---

## Gelato Relay

| Contract | Address |
|----------|---------|
| GelatoRelayRouter | `0xeFa1Af575d9Fe55c71CE83f5D03B075bf62a60Ef` |
| SubaccountGelatoRelayRouter | `0xba091449600a69fC351F50988B22679ADeB63F28` |

---

## Squid Indexer

- **EventEmitter:** `0xd5aAfa71f745645Db84cB4877873701ddAf2514c`
- **Start Block:** 19,000,000
- **EventLog1 Topic:** `0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160`
- **EventLog2 Topic:** `0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5`

---

## Where Addresses Live in Code

| Service | Files |
|---------|-------|
| Interface SDK | `sdk/src/configs/contracts.ts`, `tokens.ts`, `markets.ts` |
| Interface Frontend | `src/config/static/markets.ts`, `src/config/multichain.ts` |
| Keeper Service | `keeper-service/src/config/tokens.ts`, `.env` |
| Order Execution Keeper | `order-execution-keeper-service/.env` |
| Squid Indexer | `0xMarkets-squid/src/processor.ts` |
| Contracts Repo | `0xmarkets_contract/config/tokens.ts`, `config/markets.ts` |

When updating addresses, follow the procedure in `.claude/contract-address-update-guide.md` in the Interface repo.
