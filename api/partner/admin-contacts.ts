import type { VercelRequest, VercelResponse } from "@vercel/node";

import { authenticate } from "../_lib/auth";
import { query } from "../_lib/db";
import { applyCommonHeaders, methodNotAllowed, serverError } from "../_lib/http";

/**
 * GET /api/partner/admin-contacts — every partner's verified contact, for the admin console.
 *
 * This is the real access control for contact details. The console also gates itself in the
 * browser, but that is convenience: anyone can call this endpoint directly, so the caller's signed
 * session address is re-checked against a server-side allowlist here before a single handle is
 * returned. An unset allowlist denies everyone rather than allowing everyone.
 *
 * `shared` marks a channel that sits behind more than one partner address. Legitimate for a desk
 * running several wallets, so it is reported, never enforced.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const address = authenticate(req);
  if (!address) return res.status(401).json({ error: "Sign in with your wallet first." });

  const allowlist = (process.env.PARTNER_ADMIN_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.includes(address)) {
    // Deliberately identical to the unauthenticated response: do not confirm the endpoint exists
    // to someone probing for it.
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const rows = await query<{
      address: string;
      name: string | null;
      channel: "discord" | "telegram" | "email";
      handle: string;
      verified_at: Date | null;
      shared: boolean;
    }>(
      `SELECT c.address, c.name, c.channel, c.handle, c.verified_at,
              (COUNT(*) OVER (PARTITION BY c.channel, lower(c.handle))) > 1 AS shared
         FROM partner_contact c
        WHERE c.verified_at IS NOT NULL`
    );

    const contacts: Record<string, unknown> = {};
    for (const r of rows) {
      contacts[r.address.toLowerCase()] = {
        channel: r.channel,
        handle: r.handle,
        verifiedAt: r.verified_at?.toISOString() ?? null,
        shared: r.shared,
      };
    }

    return res.status(200).json({ contacts });
  } catch (error) {
    return serverError(res, "admin-contacts", error);
  }
}
