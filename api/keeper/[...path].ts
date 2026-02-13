import type { VercelRequest, VercelResponse } from "@vercel/node";

const KEEPER_URL = "http://142.93.203.222:37017";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;
  const pathStr = Array.isArray(path) ? path.join("/") : path || "";

  const incomingUrl = new URL(req.url!, `https://${req.headers.host}`);
  const target = new URL(`/${pathStr}`, KEEPER_URL);
  target.search = incomingUrl.search;

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
