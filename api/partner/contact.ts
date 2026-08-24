import type { VercelRequest, VercelResponse } from "@vercel/node";

import { authenticate, findContact } from "../_lib/auth";
import { query } from "../_lib/db";
import { applyCommonHeaders, badRequest, methodNotAllowed, readBody, serverError } from "../_lib/http";

/**
 * GET  /api/partner/contact — what we hold for the signed-in partner.
 * POST /api/partner/contact — set the display name. Changing it never clears verification, because
 *                             the verified fact is about the channel, not the name.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);

  const address = authenticate(req);
  if (!address) return res.status(401).json({ error: "Sign in with your wallet first." });

  try {
    if (req.method === "POST") {
      const { name } = readBody(req);
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
        return badRequest(res, "Enter a name between 2 and 80 characters.");
      }
      await query(
        `INSERT INTO partner_contact (address, name, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (address) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
        [address, name.trim()]
      );
    }

    const row = await findContact(address);
    return res.status(200).json({
      address,
      name: row?.name ?? null,
      channel: row?.channel ?? null,
      // The handle goes back only to the partner who owns it, and never anywhere else.
      handle: row?.handle ?? null,
      verified: Boolean(row?.verified_at),
      verifiedAt: row?.verified_at?.toISOString() ?? null,
    });
  } catch (error) {
    return serverError(res, "contact", error);
  }
}
