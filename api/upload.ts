import { put } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const dataUrl = await getRawBody(req);

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image data" });
    }

    const base64Data = dataUrl.split(",")[1];
    if (!base64Data) {
      return res.status(400).json({ error: "Invalid base64 data" });
    }

    const buffer = Buffer.from(base64Data, "base64");
    const id = randomUUID();

    const blob = await put(`shares/${id}.png`, buffer, {
      access: "public",
      contentType: "image/png",
    });

    return res.status(200).json({ id, url: blob.url });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
}

function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
