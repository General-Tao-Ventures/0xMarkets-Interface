import type { VercelRequest, VercelResponse } from "@vercel/node";

import { authenticate, findContact } from "../_lib/auth";
import { verifyChallenge } from "../_lib/channels";
import { applyCommonHeaders, badRequest, methodNotAllowed, readBody, serverError } from "../_lib/http";

const REASONS: Record<string, string> = {
  none: "Start a verification first.",
  expired: "That code expired. Send a new one.",
  attempts: "Too many wrong codes. Start again.",
  mismatch: "That code is not right.",
};

/** POST /api/partner/contact-verify — finish verifying the channel started earlier. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const address = authenticate(req);
  if (!address) return res.status(401).json({ error: "Sign in with your wallet first." });

  const { code } = readBody(req);
  if (typeof code !== "string" || !code.trim()) return badRequest(res, "Enter the code you were sent.");

  try {
    const result = await verifyChallenge(address, code);
    if (!result.ok) return res.status(400).json({ error: REASONS[result.reason] });

    const row = await findContact(address);
    return res.status(200).json({
      address,
      name: row?.name ?? null,
      channel: result.channel,
      handle: result.handle,
      verified: true,
      verifiedAt: row?.verified_at?.toISOString() ?? new Date().toISOString(),
    });
  } catch (error) {
    return serverError(res, "contact-verify", error);
  }
}
