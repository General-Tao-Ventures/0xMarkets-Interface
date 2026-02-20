# Phase 1: Core Execution - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the order-execution-keeper successfully execute a fresh deposit end-to-end: user's createDeposit tx mines on Base Sepolia → keeper detects it → pushes Pyth Lazer prices on-chain → calls executeDeposit → user receives GM tokens. This phase is about making the happy path work — retry logic, expiry handling, and UI feedback are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Debugging approach
- Check keeper Docker logs on DO server for error messages from recent failures
- Create a standalone test deposit script using viem that can submit createDeposit programmatically (no dependency on Interface UI or user being present)
- Use small mUSDC deposit amount (e.g. 1 mUSDC) into ETH/USD pool for testing
- User will provide their private key for the test script
- Claude decides whether to keep the test script as a reusable tool or throw it away
- Edit code locally in the repo, then deploy to DO server via SSH + Docker rebuild — clean git history

### Execution timing
- Target: deposit executes within 2 minutes of mining on-chain
- Keep current 10-second scan interval — adequate for testnet
- Block until done: process one deposit at a time sequentially, don't queue

### Oracle price flow
- Push prices immediately before each executeDeposit call (current approach — no continuous background updates)
- Verify BOTH price update tx receipts (WETH index token + USDC collateral) landed on-chain before calling executeDeposit
- Claude decides WebSocket disconnect behavior (safer option)

### Verification method
- Verify BOTH: tx receipt status + event logs AND GM token balance change on user's wallet
- Test script should output a full step-by-step report: deposit created → prices pushed → execution tx → GM balance before/after
- Keeper should log successful executions with full details: tx hash, GM tokens minted, time from detection to completion

### Claude's Discretion
- Whether to keep the test deposit script as a permanent tool or discard after debugging
- WebSocket disconnect handling during deposit processing (pick the safer option)
- Exact error handling approach for price push failures

</decisions>

<specifics>
## Specific Ideas

- User may not be around during testing — the test script must work autonomously
- Previous session deployed multiple fixes (nonce management, WebSocket init, index token pricing, fail-fast gas estimation) that are already on the DO server — these may or may not be working
- Last known error was OracleTimestampsAreLargerThanRequestExpirationTime which was deposit expiry, not a code bug
- Keeper wallet: 0x48Cb0d738C9B3F44F60f7338F788fa093FD25828
- DO server: 142.93.203.222 (SSH as root with ~/.ssh/id_ed25519_work)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-execution*
*Context gathered: 2026-02-20*
