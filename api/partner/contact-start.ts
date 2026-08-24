import type { VercelRequest, VercelResponse } from "@vercel/node";

import { authenticate } from "../_lib/auth";
import { isChannel, normaliseHandle, startChallenge } from "../_lib/channels";
import { applyCommonHeaders, badRequest, methodNotAllowed, readBody, serverError } from "../_lib/http";

/** POST /api/partner/contact-start — begin verifying one channel. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const address = authenticate(req);
  if (!address) return res.status(401).json({ error: "Sign in with your wallet first." });

  const body = readBody(req);
  if (!isChannel(body.channel)) return badRequest(res, "Choose Discord or Telegram.");

  const handle = normaliseHandle(body.channel, body.handle);
  if (!handle) return badRequest(res, "That does not look like a valid contact for this channel.");

  try {
    const challenge = await startChallenge(address, body.channel, handle);

    // A channel with no provider wired up is a 503, not a silent success — the partner would
    // otherwise sit waiting for a message that was never going to arrive.
    if (!challenge.delivery.sent && !challenge.delivery.echoed) {
      return res.status(503).json({ error: challenge.delivery.reason ?? "That channel is unavailable." });
    }

    return res.status(200).json({
      channel: challenge.channel,
      handle: challenge.handle,
      expiresAt: challenge.expiresAt,
      instruction: challenge.delivery.instruction ?? null,
      devCode: challenge.devCode ?? null,
    });
  } catch (error) {
    return serverError(res, "contact-start", error);
  }
}
