import type { VercelRequest, VercelResponse } from "@vercel/node";

const SQUID_URL = process.env.SQUID_URL || "http://34.10.239.169:4350";

/** Only allow simple relative path segments under the configured Squid origin. */
function buildSafeTarget(baseUrl: string, pathStr: string, search: string): URL | null {
  const base = new URL(baseUrl);
  const cleaned = (pathStr || "graphql").replace(/^\/+/, "").replace(/\\/g, "");

  // Reject absolute / protocol-relative / traversal paths that can override host
  if (
    !cleaned ||
    cleaned.includes("://") ||
    cleaned.startsWith("//") ||
    cleaned.split("/").some((seg) => seg === "..")
  ) {
    return null;
  }

  const target = new URL(cleaned, `${base.origin}${base.pathname.replace(/\/?$/, "/")}`);
  if (target.origin !== base.origin) {
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
