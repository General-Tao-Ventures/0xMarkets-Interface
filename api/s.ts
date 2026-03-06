import { list } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id, ref } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing id parameter" });
  }

  try {
    const { blobs } = await list({ prefix: `shares/${id}` });

    if (blobs.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    const imageUrl = blobs[0].url;
    const siteUrl = ref ? `https://0xmarkets.io/#/?ref=${ref}` : "https://0xmarkets.io";

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="0xMarkets Trade" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="533" />
  <meta property="og:image:height" content="300" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="0xMarkets Trade" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta http-equiv="refresh" content="0;url=${siteUrl}" />
</head>
<body>Redirecting to <a href="${siteUrl}">0xMarkets</a>...</body>
</html>`);
  } catch (error) {
    console.error("Share lookup error:", error);
    return res.status(500).json({ error: "Lookup failed" });
  }
}
