# 0xMarkets Contract Addresses

> Source of truth for all deployed contract addresses.
> **Chain:** Base Sepolia (84532)
> **Last Updated:** 2026-03-10

---

## Key Wallets

| Role | Address |
|------|---------|
| Deployer | `0x9724251d7DeC79FB5C41F31b2793892831Bf1200` |
| Keeper | `0x48Cb0d738C9B3F44F60f7338F788fa093FD25828` |

---

## Tokens

| Token | Address | Decimals | Notes |
|-------|---------|----------|-------|
| ETH (Native) | `0x0000000000000000000000000000000000000000` | 18 | |
| WETH | `0x4200000000000000000000000000000000000006` | 18 | Canonical Base WETH |
| USD0 | `0x3ae4474579d24a743c9016F017e76185A834d837` | 6 | Stablecoin (replaces mUSDC) |
| USDC (mUSDC) | `0xFDDFE40Ade3eE9aDE4A2e185C750cf28025BFd6b` | 6 | Legacy — deprecated |
| WBTC | `0xD8a6E3FCA403d79b6AD6216b60527F51cc967D39` | 8 | |
| EUR | `0x18909CC26672376e8FDF1fa54Fc5B892dd6E2b0C` | 6 | Synthetic |
| GBP | `0xf7255EAb2968Fb6B8b6226eB25c6EDC2F1CcE60a` | 6 | Synthetic |
| GOLD | `0xf4ac308123764edFB7453a7446D01277D7DEa1A7` | 6 | Synthetic |
| JPY | `0x7836DF766375f02D71fa3617F5F06a0712699A81` | 6 | Synthetic |
| WTI | `0x4B4A8E5a0deEC8611e647255425eC68A846046d4` | 6 | Synthetic |

---

## Markets (USD0)

All markets use USD0 as both long and short token.

| Market | Address | Index Token |
|--------|---------|-------------|
| EUR/USD | `0x7054eb596aCF4fC1C0686C9B2cdAC4aE6c6D0F33` | EUR |
| GBP/USD | `0xa09b59adf15B4ED98a099441b84Ff1eABf71B548` | GBP |
| GOLD/USD | `0x89c3B33bEE4b9cD1B246BE44aDcEd870F74637a3` | GOLD |
| USD/JPY | `0xD847a999faCe1f862120117C33ae8faBA768fD4b` | JPY (inverted) |
| WTI/USD | `0x80d260188c592F7F175F843EDc257b6A6Af6e5eF` | WTI |
| WBTC/USD | `0x63D05Da932541380df8d9eE20D8FdB4B02849398` | WBTC |
| WETH/USD | `0x23F40e3279685413b252A6944AF9a0641D3aa6ce` | WETH |

---

## Core Infrastructure

| Contract | Address |
|----------|---------|
| RoleStore | `0xa5fCcD8Eba314B08cF6f637C390f78693Eb1289C` |
| DataStore | `0x0cA7D71845cb485B7593bBdCbcac93d82d52d053` |
| EventEmitter | `0x68001935Ec7C2e3980f99435db3CabC89dea602B` |
| Config | `0x594e013698175DC6265A8777F34aD2b7a242c80B` |
| ExchangeRouter | `0xB326e9903271766F2eb0CcCd7180c73985d373aA` |
| SyntheticsRouter | `0xE92B08345125dc77eB071d1a2D513751C4D22714` |
| SyntheticsReader | `0x4debCC0Cf123529C2a42beC0F8027B03DB1a8b9e` |
| SubaccountRouter | `0xE0b283Aa82c47970472153A139b50B108F6F2357` |
| Multicall | `0xdD6E2999d0a882886A50c031c7a117058B4aCB5f` |
| Timelock | `0x461B737B685cd9cF68f9735792d7d0035B7AD68E` |
| GovToken | `0xA24dff4D381f97e9cb4DA7fb7b50505390cda522` |
| ExternalHandler | `0xfcD54e4D5ECA91abbB18CA9429369617730F4395` |
| ReferralStorage | `0x29D5533a26ac87C28972d277CEFf2EC00843c5A7` |
| FeeHandler | `0xe6012FD0C1B0c9f10CBAFcD2e7A8Bf69FB8BBd4A` |

---

## Vaults

| Contract | Address |
|----------|---------|
| DepositVault | `0x590d1d8e50A3a3d9F3448657D1Cb64D486978781` |
| WithdrawalVault | `0xE47130E74CAEd3Cae1Bf2c7e1e0af0B592354b57` |
| OrderVault | `0x76DE02F06979a24A87F2cD743Ab533a44EdcFb08` |
| ShiftVault | `0xEF60117684991C41dea18de53446c437462d07cc` |

---

## Execution Handlers

Used by keeper services to execute queued requests.

| Contract | Address |
|----------|---------|
| DepositHandler | `0xf4De4813DAB11b04c8B3468E54efBf0b10f218a1` |
| WithdrawalHandler | `0x2C08e7fb93b56f860d594e6e98A9eC146AbeFE01` |
| OrderHandler | `0x1E647C168325856A7e677770fAbA10ba9e02fcca` |
| AdlHandler | `0x03952462115cfF030FE9D79803442204CCd4b4e1` |
| LiquidationHandler | `0x46443405875fdFb2C87FB814ddcA2108884b3Bf4` |

---

## Oracle

| Contract | Address | Notes |
|----------|---------|-------|
| Oracle | `0x03F2a8b7D07D937a0568459a0a1299E4d2BECFAA` | |
| OracleStore | `0xeC8a60bFCF09f6788AE8c639E4A8a073f9D12512` | |
| PythLazerFeedProvider | `0x31060bBaD18D4a13Db2e66eD7b562968e93f1312` | Primary oracle provider |
| PythHermesFeedProvider | `0x75bB00982A8855C5469A5B08D16422C0316d9f9c` | |
| ChainlinkPriceFeedProvider | `0xe0A7f2a21373128DB38b55a6FEb081C6BCDCC22E` | |
| PythLazer (verifier) | `0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05` | |

### Pyth Lazer Feed IDs

| Asset | Feed ID |
|-------|---------|
| USD0 | 7 (USDC/USD — 1:1 peg) |
| WBTC | 1 |
| WETH | 2 |
| EUR | 327 |
| GBP | 333 |
| GOLD (XAU) | 346 |
| JPY | 340 (inverted) |
| WTI (USOILSPOT) | 657 |

---

## GLV (Generalized Liquidity Vault)

| Contract | Address |
|----------|---------|
| GlvReader | `0x903B6F1a02DD2eF528E00c5EE66942B2F4593fF1` |
| GlvRouter | `0xD2434Ea53F0b46200542d7CE886481D3cd07ACb3` |
| GlvVault | `0x5fEb1eF511E953dec5E016bFF32F8987cE6eD33a` |

---

## Gelato Relay

| Contract | Address |
|----------|---------|
| GelatoRelayRouter | `0x88640FBD9aBfEE38D422B47Cb6Be410515d9C431` |
| SubaccountGelatoRelayRouter | `0x9c882295c1E692Ecac7CcAd79A285a3e738ee741` |

---

## Faucet

| Contract | Address |
|----------|---------|
| Faucet | `0xdb5a4eef82ca1f2b5259b6863c68b88f7ecab853` |

---

## Squid Indexer

- **EventEmitter:** `0x68001935Ec7C2e3980f99435db3CabC89dea602B`
- **Start Block:** 38,654,000
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
