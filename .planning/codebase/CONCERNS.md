# Codebase Concerns

**Analysis Date:** 2026-02-20

## Tech Debt

**Disabled Simulation in Deposit Transactions:**
- Issue: Transaction simulation is disabled pending DataStore configuration
- Files: `src/domain/synthetics/markets/createDepositTxn.ts` (line 109)
- Impact: Deposits execute without pre-execution validation, increasing risk of failed transactions that consume gas
- Fix approach: Re-enable simulation once DataStore is fully configured; add proper error handling for simulation failures

**Deprecated Contract Call Functions Still in Use:**
- Issue: `callContract()` and `estimateGasLimit()` marked `@deprecated` but still used throughout codebase
- Files: `src/lib/contracts/callContract.tsx`, `src/lib/contracts/utils.ts`
- Impact: Migration path unclear; technical debt accumulates with multiple ways to call contracts
- Fix approach: Create comprehensive migration guide to `sendWalletTransaction`; batch deprecation warnings; set sunset date

**Multiple Deprecated Error Parsing Functions:**
- Issue: `simulateExecuteTxn()` and transaction error utilities have multiple deprecated versions
- Files: `src/domain/synthetics/orders/simulateExecuteTxn.tsx`, `src/components/Errors/errorToasts.tsx`, `sdk/src/utils/errors/transactionsErrors.ts`
- Impact: Confusion about which functions to use; potential inconsistent error handling
- Fix approach: Consolidate to single error parsing path; remove deprecated functions in next major version

**Debug-Only Functions Left in Code:**
- Issue: Multiple `@deprecated` functions and debug utilities still present (`useContractFetcher`, Multicall v1 patterns)
- Files: `src/lib/contracts/contractFetcher.ts`, various request building utilities
- Impact: Bloats codebase; creates maintenance burden
- Fix approach: Create deprecation cleanup pass; remove functions 2+ versions old

## Known Bugs

**localStorage Address Validation Gap:**
- Symptoms: Stale token addresses stored in localStorage cause `getToken()` to throw when address is no longer valid, breaking trade page
- Files: `src/domain/synthetics/trade/useTradeboxState.ts` (localStorage reads), `src/domain/synthetics/trade/useAvailableTokenOptions.ts` (address caching)
- Trigger: Update contract addresses without clearing localStorage; user returns to site with old cached address
- Workaround: Clear browser cache or manually edit localStorage
- Risk: HIGH - Returning users lose all trade state when addresses change

**Multichain Event Listener Dependency Issue:**
- Symptoms: Multichain event listeners stop responding to events from source chains
- Files: `src/context/SyntheticsEvents/useMultichainEvents.ts` (line 138)
- Trigger: `srcChainId` changes or becomes undefined
- Code: `// TODO MLTCH: make send events listening regardless of srcChainId`
- Impact: Multichain deposits/withdrawals fail silently with no listener active
- Risk: MEDIUM - Users can't fund accounts from other chains

**Permit Deadline Race Condition:**
- Symptoms: Permit signature expires between signing and transaction execution
- Files: `src/domain/tokens/permitUtils.ts` (lines 50, 74)
- Trigger: User delays transaction submission after signing; deadline is nowInSeconds() + 3600
- Impact: Express orders fail with expired permit; user has to sign again
- Risk: MEDIUM - Affects express trading UX

**Tender Configuration Unsafe Parse:**
- Symptoms: Unvalidated JSON parsing from localStorage could throw or return wrong types
- Files: `src/lib/tenderly.tsx` (lines 277-290)
- Issue: `JSON.parse()` with fallback defaults doesn't handle malformed data safely
- Impact: Missing Tenderly simulation parameters if localStorage corrupted
- Risk: LOW - Fallback exists but could mask bugs

## Security Considerations

**No XSS Protection Observed for Dynamic Content:**
- Risk: If external data (API responses) are rendered without sanitization
- Files: Search revealed no `dangerouslySetInnerHTML` usage - good signal
- Current mitigation: Using React's default text escaping via JSX
- Recommendations:
  - Add dompurify for any user-generated or API content rendering
  - Audit ExternalLink component for href injection vectors
  - Validate all ExchangeRouter ABI calls source

**localStorage as Trusted State:**
- Risk: Trade state, market selections, and leverage settings are persisted without integrity checks
- Files: `src/config/localStorage.ts`, `src/domain/synthetics/trade/useTradeboxState.ts`
- Current mitigation: State is re-validated against availableTokensAddresses on load
- Recommendations:
  - Add hash-based integrity check for critical state
  - Timestamp localStorage writes to detect cross-origin corruption
  - Implement automatic cleanup of stale token addresses

**Permit Signature Replay Prevention:**
- Risk: Nonce management could be bypassed if permit is used multiple times
- Files: `src/domain/tokens/permitUtils.ts` (line 49)
- Current mitigation: Nonce fetched fresh each time from contract
- Recommendations:
  - Document nonce refresh timing in comments
  - Add audit logs for permit signings
  - Monitor for unexpected permit rejections

**Unvalidated getToken() Calls:**
- Risk: Calling `getToken(chainId, address)` without `isValidToken()` guard throws uncaught error
- Files: Global pattern - 44 files use `getToken()`, only some guard with `isValidToken()`
- Examples of guarded calls: `src/context/SettingsContext/SettingsContextProvider.tsx` (line 186), `src/components/TokenSelector/MultichainTokenSelector.tsx` (line 66)
- Examples of UNGUARDED calls: Most token lookups in selectors assume address is valid
- Current mitigation: `isValidTokenSafe()` exists as alternative
- Recommendations:
  - Add ESLint rule to require isValidToken() before getToken()
  - Standardize on `isValidTokenSafe()` in selector code
  - Add runtime guard assertions in development builds

## Performance Bottlenecks

**Large Mock Data Files:**
- Problem: Trade history mock data is very large, impacts bundle and memory
- Files: `src/components/TradeHistory/TradeHistoryRow/mocks.ts` (6,521 lines)
- Cause: Embedded full market and token objects with all decimals/prices
- Improvement path: Extract to external JSON file; lazy-load only when needed; consider fixture generation

**Typechain-Generated Files Not Tree-Shaken:**
- Problem: All factory classes generated but only subset used
- Files: `src/typechain-types/factories/*` (multiple 2000+ line files)
- Cause: Full ABI code generation; no dead code elimination by Vite
- Improvement path: Configure typechain to only generate used contracts; or lazy-load factories

**Promise.race() Timeout Chains:**
- Problem: Multiple nested Promise.race() with 5-second timeouts for candle data
- Files: `src/domain/tradingview/DataFeed.ts` (lines 363-394)
- Impact: 3+ parallel requests with overlapping timeouts = unpredictable latency
- Improvement path: Use AbortController for cancellation; consolidate timeout logic; add request batching

**Expensive Array .find() in Hot Path:**
- Problem: Linear searches for pending funding items on every event
- Files: `src/context/SyntheticsEvents/useMultichainEvents.ts` (multiple lines)
- Impact: O(n) lookup for every ComposeDelivered/OFTSent event
- Improvement path: Index pending items by guid; use Map for O(1) lookup

**Permit Parameter Fetching Not Batched:**
- Problem: Individual multicall for each permit (name, version, nonce)
- Files: `src/domain/tokens/permitUtils.ts` (lines 90-96)
- Impact: Extra round-trip for express orders; could batch across tokens
- Improvement path: Implement batch permit parameter cache; reuse between tokens

## Fragile Areas

**Multichain Funding State Machine:**
- Files: `src/context/SyntheticsEvents/useMultichainEvents.ts`
- Why fragile: Multiple state transitions (submitted → sent → executed → cleared) with async event listeners; race conditions possible if events arrive out of order or duplicate
- Safe modification: Add state validation checks before transitions; log state changes for debugging; add timeout-based cleanup
- Test coverage: Complex event ordering has limited test coverage; no tests for missed events
- Risk: Missing events cause orphaned pending items; duplicate events cause incorrect double-counting

**Trade Options State Synchronization:**
- Files: `src/domain/synthetics/trade/useTradeboxState.ts`
- Why fragile: Complex fallback logic when market/token addresses change; multiple dependent effects interact; hardcoded string keys in lodash operations
- Safe modification: Add invariant checks before state mutations; separate concerns into smaller hooks; use reducer pattern instead of immer
- Test coverage: Limited; missing tests for edge cases like switching chains with invalid tokens
- Risk: Corrupted trade state after address changes; users lose trade progress

**Oracle Keeper URL Resolution:**
- Files: `sdk/src/configs/oracleKeeper.ts`
- Why fragile: Localhost detection via `self.location?.host?.includes("localhost")` is host-string-dependent; doesn't account for docker or custom domains
- Safe modification: Use explicit environment variable for keeper URL; add fallback chain for URL selection; validate URL format
- Test coverage: No unit tests for URL resolution logic
- Risk: Wrong keeper endpoint in non-standard environments; price feeds fail silently

**Expression Order Relay Transaction Handling:**
- Files: `src/domain/synthetics/express/callRelayTransaction.ts`
- Why fragile: Gelato relay integration uses Promise callbacks; error recovery path unclear
- Safe modification: Add retry logic with exponential backoff; implement request idempotency; log relay transaction lifecycle
- Test coverage: Not mocked; integration-only testing
- Risk: Express orders fail permanently if relay is temporarily down

## Scaling Limits

**LRUCache Global State:**
- Current capacity: Various fixed limits (100, 1000 items)
- Limit: Memory growth unbounded if new tokens added frequently
- Files: `sdk/src/utils/swap/swapPath.ts` (100-item market graph cache), `src/context/SyntheticsEvents/useMultichainEvents.ts` (1000-item withdrawal cache)
- Scaling path: Monitor cache hit rates; implement TTL-based eviction; use memory-bounded cache; consider Redis for shared state

**localStorage Single-Chain Trade State:**
- Current capacity: Scales with number of markets per chain; market objects are large
- Limit: ~5-10MB localStorage limit; grows with new token additions
- Files: `src/domain/synthetics/trade/useTradeboxState.ts` (stores full trade options including market objects)
- Scaling path: Implement selective storage (only indices/addresses, not full objects); compress state; archive old trade history

**WebSocket Event Accumulation:**
- Current capacity: Multichain events buffered in memory during page focus loss
- Limit: No explicit bounds on pending funding array growth
- Files: `src/context/SyntheticsEvents/useMultichainEvents.ts`
- Scaling path: Add max queue size; implement event deduplication; use time-window filtering

## Dependencies at Risk

**Old ethers v6 with Patches:**
- Risk: ethers 6.12.1 is patched to suppress console logs (patch in .yarn/patches)
- Files: `package.json` (line 74), `.yarn/patches/ethers-npm-6.12.1-7d4a09a25c`
- Impact: Patches hide upstream issues; blocking upgrades; may miss security fixes
- Migration plan: Review if ethers v6 can upgrade to latest patch version; plan migration to ethers v7 or viem (already in stack)

**react-router-dom v5 (EOL):**
- Risk: React Router v5.3.4 reached end of life; no security updates since 2022
- Files: `package.json` (line 92)
- Impact: Potential URL parsing vulnerabilities; missing performance improvements
- Migration plan: Audit breakage for v6 upgrade; coordinate with React 18 patterns; update route definitions

**Older Testing Library Versions:**
- Risk: @testing-library packages pinned to early versions (v11.2.7 for react)
- Files: `package.json` (lines 52-54)
- Impact: Missing improvements; potential incompatibilities with new React versions
- Migration plan: Review API changes in v12+; ensure query selector stability; update test fixtures

**Apollo Client 3.5.6 (Old):**
- Risk: Apollo Client 3.5 released 2021; v4+ has breaking improvements
- Files: `package.json` (line 36)
- Impact: Missing cache improvements; manual cache synchronization burden
- Migration plan: Audit GraphQL queries; test cache persistence; check field naming changes

## Missing Critical Features

**No Permit Duration Validation UI:**
- Problem: Permit deadline duration is hardcoded (3600s); no warning if user delays transaction
- Blocks: Can't make express orders user-friendly without deadline feedback
- Files: `sdk/src/configs/express.ts` (DEFAULT_PERMIT_DEADLINE_DURATION), `src/domain/tokens/permitUtils.ts`
- Recommendation: Show countdown timer in modal; auto-refresh permit if nearing expiry

**No Simulation Fallback:**
- Problem: Disabled simulation (line 109 in createDepositTxn.ts) blocks execution without alternative validation
- Blocks: Can't confidently estimate gas or validate deposit amounts
- Impact: Users have no pre-check before spending gas
- Recommendation: Implement alternative validation (check vault capacity, balance); re-enable simulation with error handling

**No Multichain Event Recovery:**
- Problem: If websocket disconnects, missed events are never replayed
- Blocks: Multichain funding state can become inconsistent
- Files: `src/context/SyntheticsEvents/useMultichainEvents.ts`, `src/context/WebsocketContext/WebsocketContextProvider.tsx`
- Recommendation: Query historical events on reconnect; implement exponential backoff for websocket

**No Address Change Migration UI:**
- Problem: When contract addresses change, users are silently broken until they clear cache
- Blocks: Can't safely update addresses without breaking production
- Files: No migration logic in `src/domain/synthetics/trade/useTradeboxState.ts`
- Recommendation: Detect stale addresses on load; offer to reset trade state or migrate addresses

## Test Coverage Gaps

**Multichain Event Ordering:**
- What's not tested: Out-of-order events, duplicate events, missing events in multichain flow
- Files: `src/context/SyntheticsEvents/useMultichainEvents.ts`
- Risk: State corruption undetected until user reports it
- Priority: HIGH - Affects fund movement across chains

**Trade State Fallback Logic:**
- What's not tested: All paths through `fallbackPositionTokens()` and `fallbackCollateralTokens()` after address changes
- Files: `src/domain/synthetics/trade/useTradeboxState.ts` (function not shown, but referenced)
- Risk: Invalid trade state silently persisted
- Priority: HIGH - Core trade functionality

**Permit Creation Race Window:**
- What's not tested: Behavior when permit expires between signing and submission
- Files: `src/domain/tokens/permitUtils.ts`, express transaction code
- Risk: Uncaught promise rejection when permit rejected
- Priority: MEDIUM - Affects express orders

**localStorage Corruption Recovery:**
- What's not tested: Malformed JSON, wrong types, missing required fields in trade state
- Files: `src/domain/synthetics/trade/useTradeboxState.ts` (line 149)
- Risk: Crashes on page load if localStorage corrupted
- Priority: MEDIUM - Affects all users

**Tenderly Simulation Error Paths:**
- What's not tested: Tenderly unreachable, API errors, malformed responses
- Files: `src/lib/tenderly.tsx`
- Risk: UI hangs on slow Tenderly response
- Priority: LOW - Dev tool, not production-critical

**Token Address Validation:**
- What's not tested: getToken() called with unknown addresses across entire codebase
- Files: 44 files use getToken; coverage of isValidToken guards is incomplete
- Risk: Cascading errors if new token address handling added
- Priority: MEDIUM - Affects token support

**Keeper URL Resolution:**
- What's not tested: Localhost detection, fallback URL selection, invalid keeper responses
- Files: `sdk/src/configs/oracleKeeper.ts`
- Risk: Price feeds silently fail in non-standard environments
- Priority: LOW - But easy fix, high confidence

---

*Concerns audit: 2026-02-20*
