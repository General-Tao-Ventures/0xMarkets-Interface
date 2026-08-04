import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const orderKeeperUrl = process.env.ORDER_KEEPER_URL;
  if (!orderKeeperUrl) {
    return res.status(500).json({ error: "ORDER_KEEPER_URL is not configured" });
  }

  const pathStr = (req.query._path as string) || "";

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key === "_path") continue;
    if (Array.isArray(val)) {
      val.forEach((v) => params.append(key, v));
    } else if (val !== undefined) {
      params.append(key, val);
    }
  }

  const target = new URL(`/${pathStr}`, orderKeeperUrl);
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
    res.status(502).json({ error: "Failed to proxy to order-keeper service" });
  }
}
