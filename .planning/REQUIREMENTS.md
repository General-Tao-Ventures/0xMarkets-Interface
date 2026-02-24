# Requirements: 0xMarkets v1.4 Maximum Keeper Speed

**Defined:** 2026-02-24
**Core Value:** All keeper-executed operations complete as fast as possible with proper oracle configuration

## v1.4 Requirements

Requirements for v1.4 release. Each maps to roadmap phases.

### Oracle Correctness

- [ ] **ORCL-01**: Keeper deploys new Pyth Pro API key and verifies per-feed entitlements at startup (exits with clear error if expected feeds receive no data within 10s)
- [ ] **ORCL-02**: Keeper routes oracle params per-token — Lazer for crypto tokens (WETH, WBTC, USDC), Hermes/Chainlink for FX tokens (EUR, GBP, GOLD, JPY) — based on startup entitlement results
- [ ] **ORCL-03**: On-chain `oracleProviderForToken` in DataStore is updated for FX tokens to point to the correct provider (ChainlinkPriceFeedProvider or equivalent)
- [ ] **ORCL-04**: Keeper reads on-chain `oracleProviderForToken` at startup and logs FATAL if any token's configured provider doesn't match keeper's expected provider address

### Execution Speed

- [ ] **SPEED-01**: Keeper uses Flashblocks-enabled RPC endpoint for TX submission, reducing confirmation time from ~2-4s to ~200ms
- [ ] **SPEED-02**: MaxPriceAgeExceeded prevented by increasing safety margin to 30s and reducing background oracle update interval from 10s to 5s
- [ ] **SPEED-03**: Synchronous `updatePriceOnChain()` TX eliminated from normal execution path — background updater keeps prices fresh
- [ ] **SPEED-04**: Per-stage execution timing (detection → oracle params → TX submission → confirmation) logged via `performance.now()` instrumentation

## Future Requirements

Deferred to v2+. Tracked but not in current roadmap.

### Advanced Oracle

- **ADV-01**: Pyth Pro tier upgrade for native FX Lazer feeds (eliminates Hermes fallback)
- **ADV-02**: Oracle cascade fallback — when Lazer cache goes stale per-token, automatically fall back to Hermes for that token only
- **ADV-03**: Custom multicall contract for atomic price-update + execution in single TX

### Infrastructure

- **INFRA-01**: Multi-wallet parallel execution for higher throughput
- **INFRA-02**: Background update interval below 3s (requires nonce pressure testing)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pyth Pro $10k tier upgrade | Hermes adequate for testnet FX volume |
| Multi-wallet parallel execution | Single wallet sufficient at current volume |
| Custom PythHermesFeedProvider contract | Only needed if Chainlink FX feeds absent on Base Sepolia — check first |
| Mainnet deployment | Testnet-first strategy unchanged |
| New market additions | Focus on making existing 6 markets fast and reliable |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORCL-01 | — | Pending |
| ORCL-02 | — | Pending |
| ORCL-03 | — | Pending |
| ORCL-04 | — | Pending |
| SPEED-01 | — | Pending |
| SPEED-02 | — | Pending |
| SPEED-03 | — | Pending |
| SPEED-04 | — | Pending |

**Coverage:**
- v1.4 requirements: 8 total
- Mapped to phases: 0
- Unmapped: 8 ⚠️

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
