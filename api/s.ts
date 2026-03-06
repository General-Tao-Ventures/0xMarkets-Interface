import { list } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing id parameter" });
  }

  try {
    const { blobs } = await list({ prefix: `shares/${id}` });

    if (blobs.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    return res.redirect(302, blobs[0].url);
  } catch (error) {
    console.error("Share lookup error:", error);
    return res.status(500).json({ error: "Lookup failed" });
  }
}
