import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Self-hosted Base mainnet Squid (GCP). Override via SQUID_URL. */
const DEFAULT_SQUID_URL = "http://34.10.239.169:4350";

// Prefer Vercel/local env; fall back to mainnet Squid so Preview/Prod
// volume/fees/history keep working when SQUID_URL isn't set in the project.
const SQUID_URL = process.env.SQUID_URL || DEFAULT_SQUID_URL;

/** Allowlist only — GraphQL is the sole Squid surface the Interface needs. */
const ALLOWED_PATHS = new Set(["graphql"]);

/**
 * Build a same-origin URL under SQUID_URL.
 * Accepts either host root (`http://host:4350`) or a full GraphQL URL
 * (`http://host:4350/graphql`) without doubling `/graphql`.
 */
function buildSafeTarget(baseUrl: string, pathStr: string, search: string): URL | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathStr || "graphql");
  } catch {
    return null;
  }

  const cleaned = decoded.replace(/^\/+/, "").replace(/\\/g, "").replace(/\/+$/, "");
  if (!ALLOWED_PATHS.has(cleaned)) {
    return null;
  }

  const base = new URL(baseUrl);
  // Strip a trailing /graphql so env can be either root or full GraphQL endpoint
  let basePath = base.pathname.replace(/\/+$/, "") || "";
  if (basePath.endsWith("/graphql")) {
    basePath = basePath.slice(0, -"/graphql".length);
  }

  const target = new URL(`${basePath}/${cleaned}`.replace(/\/{2,}/g, "/"), base.origin);
  if (target.origin !== base.origin) {
    return null;
  }

  const normalizedPath = target.pathname.replace(/\/+$/, "");
  if (!normalizedPath.endsWith(`/${cleaned}`) && normalizedPath !== `/${cleaned}`) {
    return null;
  }

  target.search = search;
  return target;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathStr = (req.query._path as string) || "graphql";

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key === "_path") continue;
    if (Array.isArray(val)) {
      val.forEach((v) => params.append(key, v));
    } else if (val !== undefined) {
      params.append(key, val);
    }
  }

  const target = buildSafeTarget(SQUID_URL, pathStr, params.toString());
  if (!target) {
    return res.status(400).json({ error: "Invalid Squid proxy path" });
  }

  try {
    const response = await fetch(target.toString(), {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const data = await response.text();
    res.status(response.status).send(data);
  } catch {
    res.status(502).json({ error: "Failed to proxy to Squid GraphQL" });
  }
}
