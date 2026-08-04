import type { VercelRequest, VercelResponse } from "@vercel/node";

// Prefer Vercel/local env — no public hostname yet, so fail closed if unset in handlers below.
const SQUID_URL = process.env.SQUID_URL;

/** Allowlist only — GraphQL is the sole Squid surface the Interface needs. */
const ALLOWED_PATHS = new Set(["graphql"]);

function buildSafeTarget(baseUrl: string, pathStr: string, search: string): URL | null {
  const base = new URL(baseUrl);

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

  const target = new URL(cleaned, `${base.origin}${base.pathname.replace(/\/?$/, "/")}`);
  if (target.origin !== base.origin) {
    return null;
  }

  // Final guard: pathname must end with the allowlisted segment (no traversal residue)
  const normalizedPath = target.pathname.replace(/\/+$/, "");
  if (!normalizedPath.endsWith(`/${cleaned}`) && normalizedPath !== `/${cleaned}`) {
    return null;
  }

  target.search = search;
  return target;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SQUID_URL) {
    return res.status(500).json({ error: "SQUID_URL is not configured" });
  }

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
