import type { VercelRequest, VercelResponse } from "@vercel/node";

import { consumeNonce, isAddress, issueSession, loginMessage, recoverSigner } from "../_lib/auth";
import { applyCommonHeaders, badRequest, methodNotAllowed, readBody, serverError } from "../_lib/http";

/**
 * POST /api/partner/session — trade a signed nonce for a session token.
 *
 * The nonce is spent before the signature is checked, so a wrong signature burns the nonce too.
 * That costs an honest partner one extra click and costs an attacker their whole replay window.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCommonHeaders(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const { address, nonce, signature } = readBody(req);
  if (!isAddress(address)) return badRequest(res, "A wallet address is required.");
  if (typeof nonce !== "string" || typeof signature !== "string") {
    return badRequest(res, "A signed nonce is required.");
  }

  try {
    if (!(await consumeNonce(address, nonce))) {
      return res.status(401).json({ error: "That sign-in request expired. Try again." });
    }

    const signer = await recoverSigner(loginMessage(address, nonce), signature);
    if (!signer || signer !== address.toLowerCase()) {
      return res.status(401).json({ error: "That signature does not match this wallet." });
    }

    return res.status(200).json(issueSession(address));
  } catch (error) {
    return serverError(res, "session", error);
  }
}
