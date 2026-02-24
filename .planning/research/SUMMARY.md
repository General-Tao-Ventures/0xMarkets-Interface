# Project Research Summary

**Project:** 0xMarkets v1.4 — Maximum Keeper Speed with Dual Oracle Configuration
**Domain:** DeFi perpetual futures keeper — oracle routing, on-chain provider registration, execution latency optimization
**Researched:** 2026-02-24
**Confidence:** MEDIUM-HIGH (stack/architecture HIGH from direct codebase analysis; Pyth entitlement model MEDIUM due to sparse official documentation)

## Executive Summary

This milestone addresses two related but distinct problems in the order-execution-keeper-service. The first is a correctness failure: FX markets (EUR, GBP, JPY, GOLD) cannot execute at all because the on-chain `oracleProviderForToken` mapping sets ALL tokens to PythLazerFeedProvider, but the current Pyth Pro API key has crypto-only entitlements. Every FX execution reverts with `InvalidOracleProvider (0x05d102a2)`. The second problem is a speed problem: even working crypto markets execute in 5-10 seconds due to synchronous oracle price update transactions, conservative background update intervals, and slow RPC block confirmation times. Both problems must be solved together because the solution to correctness — per-token oracle routing — is also the foundation for the speed optimizations.

The recommended approach is a three-layer fix. First, deploy and verify the new Pyth Pro API key (`QpxMy21OMvC7rap9hYxJ6GB0eb3PdOEs2WvmG0XN`) to confirm empirically which feeds actually receive data at startup. If the key has crypto-only entitlements (which its label and the existing code comments strongly suggest), implement per-token oracle routing in `buildOracleParams()`: Lazer for crypto tokens, Hermes via ChainlinkPriceFeedProvider for FX tokens. This requires a one-time admin script to update `oracleProviderForToken` in the DataStore for FX tokens, plus a startup consistency check to catch any future mismatches before they cause hours of cryptic debugging. Second, optimize crypto market speed by switching to a Flashblocks-enabled RPC (single env var change saving ~1.8s per TX confirmation) and reducing the background oracle update interval from 10s to 5s (eliminating the synchronous `updatePriceOnChain()` fallback from the normal execution path). Third, add execution pipeline observability — per-stage timing and per-feed health status — to measure the actual latency improvement.

The critical external dependency is Pyth entitlement verification: if the new key covers FX feeds, the architecture simplifies dramatically (all tokens via Lazer, no Hermes routing needed). This must be verified empirically before committing to the dual-oracle architecture. Separately, if Chainlink price feeds do not exist on Base Sepolia for FX pairs, the ChainlinkPriceFeedProvider cannot serve as the Hermes-equivalent on-chain provider, which would require deploying a custom PythHermesFeedProvider Solidity contract. Both unknowns must be resolved as the first implementation steps, not during planning.

## Key Findings

### Recommended Stack

No new packages are required for v1.4. The existing stack (viem 2.44.4, @pythnetwork/pyth-lazer-sdk 5.2.1, @pythnetwork/hermes-client 2.1.0, Prisma, Express, PostgreSQL) is sufficient for all goals. Changes are configuration and routing logic only.

**Core technologies:**
- **viem 2.44.4**: Blockchain interaction, TX submission, on-chain DataStore reads — stay on current version; 2.46.3 is available but upgrade adds unnecessary risk during feature work
- **@pythnetwork/pyth-lazer-sdk 5.2.1**: WebSocket streaming binary price feeds for crypto tokens — do NOT upgrade to 6.0.0 (major version bump, released 2 days ago, breaking changes)
- **@pythnetwork/hermes-client 2.1.0**: REST HTTP price feeds for FX/commodity tokens as fallback — do NOT upgrade to 3.1.0 (major version bump)
- **ChainlinkPriceFeedProvider**: Already deployed on Base Sepolia — candidate on-chain provider for FX tokens if Chainlink FX feeds exist; needs validation before relying on it
- **Flashblocks RPC** (Alchemy or Chainstack, Base Sepolia): Reduces TX confirmation from 2-4s to ~200ms; single env var change, no code required

**New configuration (no new packages):**
- `CHAINLINK_PRICE_FEED_PROVIDER_ADDRESS` — address from `deployments/baseSepolia/ChainlinkPriceFeedProvider.json`
- `ORACLE_MODE=dual` — signals per-token routing instead of global mode
- Flashblocks-enabled `RPC_URL` — highest ROI single change in the entire milestone

### Expected Features

**Must have (table stakes — correctness failures that block FX markets entirely):**
- **Pyth Pro API key deployment with startup entitlement verification** — current key has zero entitlements for any feed; new key needs per-feed empirical validation via local test script before production deployment
- **Per-market oracle mode selection (Lazer for crypto, Hermes for FX)** — core feature of v1.4; `buildOracleParams()` currently uses global mode, must route per-token based on actual Lazer feed data availability
- **On-chain oracle provider registration for FX tokens** — `oracleProviderForToken` in DataStore must point to the correct provider per token; currently ALL tokens point to PythLazerFeedProvider, causing FX reverts; requires one-time admin script
- **MaxPriceAgeExceeded prevention** — increase safety margin from 5s to 30s; reduce `BG_UPDATE_INTERVAL_MS` from 10s to 5s

**Should have (speed differentiators — make fast markets faster):**
- **Flashblocks-enabled RPC** — 15-minute env var change, saves ~1.8s per TX confirmation, highest ROI change in the milestone
- **Eliminate synchronous `updatePriceOnChain()` TX** — if background updates run at 5s interval, synchronous fallback effectively never fires; saves 2-4s per execution
- **Startup oracle provider consistency verification** — read `oracleProviderForToken` from DataStore at startup, compare against keeper config, log FATAL on mismatch
- **Oracle cascade fallback (Lazer -> Hermes per-token)** — when Lazer cache goes stale for a specific token, fall back to Hermes for that token only; prevents Lazer outage from blocking all executions

**Defer to v2+:**
- Pyth Pro tier upgrade ($10k/mo) for native FX Lazer feeds — Hermes is adequate for testnet FX volume at ~400ms latency
- Custom multicall contract for atomic price-update + execution — background updater already handles this when tuned correctly
- Multi-wallet parallel execution — single wallet sequential model works; parallelism requires nonce management complexity not justified at current volume
- Background update interval below 3s — creates nonce pressure with single wallet even with Flashblocks

### Architecture Approach

The system has a mature v1.3 pipeline: event-driven detection via WebSocket EventListener, an `ExecutionQueue` for sequential processing, a `drainQueue` loop that coordinates nonce access between background oracle updates and execution TXs. The v1.4 architecture adds a **per-token oracle route map** built at startup through entitlement verification, then used in `buildOracleParams()` to select the correct provider per token. Mixed providers within the same oracle params array are fully supported by Oracle.sol — each `tokens[i]` / `providers[i]` / `data[i]` index is validated independently against DataStore, enabling EUR+USDC withdrawal oracle params to carry Hermes provider for EUR and Lazer provider for USDC in the same call.

**Major components:**
1. **OracleRouteMap** (new, `core/oracle/routeMap.ts`) — maps each token address to its oracle provider (Lazer or Hermes) and the corresponding on-chain provider contract address; built once at startup, read on every execution
2. **StartupVerifier** (new, `core/oracle/startupVerifier.ts`) — waits 10s after Lazer WebSocket connect, checks which feeds actually received data, builds the route map, then verifies on-chain DataStore consistency per-token; logs FATAL on any mismatch
3. **BaseExecutor.buildOracleParams()** (modified) — consumes OracleRouteMap for per-token provider selection instead of global `config.oracleMode`; for Lazer-routed tokens: check freshness + skip synchronous update if fresh; for Hermes-routed tokens: pass `ChainlinkPriceFeedProvider` address with empty data (provider reads Chainlink on-chain, no keeper-side price push needed)
4. **PythLazerOracleService.triggerBackgroundUpdate()** (modified) — skips background update TXs for Hermes-routed tokens (no Lazer cache data; sending update TXs for them wastes gas and nonces)
5. **Admin script in contracts repo** (new, one-time) — `register-hermes-provider-for-fx.ts` updates `oracleProviderForToken` in DataStore for FX tokens via viem; only needed if Lazer entitlements do not cover FX

**Unchanged components:** `ExecutionQueue`, `EventListener`, `DepositExecutor`/`OrderExecutor`/`WithdrawalExecutor` (they call `buildOracleParams()` which handles routing internally), `PythOracleService` (Hermes, API unchanged), `healthState.ts`, `latencyTracker.ts`, `transactionMonitor.ts`.

### Critical Pitfalls

1. **Oracle provider mismatch between keeper config and on-chain DataStore** — Every execution reverts with `InvalidOracleProvider (0x05d102a2)`. Prevention: startup consistency check reads `oracleProviderForToken` from DataStore for every token and compares against keeper's expected provider; FATAL log on mismatch. Never change `ORACLE_MODE` without updating on-chain config first. This has already happened in production.

2. **"Both" mode sends Hermes-format oracle params for tokens registered with Lazer provider on-chain** — `buildOracleParams()` in "both" mode updates Lazer prices on-chain, then returns Hermes-style params with `pythContractAddress` as provider. If on-chain `oracleProviderForToken` is PythLazerFeedProvider, every execution rejects. Prevention: eliminate global "both" mode; use per-token route map where each token independently routes to its correct provider.

3. **Pyth Pro API key with wrong asset class entitlements** — WebSocket connects successfully but FX feeds receive no data silently. This has already happened — the commented-out FX feeds in `tokens.ts` include the note "key entitled for [crypto, index, nav, crypto-redemption-rate] only." Prevention: verify ALL 7 feed IDs locally with a standalone test script before any routing code is written; the result determines whether the dual-oracle architecture is needed at all.

4. **MaxPriceAgeExceeded from race between freshness check and TX mining** — `isStoredPriceFresh()` uses only a 5s safety margin. Gas estimation + submission + block inclusion typically takes 10-30s, making a "fresh" price stale before execution completes. Prevention: increase safety margin to 30s; reduce `BG_UPDATE_INTERVAL_MS` from 10s to 5s; with Flashblocks, the confirmation wait drops to ~200ms, which also helps.

5. **Nonce collision between background oracle updates and execution TXs** — Coordination via disable/enable has a race window where in-flight background TXs and execution TXs compete for nonces. Prevention: reduce `drainQueue` background wait from 5s to 1s maximum; log every nonce conflict with source to measure frequency; if frequent, implement proper nonce manager with mutex.

## Implications for Roadmap

Based on combined research findings, two clean phases with a clear dependency boundary.

### Phase 1: Oracle Correctness (Fix Broken FX Markets)

**Rationale:** Every other improvement depends on the keeper executing ALL markets without reverts. FX market failures are deterministic and 100% reproducible — no amount of speed optimization fixes them. The correctness work gates the speed work.

**Delivers:**
- All 7 tokens execute successfully (WETH, WBTC, USDC via Lazer; EUR, GBP, GOLD, JPY via Hermes or all via Lazer if entitlements confirmed)
- Startup consistency check that surfaces provider mismatches immediately instead of after hours of cryptic debugging
- Per-token oracle routing in `buildOracleParams()` handling mixed-provider operations in a single execution call

**Addresses from FEATURES.md:** Pyth Pro API key deployment + startup entitlement verification, per-market oracle mode selection, on-chain oracle provider registration for FX tokens, startup oracle provider consistency check

**Avoids from PITFALLS.md:** Pitfall 1 (oracle provider mismatch — startup verifier), Pitfall 2 (per-market routing inconsistency — per-token route map), Pitfall 3 (wrong API key entitlements — empirical verification first), Pitfall 6 ("both" mode confusion — eliminate global mode), Pitfall 10 (wrong deploy script order — combined setup checklist), Pitfall 11 (OracleProvider type gap — add `"pythLazerFeed" | "pythHermes"` to type)

**Implementation gate:** Verify Lazer entitlements for all 7 feeds FIRST. If all feeds have data, Phase 1 collapses to: deploy API key + startup verification + uncomment FX feeds in `tokens.ts`. If FX lacks entitlements (the more likely case), Phase 1 requires: per-token route map + on-chain admin script + `buildOracleParams()` refactor.

### Phase 2: Execution Speed Optimization

**Rationale:** Once all markets execute correctly, speed improvements are independent configuration and tuning changes. Flashblocks RPC is a single env var change. Background interval tuning is a constant change. Both are low-risk but should wait until Phase 1 is stable to get clean latency measurements.

**Delivers:**
- Crypto market execution reduced from ~5-10s to ~3-4s end-to-end
- FX market execution comparable to crypto (Chainlink on-chain reads have no keeper-side latency)
- Synchronous `updatePriceOnChain()` TX eliminated from normal execution path (background updater keeps prices fresh)
- Per-stage execution timing logs via `performance.now()` instrumentation
- Oracle cascade fallback for Lazer outage resilience

**Uses from STACK.md:** Flashblocks-enabled RPC (Alchemy or Chainstack), `performance.now()` Node.js built-in instrumentation

**Implements from ARCHITECTURE.md:** Reduce `BG_UPDATE_INTERVAL_MS` 10s -> 5s, reduce `drainQueue` background wait 5s -> 1s, pre-fetch operation data for event-sourced items (parallel with background wait), market data `Map` cache, oracle cascade fallback per-token

**Avoids from PITFALLS.md:** Pitfall 4 (MaxPriceAgeExceeded — 30s safety margin + tighter updates), Pitfall 5 (nonce collision — measure frequency first, reduce wait window, log conflicts), Pitfall 9 (silent Lazer WebSocket disconnect — per-token cache age check, Hermes fallback on stale), Pitfall 12 (REQUEST_EXPIRATION_TIME masking slow execution — reduce to realistic mainnet value for validation), Pitfall 13 (10s staleness at execution time — 5s interval eliminates the gap)

### Phase Ordering Rationale

- Phase 1 before Phase 2 because speed tuning on a partially-broken system produces misleading measurements and wastes debugging time
- Flashblocks RPC placed in Phase 2 because it only reduces confirmation wait — it does not fix the correctness failures in Phase 1
- On-chain admin script for FX provider registration belongs at the END of Phase 1 (it is the final unlock before FX markets work); speed optimizations are independent and belong in Phase 2
- Per-market latency tracking is a Phase 2 output, not an input — build it after routing works to measure the improvement, not before

### Research Flags

**Needs empirical validation before writing code (not research-phase, but validate-first):**
- **Phase 1, first step — Pyth entitlement verification:** Run the local feed verification script (subscribe to all 7 feed IDs, check which receive data after 10s); result determines whether dual-oracle architecture is needed or all tokens can use Lazer
- **Phase 1, before on-chain admin script — ChainlinkPriceFeedProvider compatibility:** Run `printOracleConfig.ts` to read current on-chain state; check Chainlink's Base Sepolia feed registry for EUR/USD, GBP/USD, XAU/USD, JPY/USD; if feeds are absent, a custom `PythHermesFeedProvider` contract is needed instead

**Standard patterns (well-documented, skip deeper research):**
- **Phase 1, on-chain admin script:** `initOracleConfigForTokens.ts` pattern already implemented in contracts repo; follow existing scripts exactly
- **Phase 2, Flashblocks RPC:** Single env var change; no research needed
- **Phase 2, background interval tuning:** Constant change in one file; well-understood trade-off
- **Phase 2, market data caching:** Standard `Map`-based cache pattern; no research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Full codebase analysis; all dependencies are existing packages; no new installs needed; SDK version decisions are conservative and well-justified |
| Features | MEDIUM | Table stakes and differentiators well-defined from codebase; Pyth entitlement tier model (Crypto vs Pro) has LOW confidence from external docs and requires empirical validation |
| Architecture | HIGH | Full analysis of Oracle.sol per-token validation logic, `buildOracleParams()` implementation (lines 202-291), and on-chain provider contract structure; per-token mixed-provider params are unambiguously supported |
| Pitfalls | HIGH | Most pitfalls derived from actual observed failures: commented-out FX feeds with entitlement note, existing retry logic (evidence of past nonce conflicts), documented `MaxPriceAgeExceeded` in PROJECT.md |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Chainlink FX feed availability on Base Sepolia:** Unknown whether EUR/USD, GBP/USD, XAU/USD, JPY/USD Chainlink feeds are deployed on Base Sepolia. If absent, `ChainlinkPriceFeedProvider` cannot serve FX tokens and a custom `PythHermesFeedProvider` Solidity contract is needed. Resolution: check Chainlink Base Sepolia feed registry in Phase 1 before writing any routing code. If absent, fallback plan is a minimal `PythHermesFeedProvider` implementing `IOracleProvider` that reads from the Pyth contract.

- **Pyth Pro API key exact entitlements:** The key label ("crypto account") and the existing code comment ("key entitled for [crypto, index, nav, crypto-redemption-rate] only") strongly suggest crypto-only coverage. But this has not been confirmed with the Pyth Data Distributor. Resolution: run local feed verification script in Phase 1, Step 1. Contact Pyth team if FX entitlements are needed and not present.

- **"Both" mode oracle params provider address:** Research confirmed that "both" mode returns Hermes-format params (not Lazer-format), incompatible with Lazer-registered tokens on-chain. The exact provider address sent in "both" mode was not definitively traced. Resolution: check `baseExecutor.ts` lines 259-273 at implementation time to confirm the exact address before writing the per-token routing replacement.

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `order-execution-keeper-service/src/core/executors/baseExecutor.ts` — `buildOracleParams()`, `isStoredPriceFresh()`, nonce handling
- `order-execution-keeper-service/src/core/oracle/pythLazerOracle.ts` — WebSocket pool config, background updates, cache freshness thresholds
- `order-execution-keeper-service/src/core/oracle/pythOracle.ts` — Hermes provider integration
- `order-execution-keeper-service/src/config/tokens.ts` — Feed configs, commented-out FX feeds with entitlement note
- `order-execution-keeper-service/src/index.ts` — Startup sequence, `drainQueue` nonce coordination
- `0xmarkets_contract/contracts/oracle/Oracle.sol` — Per-token provider validation (lines 250-280)
- `0xmarkets_contract/contracts/oracle/PythLazerFeedProvider.sol` — On-chain stored price model
- `0xmarkets_contract/contracts/oracle/ChainlinkPriceFeedProvider.sol` — On-chain price feed reader
- `0xmarkets_contract/deploy/configureOracleTokens.ts` — Default provider = pythLazerFeed for ALL tokens
- `0xmarkets_contract/config/tokens.ts` — Per-token feed IDs, decimals (8 for crypto, 5 for FX, 3 for commodity), inverted flags
- `0xmarkets_contract/config/oracle.ts` — maxOraclePriceAge = 300s
- `.planning/phases/13-production-lazer-deployment-and-keeper-optimization/13-RESEARCH.md` — Prior debugging: error selectors `0x05d102a2` and `0x68b49e6c`, entitlement analysis

### Secondary (MEDIUM confidence — official documentation)
- [Pyth Pro Getting Started](https://docs.pyth.network/price-feeds/pro/getting-started) — API key setup, WebSocket subscription model
- [Pyth Pro Price Feed IDs](https://docs.pyth.network/price-feeds/pro/price-feed-ids) — Feed ID catalog (BTC=1, ETH=2, USDC=7, EUR=327, GBP=333, GOLD=346, JPY=340)
- [Pyth Best Practices](https://docs.pyth.network/price-feeds/core/best-practices) — `MaxPriceAge` guidance, staleness checks
- [Base Flashblocks documentation](https://docs.base.org/base-chain/flashblocks/apps) — 200ms preconfirmations, supported RPC providers
- [Chainstack Flashblocks on Base](https://chainstack.com/flashblocks-base-rpc/) — Base Sepolia Flashblocks support confirmed
- [GMX Synthetics Oracle.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/oracle/Oracle.sol) — Oracle provider validation reference

### Tertiary (LOW confidence — requires empirical validation)
- Pyth Pro entitlement tiers per asset class — no official documentation on which feeds are included in "Pyth Crypto" vs "Pyth Pro"; understanding based on observed behavior (FX feeds silent) and keeper token config comments; must verify with actual API key
- ChainlinkPriceFeedProvider compatibility with FX pairs on Base Sepolia — deployed contract exists but whether Chainlink FX feeds (EUR/USD, GBP/USD, etc.) are configured for Base Sepolia is unverified

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
