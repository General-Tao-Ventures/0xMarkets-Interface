# Feature Landscape: Keeper Execution Speed Optimization

**Domain:** DeFi keeper/executor speed optimization for GMX-style perpetual futures protocol
**Researched:** 2026-02-23
**Overall confidence:** HIGH (verified against codebase, GMX architecture docs, viem docs, Pyth docs)

## Table Stakes

Features users expect from a responsive DeFi protocol. Missing = users feel the platform is broken or unreliable. These are the minimum optimizations needed to hit the sub-10s target.

| Feature | Why Expected | Complexity | Current State | Savings Estimate |
|---------|--------------|------------|---------------|------------------|
| Event-driven detection (replace polling) | GMX keepers listen for EventEmitter events, not poll DataStore lists. Polling adds up to 10s latency before detection even starts. | Medium | 10s `setInterval` polling cycle in `index.ts` L180 | **5-10s saved** (detection becomes near-instant) |
| Batch oracle price updates into single tx | Current code sends one `updatePrice` tx per token, each awaiting receipt. A deposit needing 2 tokens = 2 sequential txs before execution even starts. | Medium | Sequential `updatePriceOnChain()` calls in `baseExecutor.ts` L176-208, each with `waitForTransactionReceipt` | **4-8s saved** (eliminate 1-2 extra tx round-trips) |
| Eliminate redundant on-chain reads during execution | Each deposit execution creates a fresh `ReaderContract()`, re-reads the deposit, re-reads the market. Scanner already read these. | Low | `depositExecutor.ts` L80-81 creates new `ReaderContract` every execution | **1-2s saved** (skip redundant RPC calls) |
| Optimistic nonce management | Current code fetches `pending` nonce from RPC before every tx, then waits for receipt before next tx. On L2 with 2s blocks, nonce fetch + wait = wasted time. | Medium | `baseExecutor.ts` L93-96 fetches nonce per tx; `pythLazerOracle.ts` L264-277 waits for receipt | **2-4s saved** per multi-tx sequence |

## Differentiators

Features that push execution well below 10s. Not strictly required but deliver noticeably faster UX.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Combine price update + execution in single multicall tx | Instead of: tx1=updatePrice, wait, tx2=executeDeposit, wait -- do one tx that calls both. Pyth's pull oracle architecture explicitly supports this pattern ("package price update together with each transaction that depends on it"). | High | Requires custom multicall contract or batched tx support; contract must accept combined call | GMX production keepers do this -- bundle signed prices WITH execution call. 0xMarkets already passes oracle params to `executeDeposit`; the separate `updatePrice` tx may be unnecessary if the contract reads from the Lazer feed provider within the same block. **Investigate whether updatePrice + executeDeposit can be batched or if the contract already reads cached prices.** |
| WebSocket transport for event detection | viem's `watchContractEvent` supports WebSocket via `eth_subscribe("logs")` when using a WebSocket transport. Base Sepolia supports WSS via Alchemy/QuickNode. Sub-second event delivery vs. polling. | Low | Requires WSS RPC endpoint (e.g., `wss://base-sepolia.g.alchemy.com/v2/KEY`) | Straightforward upgrade if RPC provider offers WSS. Falls back to polling automatically if WSS unavailable. |
| Parallel execution across operation types | Current code executes deposits THEN withdrawals THEN orders sequentially. With a single wallet, they must be sequential per-type. But scanning all three types can happen in parallel. | Low | None -- pure code restructuring | Scan deposits + withdrawals + orders simultaneously via `Promise.all()`, then execute the combined queue sequentially. Saves scan time, not execution time. |
| Pre-computed oracle params cache | Instead of building oracle params fresh for every execution (fetching market info, identifying tokens, building Pyth data), maintain a hot cache keyed by market address. Update cache on new Pyth Lazer WebSocket messages. | Medium | Pyth Lazer WebSocket already connected and caching updates in `updateCache` | Eliminates the `getMarket()` RPC call and token identification logic from the hot path. Most markets use the same token set repeatedly. |
| Local nonce tracker (in-memory counter) | Track nonce locally instead of querying RPC. Increment after each `writeContract`. Only re-sync from chain on errors (nonce too low, replacement underpriced). Thirdweb and Circle both recommend this pattern for high-throughput bots. | Medium | Single-wallet constraint means simple counter works | Eliminates one RPC round-trip per transaction. On Base (2s blocks), this matters. |
| Flashblocks-aware RPC (200ms preconfirmations) | Base Sepolia already has Flashblocks support. With a Flashblocks-aware RPC endpoint, `waitForTransactionReceipt` resolves in ~200ms instead of ~2s. | Low | Requires Flashblocks-aware RPC provider (Chainstack, Alchemy, dRPC support this on Base Sepolia) | Potentially the single highest-impact change. Every `waitForTransactionReceipt` call in the codebase benefits. Currently the keeper waits up to 2s per tx confirmation. |

## Anti-Features

Features to explicitly NOT build. Over-engineering traps that add complexity without meaningful speed gains for this use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-wallet keeper with wallet pool | Adds massive complexity (wallet funding, nonce management across wallets, key management, health monitoring per wallet). Only needed at very high throughput. On testnet with sparse orders, sequential single-wallet is fine. | Keep single wallet. Optimize the sequential pipeline speed instead. |
| Mempool monitoring / frontrunning protection | 0xMarkets is the only keeper on its own testnet contracts. There is no competition. Mempool monitoring is for competitive MEV environments (mainnet Uniswap, etc.). | Not applicable until mainnet with external keepers. |
| Pre-signed transactions | The keeper IS the signer. Pre-signing provides no benefit when the keeper already has the private key in memory and signs on-demand. Pre-signing is for user-facing flows where the user signs ahead of time. | Sign at execution time as currently done. |
| Custom Solidity multicall keeper contract | Building a custom contract that combines updatePrice + executeDeposit in one call. High audit risk, deployment overhead, and the protocol's handler contracts may not be designed for delegatecall patterns. | First verify if the existing `executeDeposit` with oracle params already handles price freshness (it likely does -- the `oracleParams` structure passes price data inline). |
| Aggressive gas optimization (EIP-4844 blobs, calldata compression) | Gas cost is negligible on Base Sepolia testnet. These optimizations matter for mainnet cost reduction, not execution speed. | Defer to mainnet milestone. |
| Queue-based architecture with Redis/workers | Overkill for a single-keeper, single-server setup processing sparse testnet orders. Queue systems (like thirdweb Engine) are for hundreds of concurrent transactions from many users. | Keep the simple in-process loop. Add queuing only if moving to multi-instance deployment. |

## Feature Dependencies

```
Event-driven detection -----> WebSocket transport (optional enhancement)
                       \
                        \---> Parallel scanning (scan all types on event, not sequentially)

Batch oracle updates -------> Pre-computed oracle params cache (need cached data to batch)
                       \
                        \---> Local nonce tracker (batching changes nonce flow)

Flashblocks RPC ------------> Independent (swap RPC URL, immediate benefit)

Eliminate redundant reads --> Pre-computed oracle params cache (related optimization)
```

## MVP Recommendation (Sub-10s Target)

**Phase 1 -- Detection speed (biggest win, lowest risk):**
1. **Event-driven detection** via `watchContractEvent` on EventEmitter for `DepositCreated`, `WithdrawalCreated`, `OrderCreated` events. Replace the 10s `setInterval` polling. This alone likely cuts 5-10s from the pipeline.
2. **Parallel scanning** -- scan deposits, withdrawals, and orders concurrently with `Promise.all()` instead of sequentially.

**Phase 2 -- Execution pipeline speed:**
3. **Eliminate redundant on-chain reads** -- pass scanned data through to executor instead of re-reading from chain.
4. **Batch oracle price updates** -- send one `updatePrice` tx for all tokens, or better yet, verify if `executeDeposit` with inline oracle params makes the separate `updatePrice` tx unnecessary.
5. **Local nonce tracker** -- maintain in-memory nonce counter, sync from chain only on error.

**Phase 3 -- Infrastructure optimization:**
6. **Flashblocks-aware RPC** -- switch to WSS endpoint from provider that supports Base Sepolia Flashblocks for ~200ms confirmations.

**Defer:**
- Multi-wallet keeper: unnecessary complexity for testnet volume
- Custom multicall contracts: high risk, unproven benefit
- Mempool monitoring: no competition on own testnet

## Complexity Budget

| Feature | Effort | Risk | Impact on Sub-10s Goal |
|---------|--------|------|----------------------|
| Event-driven detection | 2-3 hours | Low (viem API is well-documented, fallback to polling built-in) | Critical -- eliminates the largest latency source |
| Parallel scanning | 30 min | Very Low (pure code change, no new dependencies) | Moderate -- saves 1-3s during scan phase |
| Eliminate redundant reads | 1-2 hours | Low (refactor data flow, no new APIs) | Moderate -- saves 1-2s per execution |
| Batch oracle updates | 2-4 hours | Medium (need to verify contract behavior with batched prices) | High -- eliminates 1-2 extra transactions |
| Local nonce tracker | 1-2 hours | Medium (must handle edge cases: stuck tx, nonce gaps) | Moderate -- saves 1 RPC round-trip per tx |
| Flashblocks RPC | 30 min | Very Low (config change) | High -- every waitForReceipt benefits |

## Sources

- GMX Synthetics architecture: [gmx-io/gmx-synthetics](https://github.com/gmx-io/gmx-synthetics) -- HIGH confidence
- GMX keeper two-step execution model: [GMX Docs - Contracts](https://docs.gmx.io/docs/api/contracts/) -- HIGH confidence
- Chainlink Data Streams + GMX integration: [Chainlink Data Streams blog](https://blog.chain.link/data-streams-mainnet/) -- HIGH confidence
- viem `watchContractEvent` API: [viem docs](https://viem.sh/docs/contract/watchContractEvent) -- HIGH confidence
- Pyth pull oracle "package update with transaction": [Pyth docs](https://docs.pyth.network/price-feeds/core/pull-updates) -- HIGH confidence
- Nonce management patterns: [QuickNode guide](https://www.quicknode.com/guides/ethereum-development/transactions/how-to-manage-nonces-with-ethereum-transactions), [thirdweb approach](https://blog.thirdweb.com/sending-more-than-one-transaction-at-a-time/), [Circle docs](https://developers.circle.com/cpn/concepts/wallet-nonce-management) -- HIGH confidence
- Base Sepolia Flashblocks (200ms): [The Block](https://www.theblock.co/post/343908/base-cuts-block-times-to-0-2-seconds-on-testnet-with-flashblocks-mainnet-rollout-expected-in-q2) -- MEDIUM confidence (testnet feature, verify availability with your RPC provider)
- Base block time (2s): [Base docs](https://docs.base.org/base-chain/network-information/transaction-finality) -- HIGH confidence
- Multicall3 batching: [viem multicall docs](https://viem.sh/docs/contract/multicall.html) -- HIGH confidence
- Codebase analysis: Direct reading of `order-execution-keeper-service/src/` -- HIGH confidence
