# Roadmap: Fix Buy GM Flow

## Overview

Three phases that take the ETH/USD pool deposit flow from a broken keeper execution to a fully observable, resilient user experience. Phase 1 confirms a deposit actually works end-to-end. Phase 2 makes the keeper handle real-world failure conditions. Phase 3 ensures users see what is happening the entire time.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Execution** - End-to-end deposit execution works for a fresh deposit
- [x] **Phase 2: Keeper Resilience** - Keeper handles failures, restarts, concurrency, and expired deposits
- [x] **Phase 3: UI Feedback** - User sees accurate deposit status and actionable error messages

## Phase Details

### Phase 1: Core Execution
**Goal**: A user can deposit USDC into the ETH/USD pool and receive GM tokens
**Depends on**: Nothing (first phase)
**Requirements**: EXEC-01, EXEC-02
**Success Criteria** (what must be TRUE):
  1. A createDeposit transaction that mines on Base Sepolia is detected by the keeper within one scan cycle
  2. The keeper pushes Pyth Lazer prices on-chain and calls executeDeposit within the 300-second oracle freshness window
  3. The executeDeposit transaction succeeds on-chain and the user's wallet reflects GM token balance
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md -- Test deposit script + fix deposit executor guards
- [x] 01-02-PLAN.md -- Deploy to DO server + end-to-end verification

### Phase 2: Keeper Resilience
**Goal**: The keeper handles transient failures, restarts, concurrency, and expired deposits without manual intervention
**Depends on**: Phase 1
**Requirements**: EXEC-03, EXEC-04, LIFE-01, LIFE-03, LIFE-04
**Success Criteria** (what must be TRUE):
  1. A deposit that fails due to an RPC timeout or nonce collision is retried automatically and eventually succeeds
  2. Deposits created while the keeper is down are picked up and executed on the next scan cycle after restart
  3. Two concurrent deposits from different users both complete without interfering with each other
  4. An expired deposit is detected and cancelled on-chain, freeing the user's locked funds
  5. Failed deposits have a specific error reason recorded that is visible in the keeper logs or DB
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md -- Retry logic with exponential backoff + error recording in DB
- [x] 02-02-PLAN.md -- Expired deposit detection and on-chain cancellation

### Phase 3: UI Feedback
**Goal**: Users see accurate, real-time deposit status and actionable error messages throughout the flow
**Depends on**: Phase 2
**Requirements**: LIFE-02, UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. The "Fulfilling buy request" state shows a meaningful status (e.g. "Waiting for keeper to execute") rather than an infinite spinner
  2. When a deposit fails, the error message explains what happened and what the user can do next
  3. A deposit that sits pending for too long displays a warning with an option to cancel
  4. Deposit status transitions (pending → executing → complete/failed/expired) are reflected in the UI without a page refresh
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md -- Keeper deposit status API endpoint with CORS
- [x] 03-02-PLAN.md -- Enhanced GmStatusNotification with elapsed time, timeout warnings, cancel button, and error messages

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Execution | 2/2 | Complete   | 2026-02-21 |
| 2. Keeper Resilience | 2/2 | Complete | 2026-02-20 |
| 3. UI Feedback | 2/2 | Complete | 2026-02-20 |
