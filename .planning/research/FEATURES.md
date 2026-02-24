# Feature Landscape: Maximum Keeper Speed and Oracle Configuration (v1.4)

**Domain:** DeFi keeper oracle routing, per-market oracle configuration, and end-to-end latency optimization
**Researched:** 2026-02-24
**Overall confidence:** MEDIUM (Pyth entitlement model externally verified via pricing page; on-chain provider registration pattern verified from Phase 13 research and GMX Oracle.sol; latency optimization patterns HIGH confidence from codebase analysis)

## Table Stakes

Features required for the keeper to execute ALL markets reliably. Missing = FX markets are broken, crypto markets intermittently fail with stale prices, or the new API key silently does nothing.

| Feature | Why Expected | Complexity | Current State | Notes |
|---------|--------------|------------|---------------|-------|
| Pyth Pro API key deployment with startup entitlement verification | Current key has zero entitlements -- WebSocket connects but sends no data. Without verification, keeper runs indefinitely with stale prices and every execution fails silently. | Low | Key `QpxMy21OMvC7rap9...` obtained but not deployed. Phase 13 planned `verifyLazerFeeds()` startup check. FX feeds commented out in `tokens.ts`. | Tier matters: "Pyth Crypto" (free) = crypto only, 1s updates. "Pyth Crypto+" ($5k/mo) = crypto, 1ms updates. "Pyth Pro" ($10k/mo) = cross-asset including FX. If key is Crypto tier, FX feeds will never receive data regardless of feed IDs. |
| Per-market oracle mode selection (Lazer for crypto, Hermes for FX) | Crypto tokens (WETH, WBTC, USDC) have Lazer feed IDs and entitlements. FX tokens (EUR, GBP, JPY, GOLD) may not have Lazer entitlements unless on Pyth Pro tier. Forcing Lazer-only mode breaks FX; forcing Hermes-only mode wastes Lazer's speed for crypto. | Medium | `config.oracleMode` is global ("hermes", "lazer", or "both"). `buildOracleParams()` in `baseExecutor.ts` applies the same mode to ALL tokens. No per-token oracle routing exists. | Central feature of v1.4. Must route crypto tokens through Lazer (fast path) and FX tokens through Hermes (reliable path). The `pythLazerOracle.hasFeed()` check already exists per-token -- extend this into a routing decision. |
| On-chain oracle provider registration for FX tokens to accept Hermes prices | FX withdrawals fail with `InvalidOracleProvider (0x05d102a2)`. The DataStore's `oracleProviderForToken` maps each token to a single expected provider address. If it points to PythLazerFeedProvider but keeper sends Hermes provider address (or vice versa), the contract reverts. | Medium | `oracleProviderForToken` likely set to PythLazerFeedProvider for ALL tokens via `configureOracleTokens.ts`. FX tokens need the Hermes/Pyth contract address registered instead (or both providers enabled). | Requires contract-level admin transaction via deploy scripts in `0xmarkets_contract`. Keeper-side code cannot fix this alone -- it is an on-chain DataStore configuration issue. |
| MaxPriceAgeExceeded prevention for all execution paths | Stored prices go stale between background update and execution. With MAX_ORACLE_PRICE_AGE = 300s and background updates every 10s per token, there is normally a large margin. But during execution, background updates are disabled (nonce coordination), and if the queue is backed up, prices can age out. | Low | `isStoredPriceFresh()` in `baseExecutor.ts` checks freshness with 5s safety margin. Falls back to synchronous `updatePriceOnChain()` when stale. Current 10s background interval is conservative. | The real risk is when `updatePriceOnChain()` also fails (e.g., Lazer WS disconnected AND cache stale). Need clear error path: try Lazer cache -> try Lazer fresh fetch -> fall back to Hermes for that token. |

## Differentiators

Features that push execution speed well beyond "working" into "fast" territory. These leverage the existing event-driven architecture from v1.3 and optimize the remaining latency sources.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Eliminate synchronous `updatePriceOnChain()` TX during execution | Current flow: check `isStoredPriceFresh()` -> if stale, call `updatePriceOnChain()` (sends TX, waits for receipt: ~2-4s) -> then submit execution TX. If background updater keeps prices fresh, the synchronous path is never needed for Lazer tokens. Reduce background interval from 10s to 5s or lower for Lazer tokens. | Low | Background updater already exists in `pythLazerOracle.ts`. Just needs interval tuning + confidence that prices stay fresh. | With 300s MAX_ORACLE_PRICE_AGE and 5s update interval, prices should never go stale during execution. Saves 2-4s per execution when the synchronous fallback would have fired. |
| Flashblocks-aware RPC endpoint (200ms confirmations) | Every `waitForTransactionReceipt` call in the keeper waits up to 2s for block inclusion. With Flashblocks, this drops to ~200ms. Affects: `updatePriceOnChain()` receipt wait, `executeDeposit/Withdrawal/Order` receipt wait, and `submitTransaction` nonce retry waits. | Very Low | Alchemy and Chainstack support Flashblocks on Base Sepolia. Just swap RPC URL. Flashblocks went live on Base Mainnet July 2025. | Single highest-ROI configuration change. No code changes needed -- just update `RPC_URL` env var to a Flashblocks-enabled endpoint. Every execution saves ~1.8s per TX confirmation. |
| Tighter background oracle update interval for Lazer tokens | Current: 10s minimum between on-chain updates per token (`BG_UPDATE_INTERVAL_MS = 10_000`). With 200ms Flashblocks confirmations, this can safely drop to 3-5s without nonce pressure. Keeps stored prices fresher, reducing synchronous fallback probability. | Very Low | Flashblocks RPC (for faster confirmations). Without Flashblocks, more frequent updates risk nonce pileup. | Trade-off: more gas spent on background updates vs. fewer synchronous update delays during execution. On testnet, gas is free -- prefer freshness. |
| Oracle cascade fallback (Lazer -> Hermes per-token) | When Lazer WS disconnects or cache goes stale for a specific token, automatically fall back to Hermes for that token only (not globally). Prevents a Lazer outage from blocking all executions. | Medium | Per-market oracle routing (table stakes feature). Hermes feeds already registered for all 7 tokens. | Different from "both" mode which always does Lazer then Hermes. This is: try Lazer, and if Lazer fails for THIS token, use Hermes for THIS token only. Keeps crypto tokens fast when Lazer works while providing resilience. |
| Startup oracle provider consistency verification | Read `oracleProviderForToken` from DataStore for each configured token at startup. Compare against keeper's expected provider address. Log clear MISMATCH warnings before any execution attempt. Prevents running for hours with 100% execution failures. | Low | Phase 13 already planned this in `13-01-PLAN.md`. | Diagnostic only -- does not fix mismatches, but surfaces them immediately at startup instead of discovering them from cryptic `0x05d102a2` reverts during execution. |
| Per-market latency tracking | Track execution latency separately per market/token-pair, not just globally. Enables identifying if FX markets are slower (Hermes HTTP fetch) vs. crypto markets (Lazer cached). | Low | `latencyTracker.ts` circular buffer exists. Extend to per-market buckets. | Observability feature. Reveals whether per-market oracle routing is actually delivering speed benefits. |

## Anti-Features

Features to explicitly NOT build for v1.4. These are traps that appear relevant but add complexity without solving the actual problems.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Upgrading to Pyth Pro tier ($10k/mo) just for FX Lazer feeds | FX markets (EUR, GBP, JPY, GOLD) are low-volume on testnet. Paying $10k/mo for millisecond FX data on a testnet with sparse orders is not justified. Hermes provides perfectly adequate FX prices at ~400ms latency. | Use Hermes for FX, Lazer for crypto. The per-market routing approach gives crypto markets maximum speed without requiring cross-asset entitlements. |
| Custom multicall contract for atomic price-update + execution | Building a Solidity contract that batches `updatePrice()` + `executeDeposit()` in one TX. High audit risk, requires contract deployment, and the existing two-TX pattern (background update + execution) already eliminates most of this latency when prices stay fresh. | Keep background price updater. Tune update interval. The only time a synchronous update TX is needed is when background updater falls behind -- optimize that path, don't rebuild the contract layer. |
| Switching ALL markets to Hermes-only for simplicity | Hermes works for all tokens and avoids the `InvalidOracleProvider` issue entirely. But Hermes adds ~200-500ms HTTP fetch latency per execution, and loses the streaming WebSocket advantage of Lazer. | Per-market routing: best of both worlds. Crypto gets Lazer speed, FX gets Hermes reliability. |
| Building a separate "oracle admin service" for provider registration | The `oracleProviderForToken` on-chain configuration is a one-time admin operation per token, done via contract deploy scripts. Building a service to manage this is over-engineering. | Run `configureOracleTokens.ts` from `0xmarkets_contract` repo with the correct provider addresses. This is a deploy-time concern, not a runtime concern. |
| Parallel execution of multiple operations | With a single keeper wallet, parallel execution causes nonce collisions. The v1.3 `ExecutionQueue` was specifically designed to prevent this. | Keep sequential execution via queue. Speed comes from making each individual execution faster (fresh prices, Flashblocks, no synchronous oracle TX), not from parallelism. |
| Aggressive background update interval (< 3s) | Updating on-chain prices every 1-2s with single wallet creates nonce pressure, especially if one TX is slow. Background updates compete with execution TXs for nonce slots. | 3-5s interval with Flashblocks is sufficient. 300s MAX_ORACLE_PRICE_AGE means even 10s intervals have massive headroom. The goal is to prevent synchronous fallback, not achieve real-time on-chain prices. |

## Feature Dependencies

```
Pyth Pro API key deployment ---------> Entitlement verification at startup
                                  \
                                   \-> Per-market oracle mode selection
                                         |
                                         v
                              On-chain provider registration for FX tokens
                              (FX tokens need Hermes provider in DataStore)
                                         |
                                         v
                              Oracle cascade fallback (Lazer -> Hermes per-token)

Background update interval tuning ---> Flashblocks RPC (faster confirmations = safer frequent updates)
                                  \
                                   \-> Eliminate synchronous updatePriceOnChain
                                        (fresh prices = synchronous path never fires)

Startup provider verification -------> Independent (diagnostic, no deps)

Per-market latency tracking ---------> Per-market oracle routing (needs routing to measure)
```

**Critical path:** API key deployment -> entitlement verification -> per-market routing -> on-chain provider fix -> FX markets work.

**Speed path (parallel):** Flashblocks RPC -> background interval tuning -> synchronous fallback elimination.

## MVP Recommendation

Prioritize in this order:

**Phase 1 -- Oracle Configuration (fix broken markets):**
1. **Deploy Pyth Pro API key** and add startup entitlement verification (`verifyLazerFeeds()` from Phase 13 plan)
2. **Per-market oracle mode selection** -- route crypto tokens through Lazer, FX tokens through Hermes. Modify `buildOracleParams()` to check `pythLazerOracle.hasFeed(token)` per-token instead of using global `config.oracleMode`
3. **On-chain oracle provider registration** -- run `configureOracleTokens.ts` to set correct provider per token (PythLazerFeedProvider for crypto, Pyth/Hermes contract for FX)
4. **Startup oracle provider consistency check** -- verify DataStore matches keeper config

**Phase 2 -- Latency Optimization (make fast markets faster):**
5. **Flashblocks-aware RPC** -- swap `RPC_URL` to Flashblocks-enabled endpoint (Alchemy or Chainstack)
6. **Reduce background update interval** from 10s to 5s for Lazer tokens
7. **Oracle cascade fallback** -- per-token Lazer->Hermes fallback when Lazer cache is stale

**Defer:**
- Pyth Pro tier upgrade: unnecessary cost for testnet FX feeds
- Custom multicall contracts: background updater already handles this
- Multi-wallet keeper: testnet volume doesn't justify

## Complexity Budget

| Feature | Effort | Risk | Impact |
|---------|--------|------|--------|
| API key deployment + verification | 1 hour | Low (config + startup check) | Critical -- unblocks all Lazer functionality |
| Per-market oracle routing | 2-3 hours | Medium (modify buildOracleParams branching logic) | Critical -- unblocks FX markets while keeping crypto fast |
| On-chain provider registration | 30 min | Low (one-time admin script run) | Critical -- fixes InvalidOracleProvider for FX tokens |
| Startup provider consistency check | 1 hour | Low (read-only diagnostic) | High -- prevents hours of cryptic execution failures |
| Flashblocks RPC | 15 min | Very Low (env var change) | High -- ~1.8s saved per TX confirmation, no code changes |
| Background interval tuning | 15 min | Very Low (change constant) | Medium -- reduces synchronous oracle fallback probability |
| Oracle cascade fallback | 2-3 hours | Medium (per-token fallback logic in buildOracleParams) | Medium -- resilience against Lazer outages |
| Per-market latency tracking | 1 hour | Low (extend existing tracker) | Low -- observability only |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `order-execution-keeper-service/src/` -- full oracle, executor, and config code examined directly
- Phase 13 research: `.planning/phases/13-production-lazer-deployment-and-keeper-optimization/13-RESEARCH.md` -- oracle provider error analysis, entitlement pitfalls
- [GMX Synthetics Oracle.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/oracle/Oracle.sol) -- `oracleProviderForToken` validation, `InvalidOracleProviderForToken` error pattern
- [Pyth Best Practices](https://docs.pyth.network/price-feeds/core/best-practices) -- `updatePriceFeeds()` + execution in same TX pattern
- [Pyth Pull Oracle Architecture](https://docs.pyth.network/price-feeds/core/pull-updates) -- "package price update together with each transaction"
- [Base Flashblocks documentation](https://docs.base.org/base-chain/flashblocks/apps) -- 200ms preconfirmations, RPC provider support

### Secondary (MEDIUM confidence)
- [Pyth Pro pricing tiers](https://www.pyth.network/price-feeds) -- Pyth Crypto (free, crypto only, 1s), Pyth Crypto+ ($5k/mo, crypto, 1ms), Pyth Pro ($10k/mo, cross-asset, 1ms)
- [Pyth Pro documentation](https://docs.pyth.network/price-feeds/pro) -- subscription model, access token usage, feed categories
- [Pyth Pro Getting Started](https://docs.pyth.network/price-feeds/pro/getting-started) -- PythLazerClient setup, token acquisition via Data Distributors
- [Chainstack Flashblocks on Base](https://chainstack.com/flashblocks-base-rpc/) -- Flashblocks available on Chainstack Base Mainnet and Sepolia
- [Alchemy Flashblocks support](https://x.com/Alchemy/status/1945626061146132650) -- Alchemy supported Flashblocks from day one on Base Mainnet

### Tertiary (LOW confidence -- needs validation)
- Pyth entitlement per-asset-class behavior: No official documentation found on exactly which feeds are included in "Pyth Crypto" free tier vs. "Pyth Pro". Understanding based on tier descriptions ("crypto data" vs. "global, cross-asset coverage") and observed behavior (crypto feeds work, FX feeds don't receive data). Must verify empirically with the actual API key.
- [Pyth Pro Price Feed IDs](https://docs.pyth.network/price-feeds/pro/price-feed-ids) -- feed ID list exists but specific FX availability per tier not documented

---
*Research completed: 2026-02-24*
*Replaces: v1.3 FEATURES.md (2026-02-23) -- v1.3 features are now SHIPPED; this covers v1.4 scope*
