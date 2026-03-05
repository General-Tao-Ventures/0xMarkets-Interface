---
phase: 38-squid-fixes-redeployment
verified: 2026-03-05T02:15:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 38: Squid Fixes & Redeployment Verification Report

**Phase Goal:** Fix squid trade history and account stats data -- make OrderExecuted events contain pnlUsd, fix maxCapital precision, fix realizedFees field sourcing, redeploy and verify
**Verified:** 2026-03-05T02:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | OrderExecuted trade actions for MarketDecrease have pnlUsd populated | VERIFIED | Live GraphQL returns pnlUsd values: -345786025281529556442306400000, -33110078561434685800000000000000, +1246897228356633383959929450931 across 3 sampled records |
| 2   | Fee fields extracted from correct event data keys (PositionFeesCollected) | VERIFIED | Live data shows positionFeeAmount (495481, 495559, 1000), borrowingFeeAmount (0, 971), fundingFeeAmount (0, 1165584) -- non-null and populated |
| 3   | accountStats maxCapital reflects actual collateral deposited | VERIFIED | All 5 sampled accounts have maxCapital > 0 (range: 1004926888691728670000000000000000 to 29822411677967817340000000000000000). Type-aware int256/uint256 extraction in accountStats.ts lines 141-145. |
| 4   | accountStats realizedFees accumulates fees from position decrease events | VERIFIED | 4 of 5 sampled accounts with closedCount > 0 have realizedFees > 0 (e.g., 35417774240619280000000000000000). Account 0x863b has realizedFees=0 consistent with closedCount=0 (no closes yet). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `/Users/ken/Projects/0xM/0xMarkets-squid/src/handlers/orders.ts` | Position event handler with pnlUsd computation | VERIFIED | Line 177: `pnlUsd: getInt(data, 'basePnlUsd')`. Also contains `handlePositionFeesEvent` (lines 196-218) with PositionFeeData extraction. |
| `/Users/ken/Projects/0xM/0xMarkets-squid/src/handlers/accountStats.ts` | Account stats with correct fee extraction | VERIFIED | Lines 141-145: type-aware collateralDeltaAmount (intItems then uintItems). Lines 155-161: fee data from PositionFeeData parameter. Lines 249-261: mirror to PeriodAccountStat. |
| `/Users/ken/Projects/0xM/0xMarkets-squid/src/main.ts` | Event routing and enrichment | VERIFIED | Line 31: `feesByOrderKey` map. Lines 224-228: PositionFeesCollected routing. Lines 299-306: fee merge in enrichTradeActions. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| handlePositionEvent | enrichTradeActions mergeFields | positionEventsByOrderKey map | WIRED | main.ts:201 stores position TradeAction by orderKey; main.ts:294 retrieves and merges at line 296 |
| handlePositionFeesEvent | enrichTradeActions fee merge | feesByOrderKey map | WIRED | main.ts:225 stores fee data; main.ts:300-306 merges fee fields into OrderExecuted |
| handlePositionAndAccountStats | PeriodAccountStat | mirror from accountStat | WIRED | accountStats.ts:250-261 copies all stat fields from accountStat to periodStat |
| PositionFeesCollected | accountStats feeData | feesByOrderKey lookup | WIRED | main.ts:205-206 looks up feeData by orderKey; passes to handlePositionAndAccountStats at line 213 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| TH-01 | 38-01-PLAN | Market order executions appear in trade history | SATISFIED | OrderExecuted events for orderType 2 (MarketIncrease) and 4 (MarketDecrease) confirmed in live GraphQL with enriched fields |
| TH-02 | 38-01-PLAN | Realized PnL displays for closed positions | SATISFIED | pnlUsd populated on MarketDecrease OrderExecuted (3 sampled records all non-null) |
| LB-01 | 38-01-PLAN | maxCapital is non-zero for accounts with positions | SATISFIED | All 5 sampled periodAccountStats have maxCapital > 0; type-aware collateralDeltaAmount extraction confirmed in code |
| LB-02 | 38-01-PLAN | realizedFees is non-zero for accounts that paid fees | SATISFIED | 4/4 accounts with closedCount > 0 have realizedFees > 0; PositionFeesCollected handler wired correctly |

No orphaned requirements -- TH-03 and LB-03 are not mapped to Phase 38 in REQUIREMENTS.md or claimed by the plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | - | - | No anti-patterns detected in modified files |

### Human Verification Required

### 1. Trade History PnL Display

**Test:** Open the 0xMarkets frontend trade history page for an account that has closed positions. Check that the rPnL column shows non-zero values.
**Expected:** Closed position rows display a negative or positive PnL value instead of blank/zero.
**Why human:** Frontend rendering depends on how `formatUsd(tradeAction.pnlUsd)` handles the BigInt scale -- visual confirmation needed.

### 2. Leaderboard Rankings

**Test:** Open the leaderboard page and verify accounts are ranked by maxCapital or other metrics.
**Expected:** Multiple traders appear with non-zero stats. Rankings are ordered correctly.
**Why human:** Frontend query parameters (periodStart/periodEnd) and rendering logic not in squid scope -- needs visual check.

### Gaps Summary

No gaps found. All four must-have truths are verified both in code (correct field extraction, type-aware reads, cross-event enrichment wiring) and in live data (GraphQL queries returning populated pnlUsd, fees, maxCapital, realizedFees). The squid was successfully redeployed with --hard-reset per commits e277918 and 9fb8ab8 in the squid repo.

---

_Verified: 2026-03-05T02:15:00Z_
_Verifier: Claude (gsd-verifier)_
