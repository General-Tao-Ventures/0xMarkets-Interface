# Phase 17: Deploy and Verify - Research

**Researched:** 2026-02-26
**Domain:** Docker Compose deployment, environment configuration, end-to-end verification on live chain
**Confidence:** HIGH

## Summary

Phase 17 is a deployment and verification phase -- no new application code is needed. The keeper service was fully implemented in Phases 15-16 and compiles cleanly (`pnpm build` produces 9 JS files in `dist/`). The work is: (1) update the DigitalOcean droplet's `docker-compose.yml` to match the rewritten keeper's simplified environment (no Postgres, no Prisma, new `WS_RPC_URL` env var), (2) rsync the new source to the droplet, (3) rebuild and start the container, and (4) verify deposits, withdrawals, and orders execute end-to-end via the frontend.

The deployment infrastructure is already established: a DigitalOcean droplet at 142.93.203.222 with Docker Compose, rsync-based deployment (no git on the droplet), and BetterStack monitoring already configured for the health endpoint at port 37018. The key challenge is that the `docker-compose.yml` on the droplet was written for the old 3,000-line keeper and includes environment variables and dependencies (Postgres, DATABASE_URL, ORACLE_MODE, feature flags) that the rewritten keeper does not use. Conversely, the rewritten keeper requires `WS_RPC_URL` (for the event watcher's WebSocket transport), which the old docker-compose.yml does not provide.

**Primary recommendation:** Update the docker-compose.yml locally, rsync it along with the keeper source, add WS_RPC_URL to the droplet's `.env`, then rebuild and restart. Verify each operation type (deposit, withdrawal, order) one at a time via the frontend, checking keeper logs after each.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | Deployed to DigitalOcean droplet (142.93.203.222) via Docker Compose | Update docker-compose.yml to remove Postgres dependency and old env vars, add WS_RPC_URL; rsync source; rebuild container; BetterStack monitoring already configured at port 37018 |
| DEPLOY-02 | End-to-end deposit executes successfully on a live market | Submit deposit via frontend, verify keeper logs show "tx confirmed" with deposit key, verify user sees GM tokens appear in wallet |
| DEPLOY-03 | End-to-end withdrawal executes successfully | Submit withdrawal via frontend, verify keeper logs show execution, verify user receives collateral back |
| DEPLOY-04 | End-to-end order executes successfully | Submit market order via frontend, verify keeper logs show execution, verify position opens/closes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Docker Compose | v2 (on droplet) | Multi-container orchestration | Already installed on DO droplet; standard for this project |
| rsync | system | File transfer to droplet | Already established deployment pattern (see DEPLOYMENT.md) |
| ssh | system | Remote command execution | Standard access to DO droplet |
| curl | system | Health endpoint verification | Installed in the keeper Dockerfile for HEALTHCHECK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| docker compose logs | built-in | View keeper output | Verifying execution after each operation |
| BetterStack | free tier | Uptime monitoring | Already configured for both keeper endpoints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rsync + rebuild on droplet | Pre-build Docker image locally and push | Avoids slow builds on 1-vCPU droplet, but requires Docker registry setup -- overkill for testnet |
| Manual verification via frontend | Automated test scripts | Would require building a test harness with viem + contract calls -- not worth it for 3 one-time verification checks |

**Installation:**
```bash
# No new installation needed -- all tools already available
```

## Architecture Patterns

### Recommended Deployment Flow
```
Local machine                         DO Droplet (142.93.203.222)
─────────────                         ──────────────────────────
1. Update docker-compose.yml    ──>   rsync to /opt/0xmarkets/
2. rsync keeper source          ──>   /opt/0xmarkets/order-execution-keeper-service/
3. SSH: docker compose build    ──>   Builds new image (~5-10 min on 1 vCPU)
4. SSH: docker compose up -d    ──>   Starts new container
5. SSH: docker compose logs     ──>   Verify startup sequence
6. curl health endpoint         ──>   Verify /health returns "ok"
7. Frontend: submit operations  ──>   Verify end-to-end execution
```

### Pattern 1: Docker Compose Environment Delta

**What:** The docker-compose.yml `order-execution-keeper` service needs its environment block updated to match the rewritten keeper's `config.ts` requirements.

**Current (old) environment variables in docker-compose.yml:**
```yaml
# REMOVE these -- rewritten keeper does not use:
DATABASE_URL: postgresql://...          # No database
PYTH_HERMES_ENDPOINT: "..."            # Lazer only, no Hermes
ORACLE_MODE: ${ORACLE_MODE:-hermes}    # Not configurable, always Lazer
SCAN_INTERVAL_SECONDS: "10"            # Not configurable, hardcoded 15s
ENABLE_DEPOSITS: "true"                # No feature flags
ENABLE_WITHDRAWALS: "true"             # No feature flags
ENABLE_ORDERS: "true"                  # No feature flags
ENABLE_ADL: "false"                    # No ADL support
ADL_HANDLER_ADDRESS: "0x..."           # No ADL support
```

**Add these -- required by rewritten keeper:**
```yaml
WS_RPC_URL: ${WS_RPC_URL}             # WebSocket RPC for event watcher
```

**Keep these -- still required:**
```yaml
RPC_URL: ${RPC_URL:-https://sepolia.base.org}
PRIVATE_KEY: ${PRIVATE_KEY}
DATA_STORE_ADDRESS: "0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E"
READER_ADDRESS: "0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c"
EVENT_EMITTER_ADDRESS: "0x1E4cBc2ea12B190D6222D568151b5e708e1477F8"
DEPOSIT_HANDLER_ADDRESS: "0x9388B07f807eB870aD36d350d80DC0c214a7f04f"
WITHDRAWAL_HANDLER_ADDRESS: "0x7aAF500d8C737076480914342F2904378fbb21B9"
ORDER_HANDLER_ADDRESS: "0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1"
PYTH_LAZER_FEED_PROVIDER_ADDRESS: "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05"
PYTH_PRO_ACCESS_TOKEN: ${PYTH_PRO_ACCESS_TOKEN}
CHAIN_ID: "84532"
```

**Optional (falls back gracefully):**
```yaml
FLASHBLOCKS_RPC_URL: ${FLASHBLOCKS_RPC_URL:-}   # Optional, code reads but doesn't require
PORT: "37018"                                      # Defaults to 37018 in code
```

### Pattern 2: Postgres Dependency Removal

**What:** The rewritten keeper has zero database dependencies. The `depends_on: postgres` block must be removed from the order-execution-keeper service. However, `keeper-service` (port 37017, price feeds) still uses Postgres, so the postgres service itself stays in docker-compose.yml.

**Before:**
```yaml
order-execution-keeper:
  build: ./order-execution-keeper-service
  restart: unless-stopped
  depends_on:
    postgres:
      condition: service_healthy
```

**After:**
```yaml
order-execution-keeper:
  build: ./order-execution-keeper-service
  restart: unless-stopped
```

### Pattern 3: Verification Sequence

**What:** Verify each operation type sequentially, checking keeper logs after each. Order matters: deposits first (simplest), then withdrawals (requires a deposited position), then orders (requires liquidity).

**Verification checklist:**
```bash
# 1. Check keeper is running and healthy
curl http://142.93.203.222:37018/health
# Expected: {"status":"ok","uptime":...,"queueLength":0,"keeperAddress":"0x48Cb..."}

# 2. After submitting deposit via frontend:
ssh root@142.93.203.222 "cd /opt/0xmarkets && docker compose logs --tail 20 order-execution-keeper"
# Expected: "enqueued" log, then "tx confirmed" with deposit key

# 3. After submitting withdrawal via frontend:
# Same pattern -- check logs for "tx confirmed" with withdrawal key

# 4. After submitting market order via frontend:
# Same pattern -- check logs for "tx confirmed" with order key
```

### Anti-Patterns to Avoid
- **Syncing .env to droplet:** The rsync command excludes `.env` by design. The droplet's `.env` has production credentials -- never overwrite it from local.
- **Rebuilding without --no-cache:** The Docker cache may serve stale layers if source files changed. Always use `docker compose build --no-cache` for the order-execution-keeper.
- **Starting keeper before oracle is ready:** The keeper's startup sequence gates on all 7 token prices being cached (30s timeout). If the Pyth Lazer WebSocket can't connect, the container will exit. Check `PYTH_PRO_ACCESS_TOKEN` in the droplet's `.env`.
- **Forgetting WS_RPC_URL:** The new keeper will fail at startup with "FATAL: Missing required environment variable: WS_RPC_URL" if this is not in the droplet's `.env`. This is the #1 deployment pitfall.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Container health monitoring | Custom health scripts | Docker HEALTHCHECK + BetterStack | Already configured; HEALTHCHECK restarts unhealthy containers, BetterStack alerts humans |
| Log aggregation | Custom log shipping | `docker compose logs` | Testnet volume is low; structured JSON from pino is readable in raw log output |
| Deployment automation | CI/CD pipeline | rsync + SSH (per DEPLOYMENT.md) | Established pattern; single deployment to a single droplet doesn't need CI/CD overhead |

**Key insight:** This phase has zero application code changes. The entire effort is operational: update config, deploy, verify. The risk is in environment configuration, not in software.

## Common Pitfalls

### Pitfall 1: Missing WS_RPC_URL on Droplet
**What goes wrong:** The rewritten keeper requires `WS_RPC_URL` for the WebSocket event watcher (`watcher.ts`), but the old docker-compose.yml and the droplet's `.env` don't have it. The keeper crashes on startup: `FATAL: Missing required environment variable: WS_RPC_URL`.
**Why it happens:** The old keeper used HTTP polling only. The rewritten keeper uses WebSocket for real-time event detection (DET-01).
**How to avoid:** Add `WS_RPC_URL` to both docker-compose.yml (environment block) and the droplet's `/opt/0xmarkets/.env`. The local `.env` has `wss://base-sepolia.core.chainstack.com/eb2a709e3101b602a19c3bebf81d1124` -- use this same value on the droplet.
**Warning signs:** Container exits immediately with "FATAL: Missing required environment variable: WS_RPC_URL" in logs.

### Pitfall 2: Stale Docker Build Cache
**What goes wrong:** Docker caches the `pnpm install` layer. If `package.json` or `pnpm-lock.yaml` didn't change (they didn't in Phase 16 -- only `src/` files changed), Docker reuses the old node_modules. This is fine for dependencies, but if the build layer (`COPY . .`) is also cached, old source code is used.
**Why it happens:** Docker layer caching. The `COPY . .` command fingerprints all files -- if any file changed, the layer is invalidated. But network issues or Docker bugs can sometimes serve stale layers.
**How to avoid:** Always use `docker compose build --no-cache order-execution-keeper` on first deploy of rewritten code. After that, normal builds are fine.
**Warning signs:** Keeper starts but shows old behavior (e.g., Prisma migration errors, database connection errors).

### Pitfall 3: Old Postgres Dependency Blocking Startup
**What goes wrong:** If docker-compose.yml still has `depends_on: postgres: condition: service_healthy` for the order-execution-keeper, and Postgres is down or unhealthy, the keeper container won't start -- even though it doesn't use Postgres at all.
**Why it happens:** The old keeper used Prisma + Postgres. The docker-compose.yml dependency was correct then but is now stale.
**How to avoid:** Remove the `depends_on` block from the order-execution-keeper service in docker-compose.yml.
**Warning signs:** `docker ps` shows order-execution-keeper as "waiting" while postgres is "unhealthy".

### Pitfall 4: Slow Builds on 1-vCPU Droplet
**What goes wrong:** The `pnpm build` step (TypeScript compilation) takes 5-10 minutes on the 1-vCPU droplet. SSH sessions may become unresponsive or time out.
**Why it happens:** TypeScript compiler is CPU-intensive. The droplet has only 1 vCPU and 2GB RAM.
**How to avoid:** Run the build command via `docker compose build --no-cache order-execution-keeper` in a tmux/screen session, or use `nohup` with output redirect. Alternatively, accept the wait and don't close the SSH session.
**Warning signs:** SSH becomes sluggish during build; build takes >10 minutes.

### Pitfall 5: Keeper Wallet Nonce Conflict with Stopped Container
**What goes wrong:** The additional context notes that the old container `0xmarkets-order-execution-keeper-1` was stopped (not removed). If it somehow restarts (e.g., `restart: unless-stopped` policy), two keepers could be running with the same wallet, causing nonce conflicts.
**Why it happens:** Docker's `restart: unless-stopped` policy means a stopped container restarts if the Docker daemon restarts.
**How to avoid:** Before deploying, explicitly remove the old container: `docker compose down order-execution-keeper` (not just stop). The new `docker compose up -d` will create a fresh container.
**Warning signs:** "nonce too low" errors in keeper logs; duplicate transaction errors.

### Pitfall 6: Pyth Lazer WebSocket Blocked by Firewall
**What goes wrong:** The Pyth Lazer SDK connects to `wss://pyth-lazer.dourolabs.app/v1/stream` (or similar). If the droplet's firewall blocks outbound WebSocket connections on port 443, the oracle cache never populates and the keeper exits after the 30s startup timeout.
**Why it happens:** Some cloud providers have restrictive outbound firewall rules by default.
**How to avoid:** DigitalOcean droplets allow all outbound traffic by default. This is unlikely to be an issue, but if the oracle startup times out, check `ufw status` on the droplet.
**Warning signs:** Keeper logs show "oracle startup timeout -- not all token prices received" with 0 cached tokens.

## Code Examples

No new application code is needed for this phase. All examples below are operational commands.

### Updated docker-compose.yml order-execution-keeper Service
```yaml
# Source: derived from current docker-compose.yml + rewritten keeper's config.ts
order-execution-keeper:
  build: ./order-execution-keeper-service
  restart: unless-stopped
  # NOTE: No depends_on postgres -- rewritten keeper has zero DB dependencies
  ports:
    - "0.0.0.0:37018:37018"
  environment:
    RPC_URL: ${RPC_URL:-https://sepolia.base.org}
    WS_RPC_URL: ${WS_RPC_URL}
    CHAIN_ID: "84532"
    PRIVATE_KEY: ${PRIVATE_KEY:?Set PRIVATE_KEY in .env}
    DATA_STORE_ADDRESS: "0xBaD049d5FedE7Bd9022F7E750B982349fE17e83E"
    READER_ADDRESS: "0xb53122a72ceA22F71Cf75dc70A2Ed2526246253c"
    EVENT_EMITTER_ADDRESS: "0x1E4cBc2ea12B190D6222D568151b5e708e1477F8"
    DEPOSIT_HANDLER_ADDRESS: "0x9388B07f807eB870aD36d350d80DC0c214a7f04f"
    WITHDRAWAL_HANDLER_ADDRESS: "0x7aAF500d8C737076480914342F2904378fbb21B9"
    ORDER_HANDLER_ADDRESS: "0x6d299Cdf1C710ad87E8D38f50c14D95D7ed67dE1"
    PYTH_LAZER_FEED_PROVIDER_ADDRESS: "0x8a3eb351aDb32A813FCb53C418E8E09dd39E2D05"
    PYTH_PRO_ACCESS_TOKEN: ${PYTH_PRO_ACCESS_TOKEN}
    PORT: "37018"
```

### Deployment Commands
```bash
# Source: adapted from DEPLOYMENT.md with updates for rewritten keeper

# 1. Rsync docker-compose.yml and keeper source to droplet
rsync -avz --delete \
  --exclude='node_modules' --exclude='dist' --exclude='.env' --exclude='.git' --exclude='*.log' \
  /Users/ken/Projects/0xM/order-execution-keeper-service/ \
  root@142.93.203.222:/opt/0xmarkets/order-execution-keeper-service/

rsync -avz \
  /Users/ken/Projects/0xM/docker-compose.yml \
  root@142.93.203.222:/opt/0xmarkets/docker-compose.yml

# 2. SSH to droplet, add WS_RPC_URL to .env if not present
ssh root@142.93.203.222 'grep -q WS_RPC_URL /opt/0xmarkets/.env || echo "WS_RPC_URL=wss://base-sepolia.core.chainstack.com/eb2a709e3101b602a19c3bebf81d1124" >> /opt/0xmarkets/.env'

# 3. Remove old container and rebuild
ssh root@142.93.203.222 'cd /opt/0xmarkets && docker compose down order-execution-keeper && docker compose build --no-cache order-execution-keeper && docker compose up -d order-execution-keeper'

# 4. Verify startup
ssh root@142.93.203.222 'cd /opt/0xmarkets && docker compose logs --tail 30 order-execution-keeper'

# 5. Check health
curl http://142.93.203.222:37018/health
```

### Expected Healthy Startup Log Sequence
```json
{"level":30,"name":"order-keeper","msg":"starting order-execution-keeper","chainId":84532,"tokenCount":7}
{"level":30,"name":"oracle","msg":"oracle started","cachedTokens":7}
{"level":30,"name":"order-keeper","msg":"oracle cache populated -- ready","cachedTokens":7}
{"level":30,"name":"poller","msg":"polled DataStore lists","deposits":0,"withdrawals":0,"orders":0}
{"level":30,"name":"watcher","msg":"event watcher started"}
{"level":30,"name":"executor","msg":"executor started"}
{"level":30,"name":"health","msg":"health server listening","port":37018}
```

### Expected Health Response
```json
{
  "status": "ok",
  "uptime": 42,
  "queueLength": 0,
  "seenCount": 0,
  "keeperAddress": "0x48Cb0d738C9B3F44F60f7338F788fa093FD25828",
  "oracleStale": false,
  "cachedTokenCount": 7
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| docker-compose with Postgres + Prisma migrations | docker-compose without Postgres (order-execution-keeper only) | v1.5 Phase 15-16 rewrite | Simpler startup, no DB dependency, faster container start |
| HTTP-only polling (no WebSocket RPC) | WebSocket event watcher + HTTP polling safety net | v1.5 Phase 16 | Requires WS_RPC_URL env var -- new requirement |
| Feature flags per operation type | All operations always enabled | v1.5 rewrite | Fewer env vars to configure |
| ORACLE_MODE configurable (hermes/lazer/both) | Always Lazer (hardcoded) | v1.5 Phase 15 | No ORACLE_MODE env var needed |

**Deprecated/outdated:**
- DATABASE_URL: No database in rewritten keeper
- ORACLE_MODE: Always Lazer, not configurable
- ENABLE_DEPOSITS/WITHDRAWALS/ORDERS/ADL: No feature flags
- ADL_HANDLER_ADDRESS: ADL not supported in v1.5
- PYTH_HERMES_ENDPOINT: Hermes not used
- SCAN_INTERVAL_SECONDS: Hardcoded 15s poller, not configurable
- MAX_REQUESTS_PER_SCAN: No scan batching

## Open Questions

1. **Chainstack WebSocket reliability from DO nyc1**
   - What we know: The local `.env` uses `wss://base-sepolia.core.chainstack.com/eb2a709e3101b602a19c3bebf81d1124` for WebSocket RPC. The keeper's watcher uses this for real-time event detection.
   - What's unclear: Whether this Chainstack WebSocket endpoint is reliable from the DigitalOcean nyc1 region, or if it has rate limits that would cause frequent disconnects.
   - Recommendation: Use the same endpoint. If disconnects are frequent, viem's WebSocket transport auto-reconnects with exponential backoff (configured as `reconnect: { attempts: Infinity, delay: 1_000 }`). The 15s poller safety net catches any events missed during reconnection. If Chainstack proves unreliable, consider switching to Alchemy or QuickNode WebSocket endpoints.

2. **Droplet .env completeness for new keeper**
   - What we know: The droplet's `.env` at `/opt/0xmarkets/.env` was configured for the old keeper. It definitely has `PRIVATE_KEY`, `RPC_URL`, `PYTH_PRO_ACCESS_TOKEN`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
   - What's unclear: Whether it has all contract addresses or relies on the docker-compose.yml environment block to provide them (which it does -- contract addresses are hardcoded in docker-compose.yml, not in `.env`).
   - Recommendation: Contract addresses are in docker-compose.yml environment block (not `.env`). Only `WS_RPC_URL` needs to be added to `.env`. Verify by SSHing to the droplet and checking: `cat /opt/0xmarkets/.env`.

3. **Old container cleanup**
   - What we know: The additional context states the container `0xmarkets-order-execution-keeper-1` was stopped, not removed. The `restart: unless-stopped` policy means it could restart if Docker daemon restarts.
   - What's unclear: Whether `docker compose down order-execution-keeper` will properly remove the old container before the new one is created with `docker compose up -d`.
   - Recommendation: Use `docker compose down order-execution-keeper` followed by `docker compose up -d order-execution-keeper`. The `down` command removes the container (not just stops it). Verify with `docker ps -a` after the down command.

## Sources

### Primary (HIGH confidence)
- `/Users/ken/Projects/0xM/DEPLOYMENT.md` -- Established deployment workflow: rsync + SSH + docker compose rebuild
- `/Users/ken/Projects/0xM/docker-compose.yml` -- Current docker-compose configuration with old environment variables
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/config.ts` -- Definitive list of required environment variables for the rewritten keeper
- `/Users/ken/Projects/0xM/order-execution-keeper-service/Dockerfile` -- Multi-stage Docker build, HEALTHCHECK on port 37018
- `/Users/ken/Projects/0xM/order-execution-keeper-service/src/index.ts` -- Startup sequence: oracle -> executor -> poll -> watcher -> health
- Phase 8 summaries (08-02, 08-03) -- BetterStack monitoring already configured for both endpoints

### Secondary (MEDIUM confidence)
- `/Users/ken/Projects/0xM/.env.production.example` -- Template for droplet `.env` (may be outdated for rewritten keeper)
- Additional context from user -- Container stop/start state, orphaned local process cleanup

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- deployment infrastructure is fully established (DEPLOYMENT.md, docker-compose.yml, rsync workflow, BetterStack monitoring); no new tools needed
- Architecture: HIGH -- the deployment pattern is documented and has been used for every previous deployment; only the docker-compose.yml environment block needs updating
- Pitfalls: HIGH -- all pitfalls derived from direct comparison of old docker-compose.yml environment vs new config.ts requirements; the WS_RPC_URL gap is a concrete finding, not speculation

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- infrastructure changes rarely)
