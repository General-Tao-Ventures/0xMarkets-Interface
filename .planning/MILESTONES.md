# Milestones

## v1.0 Fix Buy GM Flow (Shipped: 2026-02-21)

**Phases completed:** 3 phases, 6 plans
**Timeline:** 2026-02-20 → 2026-02-21 (1 day)
**Git range:** 840cc6b7c → debc77716 (19 commits)

**Key accomplishments:**
- End-to-end deposit execution working: createDeposit → keeper detects (10s) → prices pushed → executeDeposit (13s) → GM tokens minted
- Ghost deposit guard (CANCELLED vs FAILED) and empty oracle token validation
- Exponential backoff retry (3 attempts) with error classification and Prisma error recording
- On-chain expired deposit cancellation via DepositHandler with CONTROLLER role
- Keeper deposit status API with CORS for frontend consumption
- Enhanced deposit notification UI: elapsed time counter, 60s/120s timeout escalation, cancel button, actionable error messages

---

