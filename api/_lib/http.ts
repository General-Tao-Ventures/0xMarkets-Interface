import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Same-origin only: these endpoints are called by the app itself, never cross-site. */
export function applyCommonHeaders(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({ error: "Method not allowed" });
}

export function badRequest(res: VercelResponse, message: string) {
  return res.status(400).json({ error: message });
}

/**
 * Never leak a driver error to the client — a Postgres message can name tables and columns. Log it
 * for the server operator, return a flat 500.
 */
export function serverError(res: VercelResponse, context: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[partner-api] ${context}`, error);
  return res.status(500).json({ error: "Something went wrong. Try again." });
}

export function readBody(req: VercelRequest): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body as Record<string, unknown>;
}
