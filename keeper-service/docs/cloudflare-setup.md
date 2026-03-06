# Cloudflare TLS Proxy Setup for Keeper Service

This guide configures Cloudflare to proxy HTTPS/WSS traffic to the keeper-service running on the DigitalOcean droplet. Cloudflare handles TLS termination at the edge, so no certificates need to be installed on the droplet.

**Result:** `https://keeper.0xmarkets.io` and `wss://keeper.0xmarkets.io` route securely to `142.93.203.222:37017`.

---

## 1. DNS Record

Create a proxied A record in the Cloudflare dashboard.

**Location:** Cloudflare Dashboard > 0xmarkets.io > DNS > Records > Add Record

| Field        | Value               |
|--------------|---------------------|
| Type         | A                   |
| Name         | keeper              |
| IPv4 address | 142.93.203.222      |
| Proxy status | Proxied (orange cloud ON) |
| TTL          | Auto                |

The orange cloud (proxy enabled) is critical -- it tells Cloudflare to terminate TLS and proxy the connection rather than just resolving DNS.

---

## 2. Origin Rule

Create an Origin Rule so Cloudflare forwards traffic to the correct port on the droplet. By default, Cloudflare connects to port 80 (HTTP) or 443 (HTTPS) on the origin. The keeper runs on port 37017, so we need a port override.

**Location:** Cloudflare Dashboard > 0xmarkets.io > Rules > Origin Rules > Create Rule

| Field              | Value                                          |
|--------------------|-------------------------------------------------|
| Rule name          | Route keeper subdomain to origin port 37017     |
| When (field)       | Hostname                                        |
| When (operator)    | equals                                          |
| When (value)       | keeper.0xmarkets.io                             |
| Then (action)      | Destination Port > Override to                  |
| Then (port)        | 37017                                           |

Save and deploy the rule.

---

## 3. SSL/TLS Mode

The SSL/TLS mode determines how Cloudflare connects to the origin (droplet).

**Location:** Cloudflare Dashboard > 0xmarkets.io > SSL/TLS > Overview

### Recommended: Flexible

Set the zone SSL/TLS encryption mode to **Flexible**.

- **Flexible:** Cloudflare terminates TLS at the edge and connects to the origin over plain HTTP. No certificate needed on the droplet.
- **Full:** Cloudflare connects to the origin over HTTPS, requiring a certificate on the droplet. More secure but more complex.
- **Full (Strict):** Like Full, but requires a valid CA-signed or Cloudflare Origin Certificate. Will fail without one.

For a testnet keeper with no sensitive data, **Flexible** is the simplest option. It provides browser-to-Cloudflare encryption (HTTPS/WSS) without any cert management on the droplet.

> **Note:** If other subdomains on 0xmarkets.io require Full/Strict, you can use a **Configuration Rule** scoped to `keeper.0xmarkets.io` to override the SSL mode to Flexible for just this subdomain. Location: Cloudflare Dashboard > 0xmarkets.io > Rules > Configuration Rules.

---

## 4. Docker Port Binding

The keeper's Docker container must bind port 37017 to all interfaces (`0.0.0.0`), not just localhost.

**Check current binding:**

```bash
ssh root@142.93.203.222
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep keeper
```

**Expected output:**
```
keeper-service   0.0.0.0:37017->37017/tcp
```

**If bound to 127.0.0.1** (e.g., `127.0.0.1:37017->37017/tcp`):

Edit the docker-compose.yml on the droplet:

```yaml
# Change this:
ports:
  - "127.0.0.1:37017:37017"

# To this:
ports:
  - "37017:37017"    # Binds to 0.0.0.0 by default
```

Then restart:
```bash
docker compose up -d
```

---

## 5. WebSocket Support

Cloudflare proxies WebSocket connections natively on all plans (including Free). No additional WebSocket configuration is needed in the Cloudflare dashboard.

**Key details:**
- WebSocket upgrade requests are automatically forwarded to the origin
- Cloudflare has a **100-second idle timeout** for WebSocket connections -- if no data flows for 100 seconds, the connection is dropped
- The keeper must implement keepalive pings to prevent idle disconnection (handled in Phase 41)
- Enterprise plans allow configuring longer timeouts, but keepalive pings are the standard approach

---

## Verification

After completing steps 1-4, verify the setup:

### DNS Resolution

```bash
dig keeper.0xmarkets.io +short
```

Should return **Cloudflare IP addresses** (e.g., `104.x.x.x`, `172.x.x.x`), NOT the droplet IP `142.93.203.222`. If you see the droplet IP, the proxy (orange cloud) is not enabled.

### HTTPS Health Check

```bash
curl -s https://keeper.0xmarkets.io/health | jq .
```

Should return the keeper's health JSON response. If you get a connection error, check:
1. DNS record exists and is proxied
2. Origin Rule is deployed
3. Docker port is bound to 0.0.0.0
4. UFW/iptables on the droplet allows port 37017

### WebSocket TLS Handshake

```bash
wscat -c wss://keeper.0xmarkets.io
```

The TLS handshake should succeed. The connection may close immediately (no WebSocket handler exists yet -- that comes in Phase 41), but the TLS layer is confirmed working if you get past the handshake.

### Browser Console Test

Open browser DevTools console on the deployed frontend:

```javascript
fetch('https://keeper.0xmarkets.io/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

Should return health JSON without mixed-content errors.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `dig` returns droplet IP directly | DNS proxy not enabled | Toggle orange cloud ON in DNS record |
| `curl` returns 521 (Web server is down) | Cloudflare can't reach origin | Check Docker port binding, firewall rules |
| `curl` returns 525 (SSL handshake failed) | SSL mode is Full/Strict but no origin cert | Set SSL mode to Flexible |
| `curl` returns 522 (Connection timed out) | Firewall blocking Cloudflare IPs | Allow Cloudflare IP ranges in UFW |
| Browser mixed-content error | Frontend using `http://` instead of `https://` | Update keeper URL in frontend config |
