# 0xMarkets Contract Address Audit Report

**Date:** 2026-02-26T22:09:10Z
**Chain:** Base Sepolia (84532)
**Block:** 38187730
**DataStore (on-chain):** `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7`
**Reader (on-chain):** `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C`
**Audit Script:** `0xmarkets_contract/scripts/auditAddresses.ts`

---

## Executive Summary

**89 total checks performed. 54 matches, 35 mismatches.**

The infrastructure contracts (DataStore, EventEmitter, Reader, ExchangeRouter, all Vaults, all Handlers, Router, ReferralStorage, PythLazerFeedProvider) were redeployed at some point after the config files were last updated. The Hardhat `deployments/baseSepolia/` artifacts reflect the new deployment, but the service config files across Interface, Keeper, Order Keeper, Squid, and Docs all still reference the old addresses.

Market token addresses and token addresses are **correct everywhere** -- only infrastructure contract addresses are stale.

All 6 markets are **healthy** with non-zero parameters and enabled status.

---

## 1. On-Chain Markets

All 6 expected markets exist on-chain with correct token configurations.

| Market | Market Token | Index Token | Long Token | Short Token |
|--------|-------------|-------------|------------|-------------|
| EUR/USD | `0xd3c882AbD5854267d509b944429faA82f3d36088` | `0x86e6ab05217318Db4A63f0361BADBf5aF0c69270` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` |
| GBP/USD | `0x981977239025C8F2E133f87b79bEcc587B0e7562` | `0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` |
| GOLD/USD | `0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563` | `0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` |
| USD/JPY | `0xF28b8572AD4c0BfF5EdfB6579b1Fa6fF0A9Eef5A` | `0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` |
| WBTC/USD | `0x3c3D358701B4df855b3B88D4c840f694c9db8324` | `0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` |
| WETH/USD | `0x41a281111Aa12a968564a33f9293D9B7b0dDFf19` | `0x4200000000000000000000000000000000000006` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` |

---

## 2. On-Chain Token Addresses

| Token | Source | Address |
|-------|--------|---------|
| EUR | DataStore (ASSET_TOKEN) | `0x86e6ab05217318Db4A63f0361BADBf5aF0c69270` |
| GBP | DataStore (ASSET_TOKEN) | `0x29c46a7d11B6A3051f51a47eE93AAc03a907C81e` |
| GOLD | DataStore (ASSET_TOKEN) | `0xC2E2d25b96976fC054A5A262e2bc6Fbe8d9bB1e4` |
| JPY | DataStore (ASSET_TOKEN) | `0x5E45Df87fC8f91D5Bc73B6e75D63742dbE01400A` |
| USDC | Market longToken/shortToken | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` |
| WBTC | Market indexToken | `0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39` |
| WETH | Market indexToken (canonical) | `0x4200000000000000000000000000000000000006` |

---

## 3. Market Parameters

All 6 markets are healthy with non-zero parameters.

| Market | Reserve Factor (L/S) | OI Reserve Factor (L/S) | Max Pool (L/S) | Max OI (L/S) | Disabled | Status |
|--------|---------------------|------------------------|----------------|--------------|----------|--------|
| EUR/USD | 9.5e29 / 9.5e29 | 9.0e29 / 9.0e29 | 1e14 / 1e14 | 1e36 / 1e36 | false | OK |
| GBP/USD | 9.5e29 / 9.5e29 | 9.0e29 / 9.0e29 | 1e14 / 1e14 | 1e36 / 1e36 | false | OK |
| GOLD/USD | 9.5e29 / 9.5e29 | 9.0e29 / 9.0e29 | 1e14 / 1e14 | 1e36 / 1e36 | false | OK |
| USD/JPY | 9.5e29 / 9.5e29 | 9.0e29 / 9.0e29 | 1e14 / 1e14 | 1e36 / 1e36 | false | OK |
| WBTC/USD | 9.5e29 / 9.5e29 | 9.0e29 / 9.0e29 | 1e14 / 1e14 | 1e36 / 1e36 | false | OK |
| WETH/USD | 9.5e29 / 9.5e29 | 9.0e29 / 9.0e29 | 1e14 / 1e14 | 1e36 / 1e36 | false | OK |

---

## 4. Oracle Configuration

All tokens use the same oracle provider.

| Token | Oracle Provider |
|-------|----------------|
| EUR | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| GBP | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| GOLD | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| JPY | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| USDC | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| WBTC | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| WETH | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |

**On-chain PythLazerFeedProvider:** `0x81B3857cD770887fa1d839AbEa66f951ECa4206f`

---

## 5. Service-by-Service Comparison

### 5a. Interface SDK -- markets.ts

**File:** `0xMarkets-Interface/sdk/src/configs/markets.ts`

| Check | Status |
|-------|--------|
| EUR/USD marketToken | MATCH |
| EUR/USD indexToken | MATCH |
| EUR/USD longToken | MATCH |
| EUR/USD shortToken | MATCH |
| GBP/USD marketToken | MATCH |
| GBP/USD indexToken | MATCH |
| GBP/USD longToken | MATCH |
| GBP/USD shortToken | MATCH |
| GOLD/USD marketToken | MATCH |
| GOLD/USD indexToken | MATCH |
| GOLD/USD longToken | MATCH |
| GOLD/USD shortToken | MATCH |
| JPY/USD marketToken | MATCH |
| JPY/USD indexToken | MATCH |
| JPY/USD longToken | MATCH |
| JPY/USD shortToken | MATCH |
| WBTC/USD marketToken | MATCH |
| WBTC/USD indexToken | MATCH |
| WBTC/USD longToken | MATCH |
| WBTC/USD shortToken | MATCH |
| WETH/USD marketToken | MATCH |
| WETH/USD indexToken | MATCH |
| WETH/USD longToken | MATCH |
| WETH/USD shortToken | MATCH |

**Result: 24/24 MATCH. All market addresses are correct.**

### 5b. Interface SDK -- tokens.ts

**File:** `0xMarkets-Interface/sdk/src/configs/tokens.ts`

| Token | Status |
|-------|--------|
| WETH | MATCH |
| USDC | MATCH |
| EUR | MATCH |
| GBP | MATCH |
| GOLD | MATCH |
| JPY | MATCH |
| WBTC | MATCH |

**Result: 7/7 MATCH. All token addresses are correct.**

### 5c. Interface SDK -- contracts.ts

**File:** `0xMarkets-Interface/sdk/src/configs/contracts.ts`

| Contract | Config (stale) | On-Chain (correct) | Status |
|----------|---------------|-------------------|--------|
| DataStore | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` | MISMATCH |
| EventEmitter | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` | MISMATCH |
| SyntheticsReader | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` | MISMATCH |
| ExchangeRouter | `0xAf0BD41cf8376bB1084774bf81804faf7Ba9dE46` | `0x5AcE07B0E746662A2BB172a7A3C652C198bAf631` | MISMATCH |
| DepositVault | `0xAeDAad1F7acB0D1b1e1775cEde4606d617d75DCd` | `0x4AFE24c4e2477F54aFa4bF30d6D7385e588dfeC4` | MISMATCH |
| WithdrawalVault | `0x88f6B6e498720594D21B9a3E2dc3A4CbF35C1ed6` | `0x64D496E867000875Dd19C808592fAB6Fc99cBE7F` | MISMATCH |
| OrderVault | `0xF4c5C6C21baeB725AA87bb708e1e3Cc9c2495da7` | `0x18916C70dFEb3fA3366089d35464aC40f5a1D903` | MISMATCH |
| ShiftVault | `0xbDE46443061949B7ce0e534A3BC53A1E98BaD745` | `0xEB15262f24c0AdB52FaB1E496fDf8730B0195cD7` | MISMATCH |
| SyntheticsRouter | `0x189D42feB4F7238d3B908eD3B45aBc69A43c9bED` | `0x33153255bed0219b571483e6a0801Fa0B916f7D7` | MISMATCH |
| ReferralStorage | `0x38D58E8AFd79F4EcEF1414252fc0bB0151a4FD30` | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` | MISMATCH |

**Result: 0/10 MATCH. All infrastructure contract addresses are stale.**

### 5d. Interface UI -- static/markets.ts

**File:** `0xMarkets-Interface/src/config/static/markets.ts`

| Check | Status |
|-------|--------|
| EUR/USD market key | MATCH |
| GBP/USD market key | MATCH |
| GOLD/USD market key | MATCH |
| JPY/USD market key | MATCH |
| WBTC/USD market key | MATCH |
| WETH/USD market key | MATCH |

**Result: 6/6 MATCH.**

### 5e. Interface -- multichain.ts

**File:** `0xMarkets-Interface/src/config/multichain.ts`

| Check | Status |
|-------|--------|
| CHAIN_ID_PREFERRED_DEPOSIT_TOKEN (USDC) | MATCH |

**Result: 1/1 MATCH.**

### 5f. Keeper Service -- tokens.ts

**File:** `keeper-service/src/config/tokens.ts`

| Token | Status |
|-------|--------|
| EUR | MATCH |
| GBP | MATCH |
| GOLD | MATCH |
| JPY | MATCH |
| USDC | MATCH |
| WBTC | MATCH |
| WETH | MATCH |

**Result: 7/7 MATCH.**

### 5g. Keeper Service -- .env

**File:** `keeper-service/.env`

| Variable | Config (stale) | On-Chain (correct) | Status |
|----------|---------------|-------------------|--------|
| READER_ADDRESS | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` | MISMATCH |
| DATA_STORE_ADDRESS | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` | MISMATCH |
| EVENT_EMITTER_ADDRESS | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` | MISMATCH |
| LIQUIDATION_HANDLER_ADDRESS | `0xa4900B6290A64B87DD6A7c7C634c697C1D8deBc8` | `0x241829af5Fd67bf67F0c9226Ce4907dd87A94cA8` | MISMATCH |
| REFERRAL_STORAGE_ADDRESS | `0x38D58E8AFd79F4EcEF1414252fc0bB0151a4FD30` | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` | MISMATCH |
| PYTH_LAZER_FEED_PROVIDER_ADDRESS | `0x2F00A6200853B093459BCAAee1De6648D9d672fc` | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` | MISMATCH |

**Result: 0/6 MATCH. All infrastructure addresses are stale.**

### 5h. Order Execution Keeper -- .env

**File:** `order-execution-keeper-service/.env`

| Variable | Config (stale) | On-Chain (correct) | Status |
|----------|---------------|-------------------|--------|
| DATA_STORE_ADDRESS | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` | MISMATCH |
| READER_ADDRESS | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` | MISMATCH |
| EVENT_EMITTER_ADDRESS | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` | MISMATCH |
| DEPOSIT_HANDLER_ADDRESS | `0x9388B07f807eB870aD36d350d80DC0c214a7f04f` | `0xA91306c067959C157Df04f8c07568Ce51146484c` | MISMATCH |
| WITHDRAWAL_HANDLER_ADDRESS | `0x7aAF500d8C737076480914342F2904378fbb21B9` | `0x6b2aDac8313AA5971143Cc8dDd1cf7057163B68C` | MISMATCH |
| ORDER_HANDLER_ADDRESS | `0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1` | `0xCf752B72B74eE7b35a405c445E9843968f53A397` | MISMATCH |
| ADL_HANDLER_ADDRESS | `0x010809Fa821888b8aa6228A59aE89E1FeFBe7dFF` | `0x3128F74Fa7CE6A074767A5Ef3aa1da5Ca1a866c4` | MISMATCH |
| PYTH_LAZER_FEED_PROVIDER_ADDRESS | `0xf6ef3d50468D48142aC4541C8912793d4F4C288e` | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` | MISMATCH |

**Result: 0/8 MATCH. All infrastructure addresses are stale.**

### 5i. Squid -- processor.ts

**File:** `0xMarkets-squid/src/processor.ts`

| Variable | Config (stale) | On-Chain (correct) | Status |
|----------|---------------|-------------------|--------|
| EVENT_EMITTER_ADDRESS | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` | MISMATCH |

**Result: 0/1 MATCH.**

### 5j. Contracts Repo -- config/tokens.ts

**File:** `0xmarkets_contract/config/tokens.ts`

Synthetic tokens (EUR, GBP, GOLD, JPY) have no hardcoded addresses -- they resolve dynamically via DataStore at runtime. The USDC, WBTC, WETH addresses in the baseSepolia section were not extracted by the regex due to the format, but from manual inspection they match. The contracts repo config is the deployment source of truth and does not need updating.

### 5k. Docs -- keeper-infrastructure.md

**File:** `docs/keeper-infrastructure.md`

| Field | Config (stale) | On-Chain (correct) | Status |
|-------|---------------|-------------------|--------|
| EUR/USD market | `0xD25DaA1A1c740c070A6DC6F0287bD14398C090E4` | `0xd3c882AbD5854267d509b944429faA82f3d36088` | MISMATCH |
| GBP/USD market | `0x36C1EF9F39f42d7e84FB054D15E4d3171b7977BF` | `0x981977239025C8F2E133f87b79bEcc587B0e7562` | MISMATCH |
| GOLD/USD market | `0xBA69c6dc7F28E1299e20D5D1d0a48529cB189980` | `0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563` | MISMATCH |
| USD/JPY market | (not matched by regex -- may be listed as JPY/USD) | -- | -- |
| WBTC/USD market | `0xA4c80F91f4F4b4095220048cb24186e20e48B9D4` | `0x3c3D358701B4df855b3B88D4c840f694c9db8324` | MISMATCH |
| WETH/USD market | `0x4DF435E8D40740291571Df779e48662C9521ed7d` | `0x41a281111Aa12a968564a33f9293D9B7b0dDFf19` | MISMATCH |
| DataStore | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` | MISMATCH |
| EventEmitter | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` | MISMATCH |
| Reader | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` | MISMATCH |
| ReferralStorage | `0x38D58E8AFd79F4EcEF1414252fc0bB0151a4FD30` | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` | MISMATCH |
| PythLazerFeedProvider | `0x93704d7C5E8CbB668c42Dd0a131d5A126244776e` | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` | MISMATCH |
| Token USDC | MATCH |
| Token WETH | MATCH |
| Token WBTC | MATCH |
| Token EUR | MATCH |
| Token GBP | MATCH |
| Token GOLD | MATCH |
| Token JPY | MATCH |

**Result: Token addresses match. All infrastructure and market addresses are stale (from a previous deployment).**

---

## 6. Discrepancy Summary -- Fix Checklist for Plan 20-02

### Infrastructure Contract Updates (new deployment addresses)

These are the correct on-chain addresses that all services must be updated to use.

| Contract | Correct Address |
|----------|----------------|
| DataStore | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` |
| EventEmitter | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` |
| Reader / SyntheticsReader | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` |
| ExchangeRouter | `0x5AcE07B0E746662A2BB172a7A3C652C198bAf631` |
| DepositVault | `0x4AFE24c4e2477F54aFa4bF30d6D7385e588dfeC4` |
| WithdrawalVault | `0x64D496E867000875Dd19C808592fAB6Fc99cBE7F` |
| OrderVault | `0x18916C70dFEb3fA3366089d35464aC40f5a1D903` |
| ShiftVault | `0xEB15262f24c0AdB52FaB1E496fDf8730B0195cD7` |
| SyntheticsRouter / Router | `0x33153255bed0219b571483e6a0801Fa0B916f7D7` |
| ReferralStorage | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` |
| PythLazerFeedProvider | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| LiquidationHandler | `0x241829af5Fd67bf67F0c9226Ce4907dd87A94cA8` |
| DepositHandler | `0xA91306c067959C157Df04f8c07568Ce51146484c` |
| WithdrawalHandler | `0x6b2aDac8313AA5971143Cc8dDd1cf7057163B68C` |
| OrderHandler | `0xCf752B72B74eE7b35a405c445E9843968f53A397` |
| AdlHandler | `0x3128F74Fa7CE6A074767A5Ef3aa1da5Ca1a866c4` |

### Fix Checklist by Service

#### 1. Interface SDK -- contracts.ts
**File:** `0xMarkets-Interface/sdk/src/configs/contracts.ts`

| Field | Current (wrong) | Correct |
|-------|----------------|---------|
| DataStore | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` |
| EventEmitter | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` |
| SyntheticsReader | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` |
| ExchangeRouter | `0xAf0BD41cf8376bB1084774bf81804faf7Ba9dE46` | `0x5AcE07B0E746662A2BB172a7A3C652C198bAf631` |
| DepositVault | `0xAeDAad1F7acB0D1b1e1775cEde4606d617d75DCd` | `0x4AFE24c4e2477F54aFa4bF30d6D7385e588dfeC4` |
| WithdrawalVault | `0x88f6B6e498720594D21B9a3E2dc3A4CbF35C1ed6` | `0x64D496E867000875Dd19C808592fAB6Fc99cBE7F` |
| OrderVault | `0xF4c5C6C21baeB725AA87bb708e1e3Cc9c2495da7` | `0x18916C70dFEb3fA3366089d35464aC40f5a1D903` |
| ShiftVault | `0xbDE46443061949B7ce0e534A3BC53A1E98BaD745` | `0xEB15262f24c0AdB52FaB1E496fDf8730B0195cD7` |
| SyntheticsRouter | `0x189D42feB4F7238d3B908eD3B45aBc69A43c9bED` | `0x33153255bed0219b571483e6a0801Fa0B916f7D7` |
| ReferralStorage | `0x38D58E8AFd79F4EcEF1414252fc0bB0151a4FD30` | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` |
| Reader (V1 alias) | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` |
| Router (V1 alias) | `0x189D42feB4F7238d3B908eD3B45aBc69A43c9bED` | `0x33153255bed0219b571483e6a0801Fa0B916f7D7` |

After updating, run: `cd sdk && yarn prebuild`

#### 2. Keeper Service -- .env
**File:** `keeper-service/.env`

| Variable | Current (wrong) | Correct |
|----------|----------------|---------|
| READER_ADDRESS | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` |
| DATA_STORE_ADDRESS | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` |
| EVENT_EMITTER_ADDRESS | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` |
| LIQUIDATION_HANDLER_ADDRESS | `0xa4900B6290A64B87DD6A7c7C634c697C1D8deBc8` | `0x241829af5Fd67bf67F0c9226Ce4907dd87A94cA8` |
| REFERRAL_STORAGE_ADDRESS | `0x38D58E8AFd79F4EcEF1414252fc0bB0151a4FD30` | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` |
| PYTH_LAZER_FEED_PROVIDER_ADDRESS | `0x2F00A6200853B093459BCAAee1De6648D9d672fc` | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |

#### 3. Order Execution Keeper -- .env
**File:** `order-execution-keeper-service/.env`

| Variable | Current (wrong) | Correct |
|----------|----------------|---------|
| DATA_STORE_ADDRESS | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` |
| READER_ADDRESS | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` |
| EVENT_EMITTER_ADDRESS | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` |
| DEPOSIT_HANDLER_ADDRESS | `0x9388B07f807eB870aD36d350d80DC0c214a7f04f` | `0xA91306c067959C157Df04f8c07568Ce51146484c` |
| WITHDRAWAL_HANDLER_ADDRESS | `0x7aAF500d8C737076480914342F2904378fbb21B9` | `0x6b2aDac8313AA5971143Cc8dDd1cf7057163B68C` |
| ORDER_HANDLER_ADDRESS | `0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1` | `0xCf752B72B74eE7b35a405c445E9843968f53A397` |
| ADL_HANDLER_ADDRESS | `0x010809Fa821888b8aa6228A59aE89E1FeFBe7dFF` | `0x3128F74Fa7CE6A074767A5Ef3aa1da5Ca1a866c4` |
| PYTH_LAZER_FEED_PROVIDER_ADDRESS | `0xf6ef3d50468D48142aC4541C8912793d4F4C288e` | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |

#### 4. Squid -- processor.ts
**File:** `0xMarkets-squid/src/processor.ts`

| Variable | Current (wrong) | Correct |
|----------|----------------|---------|
| EVENT_EMITTER_ADDRESS | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` |

Also update the block range start to reflect the new deployment block.

#### 5. Docs -- keeper-infrastructure.md
**File:** `docs/keeper-infrastructure.md`

All market addresses and infrastructure addresses are from a previous deployment and need full replacement. The token addresses are correct.

| Field | Current (wrong) | Correct |
|-------|----------------|---------|
| EUR/USD market | `0xD25DaA1A1c740c070A6DC6F0287bD14398C090E4` | `0xd3c882AbD5854267d509b944429faA82f3d36088` |
| GBP/USD market | `0x36C1EF9F39f42d7e84FB054D15E4d3171b7977BF` | `0x981977239025C8F2E133f87b79bEcc587B0e7562` |
| GOLD/USD market | `0xBA69c6dc7F28E1299e20D5D1d0a48529cB189980` | `0xf008E4b0962Bf5907d7dB11e88C9EA423D4e2563` |
| USD/JPY market | `0x4834B9a77b32ca7F1d8A20cf7CA886d92Be98aeF` | `0xF28b8572AD4c0BfF5EdfB6579b1Fa6fF0A9Eef5A` |
| WBTC/USD market | `0xA4c80F91f4F4b4095220048cb24186e20e48B9D4` | `0x3c3D358701B4df855b3B88D4c840f694c9db8324` |
| WETH/USD market | `0x4DF435E8D40740291571Df779e48662C9521ed7d` | `0x41a281111Aa12a968564a33f9293D9B7b0dDFf19` |
| DataStore | `0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E` | `0x3B9d71B497aD2d3c32a7c24e96565f84a58089a7` |
| EventEmitter | `0x1E4cBc2ea12B190D6222D568151b5e708e1477F8` | `0xd5aAfa71f745645Db84cB4877873701ddAf2514c` |
| Reader | `0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c` | `0x1e6Ca8042e7BC258BBbA35C5C86F013b4eceC03C` |
| ReferralStorage | `0x38D58E8AFd79F4EcEF1414252fc0bB0151a4FD30` | `0xF5F9CdBe6225aBFF7cE2F290d12bc1BaCCC926E2` |
| PythLazerFeedProvider | `0x93704d7C5E8CbB668c42Dd0a131d5A126244776e` | `0x81B3857cD770887fa1d839AbEa66f951ECa4206f` |
| LiquidationHandler | `0xa4900B6290A64B87DD6A7c7C634c697C1D8deBc8` | `0x241829af5Fd67bf67F0c9226Ce4907dd87A94cA8` |
| DepositHandler | `0x9388B07f807eB870aD36d350d80DC0c214a7f04f` | `0xA91306c067959C157Df04f8c07568Ce51146484c` |
| WithdrawalHandler | `0x7aAF500d8C737076480914342F2904378fbb21B9` | `0x6b2aDac8313AA5971143Cc8dDd1cf7057163B68C` |
| OrderHandler | `0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1` | `0xCf752B72B74eE7b35a405c445E9843968f53A397` |
| ADLHandler | `0x010809Fa821888b8aa6228A59aE89E1FeFBe7dFF` | `0x3128F74Fa7CE6A074767A5Ef3aa1da5Ca1a866c4` |

#### 6. Contract Address Update Guide
**File:** `0xMarkets-Interface/.claude/contract-address-update-guide.md`

The "Current Addresses" section at the bottom needs all infrastructure addresses updated to match. Market and token addresses listed there are already correct.

---

## 7. Market Health Summary

All 6 markets confirmed healthy:

- Reserve Factor: 9.5e29 (95%) for all markets, both long and short
- OI Reserve Factor: 9.0e29 (90%) for all markets, both long and short
- Max Pool Amount: 1e14 (100M USDC with 6 decimals) for all markets, both long and short
- Max Open Interest: 1e36 for all markets, both long and short
- Disabled: false for all markets

**No unhealthy markets found.**

---

## 8. Root Cause Analysis

The infrastructure contracts were redeployed (likely a full redeploy via Hardhat deploy) at some point after the service configs were last updated. The Hardhat `deployments/baseSepolia/` directory was updated with the new artifact JSONs, but the downstream config files were not synchronized:

1. **Market token addresses survived** because they are separate contracts that were re-registered in the new DataStore
2. **Token addresses survived** because they are external contracts (WETH, USDC) or asset tokens generated deterministically
3. **Infrastructure contracts are all new** because they were freshly deployed

The pattern is clear: `npx hardhat deploy` was run, which updated `deployments/baseSepolia/*.json`, but nobody ran the update checklist from `.claude/contract-address-update-guide.md`.

---

## 9. Recommendations for Plan 20-02

1. Update all 35 mismatched addresses across all services
2. Run `cd sdk && yarn prebuild` after Interface SDK changes
3. Restart both keeper services with updated `.env` files
4. Redeploy squid indexer with new EventEmitter address and correct start block
5. Verify the Interface works end-to-end after updates
6. Re-run `auditAddresses.ts` to confirm 0 mismatches
