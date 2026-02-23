# Phase 7: Public Deployment - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the 0xMarkets Interface to Vercel and sync cloud keepers on DigitalOcean with all v1.1 verification fixes. The result: anyone with the URL can access the app and complete the full trading loop without any local services running.

</domain>

<decisions>
## Implementation Decisions

### Frontend config
- Frontend currently points to cloud keeper IP (142.93.203.222) directly for oracle/price data — no domain or proxy
- Keep direct IP for keepers — no DNS setup needed for testnet
- Frontend uses wallet provider for signing, app-configured RPC for chain reads
- User needs to set up an Alchemy/Infura API key for Base Sepolia before deploy — task should include this as a prerequisite step

### Keeper sync
- User manages keepers on DO directly via SSH (not Michael Wallert — correction from PROJECT.md)
- Server runs Docker images built from repo via Dockerfile
- Current deploy flow: manual SSH → git pull → docker compose up --build → restart
- CI pipeline desired but deferred — manual deploy for Phase 7, CI as future improvement
- Files to sync: PythLazer address, orderExecutor token fix, scanner retry for FAILED orders, REQUEST_EXPIRATION_TIME update

### Environment split
- Local dev already points to cloud keeper IP (not localhost)
- Use Vercel environment variables for production config (keeper URL, RPC endpoint) — not hardcoded
- User has a custom domain registered and ready to point at Vercel deploy
- Domain setup is part of this phase

### Verification plan
- User verifies full trading loop first: deposit → open position → close position → withdraw — all via cloud keepers from the public URL
- Then a fresh user tests the same flow cold
- Full trading loop is the minimum bar for shipping this phase
- Testnet fund onboarding for fresh user will be figured out separately
- If keepers are down: show a banner ("System maintenance" or "Keepers offline") but let users browse the app

### Claude's Discretion
- Vercel project configuration details (build settings, framework preset)
- How to structure environment variables (naming convention, grouping)
- Docker compose rebuild sequence on DO server
- Banner implementation approach for keeper-down state

</decisions>

<specifics>
## Specific Ideas

- PROJECT.md incorrectly states Michael Wallert manages keepers — user manages them directly. Update PROJECT.md.
- Keeper deploy is: SSH to 142.93.203.222 → git pull in /opt/0xmarkets/ → docker compose up --build
- Custom domain already registered — connect to Vercel during deployment

</specifics>

<deferred>
## Deferred Ideas

- CI/CD pipeline for keeper deployments — user wants this but after manual deploy works
- Keeper domain name (keeper.0xmarkets.xyz or similar) — keeping direct IP for now
- Testnet faucet or onboarding flow for fresh users — solve when testing with others

</deferred>

---

*Phase: 07-public-deployment*
*Context gathered: 2026-02-22*
