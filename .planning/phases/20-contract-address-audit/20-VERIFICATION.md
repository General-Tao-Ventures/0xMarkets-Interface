---
phase: 20-contract-address-audit
verified: 2026-02-26T23:00:00Z
status: human_needed
score: 5/5 success criteria verified
human_verification:
  - test: "Restart keepers on DigitalOcean cloud with new .env addresses"
    expected: "Both keeper-service (port 37017) and order-execution-keeper-service (port 37018) start without errors, processing events against the new DataStore address"
    why_human: "Keeper .env files are gitignored (contain private keys); cloud deployment requires SSH access to DigitalOcean and running docker compose up --build -d"
  - test: "Fund keeper wallet and run GOLD/USD and JPY/USD smoke test deposits"
    expected: "Deposits for all 6 markets submit without revert, confirming address correctness at contract level"
    why_human: "Keeper wallet 0x9724251d7DeC79FB5C41F31b2793892831Bf1200 needs testnet ETH top-up (needs at least 0.002 more ETH); smoke test is a CLI command"
  - test: "Redeploy Squid indexer with new EventEmitter address"
    expected: "Squid reindexes from correct deployment block using new EventEmitter 0xd5aAfa71f745645Db84cB4877873701ddAf2514c"
    why_human: "Squid indexer is a separate hosted service; redeployment/reindexing requires manual cloud operation"
  - test: "Verify frontend shows all 6 markets with prices after keeper restart"
    expected: "Pools page displays EUR/USD, GBP/USD, GOLD/USD, USD/JPY, WBTC/USD, WETH/USD with live prices and no blank entries"
    why_human: "Visual UI check requires browser; depends on keeper restart (above) being completed first"
---

# Phase 20: Contract Address Audit Verification Report

**Phase Goal:** All contract addresses across every service are verified correct against on-chain state, so no execution failures come from stale config
**Verified:** 2026-02-26T23:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

All 5 success criteria from the ROADMAP are verified TRUE by automated checks. Four human steps remain to complete the operational deployment side (cloud keeper restart, wallet top-up, squid reindex, frontend smoke).

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every market address in `sdk/src/configs/markets.ts` resolves to a valid on-chain DataStore entry | VERIFIED | All 6 market token addresses confirmed present in both SDK markets.ts and static/markets.ts; audit report shows 24/24 MATCH |
| 2 | Every token address in the order-execution-keeper-service matches deployed token contracts | VERIFIED | All 8 required addresses in order-execution-keeper-service/.env match the on-chain correct values from audit report |
| 3 | Oracle provider addresses in both keeper and interface match on-chain DataStore oracle config | VERIFIED | PYTH_LAZER_FEED_PROVIDER_ADDRESS=0x81B3857cD770887fa1d839AbEa66f951ECa4206f confirmed in both keeper .env files; audit report shows PythLazerFeedProvider MATCH in post-fix verification (89/89 zero mismatches) |
| 4 | All 6 markets are enabled on-chain with non-zero reserve factors, OI limits, and pool caps | VERIFIED | Audit report Section 3 confirms all 6 markets: reserveFactor 9.5e29, OI reserveFactor 9.0e29, maxPool 1e14, disabled=false |
| 5 | A single audit report documents every discrepancy found and every fix applied | VERIFIED | 20-AUDIT-REPORT.md: 549 lines; covers 89 checks, 35 mismatches found, all fixed; Sections 10-11 document every fix with before/after and post-fix 89/89 verification output |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `0xmarkets_contract/scripts/auditAddresses.ts` | Automated on-chain verification script | VERIFIED | 900 lines; reads DataStore via reader.getMarkets(), dataStore.getUint/getAddress; compares against all 6 service config files; outputs MATCH/MISMATCH; commit 619f002c |
| `.planning/phases/20-contract-address-audit/20-AUDIT-REPORT.md` | Audit report with all discrepancies and fixes | VERIFIED | 549 lines; on-chain data from block 38187730; 89 checks, 35 mismatches; Section 10 fixes, Section 11 post-fix verification (89/89); smoke test TX hashes for 4/6 markets |
| `0xMarkets-Interface/sdk/src/configs/contracts.ts` | Corrected infrastructure addresses | VERIFIED | All 10 infrastructure addresses updated to new deployment: DataStore 0x3B9d71B..., EventEmitter 0xd5aAfa7..., ExchangeRouter 0x5AcE07B..., etc; commit 02cd63d8a |
| `order-execution-keeper-service/.env` | Corrected handler and oracle addresses | VERIFIED | All 8 addresses correct: DATA_STORE, READER, EVENT_EMITTER, DEPOSIT/WITHDRAWAL/ORDER/ADL_HANDLER, PYTH_LAZER all match audit report "correct" values |
| `keeper-service/.env` | Corrected infrastructure and oracle addresses | VERIFIED | All 6 addresses correct: READER, DATA_STORE, EVENT_EMITTER, LIQUIDATION_HANDLER, REFERRAL_STORAGE, PYTH_LAZER all match on-chain values |
| `sdk/src/prebuilt/*.json` (3 files) | Regenerated hashed keys after contracts.ts fix | VERIFIED | All 3 files present (hashedKinkModelMarketRatesKeys.json 52L, hashedMarketConfigKeys.json 328L, hashedMarketValuesKeys.json 94L); keys keyed by correct market token addresses (0xd3c882... EUR/USD confirmed); regenerated via yarn prebuild (commit 02cd63d8a) |
| `0xMarkets-squid/src/processor.ts` | Updated EventEmitter address | VERIFIED | EVENT_EMITTER_ADDRESS = '0xd5aAfa71f745645Db84cB4877873701ddAf2514c' confirmed in file; commit 3dd09bd in squid repo |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `sdk/src/configs/contracts.ts` | On-chain DataStore | DataStore address as key for all SDK calls | WIRED | Address 0x3B9d71B... matches audit's on-chain correct address; all downstream SDK usage routes through getContract() |
| `order-execution-keeper-service/.env` | On-chain handler contracts | DEPOSIT/ORDER/WITHDRAWAL/ADL_HANDLER_ADDRESS env vars | WIRED | All 4 handler addresses match audit report correct values; keeper reads these at startup |
| `keeper-service/.env` | On-chain DataStore + oracle | DATA_STORE_ADDRESS + PYTH_LAZER_FEED_PROVIDER_ADDRESS | WIRED | Both addresses confirmed correct in .env file |
| `0xMarkets-squid/src/processor.ts` | On-chain EventEmitter | EVENT_EMITTER_ADDRESS | WIRED | 0xd5aAfa71f745645Db84cB4877873701ddAf2514c confirmed; commit 3dd09bd |
| `auditAddresses.ts` | On-chain DataStore | reader.getMarkets() + dataStore.getUint/getAddress() | WIRED | 30+ occurrences of dataStore.get* and reader.getMarkets(); hashData/hashString key encoding confirmed in script |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUDIT-01 | 20-01, 20-02 | All market addresses in interface SDK match actual on-chain DataStore deployments | SATISFIED | 24/24 market address checks MATCH per audit report; all 6 market tokens confirmed in sdk/markets.ts and static/markets.ts; REQUIREMENTS.md marked [x] |
| AUDIT-02 | 20-01, 20-02 | All token addresses in keeper services match deployed token contracts | SATISFIED | keeper-service tokens.ts 7/7 MATCH; order-execution-keeper .env all 8 addresses verified correct; REQUIREMENTS.md marked [x] |
| AUDIT-03 | 20-01, 20-02 | Oracle provider addresses are correct and match on-chain DataStore oracle configuration | SATISFIED | PythLazerFeedProvider 0x81B3857cD770887fa1d839AbEa66f951ECa4206f confirmed in both keeper .env files; post-fix audit shows 89/89 MATCH including oracle provider; REQUIREMENTS.md marked [x] |
| AUDIT-04 | 20-01, 20-02 | All 6 markets are enabled and properly configured on-chain (reserve factors, OI limits, pool caps) | SATISFIED | Audit report Section 3: all 6 markets have reserveFactor 9.5e29, OI reserveFactor 9.0e29, maxPool 1e14, disabled=false; REQUIREMENTS.md marked [x] |

No orphaned requirements detected. REQUIREMENTS.md Phase 20 entries: AUDIT-01 through AUDIT-04, all marked Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `auditAddresses.ts` | 105 | `return null` | Info | Helper function `readFileIfExists()` returns null on file read error -- intentional error handling, not a stub |

No blockers. The `return null` in auditAddresses.ts is correct defensive coding in a file-read helper, not an empty implementation.

---

### Human Verification Required

#### 1. Cloud Keeper Restart (DigitalOcean)

**Test:** SSH into DigitalOcean droplet, update both keeper .env files with new addresses (from audit report Sections 10c and 10d), then run `docker compose up --build -d` for both services.
**Expected:** Containers start without errors, keeper-service (port 37017) begins processing price feeds, order-execution-keeper-service (port 37018) begins monitoring the new DataStore and EventEmitter addresses.
**Why human:** Keeper .env files are gitignored due to private keys. Cloud deployment requires SSH access. Can't automate without secrets.

#### 2. GOLD/USD and JPY/USD Smoke Test Completion

**Test:** Top up keeper wallet `0x9724251d7DeC79FB5C41F31b2793892831Bf1200` with at least 0.01 testnet ETH on Base Sepolia, then re-run `TEST_MODE=deposit npx hardhat run scripts/testAllMarkets.ts --network baseSepolia`.
**Expected:** All 6 market deposits submit without revert. Existing 4 TX hashes (WETH, WBTC, EUR, GBP) already confirm address correctness -- this completes the final 2.
**Why human:** Requires testnet ETH from a faucet or wallet transfer; manual step.

#### 3. Squid Indexer Redeployment

**Test:** Redeploy the squid indexer with commit 3dd09bd from the 0xMarkets-squid repo. Trigger reindexing from the correct deployment block for the new EventEmitter address.
**Expected:** Squid begins indexing events from the correct EventEmitter 0xd5aAfa71f745645Db84cB4877873701ddAf2514c, not the stale 0x1E4cBc2ea12B190D6222D568151b5e708e1477F8.
**Why human:** Squid is a hosted indexer; redeployment and reindexing requires manual cloud operation. The code fix is committed but not deployed.

#### 4. Frontend Pools Page Verification

**Test:** After keepers are restarted (item 1 above), open the app and navigate to the Pools page.
**Expected:** All 6 markets (EUR/USD, GBP/USD, GOLD/USD, USD/JPY, WBTC/USD, WETH/USD) display with live prices. No blank entries or loading errors.
**Why human:** Visual check; requires keeper restart to be complete first; browser-based.

---

### Summary

**Automated verification: PASSED.** All 5 ROADMAP success criteria are confirmed TRUE by examining the actual codebase:

- The audit script (900 lines) substantively reads on-chain DataStore state via `reader.getMarkets()` and `dataStore.getUint/getAddress()` with correct key hashing.
- The audit report documents 89 total checks, 35 mismatches found, all 35 fixed, post-fix verification showing 89/89 MATCH at block 38188077.
- Interface SDK contracts.ts has all 10 infrastructure addresses updated to the new deployment (committed 02cd63d8a).
- Both keeper .env files have all required addresses updated to match on-chain state.
- SDK prebuilt hashed key files (3 files, 474 lines total) regenerated with new addresses.
- Squid processor.ts has correct EventEmitter address (committed 3dd09bd in squid repo).
- REQUIREMENTS.md marks all 4 requirements [x] Complete.

**Remaining items are operational/deployment**, not code correctness: cloud keeper restart, wallet top-up for 2 remaining smoke tests, and squid redeployment. The address correctness itself is fully verified by the audit script's 89/89 match.

---

_Verified: 2026-02-26T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
