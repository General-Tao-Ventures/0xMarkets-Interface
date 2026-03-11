import type { VercelRequest, VercelResponse } from "@vercel/node";

const KEEPER_URL = process.env.KEEPER_URL || "http://142.93.203.222:37017";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathStr = (req.query._path as string) || "";

  // Rebuild query string excluding the internal _path param
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key === "_path") continue;
    if (Array.isArray(val)) {
      val.forEach((v) => params.append(key, v));
    } else if (val !== undefined) {
      params.append(key, val);
    }
  }

  const target = new URL(`/${pathStr}`, KEEPER_URL);
  target.search = params.toString();

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
  } catch (error) {
    res.status(502).json({ error: "Failed to proxy to keeper service" });
  }
}
